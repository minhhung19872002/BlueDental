import { useEffect, useState } from "react";
import { warrantyToothFormId } from "./laboWarrantyRules";

export interface WarrantyToothJump {
  /** The tooth whose row was pressed last, ringed with its card form. */
  focused: number | null;
  jumpTo: (tooth: number) => void;
}

/**
 * A row in 1. Chọn răng kích hoạt scrolls its tooth's card form into view.
 * The tick lets a second press on the same row scroll again; the effect runs
 * after the render that mounts a just-picked tooth's form.
 */
export function useWarrantyToothJump(): WarrantyToothJump {
  const [jump, setJump] = useState<{ tooth: number; tick: number } | null>(null);

  useEffect(() => {
    if (!jump) return;
    document.getElementById(warrantyToothFormId(jump.tooth))?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [jump]);

  return {
    focused: jump?.tooth ?? null,
    jumpTo: (tooth) => setJump((current) => ({ tooth, tick: (current?.tick ?? 0) + 1 })),
  };
}
