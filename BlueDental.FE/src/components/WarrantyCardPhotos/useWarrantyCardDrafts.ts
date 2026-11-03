import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { validateImageFile } from "@/utils/validateImageFile";
import {
  WARRANTY_CARD_SIDES,
  type WarrantyCardFiles,
  type WarrantyCardSide,
  type WarrantyCardUrls,
} from "./warrantyCardSide";

interface Draft {
  file: File;
  /** Object URL of the file, revoked when the draft goes. */
  url: string;
}

type DraftCard = Partial<Record<WarrantyCardSide, Draft>>;

export interface WarrantyCardDrafts {
  urlsOf: (card: number) => WarrantyCardUrls;
  filesOf: (card: number) => WarrantyCardFiles;
  pick: (card: number, side: WarrantyCardSide, file: File) => void;
  remove: (card: number, side: WarrantyCardSide) => void;
  /** Drops the drafts of these cards, e.g. once they were sent. */
  clear: (cards: number[]) => void;
}

const revoke = (card: DraftCard | undefined) =>
  WARRANTY_CARD_SIDES.forEach((side) => {
    const url = card?.[side]?.url;
    if (url) URL.revokeObjectURL(url);
  });

/**
 * The Ảnh thẻ bảo hành picked but not yet sent, one front and one back per
 * card (keyed by the caller, e.g. the tooth). A picked file that is not an
 * accepted image is refused with a toast; a face picked again replaces it.
 */
export function useWarrantyCardDrafts(): WarrantyCardDrafts {
  const [drafts, setDrafts] = useState<Record<number, DraftCard>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  useEffect(() => () => Object.values(draftsRef.current).forEach(revoke), []);

  const urlsOf = (card: number): WarrantyCardUrls =>
    Object.fromEntries(WARRANTY_CARD_SIDES.flatMap((side) => {
      const draft = drafts[card]?.[side];
      return draft ? [[side, draft.url]] : [];
    }));

  const filesOf = (card: number): WarrantyCardFiles =>
    Object.fromEntries(WARRANTY_CARD_SIDES.flatMap((side) => {
      const draft = drafts[card]?.[side];
      return draft ? [[side, draft.file]] : [];
    }));

  const replace = (card: number, side: WarrantyCardSide, draft: Draft | undefined) => {
    const gone = draftsRef.current[card]?.[side];
    if (gone) URL.revokeObjectURL(gone.url);
    setDrafts((current) => ({ ...current, [card]: { ...current[card], [side]: draft } }));
  };

  const pick = (card: number, side: WarrantyCardSide, file: File) => {
    const error = validateImageFile(file);
    if (error) {
      toast.error(`${file.name}: ${error}`);
      return;
    }
    replace(card, side, { file, url: URL.createObjectURL(file) });
  };

  const clear = useCallback((cards: number[]) => {
    cards.forEach((card) => revoke(draftsRef.current[card]));
    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([card]) => !cards.includes(Number(card)))));
  }, []);

  return { urlsOf, filesOf, pick, remove: (card, side) => replace(card, side, undefined), clear };
}
