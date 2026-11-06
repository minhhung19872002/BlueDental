/**
 * The short "ting" a new chat message plays (R-1165, BA 2026-11-06). It is
 * made with Web Audio, two bell partials fading out, so it needs no sound
 * file and never sounds like the reception "Mời lên" chime (R-1144).
 *
 * Browsers keep audio muted until the page has had a click or key press; a
 * blocked ting is skipped, the toast still shows.
 */
const PARTIALS = [
  { frequency: 1318.5, gain: 0.16 },
  { frequency: 1975.5, gain: 0.07 },
] as const;
const LENGTH_S = 0.7;
/** Several messages in a burst ring once. */
const QUIET_MS = 1_500;

let context: AudioContext | null = null;
let lastPlayedAt = 0;

export async function playChatTing(): Promise<void> {
  if (typeof AudioContext !== "function") return;
  const now = Date.now();
  if (now - lastPlayedAt < QUIET_MS) return;
  lastPlayedAt = now;
  try {
    context ??= new AudioContext();
    if (context.state === "suspended") await context.resume();
    if (context.state !== "running") return;
    const start = context.currentTime;
    for (const { frequency, gain } of PARTIALS) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(gain, start);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + LENGTH_S);
      oscillator.connect(envelope).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + LENGTH_S);
    }
  } catch (error: unknown) {
    console.warn("Chat sound not played:", error);
  }
}
