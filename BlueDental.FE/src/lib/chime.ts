/**
 * The "ting ting" a doctor's "Mời lên" rings at reception (R-1144): the sound
 * file BA picked (2026-11-04), `public/sounds/invite-chime.mp3`.
 *
 * Browsers keep audio muted until the page has had a click or key press (a
 * fresh load or F5 counts as no click), so this module also tracks whether
 * sound is unlocked yet; the dock shows a muted bell until then (R-1145).
 */
const CHIME_URL = "/sounds/invite-chime.mp3";

/** Inputs that give the page user activation, which lifts the block. */
const ACTIVATION_EVENTS = ["pointerdown", "keydown", "touchend"] as const;

let audio: HTMLAudioElement | null = null;
// A browser without the API (older Safari) is taken as unlocked: no false hint.
let unlocked = typeof navigator === "undefined" || (navigator.userActivation?.hasBeenActive ?? true);
const listeners = new Set<() => void>();

function markUnlocked(): void {
  if (unlocked) return;
  unlocked = true;
  stopWatching();
  listeners.forEach((listener) => listener());
}

// Activation is granted just before the event is dispatched, so it can be read
// here; an Escape key press, which grants none, leaves the hint up.
function handleActivation(): void {
  if (navigator.userActivation?.hasBeenActive ?? true) markUnlocked();
}

function stopWatching(): void {
  for (const type of ACTIVATION_EVENTS) document.removeEventListener(type, handleActivation, true);
}

/** Whether the chime can be heard now (the page has had its first click). */
export function isSoundUnlocked(): boolean {
  return unlocked;
}

/** Listens for sound becoming unlocked, for `useSyncExternalStore`. */
export function subscribeSoundUnlocked(listener: () => void): () => void {
  if (!unlocked && listeners.size === 0) {
    for (const type of ACTIVATION_EVENTS) document.addEventListener(type, handleActivation, true);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopWatching();
  };
}

/**
 * Plays the chime once, from the start even if it is still ringing. Resolves
 * whether it was heard: `false` when the browser blocked it.
 */
export async function playChime(): Promise<boolean> {
  if (typeof Audio !== "function") return false;
  audio ??= new Audio(CHIME_URL);
  audio.currentTime = 0;
  try {
    await audio.play();
    markUnlocked();
    return true;
  } catch (error: unknown) {
    console.warn("Invite chime not played:", error);
    return false;
  }
}
