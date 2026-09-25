import { useEffect, useRef, useState } from "react";
import {
  decodeVideoFrame,
  drawScaled,
  warmUpQrDecoder,
  type DecodeResponse,
  type QrCorners,
} from "../utils/qr/qrDecoder";
import { SightingFilter } from "../utils/qr/sightingFilter";

export type CameraStatus = "idle" | "starting" | "live" | "denied" | "unavailable" | "insecure";

/** A QR in the picture: its corners (fractions of the frame) and the frame's size. */
export interface QrSighting {
  corners: QrCorners;
  frameWidth: number;
  frameHeight: number;
}

/**
 * What to tell the desk when a scan is not getting anywhere: nothing found for
 * a while ("notFound"), or a code in view that will not read ("soft") — both
 * usually a card held too close for a webcam's fixed focus.
 */
export type ScanAdvice = "none" | "notFound" | "soft";

interface Options {
  /** The camera runs only while this is true. */
  active: boolean;
  /** A chosen camera; the rear one is asked for when absent. */
  deviceId?: string;
  /** Bumped to ask for the camera again after it was refused or missing. */
  attempt?: number;
  /** True when the text was a card and the scan is done. */
  onDecode: (text: string) => boolean;
}

/** Enough pixels for a dense QR held at arm's length, like Zalo reads it. */
const RESOLUTION = { width: { ideal: 1920 }, height: { ideal: 1080 } };
/** A box that vanished for a frame or two stays put, instead of flickering. */
const SIGHTING_HOLD_MS = 300;
const SNAPSHOT_SIDE = 1280;
const NOT_FOUND_ADVICE_MS = 4000;
const SOFT_ADVICE_MS = 2500;

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
async function keepFocusing(track: MediaStreamTrack | undefined): Promise<void> {
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

async function openStream(deviceId?: string): Promise<MediaStream> {
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

function statusOf(error: unknown): CameraStatus {
  if (error instanceof DOMException && error.name === "NotAllowedError") return "denied";
  return "unavailable";
}

/**
 * The live camera behind "Quét CCCD": opens it at full resolution, never
 * mirrors it, follows the QR in the picture, and hands every QR it reads to
 * `onDecode`. Once a card is accepted the frame is kept as a still.
 *
 * Frames are read back to back — the next one as soon as the decoder answers —
 * so the box keeps up with the card. While a code is being followed only the
 * fast pass runs; the thorough one comes back whenever it is lost.
 */
export function useQrCamera({ active, deviceId, attempt = 0, onDecode }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDecodeRef = useRef(onDecode);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
  const [sighting, setSighting] = useState<QrSighting | null>(null);
  /** The frame a card was read from (a data URL), kept once the camera stops. */
  const [capture, setCapture] = useState<string | null>(null);
  const [advice, setAdvice] = useState<ScanAdvice>("none");

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    const video = videoRef.current;
    setSighting(null);
    setAdvice("none");
    if (!active || !video) {
      setStatus("idle");
      return undefined;
    }
    // A new scan: the last card's frame gives way to the live picture.
    setCapture(null);
    // Browsers only offer the camera to HTTPS pages and localhost.
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("insecure");
      return undefined;
    }

    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let lastSeen = 0;
    let tracking = false;
    let filter: SightingFilter | null = null;
    let searchingSince = 0;
    let seenSince = 0;

    const next = () => {
      if (!stopped) frame = requestAnimationFrame(() => void readFrame());
    };

    const readFrame = async () => {
      if (stopped) return;
      if (video.readyState < video.HAVE_CURRENT_DATA || video.videoWidth === 0) {
        next();
        return;
      }

      let result: DecodeResponse;
      try {
        result = await decodeVideoFrame(video, !tracking);
      } catch {
        // A frame the browser could not hand over (the stream was switching):
        // the next one will do.
        next();
        return;
      }
      if (stopped) return;

      const now = performance.now();
      const width = video.videoWidth;
      const height = video.videoHeight;
      tracking = Boolean(result.corners);

      // Only a believable outline moves the box; the odd undersized one ZXing
      // reports for a blurred frame counts as nothing seen.
      if (!filter?.matches(width, height)) filter = new SightingFilter(width, height);
      const corners = result.corners
        ? filter.accept(result.corners, result.text !== null, now)
        : null;

      if (corners) {
        if (now - lastSeen > SIGHTING_HOLD_MS) seenSince = now;
        lastSeen = now;
        setSighting({ corners, frameWidth: width, frameHeight: height });
      } else if (now - lastSeen > SIGHTING_HOLD_MS) {
        setSighting(null);
      }

      searchingSince ||= now;
      const inView = now - lastSeen <= SIGHTING_HOLD_MS;
      if (inView && now - seenSince > SOFT_ADVICE_MS) setAdvice("soft");
      else if (!inView && now - Math.max(lastSeen, searchingSince) > NOT_FOUND_ADVICE_MS) {
        setAdvice("notFound");
      } else setAdvice("none");

      if (result.text && onDecodeRef.current(result.text)) {
        const still = drawScaled(video, video.videoWidth, video.videoHeight, SNAPSHOT_SIDE);
        setCapture(still.toDataURL("image/jpeg", 0.85));
        setSighting(null);
        return;
      }
      next();
    };

    setStatus("starting");
    warmUpQrDecoder();

    void (async () => {
      try {
        stream = await openStream(deviceId);
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        video.srcObject = stream;
        await video.play();
        setStatus("live");
        setActiveDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId);
        void keepFocusing(stream.getVideoTracks()[0]);

        // Labels are only readable once permission has been given.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!stopped) setCameras(devices.filter((device) => device.kind === "videoinput"));

        next();
      } catch (error) {
        if (!stopped) setStatus(statusOf(error));
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
    // `attempt` only re-runs the effect: a retry is the same request again.
  }, [active, deviceId, attempt]);

  return { videoRef, status, cameras, activeDeviceId, sighting, capture, advice };
}
