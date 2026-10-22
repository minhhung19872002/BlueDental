import { useMemo, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import {
  MESSAGE_CHANNEL,
  useSampleCustomer,
  useTemplatePreview,
  type PreviewTemplateInput,
} from "../api/templateApi";
import { hasComposed, type TemplateForm } from "./useTemplateEditor";

/**
 * XEM TRƯỚC: the text as one real customer of the branch would get it. "Đổi
 * khách" asks the server for anyone but the one on screen; the preview itself
 * waits for the user to stop typing.
 */
export function useEditorPreview(form: TemplateForm) {
  const [exceptId, setExceptId] = useState<string | null>(null);
  const sample = useSampleCustomer(exceptId);
  const patientId = sample.data?.patientId ?? null;

  const { channel, content, subject, paramMap, removeDiacritics } = form;
  const input = useMemo<PreviewTemplateInput>(
    () => ({
      channel,
      content: channel === MESSAGE_CHANNEL.Zalo ? null : content,
      subject: channel === MESSAGE_CHANNEL.Email ? subject : null,
      paramMap: channel === MESSAGE_CHANNEL.Zalo ? paramMap : null,
      removeDiacritics: channel === MESSAGE_CHANNEL.Sms && removeDiacritics,
      patientId,
    }),
    [channel, content, subject, paramMap, removeDiacritics, patientId],
  );
  const debounced = useDebounce(input);
  const composed = hasComposed(form);
  const preview = useTemplatePreview(debounced, composed && !sample.isLoading);

  const changeCustomer = () => setExceptId(patientId);

  return {
    customer: sample.data,
    preview: composed ? preview.data : undefined,
    changeCustomer,
    changing: sample.isFetching,
  };
}
