/**
 * How a # tag sits inside a message's text (R-1161): `#[Tên](patient:{id})`.
 * Mirrors ChatPatientTokens on the server. The reader and the composer only
 * ever see `#Tên`; the token is built when sending and read back when editing.
 */

const GUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const MAX_NAME_LENGTH = 100;

function tokenPattern(): RegExp {
  return new RegExp(`#\\[([^\\[\\]\\r\\n]{1,${MAX_NAME_LENGTH}})\\]\\(patient:(${GUID})\\)`, "g");
}

/** A patient tagged in the composer: who, and the `#Tên` it shows. */
export interface ChatMention {
  id: string;
  name: string;
}

export type ChatTextSegment = { kind: "text"; text: string } | { kind: "patient"; id: string; name: string };

/** The `#Tên` a mention shows in the text. */
export function mentionLabel(mention: ChatMention): string {
  return `#${mention.name}`;
}

/** A name a token can hold, cleaned the way the server cleans it. */
export function safeMentionName(name: string): string {
  const cleaned = name.replace(/[[\]\r\n]+/g, " ").trim().slice(0, MAX_NAME_LENGTH).trimEnd();
  return cleaned || "?";
}

/** The text as a reader sees it: every tag as `#Tên`. */
export function toDisplayText(text: string): string {
  return text.replace(tokenPattern(), (_match, name: string) => `#${name}`);
}

/** The text cut into plain pieces and tags, for a bubble to style the tags. */
export function splitPatientTags(text: string): ChatTextSegment[] {
  const segments: ChatTextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(tokenPattern())) {
    const at = match.index ?? 0;
    if (at > last) segments.push({ kind: "text", text: text.slice(last, at) });
    segments.push({ kind: "patient", name: match[1], id: match[2].toLowerCase() });
    last = at + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}

/** A sent message turned back into a draft: `#Tên` text plus who each tag is. */
export function parseDraft(content: string): { text: string; mentions: ChatMention[] } {
  const mentions: ChatMention[] = [];
  const text = content.replace(tokenPattern(), (_match, name: string, id: string) => {
    if (!mentions.some((m) => m.id === id.toLowerCase())) mentions.push({ id: id.toLowerCase(), name });
    return `#${name}`;
  });
  return { text, mentions };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The draft as it is sent. The first `#Tên` of each mention still in the
 * text becomes its token; a mention whose text was deleted is dropped. The
 * ids follow the order the tags appear in, which is the order of the cards.
 */
export function buildContent(text: string, mentions: ChatMention[]): { content: string; patientIds: string[] } {
  if (mentions.length === 0) return { content: text, patientIds: [] };
  // Longest label first, so "#Hà My" is never read as "#Hà" followed by " My".
  const byLabel = new Map(mentions.map((m) => [mentionLabel(m), m]));
  const patientIds: string[] = [];
  const content = text.replace(labelPattern(mentions), (match, before: string, label: string) => {
    const mention = byLabel.get(label);
    if (!mention || patientIds.includes(mention.id)) return match;
    patientIds.push(mention.id);
    return `${before}#[${mention.name}](patient:${mention.id})`;
  });
  return { content, patientIds };
}

function labelPattern(mentions: ChatMention[]): RegExp {
  const labels = [...new Set(mentions.map(mentionLabel))].sort((a, b) => b.length - a.length).map(escapeRegExp);
  // A tag stands alone: a space or the start before it, no letter or digit right after it.
  return new RegExp(`(^|\\s)(${labels.join("|")})(?![\\p{L}\\p{N}])`, "gu");
}

/** The draft cut into plain pieces and picked tags, for the composer to shade the tags like chips. */
export function splitDraft(text: string, mentions: ChatMention[]): { text: string; tag: boolean }[] {
  if (mentions.length === 0) return [{ text, tag: false }];
  const pieces: { text: string; tag: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(labelPattern(mentions))) {
    const at = (match.index ?? 0) + match[1].length;
    if (at > last) pieces.push({ text: text.slice(last, at), tag: false });
    pieces.push({ text: match[2], tag: true });
    last = at + match[2].length;
  }
  if (last < text.length) pieces.push({ text: text.slice(last), tag: false });
  return pieces;
}

/** Mentions whose `#Tên` is still in the text, as standalone tags. */
export function mentionsInText(text: string, mentions: ChatMention[]): ChatMention[] {
  if (mentions.length === 0) return [];
  const present = new Set([...text.matchAll(labelPattern(mentions))].map((match) => match[2]));
  return mentions.filter((m) => present.has(mentionLabel(m)));
}

/** The `#…` being typed just before the caret: where it starts and what follows the #. */
export interface MentionQuery {
  start: number;
  text: string;
}

/**
 * What the user is looking for after a #: the # must open the text or follow
 * a space, and what follows has no line break, no second # and no double
 * space. A # that starts a tag already picked is not a search.
 */
export function findMentionQuery(text: string, caret: number, mentions: ChatMention[], maxLength: number): MentionQuery | null {
  if (caret <= 0) return null;
  const start = text.lastIndexOf("#", caret - 1);
  if (start < 0 || (start > 0 && !/\s/.test(text[start - 1]))) return null;
  const query = text.slice(start + 1, caret);
  if (query.length > maxLength || /[\r\n#]/.test(query) || /^\s|\s\s/.test(query)) return null;
  const rest = text.slice(start);
  if (mentions.some((m) => rest.startsWith(mentionLabel(m)) && caret > start + 1)) return null;
  return { start, text: query };
}

/** The tag whose `#Tên` ends right at the caret, so Backspace takes it whole. */
export function mentionEndingAt(text: string, caret: number, mentions: ChatMention[]): { start: number } | null {
  for (const mention of mentions) {
    const label = mentionLabel(mention);
    const start = caret - label.length;
    if (start >= 0 && text.slice(start, caret) === label && (start === 0 || /\s/.test(text[start - 1]))) {
      return { start };
    }
  }
  return null;
}
