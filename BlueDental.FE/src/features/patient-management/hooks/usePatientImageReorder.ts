import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  patientImageKeys,
  useReorderPatientImage,
  type PatientImagePages,
  type PatientImageType,
} from "../api/patientImageApi";
import type { PatientImageDay } from "../api/patientImageAdapters";

export interface PatientImageReorder {
  reordering: boolean;
  /** Moves the card at `from` to `to` within one day's row. */
  reorder: (day: PatientImageDay, from: number, to: number) => Promise<void>;
}

/**
 * Drag-to-sort within a day. The dragged order is written into the query
 * cache at once so nothing flashes back, then the server is told which image
 * takes which position. On failure the cache is restored and the user told.
 *
 * The positions a day's cards hold are handed out again in the new order —
 * the server does the same, renumbering the whole sequence — so the cache and
 * the database agree without waiting for the refetch.
 */
export function usePatientImageReorder(
  patientId: string,
  filter: PatientImageType | null,
): PatientImageReorder {
  const queryClient = useQueryClient();
  const mutation = useReorderPatientImage();

  const reorder = useCallback(
    async (day: PatientImageDay, from: number, to: number) => {
      const moved = day.images[from];
      const target = day.images[to];
      if (!moved || !target || from === to) return;

      const positions = day.images.map((image) => image.ordering).sort((a, b) => a - b);
      const assigned = new Map(
        arrayMove(day.images, from, to).map((image, index) => [image.id, positions[index]]),
      );

      const key = patientImageKeys.pages(patientId, filter);
      const previous = queryClient.getQueryData<PatientImagePages>(key);
      queryClient.setQueryData<PatientImagePages>(key, (data) =>
        data && {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => ({
              ...item,
              ordering: assigned.get(item.id) ?? item.ordering,
            })),
          })),
        },
      );

      try {
        await mutation.mutateAsync({ id: moved.id, ordering: target.ordering });
        await queryClient.invalidateQueries({ queryKey: patientImageKeys.all });
      } catch {
        queryClient.setQueryData(key, previous);
        toast.error(t("Không thể sắp xếp lại ảnh"));
      }
    },
    [patientId, filter, queryClient, mutation],
  );

  return { reordering: mutation.isPending, reorder };
}
