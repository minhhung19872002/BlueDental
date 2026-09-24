import type { QrSighting } from "../../hooks/useQrCamera";
import { useSmoothedCorners } from "../../hooks/useSmoothedCorners";

interface Props {
  sighting: QrSighting;
}

/** Just outside the code's own edge, so the brackets hug it without covering it. */
const GROW = 1.05;
/** How far along each edge a corner bracket runs. */
const ARM = 0.26;

type Point = { x: number; y: number };

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

const at = ({ x, y }: Point) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/**
 * Corner brackets around the QR where the camera found it, gliding with the
 * card as Zalo's do. The SVG is laid out in the video's own pixels and fitted
 * the way the video is (`object-fit: contain` ↔ `xMidYMid meet`), so a point of
 * the frame lands on the same pixel of the picture.
 */
export function QrBox({ sighting }: Props) {
  const { frameWidth, frameHeight } = sighting;
  const smoothed = useSmoothedCorners(sighting.corners);
  if (!smoothed) return null;

  const corners = smoothed.map((p) => ({ x: p.x * frameWidth, y: p.y * frameHeight }));
  const center = {
    x: corners.reduce((sum, p) => sum + p.x, 0) / corners.length,
    y: corners.reduce((sum, p) => sum + p.y, 0) / corners.length,
  };
  const quad = corners.map((p) => lerp(center, p, GROW));

  const brackets = quad
    .map((corner, i) => {
      const previous = quad[(i + quad.length - 1) % quad.length];
      const next = quad[(i + 1) % quad.length];
      return `M ${at(lerp(corner, previous, ARM))} L ${at(corner)} L ${at(lerp(corner, next, ARM))}`;
    })
    .join(" ");

  return (
    <svg
      className="bd-idscan-box"
      viewBox={`0 0 ${frameWidth} ${frameHeight}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <polygon className="bd-idscan-box-fill" points={quad.map(at).join(" ")} />
      <path className="bd-idscan-box-edge" d={brackets} />
    </svg>
  );
}
