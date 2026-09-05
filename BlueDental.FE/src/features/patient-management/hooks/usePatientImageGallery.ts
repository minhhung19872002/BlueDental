import { useCallback, useMemo, useState } from "react";
import { useLoadMoreSentinel } from "@/hooks/useLoadMoreSentinel";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { usePatientImagePages, type PatientImageType } from "../api/patientImageApi";
import {
  adaptPatientImage,
  groupImagesByDay,
  type PatientImageDay,
  type PatientImageViewModel,
} from "../api/patientImageAdapters";

export interface PatientImageGallery {
  branchId: string;
  /** The "Giai đoạn điều trị" filter; null is "tất cả", which is how the tab opens. */
  filter: PatientImageType | null;
  setFilter: (filter: PatientImageType | null) => void;
  clearFilter: () => void;
  /** Every loaded image in feed order — what the viewer pages through. */
  images: PatientImageViewModel[];
  days: PatientImageDay[];
  /** First page still on its way. */
  isLoading: boolean;
  /** A later page is on its way. */
  isLoadingMore: boolean;
  /** Any request in flight, for the spinner overlay. */
  isFetching: boolean;
  hasMore: boolean;
  /** Put on the element at the foot of the timeline. */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * The Hình ảnh tab's reading side: filter, paged feed, and the day-by-day
 * grouping the timeline draws. The filter lives in state, not the URL, as the
 * reference keeps it.
 */
export function usePatientImageGallery(patientId: string): PatientImageGallery {
  const branchId = useCurrentBranchId();
  const [filter, setFilter] = useState<PatientImageType | null>(null);
  const query = usePatientImagePages(patientId, branchId, filter);

  const images = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.items).map(adaptPatientImage),
    [query.data],
  );
  const days = useMemo(() => groupImagesByDay(images), [images]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  const sentinelRef = useLoadMoreSentinel(Boolean(hasNextPage) && !isFetchingNextPage, loadMore);

  const clearFilter = useCallback(() => setFilter(null), []);

  return {
    branchId,
    filter,
    setFilter,
    clearFilter,
    images,
    days,
    isLoading: query.isPending,
    isLoadingMore: isFetchingNextPage,
    isFetching: query.isFetching,
    hasMore: Boolean(hasNextPage),
    sentinelRef,
  };
}
