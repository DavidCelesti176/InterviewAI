export const MAX_PDF_BYTES = 8 * 1024 * 1024;
export const MAX_COMPANY_CHARS = 200;
export const MAX_JOB_TITLE_CHARS = 200;
export const MAX_JOB_DESCRIPTION_CHARS = 8_000;
export const MAX_JOB_LISTING_CHARS = 20_000;
export const MIN_JOB_LISTING_CHARS = 40;
export const MAX_RESUME_TEXT_CHARS = 12_000;
export const MIN_JOB_DESCRIPTION_CHARS = 20;
export const MIN_RESUME_TEXT_CHARS = 40;

export function clipText(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trim()}…`;
}
