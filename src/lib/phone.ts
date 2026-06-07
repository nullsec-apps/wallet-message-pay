// Self-contained phone utilities (no libphonenumber-js dependency).
// Provides E.164 normalization, validation, country detection, formatting,
// masking and a country dataset for the searchable selector.

export type CountryCode = string;

export interface CountryEntry {
  iso: CountryCode;
  flag: string;
  callingCode: string; // e.g. '+34'
  name: string;
}

// Compact dataset of common countries (iso, calling code, name). Ordered so
// longer/more-specific codes can be matched first where needed.
const COUNTRY_DATA: { iso: string; cc: string; name: string }[] = [
  { iso: 'US', cc: '1', name: 'United States' },
  { iso: 'CA', cc: '1', name: 'Canada' },
  { iso: 'GB', cc: '44', name: 'United Kingdom' },
  { iso: 'ES', cc: '34', name: 'Spain' },
  { iso: 'FR', cc: '33', name: 'France' },
  { iso: 'DE', cc: '49', name: 'Germany' },
  { iso: 'IT', cc: '39', name: 'Italy' },
  { iso: 'PT', cc: '351', name: 'Portugal' },
  { iso: 'NL', cc: '31', name: 'Netherlands' },
  { iso: 'BE', cc: '32', name: 'Belgium' },
  { iso: 'CH', cc: '41', name: 'Switzerland' },
  { iso: 'AT', cc: '43', name: 'Austria' },
  { iso: 'IE', cc: '353', name: 'Ireland' },
  { iso: 'SE', cc: '46', name: 'Sweden' },
  { iso: 'NO', cc: '47', name: 'Norway' },
  { iso: 'DK', cc: '45', name: 'Denmark' },
  { iso: 'FI', cc: '358', name: 'Finland' },
  { iso: 'PL', cc: '48', name: 'Poland' },
  { iso: 'CZ', cc: '420', name: 'Czechia' },
  { iso: 'GR', cc: '30', name: 'Greece' },
  { iso: 'RO', cc: '40', name: 'Romania' },
  { iso: 'HU', cc: '36', name: 'Hungary' },
  { iso: 'UA', cc: '380', name: 'Ukraine' },
  { iso: 'RU', cc: '7', name: 'Russia' },
  { iso: 'TR', cc: '90', name: 'Turkey' },
  { iso: 'AE', cc: '971', name: 'United Arab Emirates' },
  { iso: 'SA', cc: '966', name: 'Saudi Arabia' },
  { iso: 'IL', cc: '972', name: 'Israel' },
  { iso: 'EG', cc: '20', name: 'Egypt' },
  { iso: 'NG', cc: '234', name: 'Nigeria' },
  { iso: 'KE', cc: '254', name: 'Kenya' },
  { iso: 'GH', cc: '233', name: 'Ghana' },
  { iso: 'ZA', cc: '27', name: 'South Africa' },
  { iso: 'MA', cc: '212', name: 'Morocco' },
  { iso: 'IN', cc: '91', name: 'India' },
  { iso: 'PK', cc: '92', name: 'Pakistan' },
  { iso: 'BD', cc: '880', name: 'Bangladesh' },
  { iso: 'CN', cc: '86', name: 'China' },
  { iso: 'HK', cc: '852', name: 'Hong Kong' },
  { iso: 'JP', cc: '81', name: 'Japan' },
  { iso: 'KR', cc: '82', name: 'South Korea' },
  { iso: 'ID', cc: '62', name: 'Indonesia' },
  { iso: 'MY', cc: '60', name: 'Malaysia' },
  { iso: 'SG', cc: '65', name: 'Singapore' },
  { iso: 'TH', cc: '66', name: 'Thailand' },
  { iso: 'VN', cc: '84', name: 'Vietnam' },
  { iso: 'PH', cc: '63', name: 'Philippines' },
  { iso: 'AU', cc: '61', name: 'Australia' },
  { iso: 'NZ', cc: '64', name: 'New Zealand' },
  { iso: 'MX', cc: '52', name: 'Mexico' },
  { iso: 'BR', cc: '55', name: 'Brazil' },
  { iso: 'AR', cc: '54', name: 'Argentina' },
  { iso: 'CL', cc: '56', name: 'Chile' },
  { iso: 'CO', cc: '57', name: 'Colombia' },
  { iso: 'PE', cc: '51', name: 'Peru' },
  { iso: 'VE', cc: '58', name: 'Venezuela' },
  { iso: 'EC', cc: '593', name: 'Ecuador' },
  { iso: 'BO', cc: '591', name: 'Bolivia' },
  { iso: 'UY', cc: '598', name: 'Uruguay' },
  { iso: 'PY', cc: '595', name: 'Paraguay' },
  { iso: 'CR', cc: '506', name: 'Costa Rica' },
  { iso: 'PA', cc: '507', name: 'Panama' },
  { iso: 'DO', cc: '1', name: 'Dominican Republic' },
  { iso: 'GT', cc: '502', name: 'Guatemala' },
];

// Build a calling-code -> iso map, preferring the first (primary) entry.
const CC_TO_ISO: Record<string, string> = {};
for (const c of COUNTRY_DATA) {
  if (!CC_TO_ISO[c.cc]) CC_TO_ISO[c.cc] = c.iso;
}
// Sorted calling codes (longest first) for greedy prefix matching.
const SORTED_CCS = Array.from(new Set(COUNTRY_DATA.map((c) => c.cc))).sort(
  (a, b) => b.length - a.length
);

