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

const DEFAULT_MODEL = 'gemini-3.6-flash';
const FALLBACK_MODELS = ['gemini-flash-latest'] as const;
const MAX_ATTEMPTS = 3;

export type GeminiGenerateOptions = {
  prompt: string;
  systemInstruction?: string;
  /** Prefer JSON response from the model. */
  json?: boolean;
  temperature?: number;
  model?: string;
};

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);

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

  /**
   * GoogleGenerativeAI → getGenerativeModel → generateContent
   * Retries and falls back across models on high-demand / transient failures.
   */
  async generateContent(options: GeminiGenerateOptions): Promise<string> {
    const primary = options.model?.trim() || this.defaultModel();
    const models = [
      primary,
      ...FALLBACK_MODELS.filter((m) => m !== primary),
    ];
    let lastError: unknown;

    for (const model of models) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          return await this.callModel(model, options);
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          const retryable =
            /high demand|resource.?exhausted|429|503|unavailable|try again|fetch failed|ECONNRESET|ETIMEDOUT/i.test(
              message,
            );
          this.logger.warn(
            `Gemini ${model} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message.slice(0, 220)}`,
          );
          if (!retryable || attempt >= MAX_ATTEMPTS) break;
          await new Promise((r) => setTimeout(r, 700 * attempt));
        }
      }
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
