import { useCallback, useRef, useState, type RefObject } from "react";
import { attachMaterialControls, putMaterial, type MaterialRequest, type SheetMaterial } from "./materialField";

/**
 * The "Loại" blanks on an open sheet: which one asked for the dialog, and the
 * saved type put back onto the sheet. Like a drawing, the change goes onto the
 * sheet's own document and is reported from there through `onChanged`.
 */
export function useSheetMaterials(frame: RefObject<HTMLIFrameElement | null>, onChanged: () => void) {
  const [request, setRequest] = useState<MaterialRequest | null>(null);

  const changed = useRef(onChanged);
  changed.current = onChanged;

  const attach = useCallback(
    (doc: Document) => attachMaterialControls(doc, setRequest, () => changed.current()),
    [],
  );

  const apply = useCallback(
    (material: SheetMaterial) => {
      const doc = frame.current?.contentDocument;
      if (doc && request) {
        putMaterial(doc, request.fieldId, material, request.materialId === null);
        changed.current();
      }
      setRequest(null);
    },
    [frame, request],
  );

  const close = useCallback(() => setRequest(null), []);

  return { request, attach, apply, close };
}

export type SheetMaterials = ReturnType<typeof useSheetMaterials>;
