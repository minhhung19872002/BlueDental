export const QueueTicketStatus = {
  Waiting: 1,
  Called: 2,
  Serving: 3,
  Completed: 4,
  Skipped: 5,
  Expired: 6,
} as const;

export type QueueTicketStatus =
  (typeof QueueTicketStatus)[keyof typeof QueueTicketStatus];

export const QueueTicketPriority = {
  Normal: 0,
  Urgent: 1,
} as const;

export type QueueTicketPriority =
  (typeof QueueTicketPriority)[keyof typeof QueueTicketPriority];

export interface QueueTicket {
  id: string;
  clinicBranchId: string;
  queueDate: string;
  ticketNumber: number;
  displayNumber: string;
  patientId: string;
  patientName?: string;
  appointmentId?: string;
  status: QueueTicketStatus;
  priority: QueueTicketPriority;
  serviceType?: string;
  dentistId?: string;
  dentistName?: string;
  counterId?: string;
  counterName?: string;
  calledAt?: string;
  servingAt?: string;
  completedAt?: string;
  skippedAt?: string;
  callCount: number;
  note?: string;
  creationTime: string;
}

export interface CreateQueueTicketInput {
  patientId: string;
  appointmentId?: string;
  priority: QueueTicketPriority;
  serviceType?: string;
  dentistId?: string;
  counterId?: string;
  note?: string;
}

export interface CallTicketInput {
  counterId?: string;
}

export interface QueueListQuery {
  date?: string;
  status?: QueueTicketStatus;
  counterId?: string;
  skipCount?: number;
  maxResultCount?: number;
}

export interface QueueDisplayItem {
  id: string;
  displayNumber: string;
  status: QueueTicketStatus;
  priority: QueueTicketPriority;
  serviceType?: string;
  counterId?: string;
  counterName?: string;
  calledAt?: string;
  callCount: number;
}

export interface QueueStats {
  totalToday: number;
  waiting: number;
  called: number;
  serving: number;
  completed: number;
  skipped: number;
  waitingWarning: number;
  waitingDanger: number;
  averageWaitMinutes: number | null;
}

export interface WaitingTimeWarningPayload {
  branchId: string;
  warningCount: number;
  dangerCount: number;
}

export interface ServiceCounter {
  id: string;
  clinicBranchId: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateServiceCounterInput {
  name: string;
  sortOrder: number;
}

export interface UpdateServiceCounterInput {
  name: string;
  sortOrder: number;
}

export interface PagedResult<T> {
  totalCount: number;
  items: T[];
}
