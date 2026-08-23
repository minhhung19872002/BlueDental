import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import type { PagedResult } from "@/types";

export interface AuditLogDto {
  id: string;
  userId?: string;
  userName?: string;
  tenantId?: string;
  tenantName?: string;
  impersonatorUserId?: string;
  impersonatorUserName?: string;
  executionTime: string;
  executionDuration: number;
  clientIpAddress?: string;
  clientName?: string;
  browserInfo?: string;
  httpMethod?: string;
  url?: string;
  exceptions?: string;
  comments?: string;
  httpStatusCode?: number;
  applicationName?: string;
  correlationId?: string;
}

export interface AuditLogListParams {
  startTime?: string;
  endTime?: string;
  url?: string;
  userName?: string;
  applicationName?: string;
  httpMethod?: string;
  httpStatusCode?: number;
  maxExecutionDuration?: number;
  minExecutionDuration?: number;
  hasException?: boolean;
  skipCount?: number;
  maxResultCount?: number;
}

const auditLogApi = {
  list: (params?: AuditLogListParams): Promise<PagedResult<AuditLogDto>> =>
    api.get("/audit-logging/audit-logs", { params }).then((r) => r.data),
};

export function useAuditLogList(params?: AuditLogListParams) {
  return useQuery({
    queryKey: ["audit-logs", params],
    queryFn: () => auditLogApi.list({ maxResultCount: 50, ...params }),
  });
}
