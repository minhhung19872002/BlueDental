import { useEffect, useState } from "react";
import { cameraSupported, listCameras } from "../utils/camera/cameraStream";

/**
 * - `checking`: not known yet (the first look takes a few milliseconds).
 * - `available`: at least one camera is plugged in.
 * - `none`: no camera on this machine.
 * - `insecure`: the page is plain HTTP, where browsers never offer a camera.
 */
export type CameraAvailability = "checking" | "available" | "none" | "insecure";

/**
 * Whether this machine has a camera, before anything is opened. Browsers list
 * a camera even before permission is given — only its name stays hidden — so
 * asking does not prompt anyone. A webcam or intraoral camera plugged in (or
 * pulled out) while the page is open is picked up straight away.
 */
export function useCameraAvailability(): CameraAvailability {
  const [availability, setAvailability] = useState<CameraAvailability>(() =>
    cameraSupported() ? "checking" : "insecure",
  );

  useEffect(() => {
    if (!cameraSupported()) return undefined;
    const devices = navigator.mediaDevices;
    let stale = false;

    const check = async () => {
      try {
        const cameras = await listCameras();
        if (!stale) setAvailability(cameras.length > 0 ? "available" : "none");
      } catch {
        if (!stale) setAvailability("none");
      }
    };

    void check();
    devices.addEventListener("devicechange", check);
    return () => {
      stale = true;
      devices.removeEventListener("devicechange", check);
    };
  }, []);

  return availability;
}
