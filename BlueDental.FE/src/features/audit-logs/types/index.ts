// TODO: Define audit log types.

export interface AuditLogDto {
  id: string;
  userId: string;
  userName: string;
  serviceName: string;
  methodName: string;
  parameters: string | null;
  executionTime: string;
  executionDuration: number;
  clientIpAddress: string | null;
  httpMethod: string | null;
  httpStatusCode: number | null;
}
