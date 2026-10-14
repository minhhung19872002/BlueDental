import { useCallback, useRef, useState, type RefObject } from "react";
import { attachDrawingControls, showDrawing, type DrawingAction } from "./drawingField";

export interface DrawingRequest {
  fieldId: string;
  action: DrawingAction;
  /** What the blank held when its button was pressed. */
  source: string;
}

/**
 * The drawing blanks on an open sheet: which one asked for its dialog, and
 * putting the result back on the sheet.
 *
 * The picture goes onto the sheet's own document, like a typed word does, and
 * is reported from there through `onChanged` — the same path every other edit
 * takes back to the page's unsaved values.
 */
export function useSheetDrawing(frame: RefObject<HTMLIFrameElement | null>, onChanged: () => void) {
  const [request, setRequest] = useState<DrawingRequest | null>(null);

  const changed = useRef(onChanged);
  changed.current = onChanged;

  /** Listens on a freshly loaded sheet; returns the call that stops. */
  const attach = useCallback(
    (doc: Document) =>
      attachDrawingControls(doc, (fieldId, action, source) => setRequest({ fieldId, action, source })),
    [],
  );

  const put = useCallback(
    (source: string) => {
      const doc = frame.current?.contentDocument;
      const node = request
        ? doc?.querySelector(`[data-medical-record-field="${CSS.escape(request.fieldId)}"]`)
        : null;
      if (node) {
        showDrawing(node, source, true);
        changed.current();
      }
      setRequest(null);
    },
    [frame, request],
  );

  const close = useCallback(() => setRequest(null), []);
  const remove = useCallback(() => put(""), [put]);

  return { request, attach, apply: put, remove, close };
}

export type SheetDrawing = ReturnType<typeof useSheetDrawing>;
