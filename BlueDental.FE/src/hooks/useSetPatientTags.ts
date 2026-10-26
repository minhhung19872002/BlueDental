import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";

/**
 * Thẻ hồ sơ — replaces the record's tags alone.
 *
 * Shared rather than feature-local: the record's own picker and the Tiếp nhận
 * card both tick tags, and the card has no full hồ sơ to send back with them.
 */
export function useSetPatientTags(patientId: string) {
  return useMutation({
    mutationFn: async (tagIds: string[]): Promise<string[]> => {
      const response = await api.put<{ tagIds: string[] }>(`/v1/app/patients/${patientId}/tags`, {
        tagIds,
      });
      return response.data.tagIds;
    },
    // The patient's own screens and the Tiếp nhận board both print the tags.
    meta: { invalidates: ["patient"] },
  });
}
