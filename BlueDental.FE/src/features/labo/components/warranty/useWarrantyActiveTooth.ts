import { useState } from "react";

export interface WarrantyActiveTooth {
  /** The picked tooth whose card form is open; null with nothing picked. */
  active: number | null;
  /** 0-based place of `active` among the picked teeth. */
  index: number;
  total: number;
  show: (tooth: number) => void;
  /** ‹ Răng trước (-1) / Răng tiếp theo › (+1), round the picked teeth. */
  step: (delta: number) => void;
}

/**
 * Kích hoạt bảo hành v2 (BA mock BaoHanhV2, R-1152): one tooth's card form at
 * a time. The open tooth is the last one shown while it stays picked, else the
 * first picked; ‹ › walk the picked teeth in their order, wrapping round.
 */
export function useWarrantyActiveTooth(picked: number[]): WarrantyActiveTooth {
  const [shown, setShown] = useState<number | null>(null);
  const active = shown != null && picked.includes(shown) ? shown : (picked[0] ?? null);
  const index = active == null ? -1 : picked.indexOf(active);

  return {
    active,
    index,
    total: picked.length,
    show: setShown,
    step: (delta) => {
      if (picked.length === 0) return;
      setShown(picked[(index + delta + picked.length) % picked.length]);
    },
  };
}
