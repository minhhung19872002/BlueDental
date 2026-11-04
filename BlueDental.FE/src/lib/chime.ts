/**
 * The "ting ting" a doctor's "Mời lên" rings at reception (R-1144): the sound
 * file BA picked (2026-11-04), `public/sounds/invite-chime.mp3`. Browsers keep
 * audio muted until the page has had a click or key press, so a chime before
 * any such gesture may stay silent.
 */
const CHIME_URL = "/sounds/invite-chime.mp3";

let audio: HTMLAudioElement | null = null;

/** Plays the chime once, from the start even if it is still ringing. */
export function playChime(): void {
  if (typeof Audio !== "function") return;
  audio ??= new Audio(CHIME_URL);
  audio.currentTime = 0;
  audio.play().catch((error: unknown) => {
    // Blocked until the viewer's first click; the badge still shows the patient.
    console.warn("Invite chime not played:", error);
  });
}
