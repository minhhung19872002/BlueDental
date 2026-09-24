import { useEffect, useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  LABO_STATUS,
  useSaveLaboOrderDetail,
  type LaboOrderDto,
  type LaboStatus,
} from "@/features/labo/api/laboApi";
import type { LaboPictureTile } from "./LaboPictureWell";
import { useLaboPictures } from "./useLaboPictures";

const DRAFT_PREFIX = "draft:";

export interface LaboDetailEditor {
  status: LaboStatus;
  /** Refused, with the reference's toast, when a non-new order is cancelled. */
  pickStatus: (next: LaboStatus) => void;
  /** Saved pictures still kept, then the drafts, in that order. */
  tiles: LaboPictureTile[];
  addPictures: (files: File[]) => void;
  removeTile: (tile: LaboPictureTile) => void;
  saving: boolean;
  /** Resolves true once the server took it; the dialog then closes. */
  save: () => Promise<boolean>;
}

/**
 * What the Mẫu Labo detail dialog edits: the status and the picture strip.
 * Everything restarts from the order whenever another row opens, and Lưu
 * sends the lot in one multipart PUT (docs/clone/api.md, labo-orders detail).
 */
export function useLaboDetailEditor(order: LaboOrderDto | null): LaboDetailEditor {
  const mutation = useSaveLaboOrderDetail();
  const drafts = useLaboPictures();
  const [status, setStatus] = useState<LaboStatus>(LABO_STATUS.Draft);
  const [keptIds, setKeptIds] = useState<string[]>([]);
  const resetDrafts = drafts.reset;

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setKeptIds(order.images.map((image) => image.id));
    resetDrafts();
  }, [order, resetDrafts]);

  const pickStatus = (next: LaboStatus) => {
    // The reference stops it on the client, before any request goes up.
    if (next === LABO_STATUS.Rejected && order?.status !== LABO_STATUS.Draft) {
      toast.error(t("BlueDental:Labo:0012"));
      return;
    }
    setStatus(next);
  };

  const saved: LaboPictureTile[] = (order?.images ?? [])
    .filter((image) => keptIds.includes(image.id))
    .map((image) => ({ key: image.id, url: image.url, name: image.fileName }));
  const pending: LaboPictureTile[] = drafts.pictures.map((file, index) => ({
    key: `${DRAFT_PREFIX}${index}`,
    url: drafts.previews[index],
    name: file.name,
  }));

  const removeTile = (tile: LaboPictureTile) => {
    if (tile.key.startsWith(DRAFT_PREFIX)) {
      drafts.removePicture(Number(tile.key.slice(DRAFT_PREFIX.length)));
    } else {
      setKeptIds((current) => current.filter((id) => id !== tile.key));
    }
  };

  const save = async () => {
    if (!order) return false;
    try {
      await mutation.mutateAsync({
        id: order.id,
        input: { status, keepImageIds: keptIds, pictures: drafts.pictures },
      });
      toast.success(t("Patient:Labo:Saved"));
      return true;
    } catch {
      // The global MutationCache already toasts the server's message; the
      // dialog stays open so the fix can be made in place.
      return false;
    }
  };

  return {
    status,
    pickStatus,
    tiles: [...saved, ...pending],
    addPictures: drafts.addPictures,
    removeTile,
    saving: mutation.isPending,
    save,
  };
}
