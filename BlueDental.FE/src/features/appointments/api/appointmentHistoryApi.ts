import { api } from "@/lib/axios";
import { t } from "@/lib/i18n";
import type { PagedResult } from "../types/appointment";
import type {
  HistoryEntry,
  HistoryFilter,
  HistoryPage,
  HistoryPaging,
  HistoryStats,
  ServerAppointmentChangeLogDto,
  ServerHistoryStatsDto,
} from "../types/appointmentHistory";
import {
  adaptHistoryEntry,
  adaptHistoryStats,
  toServerListParams,
} from "./appointmentHistoryAdapters";

const BASE = "/v1/app/appointment-change-log";

/** Enough for one patient's whole history; the export fetches it in one go. */
const EXPORT_PAGE: HistoryPaging = { skipCount: 0, maxResultCount: 1000 };
const STATS_PAGE: HistoryPaging = { skipCount: 0, maxResultCount: 1 };

/** ASP.NET Core binds repeated keys (`statuses=1&statuses=2`), not `statuses[]`. */
const PARAM_SERIALIZER = { indexes: null };

export const appointmentHistoryApi = {
  list: async (filter: HistoryFilter, paging: HistoryPaging): Promise<HistoryPage> => {
    const page = await api
      .get<PagedResult<ServerAppointmentChangeLogDto>>(BASE, {
        params: toServerListParams(filter, paging),
        paramsSerializer: PARAM_SERIALIZER,
      })
      .then((r) => r.data);
    const systemActor = t("Hệ thống");
    return {
      totalCount: page.totalCount,
      items: page.items.map((dto) => adaptHistoryEntry(dto, systemActor)),
    };
  },

  listAll: async (filter: HistoryFilter): Promise<HistoryEntry[]> =>
    (await appointmentHistoryApi.list(filter, EXPORT_PAGE)).items,

  stats: async (filter: HistoryFilter): Promise<HistoryStats> => {
    const dto = await api
      .get<ServerHistoryStatsDto>(`${BASE}/stats`, {
        params: toServerListParams(filter, STATS_PAGE),
        paramsSerializer: PARAM_SERIALIZER,
      })
      .then((r) => r.data);
    return adaptHistoryStats(dto);
  },
};
