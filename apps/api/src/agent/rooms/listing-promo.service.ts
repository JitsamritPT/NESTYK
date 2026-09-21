import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { GeminiService } from '../../gemini/gemini.service';
import { LISTING_PROMO_SYSTEM_PROMPT } from './prompts/listing-promo.system-prompt';
import type {
  GenerateListingPromoBody,
  GenerateListingPromoLocale,
  GenerateListingPromoResult,
} from './dto/generate-listing-promo.dto';

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 10000;
const DESCRIPTION_SOFT_MAX = 1200;

function normalizeLocale(value: string | undefined): GenerateListingPromoLocale {
  const raw = (value || 'th').trim().toLowerCase();
  if (raw === 'en' || raw === 'zh' || raw === 'ja' || raw === 'th') return raw;
  return 'th';
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

function parsePromoJson(text: string): GenerateListingPromoResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    throw new BadGatewayException('Gemini returned non-JSON listing promo');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new BadGatewayException('Gemini returned invalid listing promo shape');
  }
  const row = parsed as Record<string, unknown>;
  const listingTitle = typeof row.listingTitle === 'string' ? row.listingTitle.trim() : '';
  const listingDescription =
    typeof row.listingDescription === 'string' ? row.listingDescription.trim() : '';
  if (!listingTitle || !listingDescription) {
    throw new BadGatewayException('Gemini listing promo missing title or description');
  }
  return {
    listingTitle: listingTitle.slice(0, TITLE_MAX),
    listingDescription: listingDescription.slice(0, DESCRIPTION_MAX),
  };
}

@Injectable()
export class ListingPromoService {
  constructor(private readonly gemini: GeminiService) {}

  async generate(body: GenerateListingPromoBody): Promise<GenerateListingPromoResult> {
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Body is required');
    }
    if (!body.listing || typeof body.listing !== 'object' || Array.isArray(body.listing)) {
      throw new BadRequestException('listing must be an object');
    }

    const locale = normalizeLocale(body.locale);
    const userPayload = {
      locale,
      listing: body.listing,
      outputLanguage: locale,
      softMaxDescriptionChars: DESCRIPTION_SOFT_MAX,
    };

    const text = await this.gemini.generateContent({
      systemInstruction: LISTING_PROMO_SYSTEM_PROMPT,
      prompt: `Write listingTitle and listingDescription in language "${locale}". Use ONLY facts in this JSON:\n${JSON.stringify(userPayload)}`,
      json: true,
      temperature: 0.7,
    });

    return parsePromoJson(text);
  }
}
