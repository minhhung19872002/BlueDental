import { useMutation, useQueryClient } from "@tanstack/react-query";
import { xrayInboxHttp } from "./xrayInboxApi";
import { xrayInboxKeys } from "./xrayInboxQueries";

/** The patient Hình ảnh tab's cache; an assigned picture lands there. */
const PATIENT_IMAGE_KEYS = ["patient-images"] as const;

function useXrayInboxMutation<TInput, TData>(run: (input: TInput) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: xrayInboxKeys.all });
      void queryClient.invalidateQueries({ queryKey: PATIENT_IMAGE_KEYS });
    },
  });
}

/** "Gán hồ sơ": the picture joins the record's "Trước điều trị" column. */
export const useAssignXrayInboxItem = () => useXrayInboxMutation(xrayInboxHttp.assign);
/** "Bỏ qua": the picture leaves the list and its file is deleted; the log row stays. */
export const useDiscardXrayInboxItem = () => useXrayInboxMutation(xrayInboxHttp.discard);
