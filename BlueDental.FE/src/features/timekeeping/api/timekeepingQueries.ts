import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  timekeepingApi,
  type AttendanceInput,
  type BulkRegisterInput,
  type GetTimeKeepingListInput,
  type OpenWorkDayInput,
  type TimeKeepingRecordDto,
  type UpdateInfoInput,
} from "./timekeepingApi";

export const timekeepingKeys = {
  all: ["timekeeping"] as const,
  lists: () => [...timekeepingKeys.all, "list"] as const,
  list: (params: GetTimeKeepingListInput) => [...timekeepingKeys.lists(), params] as const,
  summary: (branchId: string, date: string) =>
    [...timekeepingKeys.all, "summary", branchId, date] as const,
};

export function useTimeKeepingList(params: GetTimeKeepingListInput) {
  return useQuery({
    queryKey: timekeepingKeys.list(params),
    queryFn: () => timekeepingApi.list(params),
  });
}

export function useTimeKeepingSummary(clinicBranchId: string | undefined, workDate: string) {
  return useQuery({
    queryKey: timekeepingKeys.summary(clinicBranchId ?? "all", workDate),
    queryFn: () => timekeepingApi.summary(clinicBranchId, workDate),
    enabled: Boolean(workDate),
  });
}

/** Invalidates both the board and its KPI bar after any attendance change. */
function useAttendanceMutation<TVariables, TData = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: timekeepingKeys.all });
    },
  });
}

export function useOpenWorkDay() {
  return useAttendanceMutation((input: OpenWorkDayInput) => timekeepingApi.openWorkDay(input));
}

export function useRegisterWorking() {
  return useAttendanceMutation((id: string) => timekeepingApi.registerWorking(id));
}

export function useRegisterDayOff() {
  return useAttendanceMutation(({ id, reason }: { id: string; reason?: string }) =>
    timekeepingApi.registerDayOff(id, reason),
  );
}

export function useCheckIn() {
  return useAttendanceMutation(({ id, input }: { id: string; input: AttendanceInput }) =>
    timekeepingApi.checkIn(id, input),
  );
}

export function useCheckOut() {
  return useAttendanceMutation(({ id, input }: { id: string; input: AttendanceInput }) =>
    timekeepingApi.checkOut(id, input),
  );
}

export function useUpdateInfo() {
  return useAttendanceMutation(({ id, input }: { id: string; input: UpdateInfoInput }) =>
    timekeepingApi.updateInfo(id, input),
  );
}

export function useBulkRegister() {
  return useAttendanceMutation((input: BulkRegisterInput) =>
    timekeepingApi.bulkRegister(input),
  );
}
