export const QueueTicketStatus = {
  Waiting: 1,
  Called: 2,
  Serving: 3,
  Completed: 4,
  Skipped: 5,
  Expired: 6,
} as const;

export type QueueTicketStatus = (typeof QueueTicketStatus)[keyof typeof QueueTicketStatus];

export const QueueTicketPriority = {
  Normal: 0,
  Urgent: 1,
} as const;

export type QueueTicketPriority = (typeof QueueTicketPriority)[keyof typeof QueueTicketPriority];

export interface QueueTicket {
  id: string;
  clinicBranchId: string;
  queueDate: string;
  ticketNumber: number;
  displayNumber: string;
  /** A walk-in takes a number before any record exists. */
  patientId?: string;
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
  patientId?: string;
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
  dentistId?: string | null;
  dentistName?: string | null;
  numberPrefix: string;
  startNumber: number;
  autoResetDaily: boolean;
  waitWarningMinutes: number;
  minutesPerPatient: number;
  /** "Hiện đã cấp đến A018"; null until the current run hands out a number. */
  lastIssuedNumber?: string | null;
  /** Numbers waiting at, or being seen by, this counter. */
  inQueueCount: number;
}

export interface CreateServiceCounterInput {
  name: string;
  sortOrder: number;
  dentistId?: string | null;
  numberPrefix: string;
  startNumber: number;
  autoResetDaily: boolean;
  waitWarningMinutes: number;
  minutesPerPatient: number;
}

export type UpdateServiceCounterInput = CreateServiceCounterInput;

/** One counter on the board and the TV: its dentist, the number it sees and its own queue. No PHI. */
export interface CounterBoard {
  id: string;
  name: string;
  isActive: boolean;
  numberPrefix: string;
  dentistId?: string | null;
  dentistName?: string | null;
  waitWarningMinutes: number;
  /** Today's real average once a visit has finished, else the configured value. */
  minutesPerPatient: number;
  current: BoardTicket | null;
  /** The first numbers of the counter's queue, in calling order. */
  upcoming: BoardTicket[];
  waitingCount: number;
  longestWaitMinutes: number;
  /** How long a number taken now would wait. */
  newTicketWaitMinutes: number;
}

export interface BoardTicket {
  id: string;
  displayNumber: string;
  status: QueueTicketStatus;
  priority: QueueTicketPriority;
  serviceType?: string | null;
  calledAt?: string | null;
}

/** "Hàng chờ · Quầy số 2": one counter's waiting list with its estimates. */
export interface CounterQueue {
  counter: CounterBoard;
  configuredMinutesPerPatient: number;
  actualMinutesPerPatient: number | null;
  /** The number the counter will hand out next, e.g. "B016". */
  nextNumber: string;
  waiting: CounterQueueRow[];
}

export interface CounterQueueRow {
  id: string;
  displayNumber: string;
  priority: QueueTicketPriority;
  serviceType?: string | null;
  takenAt: string;
  waitedMinutes: number;
  estimatedCallAt: string;
}

export interface PagedResult<T> {
  totalCount: number;
  items: T[];
}
