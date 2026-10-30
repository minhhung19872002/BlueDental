import { useCallback, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { LaboOrderImageDto } from "@/features/labo/api/laboApi";
import type { LaboPictureTile } from "./LaboPictureWell";
import { useLaboPictures, validImages } from "./useLaboPictures";

/** Hình ảnh gửi Labo: at most five, those kept and those added together (P2910_03). */
export const LABO_MAX_PICTURES = 5;

const DRAFT_KEY = "draft:";

export interface LaboPictureTiles {
  /** The kept pictures first, then the drafts, as the well shows them. */
  tiles: LaboPictureTile[];
  /** Drafts still to be uploaded. */
  pictures: File[];
  /** Saved pictures still on the strip; an update drops every other one. */
  keepImageIds: string[];
  addPictures: (files: File[]) => void;
  removeTile: (tile: LaboPictureTile) => void;
  /** Starts over from an order's saved pictures; a check round's Ảnh kiểm tra are not this strip's. */
  reset: (saved: LaboOrderImageDto[]) => void;
}

/**
 * The Hình ảnh gửi Labo strip of the Đặt hàng tab: a reopened Nháp shows its
 * saved pictures beside the new drafts, and the five-picture cap counts both.
 */
export function useLaboPictureTiles(): LaboPictureTiles {
  const drafts = useLaboPictures();
  const resetDrafts = drafts.reset;
  const [saved, setSaved] = useState<LaboOrderImageDto[]>([]);

  const tiles: LaboPictureTile[] = [
    ...saved.map((image) => ({ key: image.id, url: image.url, name: image.fileName })),
    ...drafts.pictures.map((file, index) => ({
      key: `${DRAFT_KEY}${index}`,
      url: drafts.previews[index],
      name: file.name,
    })),
  ];

  const addPictures = (files: File[]) => {
    const valid = validImages(files);
    const room = Math.max(LABO_MAX_PICTURES - tiles.length, 0);
    if (valid.length > room) toast.error(t("Labo:Workflow:MaxImages", LABO_MAX_PICTURES));
    drafts.addPictures(valid.slice(0, room));
  };

  const removeTile = (tile: LaboPictureTile) => {
    if (tile.key.startsWith(DRAFT_KEY)) drafts.removePicture(Number(tile.key.slice(DRAFT_KEY.length)));
    else setSaved((current) => current.filter((image) => image.id !== tile.key));
  };

  const reset = useCallback(
    (images: LaboOrderImageDto[]) => {
      setSaved(images.filter((image) => image.roundNo == null));
      resetDrafts();
    },
    [resetDrafts],
  );

  return {
    tiles,
    pictures: drafts.pictures,
    keepImageIds: saved.map((image) => image.id),
    addPictures,
    removeTile,
    reset,
  };
}
