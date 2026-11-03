import { useCallback, useMemo } from "react";
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
  /** Every loaded image in feed order — what the viewer pages through. */
  images: PatientImageViewModel[];
  days: PatientImageDay[];
  /** How many pictures the stage holds on the server (that match the search), loaded or not. */
  total: number;
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
 * One "Giai đoạn điều trị" column of the Hình ảnh tab, reading side: its
 * paged feed — only the pictures whose note matches `search`, when one is
 * typed — and the day-by-day grouping the column draws.
 */
export function usePatientImageGallery(
  patientId: string,
  type: PatientImageType,
  search: string,
): PatientImageGallery {
  const branchId = useCurrentBranchId();
  const query = usePatientImagePages(patientId, branchId, type, search);

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

  return {
    branchId,
    images,
    days,
    total: query.data?.pages[0]?.totalCount ?? 0,
    isLoading: query.isPending,
    isLoadingMore: isFetchingNextPage,
    isFetching: query.isFetching,
    hasMore: Boolean(hasNextPage),
    sentinelRef,
  };
}
