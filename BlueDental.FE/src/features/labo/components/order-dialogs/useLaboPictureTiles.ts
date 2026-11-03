import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { isWarrantyCardPhoto, type LaboOrderImageDto } from "@/features/labo/api/laboApi";
import type { LaboToothPicture } from "@/features/labo/api/laboMutations";
import type { LaboPictureTile } from "./LaboPictureWell";
import { validImages } from "./useLaboPictures";

/** Each set of pictures holds at most five, those kept and those added together (P2910_03, P3110). */
export const LABO_MAX_PICTURES = 5;

/** Ảnh đính kèm chung, or the Ảnh cell of a tooth row — 0 for the "Dùng chung" row (P3110 G2). */
export type LaboPictureSet = "common" | number;

const DRAFT_KEY = "draft:";

interface Draft {
  id: number;
  set: LaboPictureSet;
  file: File;
  /** Minted once on add and revoked on removal, never in a render. */
  url: string;
}

/** What one save sends: the new files of each set and the saved pictures still shown. */
export interface LaboPictureUpload {
  pictures: File[];
  toothPictures: LaboToothPicture[];
  keepImageIds: string[];
}

export interface LaboPictureTiles {
  /** The kept pictures first, then the drafts, as a well shows them. */
  tilesOf: (set: LaboPictureSet) => LaboPictureTile[];
  addPictures: (set: LaboPictureSet, files: File[]) => void;
  removeTile: (tile: LaboPictureTile) => void;
  /**
   * The common set and the tooth sets the table shows: pictures of the other
   * mode stay on screen while «Dùng chung» is toggled but are dropped on save.
   */
  upload: (toothSets: number[]) => LaboPictureUpload;
  /** Starts over from an order's saved pictures; a check round's Ảnh kiểm tra are not the order's. */
  reset: (saved: LaboOrderImageDto[]) => void;
}

const setOf = (image: LaboOrderImageDto): LaboPictureSet => image.toothNumber ?? "common";

/**
 * The pictures of the Đặt hàng tab: Ảnh đính kèm chung and one set per row of
 * Thông số từng răng. A reopened Nháp shows its saved pictures beside the new
 * drafts, and the five-picture cap counts both.
 */
export function useLaboPictureTiles(): LaboPictureTiles {
  const [saved, setSaved] = useState<LaboOrderImageDto[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const nextId = useRef(0);
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  useEffect(() => () => draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.url)), []);

  const tilesOf = (set: LaboPictureSet): LaboPictureTile[] => [
    ...saved.filter((image) => setOf(image) === set).map((image) => ({ key: image.id, url: image.url, name: image.fileName })),
    ...drafts
      .filter((draft) => draft.set === set)
      .map((draft) => ({ key: `${DRAFT_KEY}${draft.id}`, url: draft.url, name: draft.file.name })),
  ];

  const addPictures = (set: LaboPictureSet, files: File[]) => {
    const valid = validImages(files);
    const room = Math.max(LABO_MAX_PICTURES - tilesOf(set).length, 0);
    if (valid.length > room) toast.error(t("Labo:Workflow:MaxImages", LABO_MAX_PICTURES));
    const added = valid.slice(0, room).map((file) => ({ id: nextId.current++, set, file, url: URL.createObjectURL(file) }));
    if (added.length > 0) setDrafts((current) => [...current, ...added]);
  };

  const removeTile = (tile: LaboPictureTile) => {
    if (!tile.key.startsWith(DRAFT_KEY)) {
      setSaved((current) => current.filter((image) => image.id !== tile.key));
      return;
    }
    const id = Number(tile.key.slice(DRAFT_KEY.length));
    const gone = drafts.find((draft) => draft.id === id);
    if (gone) URL.revokeObjectURL(gone.url);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  };

  const upload = (toothSets: number[]): LaboPictureUpload => {
    const sent = (set: LaboPictureSet) => set === "common" || toothSets.includes(set);
    return {
      pictures: drafts.filter((draft) => draft.set === "common").map((draft) => draft.file),
      toothPictures: drafts
        .filter((draft): draft is Draft & { set: number } => draft.set !== "common" && sent(draft.set))
        .map((draft) => ({ tooth: draft.set, file: draft.file })),
      keepImageIds: saved.filter((image) => sent(setOf(image))).map((image) => image.id),
    };
  };

  const reset = useCallback((images: LaboOrderImageDto[]) => {
    setSaved(images.filter((image) => image.roundNo == null && !isWarrantyCardPhoto(image)));
    draftsRef.current.forEach((draft) => URL.revokeObjectURL(draft.url));
    setDrafts([]);
  }, []);

  return { tilesOf, addPictures, removeTile, upload, reset };
}
