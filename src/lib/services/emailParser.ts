import { EmailInput, ParsedEmail, AttachmentInfo } from '../types';

const SIGNATURE_PATTERNS = [
  /^--\s*$/m,
  /^_{3,}/m,
  /^Best regards,?\s*$/im,
  /^Kind regards,?\s*$/im,
  /^Regards,?\s*$/im,
  /^Thanks,?\s*$/im,
  /^Thank you,?\s*$/im,
  /^Cheers,?\s*$/im,
  /^Sincerely,?\s*$/im,
  /^Sent from my (iPhone|iPad|Android|Samsung|Galaxy)/im,
  /^Get Outlook for/im,
];

const THREAD_PATTERNS = [
  /^On .+ wrote:$/m,
  /^-{3,}\s*Original Message\s*-{3,}/im,
  /^From:\s*.+$/m,
  /^>{1,}\s/m,
  /^\[cid:.+\]/m,
];

export function parseEmail(input: EmailInput): ParsedEmail {
  const cleanBody = cleanEmailBody(input.body);
  const fromName = extractSenderName(input.from);
  const language = detectLanguage(cleanBody);
  const isReply = detectIsReply(input.subject, input.body);

  return {
    id: input.id,
    from: input.from,
    fromName,
    to: input.to,
    subject: input.subject,
    cleanBody,
    originalBody: input.body,
    language,
    attachments: input.attachments || [],
    isReply,
    threadId: isReply ? generateThreadId(input.subject) : undefined,
    receivedAt: input.receivedAt || new Date().toISOString(),
  };
}

function cleanEmailBody(body: string): string {
  let cleaned = body;

  for (const pattern of THREAD_PATTERNS) {
    const match = cleaned.search(pattern);
    if (match !== -1) {
      cleaned = cleaned.substring(0, match).trim();
    }
  }

  for (const pattern of SIGNATURE_PATTERNS) {
    const match = cleaned.search(pattern);
    if (match !== -1 && match > cleaned.length * 0.3) {
      cleaned = cleaned.substring(0, match).trim();
    }
  }

  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

function extractSenderName(from: string): string {
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();

  const emailMatch = from.match(/^([^@]+)@/);
  if (emailMatch) return emailMatch[1].replace(/[._-]/g, ' ').trim();

  return from;
}

function detectLanguage(text: string): string {
  const arabicPattern = /[\u0600-\u06FF]/;
  const chinesePattern = /[\u4e00-\u9fff]/;
  const japanesePattern = /[\u3040-\u309f\u30a0-\u30ff]/;
  const koreanPattern = /[\uac00-\ud7af]/;
  const frenchIndicators = /\b(je|nous|vous|est|les|des|une|pour|avec|dans|sur|pas|qui|que)\b/gi;
  const spanishIndicators = /\b(el|los|las|una|por|con|para|como|pero|más|que|del)\b/gi;
  const germanIndicators = /\b(der|die|das|und|ist|ein|nicht|mit|auf|für|von|den|dem)\b/gi;

  if (arabicPattern.test(text)) return 'ar';
  if (chinesePattern.test(text)) return 'zh';
  if (japanesePattern.test(text)) return 'ja';
  if (koreanPattern.test(text)) return 'ko';

  const frenchCount = (text.match(frenchIndicators) || []).length;
  const spanishCount = (text.match(spanishIndicators) || []).length;
  const germanCount = (text.match(germanIndicators) || []).length;
  const maxNonEnglish = Math.max(frenchCount, spanishCount, germanCount);

  if (maxNonEnglish > 5) {
    if (frenchCount === maxNonEnglish) return 'fr';
    if (spanishCount === maxNonEnglish) return 'es';
    if (germanCount === maxNonEnglish) return 'de';
  }

  return 'en';
}

function detectIsReply(subject: string, body: string): boolean {
  if (/^(re|fw|fwd):\s/i.test(subject)) return true;
  for (const pattern of THREAD_PATTERNS) {
    if (pattern.test(body)) return true;
  }
  return false;
}

function generateThreadId(subject: string): string {
  const normalized = subject.replace(/^(re|fw|fwd):\s*/gi, '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `thread-${Math.abs(hash).toString(36)}`;
}
