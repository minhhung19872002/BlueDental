import { useEffect, useMemo, useState } from "react";
import {
  TAXONOMY_GROUP,
  useCatalogEntries,
  useTaxonomyGroups,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "@/features/taxonomy/api/taxonomyApi";
import { useDebounce } from "@/hooks/useDebounce";

/** The reference reads the sheet at 125% in the dialog and 75% full-screen; ±25 a step, 50–300. */
export const ZOOM = { min: 50, max: 300, step: 25, dialog: 125, fullscreen: 75 } as const;

/** The reference pages its contents 20 at a time. */
const PAGE = 20;

export interface ConsultingLibrary {
  topics: TaxonomyDto[];
  topicsLoading: boolean;
  topicSearch: string;
  setTopicSearch: (value: string) => void;
  topic: TaxonomyDto | null;
  topicIndex: number;
  selectTopic: (topic: TaxonomyDto) => void;
  contents: CatalogEntryDto[];
  contentsLoading: boolean;
  contentsTotal: number;
  contentSearch: string;
  setContentSearch: (value: string) => void;
  content: CatalogEntryDto | null;
  contentIndex: number;
  selectContent: (content: CatalogEntryDto) => void;
  contentsError: boolean;
  retryContents: () => void;
  hasMore: boolean;
  loadMore: () => void;
  zoom: number;
  setZoom: (update: (value: number) => number) => void;
  inverted: boolean;
  toggleInverted: () => void;
}

/**
 * What "Thư viện ảnh lâm sàng" reads: the topics are the taxonomy groups of
 * Dữ liệu tư vấn, searched on the server; the contents are the entries of the
 * chosen topic, paged in twenties. The first of each is picked as soon as it
 * arrives, so the sheet is never blank while there is something to show.
 */
export function useConsultingLibrary(
  branchId: string | undefined,
  fullscreen: boolean,
): ConsultingLibrary {
  const [topicSearch, setTopicSearch] = useState("");
  const [contentSearch, setContentSearch] = useState("");
  const [topicId, setTopicId] = useState<string | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [zoom, setZoom] = useState<number>(ZOOM.dialog);
  const [inverted, setInverted] = useState(false);

  const group = TAXONOMY_GROUP.ConsultingData;
  const topicsQuery = useTaxonomyGroups(branchId, group, useDebounce(topicSearch));
  const topics = useMemo(() => topicsQuery.data?.items ?? [], [topicsQuery.data]);
  const topicIndex = topics.findIndex((item) => item.id === topicId);
  const topic = topics[topicIndex] ?? null;

  const contentsQuery = useCatalogEntries(branchId, group, {
    scope: "group",
    taxonomyId: topic?.id,
    filter: useDebounce(contentSearch),
    skipCount: 0,
    maxResultCount: limit,
  });
  const contents = useMemo(() => contentsQuery.data?.items ?? [], [contentsQuery.data]);
  const contentsTotal = contentsQuery.data?.totalCount ?? 0;
  const contentIndex = contents.findIndex((item) => item.id === contentId);
  const content = contents[contentIndex] ?? null;

  // The first topic opens as it arrives; a search that drops the open one
  // moves on to the first match. Same for the contents once they have settled.
  useEffect(() => {
    if (topics.length > 0 && !topics.some((item) => item.id === topicId)) {
      setTopicId(topics[0].id);
    }
  }, [topics, topicId]);
  useEffect(() => {
    if (contentsQuery.isFetching) return;
    setContentId((current) =>
      contents.some((item) => item.id === current) ? current : (contents[0]?.id ?? null),
    );
  }, [contents, contentsQuery.isFetching]);
  useEffect(() => setZoom(fullscreen ? ZOOM.fullscreen : ZOOM.dialog), [fullscreen]);

  const selectTopic = (next: TaxonomyDto) => {
    setTopicId(next.id);
    setContentSearch("");
    setLimit(PAGE);
  };

  return {
    topics,
    topicsLoading: topicsQuery.isFetching,
    topicSearch,
    setTopicSearch,
    topic,
    topicIndex,
    selectTopic,
    contents,
    contentsLoading: contentsQuery.isFetching,
    contentsTotal,
    contentSearch,
    setContentSearch,
    content,
    contentIndex,
    selectContent: (next) => setContentId(next.id),
    contentsError: contentsQuery.isError,
    retryContents: () => void contentsQuery.refetch(),
    hasMore: contents.length < contentsTotal,
    loadMore: () => setLimit((value) => value + PAGE),
    zoom,
    setZoom,
    inverted,
    toggleInverted: () => setInverted((value) => !value),
  };
}
