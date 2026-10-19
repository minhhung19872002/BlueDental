/**
 * The camera plumbing shared by "Quét CCCD" and the Hình ảnh tab's "Chụp ảnh":
 * opening a stream, keeping it focused, naming why it would not open, and
 * remembering which camera the desk picked.
 */

export type CameraStatus = "idle" | "starting" | "live" | "denied" | "unavailable" | "insecure";

/** Enough pixels for a dense QR held at arm's length, or a sharp clinical photo. */
const RESOLUTION = { width: { ideal: 1920 }, height: { ideal: 1080 } };

/** The standard lists no focus controls; cameras that have them report them anyway. */
interface FocusCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
}

interface FocusConstraints extends MediaTrackConstraintSet {
  focusMode?: ConstrainDOMString;
}

/**
 * Asks a camera that can refocus on its own to keep doing so. Webcams with a
 * fixed lens simply do not offer it, and nothing changes for them.
 */
export async function keepFocusing(track: MediaStreamTrack | undefined): Promise<void> {
  if (!track?.getCapabilities) return;
  const capabilities: FocusCapabilities = track.getCapabilities();
  if (!capabilities.focusMode?.includes("continuous")) return;
  const focus: FocusConstraints = { focusMode: "continuous" };
  try {
    await track.applyConstraints({ advanced: [focus] });
  } catch {
    // Offered but refused — the camera keeps whatever focus it had.
  }
}

function constraintsFor(deviceId?: string): MediaStreamConstraints {
  return {
    audio: false,
    video: deviceId
      ? { deviceId: { exact: deviceId }, ...RESOLUTION }
      : { facingMode: { ideal: "environment" }, ...RESOLUTION },
  };
}

/** Opens the chosen camera, or the rear one when none is chosen. */
export async function openStream(deviceId?: string): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia(constraintsFor(deviceId));
  } catch (error) {
    // A remembered camera that is gone now: fall back to whichever is there.
    const missing =
      error instanceof DOMException &&
      (error.name === "OverconstrainedError" || error.name === "NotFoundError");
    if (deviceId && missing) return navigator.mediaDevices.getUserMedia(constraintsFor());
    throw error;
  }
}

/** Why `openStream` failed, as far as the user needs to know. */
export function cameraStatusOf(error: unknown): CameraStatus {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "denied";
  return "unavailable";
}

/** Browsers only offer the camera to HTTPS pages and localhost. */
export function cameraSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** The video inputs, labelled once permission has been given. */
export async function listCameras(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

export function savedCamera(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function rememberCamera(key: string, deviceId: string): void {
  try {
    localStorage.setItem(key, deviceId);
  } catch {
    // Private mode: the choice just lasts while the dialog is open.
  }
}
