import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_MAX_SIDE } from "@/utils/shrinkImageFile";
import {
  cameraStatusOf,
  cameraSupported,
  keepFocusing,
  listCameras,
  openStream,
  type CameraStatus,
} from "../utils/camera/cameraStream";

interface Options {
  /** A chosen camera; the rear one is asked for when absent. */
  deviceId?: string;
  /** Bumped to ask for the camera again after it was refused or lost. */
  attempt: number;
}

/** A shot is already at the size the upload keeps, so this is its only compression. */
const JPEG_QUALITY = 0.92;

/**
 * The live camera behind "Chụp ảnh": it opens as soon as the component using
 * it mounts and is switched off — light and all — when it unmounts. The
 * picture is never mirrored, so the left of the mouth stays on the left.
 *
 * `snap` takes the frame on screen at the size an upload keeps (1600px on the
 * longest side): a 4K camera's shot never trips the 5 MB limit, ten waiting
 * shots stay light, and the upload sends them as they are, not re-encoded.
 */
export function usePhotoCamera({ deviceId, attempt }: Options) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (!cameraSupported()) {
      setStatus("insecure");
      return undefined;
    }

    let stopped = false;
    let stream: MediaStream | null = null;
    // A camera pulled out mid-session ends its track; say so instead of
    // leaving a frozen picture with a working "Chụp" under it.
    const handleEnded = () => {
      if (!stopped) setStatus("unavailable");
    };

    setStatus("starting");
    void (async () => {
      try {
        stream = await openStream(deviceId);
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];
        track?.addEventListener("ended", handleEnded);
        video.srcObject = stream;
        await video.play();
        setStatus("live");
        setActiveDeviceId(track?.getSettings().deviceId);
        void keepFocusing(track);

        // Labels are only readable once permission has been given.
        const devices = await listCameras();
        if (!stopped) setCameras(devices);
      } catch (error) {
        if (!stopped) setStatus(cameraStatusOf(error));
      }
    })();

    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => {
        track.removeEventListener("ended", handleEnded);
        track.stop();
      });
      video.srcObject = null;
    };
    // `attempt` only re-runs the effect: a retry is the same request again.
  }, [deviceId, attempt]);

  const snap = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  }, []);

  return { videoRef, status, cameras, activeDeviceId, snap };
}
