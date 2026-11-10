import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workScheduleApi, type WorkScheduleItemInput } from "./workScheduleApi";
import { adaptBoard } from "./workScheduleAdapters";

export const workScheduleKeys = {
  all: ["work-schedule"] as const,
  board: (year: number, month: number) => [...workScheduleKeys.all, "board", year, month] as const,
};

/** One month of the Lịch làm việc board; `month` is 1-12. */
export function useWorkScheduleBoard(year: number, month: number) {
  return useQuery({
    queryKey: workScheduleKeys.board(year, month),
    queryFn: async () => adaptBoard(await workScheduleApi.board(year, month)),
  });
}

export function useSaveWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: WorkScheduleItemInput[]) => workScheduleApi.save(items),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workScheduleKeys.all });
    },
  });
}
