import { useCallback, useMemo } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import type { PagedResult } from "@/types";
import {
  patientImageKeys,
  useReorderPatientImage,
  type PatientImageDto,
  type PatientImagePages,
  type PatientImageType,
} from "../api/patientImageApi";
import type { PatientImageDay, PatientImageViewModel } from "../api/patientImageAdapters";

export interface PatientImageReorder {
  reordering: boolean;
  /** Moves the card at `from` to `to` within one day's row. */
  reorder: (day: PatientImageDay, from: number, to: number) => Promise<void>;
}

/**
 * The positions a day's cards hold, handed out again in the new order — the
 * server does the same, renumbering the whole sequence — so the cache and the
 * database agree without waiting for the refetch.
 */
export function reassignOrdering(
  images: PatientImageViewModel[],
  from: number,
  to: number,
): Map<string, number> {
  const positions = images.map((image) => image.ordering).sort((a, b) => a - b);
  return new Map(arrayMove(images, from, to).map((image, index) => [image.id, positions[index]]));
}

type Assigned = Map<string, number>;
type Patch<TData> = (data: TData, assigned: Assigned) => TData;

const renumber = (items: PatientImageDto[], assigned: Assigned): PatientImageDto[] =>
  items.map((item) => ({ ...item, ordering: assigned.get(item.id) ?? item.ordering }));

const patchPages: Patch<PatientImagePages> = (data, assigned) => ({
  ...data,
  pages: data.pages.map((page) => ({ ...page, items: renumber(page.items, assigned) })),
});

const patchList: Patch<PagedResult<PatientImageDto>> = (data, assigned) => ({
  ...data,
  items: renumber(data.items, assigned),
});

/**
 * Drag-to-sort within a day. The dragged order is written into the query
 * cache at once so nothing flashes back, then the server is told which image
 * takes which position. On failure the cache is restored and the user told.
 */
function useReorderWithCache<TData>(key: QueryKey, patch: Patch<TData>): PatientImageReorder {
  const queryClient = useQueryClient();
  const mutation = useReorderPatientImage();

  const reorder = useCallback(
    async (day: PatientImageDay, from: number, to: number) => {
      const moved = day.images[from];
      const target = day.images[to];
      if (!moved || !target || from === to) return;

      const assigned = reassignOrdering(day.images, from, to);
      const previous = queryClient.getQueryData<TData>(key);
      queryClient.setQueryData<TData>(key, (data) => (data ? patch(data, assigned) : data));

      try {
        await mutation.mutateAsync({ id: moved.id, ordering: target.ordering });
        await queryClient.invalidateQueries({ queryKey: patientImageKeys.all });
      } catch {
        queryClient.setQueryData(key, previous);
        toast.error(t("Không thể sắp xếp lại ảnh"));
      }
    },
    [key, patch, queryClient, mutation],
  );

  return { reordering: mutation.isPending, reorder };
}

/** The Hình ảnh timeline: its cache is the paged feed for one type filter. */
export function usePatientImageReorder(
  patientId: string,
  filter: PatientImageType | null,
): PatientImageReorder {
  const key = useMemo(() => patientImageKeys.pages(patientId, filter), [patientId, filter]);
  return useReorderWithCache(key, patchPages);
}

/** The consulting tab's "Chọn ảnh hiển thị": its cache is the flat list. */
export function useConsultingImageReorder(patientId: string): PatientImageReorder {
  const key = useMemo(() => patientImageKeys.list(patientId), [patientId]);
  return useReorderWithCache(key, patchList);
}
