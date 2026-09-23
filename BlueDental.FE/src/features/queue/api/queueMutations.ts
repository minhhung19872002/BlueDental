import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queueApi } from "./queueApi";
import { queueKeys } from "./queueQueries";
import type {
  CallTicketInput,
  CreateQueueTicketInput,
  CreateServiceCounterInput,
  UpdateServiceCounterInput,
} from "../types";

function useInvalidateQueue() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queueKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: queueKeys.statsBase() });
  };
}

export function useCreateQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "create"],
    mutationFn: (data: CreateQueueTicketInput) => queueApi.create(data),
    onSuccess: invalidate,
  });
}

export function useCallQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "call"],
    mutationFn: ({ id, input }: { id: string; input: CallTicketInput }) =>
      queueApi.call(id, input),
    onSuccess: invalidate,
  });
}

export function useCallNextQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "callNext"],
    mutationFn: (input: CallTicketInput) => queueApi.callNext(input),
    onSuccess: invalidate,
  });
}

export function useServeQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "serve"],
    mutationFn: (id: string) => queueApi.serve(id),
    onSuccess: invalidate,
  });
}

export function useCompleteQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "complete"],
    mutationFn: (id: string) => queueApi.complete(id),
    onSuccess: invalidate,
  });
}

export function useSkipQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "skip"],
    mutationFn: (id: string) => queueApi.skip(id),
    onSuccess: invalidate,
  });
}

export function useRecallQueueTicket() {
  const invalidate = useInvalidateQueue();
  return useMutation({
    mutationKey: ["queue", "recall"],
    mutationFn: ({ id, input }: { id: string; input: CallTicketInput }) =>
      queueApi.recall(id, input),
    onSuccess: invalidate,
  });
}

// Service Counter mutations
export function useCreateServiceCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["queue", "createCounter"],
    mutationFn: (data: CreateServiceCounterInput) => queueApi.createCounter(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.counters() });
    },
  });
}

export function useUpdateServiceCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["queue", "updateCounter"],
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceCounterInput }) =>
      queueApi.updateCounter(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.counters() });
    },
  });
}

export function useToggleServiceCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["queue", "toggleCounter"],
    mutationFn: (id: string) => queueApi.toggleCounter(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.counters() });
    },
  });
}

export function useDeleteServiceCounter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["queue", "deleteCounter"],
    mutationFn: (id: string) => queueApi.deleteCounter(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queueKeys.counters() });
    },
  });
}
