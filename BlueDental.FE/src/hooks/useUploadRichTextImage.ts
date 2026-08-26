import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";

/**
 * Put an image from a rich-text body into storage and get back its link.
 *
 * Shared by every editor in the application — an article in Vận hành, consulting
 * data or a diagnosis in Danh mục. They all write the same HTML through the same
 * editor, so they keep their pictures the same way: the bytes in blob storage
 * and a link in the body, never base64 inside the row.
 */
export interface UploadedImage {
  id: string;
  url: string;
}

export function useUploadRichTextImage() {
  const clinicBranchId = useCurrentBranchId();

  const mutation = useMutation({
    mutationFn: async (file: File): Promise<UploadedImage> => {
      const form = new FormData();
      form.append("file", file);
      form.append("clinicBranchId", clinicBranchId);

      const response = await api.post("/v1/app/rich-text-images", form);
      return response.data;
    },
  });

  /** What `RichTextField` wants: a file in, a URL out. */
  const upload = async (file: File) => (await mutation.mutateAsync(file)).url;

  return { upload, isUploading: mutation.isPending };
}
