import { api } from "@/lib/axios";
import type {
  CallTicketInput,
  CounterBoard,
  CreateQueueTicketInput,
  CreateServiceCounterInput,
  PagedResult,
  QueueDisplayItem,
  QueueListQuery,
  QueueStats,
  QueueTicket,
  ServiceCounter,
  UpdateServiceCounterInput,
} from "../types";

const BASE = "/v1/app/queue/tickets";
const COUNTER_BASE = "/v1/app/queue/counters";

export const queueApi = {
  list: (params: QueueListQuery): Promise<PagedResult<QueueTicket>> =>
    api.get<PagedResult<QueueTicket>>(BASE, { params }).then((r) => r.data),

  get: (id: string): Promise<QueueTicket> =>
    api.get<QueueTicket>(`${BASE}/${id}`).then((r) => r.data),

  create: (data: CreateQueueTicketInput): Promise<QueueTicket> =>
    api.post<QueueTicket>(BASE, data).then((r) => r.data),

  call: (id: string, input: CallTicketInput = {}): Promise<QueueTicket> =>
    api.post<QueueTicket>(`${BASE}/${id}/call`, input).then((r) => r.data),

  callNext: (input: CallTicketInput = {}): Promise<QueueTicket> =>
    api.post<QueueTicket>(`${BASE}/call-next`, input).then((r) => r.data),

  serve: (id: string): Promise<QueueTicket> =>
    api.post<QueueTicket>(`${BASE}/${id}/serve`).then((r) => r.data),

  complete: (id: string): Promise<QueueTicket> =>
    api.post<QueueTicket>(`${BASE}/${id}/complete`).then((r) => r.data),

  skip: (id: string): Promise<QueueTicket> =>
    api.post<QueueTicket>(`${BASE}/${id}/skip`).then((r) => r.data),

  recall: (id: string, input: CallTicketInput = {}): Promise<QueueTicket> =>
    api.post<QueueTicket>(`${BASE}/${id}/recall`, input).then((r) => r.data),

  stats: (date?: string, counterId?: string): Promise<QueueStats> =>
    api
      .get<QueueStats>("/v1/app/queue/stats", {
        params: { date: date || undefined, counterId: counterId || undefined },
      })
      .then((r) => r.data),

  display: (branchId: string, counterId?: string): Promise<QueueDisplayItem[]> =>
    api
      .get<QueueDisplayItem[]>("/v1/app/queue/display", {
        params: { branchId, counterId: counterId || undefined },
      })
      .then((r) => r.data),

  board: (): Promise<CounterBoard[]> =>
    api.get<CounterBoard[]>(`${COUNTER_BASE}/board`).then((r) => r.data),

  displayBoard: (branchId: string): Promise<CounterBoard[]> =>
    api
      .get<CounterBoard[]>("/v1/app/queue/display/board", { params: { branchId } })
      .then((r) => r.data),

  // Service Counters
  getCounters: (): Promise<ServiceCounter[]> =>
    api.get<ServiceCounter[]>(COUNTER_BASE).then((r) => r.data),

  createCounter: (data: CreateServiceCounterInput): Promise<ServiceCounter> =>
    api.post<ServiceCounter>(COUNTER_BASE, data).then((r) => r.data),

  updateCounter: (id: string, data: UpdateServiceCounterInput): Promise<ServiceCounter> =>
    api.put<ServiceCounter>(`${COUNTER_BASE}/${id}`, data).then((r) => r.data),

  toggleCounter: (id: string): Promise<ServiceCounter> =>
    api.post<ServiceCounter>(`${COUNTER_BASE}/${id}/toggle`).then((r) => r.data),

  deleteCounter: (id: string): Promise<void> =>
    api.delete(`${COUNTER_BASE}/${id}`).then(() => undefined),
};
