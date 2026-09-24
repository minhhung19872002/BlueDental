import { useEffect, useRef, useState } from "react";
import type { QrCorners } from "../utils/qr/qrDecoder";

/** How quickly the drawn box catches up with the detected one. */
const TIME_CONSTANT_MS = 70;
/** A jump this large (fraction of the frame) is a new code, not a moved one. */
const SNAP_DISTANCE = 0.2;
/** Close enough to stop animating. */
const SETTLED = 0.0005;

function farApart(a: QrCorners, b: QrCorners): boolean {
  return a.some((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y) > SNAP_DISTANCE);
}

function settled(a: QrCorners, b: QrCorners): boolean {
  return a.every((p, i) => Math.abs(p.x - b[i].x) < SETTLED && Math.abs(p.y - b[i].y) < SETTLED);
}

/**
 * The detected corners arrive in steps, one per decoded frame. Drawn as they
 * come the box jumps; this eases it towards each new position every animation
 * frame, so it glides with the card the way Zalo's does.
 */
export function useSmoothedCorners(target: QrCorners | null): QrCorners | null {
  const [shown, setShown] = useState<QrCorners | null>(target);
  const targetRef = useRef(target);
  const present = target !== null;

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  useEffect(() => {
    if (!present) {
      setShown(null);
      return undefined;
    }

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const ease = 1 - Math.exp(-(now - last) / TIME_CONSTANT_MS);
      last = now;
      setShown((previous) => {
        const goal = targetRef.current;
        if (!goal) return null;
        if (!previous || previous === goal || farApart(previous, goal)) return goal;
        const eased = previous.map((p, i) => ({
          x: p.x + (goal[i].x - p.x) * ease,
          y: p.y + (goal[i].y - p.y) * ease,
        }));
        // Landing exactly on the goal lets React skip the next renders.
        return settled(eased, goal) ? goal : eased;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [present]);

  return shown;
}
