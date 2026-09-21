import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  GoogleGenerativeAI,
  type GenerateContentResult,
} from '@google/generative-ai';

/** Primary default — override with GEMINI_MODEL. Prefer stable IDs in production. */
const DEFAULT_MODEL = 'gemini-2.5-flash';
/**
 * Stable fallbacks only (avoid `*-latest` aliases — shared load + churn).
 * Override via GEMINI_FALLBACK_MODELS=model-a,model-b
 */
const DEFAULT_FALLBACK_MODELS = ['gemini-2.0-flash'] as const;
const MAX_ATTEMPTS = 3;

/** Circuit opens after this many overload failures in the window. */
const CIRCUIT_FAILURE_THRESHOLD = 4;
const CIRCUIT_WINDOW_MS = 90_000;
const CIRCUIT_COOLDOWN_MS = 180_000;

/** Public marker for clients — do not localize on the API. */
export const GEMINI_OVERLOAD_CODE = 'AI_OVERLOAD';

export type GeminiGenerateOptions = {
  prompt: string;
  systemInstruction?: string;
  /** Prefer JSON response from the model. */
  json?: boolean;
  temperature?: number;
  model?: string;
};

function isRetryableOverload(message: string): boolean {
  return /high demand|resource.?exhausted|429|503|unavailable|try again|fetch failed|ECONNRESET|ETIMEDOUT|AI_OVERLOAD/i.test(
    message,
  );
}

function backoffMs(attempt: number): number {
  // ~1.2s, ~2.4s, ~4.8s + jitter up to 40%
  const base = Math.round(1200 * Math.pow(2, attempt - 1));
  const jitter = Math.floor(Math.random() * base * 0.4);
  return base + jitter;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

  /** Timestamps of recent overload/transient failures (process-local). */
  private failureTimestamps: number[] = [];
  private circuitOpenUntil = 0;

  private apiKey(): string {
    const key = (process.env.GOOGLE_API_KEY || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (!key) {
      throw new ServiceUnavailableException(
        'Google AI is not configured — set GOOGLE_API_KEY in .env.api and restart the API',
      );
    }
    return key;
  }

  defaultModel(): string {
    return (
      process.env.GEMINI_MODEL?.trim().replace(/^['"]|['"]$/g, '') || DEFAULT_MODEL
    );
  }

  private fallbackModels(): string[] {
    const raw = process.env.GEMINI_FALLBACK_MODELS?.trim();
    if (raw) {
      return raw
        .split(',')
        .map((m) => m.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    }
    return [...DEFAULT_FALLBACK_MODELS];
  }

  private pruneFailures(now: number) {
    this.failureTimestamps = this.failureTimestamps.filter(
      (t) => now - t < CIRCUIT_WINDOW_MS,
    );
  }

  private assertCircuitClosed() {
    const now = Date.now();
    if (now < this.circuitOpenUntil) {
      const waitSec = Math.ceil((this.circuitOpenUntil - now) / 1000);
      this.logger.warn(`Gemini circuit open — reject for ~${waitSec}s`);
      throw new ServiceUnavailableException(
        `${GEMINI_OVERLOAD_CODE}: AI is busy. Please try again in about ${waitSec}s.`,
      );
    }
  }

  private recordFailure(message: string) {
    if (!isRetryableOverload(message)) return;
    const now = Date.now();
    this.pruneFailures(now);
    this.failureTimestamps.push(now);
    if (this.failureTimestamps.length >= CIRCUIT_FAILURE_THRESHOLD) {
      this.circuitOpenUntil = now + CIRCUIT_COOLDOWN_MS;
      this.failureTimestamps = [];
      this.logger.warn(
        `Gemini circuit OPEN for ${CIRCUIT_COOLDOWN_MS / 1000}s after repeated overloads`,
      );
    }
  }

  private recordSuccess() {
    this.failureTimestamps = [];
    // Keep circuitOpenUntil if still in cooldown — only time clears it.
  }

  /**
   * GoogleGenerativeAI → getGenerativeModel → generateContent
   * Exponential backoff + jitter, stable model fallbacks, process-local circuit breaker.
   */
  async generateContent(options: GeminiGenerateOptions): Promise<string> {
    this.assertCircuitClosed();

    const primary = options.model?.trim() || this.defaultModel();
    const models = [
      primary,
      ...this.fallbackModels().filter((m) => m !== primary),
    ];
    let lastError: unknown;
    let sawOverload = false;

    for (const model of models) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const text = await this.callModel(model, options);
          this.recordSuccess();
          return text;
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          const retryable = isRetryableOverload(message);
          if (retryable) sawOverload = true;
          this.logger.warn(
            `Gemini ${model} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message.slice(0, 220)}`,
          );
          this.recordFailure(message);
          // Circuit may have just opened — stop hammering.
          if (Date.now() < this.circuitOpenUntil) {
            throw new ServiceUnavailableException(
              `${GEMINI_OVERLOAD_CODE}: AI is busy. Please try again shortly.`,
            );
          }
          if (!retryable || attempt >= MAX_ATTEMPTS) break;
          await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        }
      }
    }

    if (sawOverload) {
      throw new ServiceUnavailableException(
        `${GEMINI_OVERLOAD_CODE}: AI is busy. Please try again shortly.`,
      );
    }

    const message =
      lastError instanceof Error ? lastError.message : 'Gemini request failed';
    throw new BadGatewayException(message);
  }

  private extractText(result: GenerateContentResult): string {
    try {
      const direct = result.response.text()?.trim();
      if (direct) return direct;
    } catch {
      // Some blocked/empty responses throw from text() — fall through.
    }
    const parts = result.response.candidates?.[0]?.content?.parts ?? [];
    const joined = parts
      .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();
    if (joined) return joined;
    throw new Error('Gemini returned an empty response');
  }

  private async callModel(
    model: string,
    options: GeminiGenerateOptions,
  ): Promise<string> {
    const client = new GoogleGenerativeAI(this.apiKey());
    const generativeModel = client.getGenerativeModel({
      model,
      systemInstruction: options.systemInstruction,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        ...(options.json ? { responseMimeType: 'application/json' } : {}),
      },
    });

    let result: GenerateContentResult;
    try {
      result = await generativeModel.generateContent(options.prompt);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(message);
    }

    return this.extractText(result);
  }
}
