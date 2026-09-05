import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { Popover, Tooltip } from "antd";
import { Palette, PenOff, Undo2 } from "lucide-react";
import { t } from "@/lib/i18n";

interface Point {
  x: number;
  y: number;
}
interface Stroke {
  color: string;
  size: number;
  points: Point[];
}

/** Pen colours offered in the palette; data, not styling. */
const PEN_COLORS = ["#e5484d", "#f5a524", "#0e9f6e", "#2671d8", "#ffffff", "#171c33"];
const PEN_SIZES = { min: 1, max: 20 };

interface Props {
  /** The pen is out: the layer takes the pointer and shows its controls. */
  active: boolean;
  onExit: () => void;
}

function paint(canvas: HTMLCanvasElement, strokes: Stroke[]) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = window.devicePixelRatio || 1;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.beginPath();
    stroke.points.forEach((point, index) =>
      index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y),
    );
    context.stroke();
  }
}

/**
 * Freehand "Vẽ chú thích" over the picture: a canvas the size of the stage,
 * one stroke per pointer gesture, undo one stroke at a time. Nothing is saved
 * — the drawing is a pointer for the person looking over one's shoulder and
 * goes when the viewer moves to another image.
 */
export function ViewerAnnotationLayer({ active, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [color, setColor] = useState(PEN_COLORS[0] ?? "#e5484d");
  const [size, setSize] = useState(4);
  const current = useRef<Stroke | null>(null);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * ratio);
    canvas.height = Math.round(canvas.clientHeight * ratio);
    paint(canvas, current.current ? [...strokes, current.current] : strokes);
  }, [strokes]);

  useEffect(() => {
    fit();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [fit]);

  const pointOf = (event: PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    current.current = { color, size, points: [pointOf(event)] };
  };
  const handleMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const stroke = current.current;
    const canvas = canvasRef.current;
    if (!stroke || !canvas) return;
    stroke.points.push(pointOf(event));
    paint(canvas, [...strokes, stroke]);
  };
  const handleUp = () => {
    const stroke = current.current;
    current.current = null;
    if (stroke) setStrokes((all) => [...all, stroke]);
  };
  const undo = () => setStrokes((all) => all.slice(0, -1));

  const palette = (
    <div className="pi-pen-palette">
      <div className="pi-pen-colors">
        {PEN_COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={["pi-pen-swatch", swatch === color && "pi-pen-swatch--active"].filter(Boolean).join(" ")}
            style={{ "--pi-swatch": swatch } as CSSProperties}
            aria-label={swatch}
            aria-pressed={swatch === color}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>
      <label className="pi-pen-size">
        <span>{t("Độ dày")}</span>
        <input
          type="range"
          min={PEN_SIZES.min}
          max={PEN_SIZES.max}
          value={size}
          onChange={(event) => setSize(Number(event.target.value))}
        />
      </label>
    </div>
  );

  return (
    <>
      <canvas
        ref={canvasRef}
        className={["pi-annotation", active && "pi-annotation--active"].filter(Boolean).join(" ")}
        aria-hidden="true"
        onPointerDown={active ? handleDown : undefined}
        onPointerMove={active ? handleMove : undefined}
        onPointerUp={active ? handleUp : undefined}
        onPointerCancel={active ? handleUp : undefined}
      />
      {active && (
        <div className="pi-pen-tools" role="toolbar" aria-label={t("Vẽ chú thích")}>
          <Popover content={palette} trigger="click" placement="bottom">
            <Tooltip title={t("Đổi màu hoặc độ dày nét vẽ")}>
              <button type="button" className="pi-pen-tool" aria-label={t("Đổi màu hoặc độ dày nét vẽ")}>
                <Palette size={18} />
              </button>
            </Tooltip>
          </Popover>
          <Tooltip title={t("Hoàn tác nét vẽ")}>
            <button type="button" className="pi-pen-tool" aria-label={t("Hoàn tác nét vẽ")} disabled={strokes.length === 0} onClick={undo}>
              <Undo2 size={18} />
            </button>
          </Tooltip>
          <Tooltip title={t("Tắt chế độ vẽ")}>
            <button type="button" className="pi-pen-tool" aria-label={t("Tắt chế độ vẽ")} onClick={onExit}>
              <PenOff size={18} />
            </button>
          </Tooltip>
        </div>
      )}
    </>
  );
}
