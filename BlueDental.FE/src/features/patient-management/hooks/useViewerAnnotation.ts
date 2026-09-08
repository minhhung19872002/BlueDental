import { useCallback, useState } from "react";

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationStroke {
  color: string;
  size: number;
  /** In the picture's own layout pixels, so the stroke follows every transform. */
  points: AnnotationPoint[];
}

/** Preset pen colours, in the reference's order; the palette adds a free pick. */
export const PEN_COLORS = ["#2563eb", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6", "#1f2937"];
/** The three thicknesses the reference's "Độ dày nét" offers. */
export const PEN_SIZE_OPTIONS = [2, 4, 6];
const DEFAULT_COLOR = PEN_COLORS[0] ?? "#2563eb";
const DEFAULT_SIZE = 4;

export interface ViewerAnnotation {
  strokes: AnnotationStroke[];
  color: string;
  size: number;
  canUndo: boolean;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
  commit: (stroke: AnnotationStroke) => void;
  undo: () => void;
  clear: () => void;
}

/**
 * The finished strokes of "Vẽ chú thích" and the pen's colour and thickness.
 * The stroke being drawn lives in the canvas until the pointer lifts, so the
 * viewer does not re-render on every move. Nothing here is ever saved.
 */
export function useViewerAnnotation(): ViewerAnnotation {
  const [strokes, setStrokes] = useState<AnnotationStroke[]>([]);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [size, setSize] = useState(DEFAULT_SIZE);

  const commit = useCallback(
    (stroke: AnnotationStroke) => setStrokes((all) => [...all, stroke]),
    [],
  );
  const undo = useCallback(() => setStrokes((all) => all.slice(0, -1)), []);
  const clear = useCallback(() => setStrokes([]), []);

  return {
    strokes,
    color,
    size,
    canUndo: strokes.length > 0,
    setColor,
    setSize,
    commit,
    undo,
    clear,
  };
}