function ccForIso(iso?: string | null): string | null {
  if (!iso) return null;
  const found = COUNTRY_DATA.find((c) => c.iso === iso.toUpperCase());
  return found ? found.cc : null;
}

/** Convert an ISO country code (e.g. 'GB') to a flag emoji. */
export function isoToFlag(iso?: string | null): string {
  if (!iso || iso.length !== 2) return '\uD83C\uDF10';
  const upper = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '\uD83C\uDF10';
  const codePoints = upper.split('').map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

function digitsOnly(s: string): string {
  return (s || '').replace(/[^\d]/g, '');
}

/**
 * Normalize a phone number to E.164 (e.g. +34612345678).
 * Optionally pass a defaultCountry to resolve national numbers.
 */
export function normalizeE164(
  input: string,
  defaultCountry?: CountryCode
): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // Already has +
  if (trimmed.startsWith('+')) {
    const d = digitsOnly(trimmed);
    if (d.length >= 7 && d.length <= 15) return `+${d}`;
    return null;
  }
  // National number with a default country -> prefix calling code
  const cc = ccForIso(defaultCountry);
  if (cc) {
    let national = digitsOnly(trimmed);
    // Strip a leading 0 (common national trunk prefix)
    national = national.replace(/^0+/, '');
    if (national.length >= 5) {
      const full = `${cc}${national}`;
      if (full.length >= 7 && full.length <= 15) return `+${full}`;
    }
    return null;
  }
  // Bare digits, no country: best effort if it already looks international
  const d = digitsOnly(trimmed);
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

/** True if the input is a plausibly valid phone number. */
export function isValidPhone(input: string, defaultCountry?: CountryCode): boolean {
  const e164 = normalizeE164(input, defaultCountry);
  if (!e164) return false;
  const d = digitsOnly(e164);
  return d.length >= 8 && d.length <= 15;
}

/** Get the ISO country code for a phone number, if resolvable. */
export function getPhoneCountry(input: string): CountryCode | null {
  if (!input) return null;
  const e164 = normalizeE164(input);
  if (!e164) return null;
  const d = digitsOnly(e164);
  for (const cc of SORTED_CCS) {
    if (d.startsWith(cc)) {
      return CC_TO_ISO[cc] ?? null;
    }
  }
  return null;
}

/** Split an E.164 number into calling code + national digits. */
function splitE164(e164: string): { cc: string; national: string } | null {
  const d = digitsOnly(e164);
  for (const cc of SORTED_CCS) {
    if (d.startsWith(cc)) {
      return { cc, national: d.slice(cc.length) };
    }
  }
  return null;
}

/** Pretty international format, e.g. '+34 612 345 678'. */
export function formatInternational(input: string, defaultCountry?: CountryCode): string {
  const e164 = normalizeE164(input, defaultCountry);
  if (!e164) return input || '';
  const parts = splitE164(e164);
  if (!parts) return e164;
  const grouped = parts.national.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return `+${parts.cc} ${grouped}`.trim();
}

/** Live-format as the user types within a chosen country. */
export function formatAsYouType(input: string, _country?: CountryCode): string {
  // Keep a leading +, group remaining digits in blocks of 3 for readability.
  const hasPlus = input.trim().startsWith('+');
  const d = digitsOnly(input);
  if (!d) return hasPlus ? '+' : '';
  const grouped = d.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
  return hasPlus ? `+${grouped}` : grouped;
}

/**
 * Mask a phone number for the privacy-first chip,
 * e.g. '+34 612 \u2022\u2022\u2022 \u2022\u2022\u2022'.
 */
export function maskPhone(input: string): string {
  const e164 = normalizeE164(input) ?? input;
  if (!e164 || !e164.startsWith('+')) {
    if (!input) return '';
    const visible = input.slice(0, 6);
    return `${visible} \u2022\u2022\u2022 \u2022\u2022\u2022`;
  }
  const parts = splitE164(e164);
  if (parts) {
    const head = parts.national.slice(0, 3);
    return `+${parts.cc} ${head} \u2022\u2022\u2022 \u2022\u2022\u2022`;
  }
  const digits = e164.slice(1);
  const head = digits.slice(0, 5);
  return `+${head} \u2022\u2022\u2022 \u2022\u2022\u2022`;
}

/** Full flag + masked display string used across the app. */
export function flagMasked(input: string): string {
  const iso = getPhoneCountry(input);
  return `${isoToFlag(iso)} ${maskPhone(input)}`;
}

/** Build the full country dataset for the searchable selector. */
export function getCountryList(): CountryEntry[] {
  return COUNTRY_DATA.map((c) => ({
    iso: c.iso as CountryCode,
    flag: isoToFlag(c.iso),
    callingCode: `+${c.cc}`,
    name: c.name,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Look up a single country entry by ISO code. */
export function getCountryEntry(iso: CountryCode): CountryEntry | null {
  const c = COUNTRY_DATA.find((x) => x.iso === iso.toUpperCase());
  if (!c) return null;
  return {
    iso: c.iso as CountryCode,
    flag: isoToFlag(c.iso),
    callingCode: `+${c.cc}`,
    name: c.name,
  };
}
