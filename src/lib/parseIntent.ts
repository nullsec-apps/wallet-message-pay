/**
 * Parses inbound WhatsApp/SMS message bodies into structured payment intents.
 * Supports natural phrasings like:
 *   '+34 612 345 678 send 25 USDC'
 *   'send 25 to +34612345678'
 *   'pay +1 (415) 555 0100 12.50'
 *   '@+34612345678 25 usdc'
 *   'request 10 from +447911123456'
 */

export type IntentAction = 'send' | 'request' | 'unknown';

export interface ParsedIntent {
  action: IntentAction;
  amount: number | null;
  token: string;
  recipientPhone: string | null;
  rawBody: string;
  confidence: 'high' | 'medium' | 'low';
}

const SEND_KEYWORDS = ['send', 'pay', 'transfer', 'give', 'wire'];
const REQUEST_KEYWORDS = ['request', 'ask', 'invoice', 'charge'];
const KNOWN_TOKENS = ['USDC', 'USD', 'ETH', 'EUR'];

/** Extract a likely E.164-ish phone number from free text. */
function extractPhone(text: string): string | null {
  // Match a + followed by digits, optionally separated by spaces, dashes, dots, parens
  const match = text.match(/\+\s*\d[\d\s\-().]{6,}\d/);
  if (!match) return null;
  const cleaned = '+' + match[0].replace(/[^\d]/g, '');
  // E.164: up to 15 digits after the +
  if (cleaned.length < 8 || cleaned.length > 16) return null;
  return cleaned;
}

/** Extract the first plausible monetary amount. */
function extractAmount(text: string, phone: string | null): number | null {
  // Remove the matched phone number so its digits aren't read as an amount
  let scrubbed = text;
  if (phone) {
    const phoneRegex = /\+\s*\d[\d\s\-().]{6,}\d/;
    scrubbed = scrubbed.replace(phoneRegex, ' ');
  }
  // Look for a number that is NOT immediately part of a phone, allow decimals
  const matches = scrubbed.match(/(?:^|[^\d.])(\d+(?:[.,]\d{1,6})?)(?:[^\d]|$)/g);
  if (!matches) return null;
  for (const m of matches) {
    const numMatch = m.match(/(\d+(?:[.,]\d{1,6})?)/);
    if (!numMatch) continue;
    const val = Number(numMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

/** Detect the requested token symbol, defaulting to USDC. */
function extractToken(text: string): string {
  const upper = text.toUpperCase();
  for (const token of KNOWN_TOKENS) {
    const re = new RegExp(`\\b${token}\\b`);
    if (re.test(upper)) {
      // Normalize plain USD references to USDC for this app
      if (token === 'USD') return 'USDC';
      return token;
    }
  }
  return 'USDC';
}

/** Detect the action verb. */
function extractAction(text: string): IntentAction {
  const lower = text.toLowerCase();
  for (const kw of REQUEST_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(lower)) return 'request';
  }
  for (const kw of SEND_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(lower)) return 'send';
  }
  return 'unknown';
}

/**
 * Parse a raw inbound message body into a payment intent.
 * Returns a best-effort structured object with a confidence score.
 */
export function parseIntent(body: string): ParsedIntent {
  const rawBody = (body || '').trim();
  const phone = extractPhone(rawBody);
  const amount = extractAmount(rawBody, phone);
  const token = extractToken(rawBody);
  let action = extractAction(rawBody);

  // If no explicit verb but we have a phone + amount, assume a send
  if (action === 'unknown' && phone && amount) {
    action = 'send';
  }

  let confidence: ParsedIntent['confidence'] = 'low';
  if (phone && amount && action !== 'unknown') confidence = 'high';
  else if ((phone && amount) || (amount && action !== 'unknown')) confidence = 'medium';

  return {
    action,
    amount,
    token,
    recipientPhone: phone,
    rawBody,
    confidence,
  };
}

/** Quick predicate: does this body look like an actionable payment? */
export function isPaymentIntent(body: string): boolean {
  const parsed = parseIntent(body);
  return parsed.action === 'send' && !!parsed.amount && parsed.confidence !== 'low';
}

/** Build a human-readable summary of a parsed intent for confirmation bubbles. */
export function describeIntent(intent: ParsedIntent): string {
  if (intent.action === 'unknown' || !intent.amount) {
    return "Couldn't read a payment from this message";
  }
  const verb = intent.action === 'request' ? 'Request' : 'Send';
  const target = intent.recipientPhone ? ` to ${intent.recipientPhone}` : '';
  return `${verb} ${intent.amount} ${intent.token}${target}`;
}
