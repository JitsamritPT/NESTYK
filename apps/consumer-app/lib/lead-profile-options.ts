/**
 * Preset picks for lead nationality / occupation. `stored` is the canonical English text
 * saved in the free-text column; the label comes from i18n by `code`.
 */
export const LEAD_NATIONALITY_OPTIONS = [
  { code: 'thai', stored: 'Thai' },
  { code: 'chinese', stored: 'Chinese' },
  { code: 'japanese', stored: 'Japanese' },
  { code: 'korean', stored: 'Korean' },
  { code: 'indian', stored: 'Indian' },
  { code: 'myanmar', stored: 'Myanmar' },
  { code: 'vietnamese', stored: 'Vietnamese' },
  { code: 'filipino', stored: 'Filipino' },
  { code: 'american', stored: 'American' },
  { code: 'british', stored: 'British' },
  { code: 'european', stored: 'European' },
] as const;

export const LEAD_OCCUPATION_OPTIONS = [
  { code: 'employee', stored: 'Office worker' },
  { code: 'business_owner', stored: 'Business owner' },
  { code: 'freelancer', stored: 'Freelancer' },
  { code: 'student', stored: 'Student' },
  { code: 'government', stored: 'Government officer' },
  { code: 'teacher', stored: 'Teacher' },
  { code: 'medical', stored: 'Medical professional' },
  { code: 'retired', stored: 'Retired' },
] as const;

export type LeadNationalityCode = (typeof LEAD_NATIONALITY_OPTIONS)[number]['code'];
export type LeadOccupationCode = (typeof LEAD_OCCUPATION_OPTIONS)[number]['code'];

/** Sentinel select value for "Other (type your own)". */
export const LEAD_OTHER_OPTION = '__other' as const;

export function presetCodeFor(
  options: ReadonlyArray<{ code: string; stored: string }>,
  text: string,
): string | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  return options.find((option) => option.stored.toLowerCase() === normalized)?.code ?? null;
}
