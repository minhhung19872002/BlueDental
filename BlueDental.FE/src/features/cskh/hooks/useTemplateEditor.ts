import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { notifyApiError } from "@/lib/notify";
import type { CareType } from "../api/careApi";
import {
  MESSAGE_CHANNEL,
  useCreateTemplate,
  useUpdateTemplate,
  type MessageChannel,
  type MessageTemplateDto,
  type SaveTemplateInput,
} from "../api/templateApi";
import { removeVariable } from "../messageVariables";

/** What the editor holds; one channel's fields are filled, the others stay empty. */
export interface TemplateForm {
  channel: MessageChannel;
  name: string;
  purpose: CareType | null;
  content: string;
  subject: string;
  externalTemplateId: string | null;
  paramMap: Record<string, string>;
  removeDiacritics: boolean;
}

/** BA img_08 opens on Mẫu SMS, with "Tự bỏ dấu tiếng Việt" ticked. */
export const EMPTY_TEMPLATE_FORM: TemplateForm = {
  channel: MESSAGE_CHANNEL.Sms,
  name: "",
  purpose: null,
  content: "",
  subject: "",
  externalTemplateId: null,
  paramMap: {},
  removeDiacritics: true,
};

/** A Zalo template's content is the server's "k: v · k: v" summary, not something to edit. */
export function formOf(dto: MessageTemplateDto): TemplateForm {
  const isZalo = dto.channel === MESSAGE_CHANNEL.Zalo;
  return {
    channel: dto.channel,
    name: dto.name,
    purpose: dto.purpose,
    content: isZalo ? "" : dto.content,
    subject: dto.subject ?? "",
    externalTemplateId: dto.externalTemplateId,
    paramMap: dto.paramMap,
    removeDiacritics: dto.removeDiacritics,
  };
}

/** Anything a channel switch would throw away. */
export function hasComposed(form: TemplateForm): boolean {
  return (
    form.content.trim() !== "" ||
    form.subject.trim() !== "" ||
    form.externalTemplateId !== null ||
    Object.keys(form.paramMap).length > 0
  );
}

function toSaveInput(form: TemplateForm, publish: boolean): SaveTemplateInput {
  const isZalo = form.channel === MESSAGE_CHANNEL.Zalo;
  return {
    publish,
    name: form.name.trim(),
    purpose: form.purpose,
    content: isZalo ? null : form.content,
    subject: form.channel === MESSAGE_CHANNEL.Email ? form.subject : null,
    externalTemplateId: isZalo ? form.externalTemplateId : null,
    paramMap: isZalo ? form.paramMap : null,
    removeDiacritics: form.channel === MESSAGE_CHANNEL.Sms && form.removeDiacritics,
  };
}

/** The editor mounts once per template (keyed by id), so `initial` is read once. */
export function useTemplateForm(initial: TemplateForm) {
  const [form, setForm] = useState(initial);
  const [baseline, setBaseline] = useState(initial);

  const update = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const reset = (next: TemplateForm) => {
    setForm(next);
    setBaseline(next);
  };

  const switchChannel = (channel: MessageChannel) => {
    setForm((current) => ({
      ...current,
      channel,
      content: "",
      subject: "",
      externalTemplateId: null,
      paramMap: {},
    }));
  };

  /** The × on a "Biến đang dùng" chip; a ZNS parameter left with nothing is unmapped again. */
  const dropVariable = (key: string) => {
    setForm((current) => {
      const paramMap: Record<string, string> = {};
      for (const [name, value] of Object.entries(current.paramMap)) {
        const left = removeVariable(value, key).trim();
        if (left) paramMap[name] = left;
      }
      return {
        ...current,
        content: removeVariable(current.content, key),
        subject: removeVariable(current.subject, key),
        paramMap,
      };
    });
  };

  return {
    form,
    dirty: JSON.stringify(form) !== JSON.stringify(baseline),
    update,
    reset,
    switchChannel,
    dropVariable,
  };
}

export type SaveKind = "draft" | "publish";

export function useSaveTemplate(
  id: string | undefined,
  form: TemplateForm,
  onSaved: (saved: MessageTemplateDto, kind: SaveKind) => void,
) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const [pending, setPending] = useState<SaveKind | null>(null);

  const save = (kind: SaveKind) => {
    const input = toSaveInput(form, kind === "publish");
    const request = id
      ? update.mutateAsync({ id, ...input })
      : create.mutateAsync({ ...input, channel: form.channel });
    setPending(kind);
    request
      .then((saved) => onSaved(saved, kind))
      .catch(notifyApiError)
      .finally(() => setPending(null));
  };

  return { save, pending };
}

interface NavigateTarget {
  to: string;
  replace: boolean;
}

/**
 * Navigates once the form reads clean. A save resets the baseline in the same
 * click that wants to leave, and the leave guard still holds the old `dirty`
 * until React commits it — so the move waits for the next render. Call it after
 * useUnsavedChangesGuard so the blocker sees the clean form first.
 */
export function useNavigateWhenClean(dirty: boolean) {
  const navigate = useNavigate();
  const [target, setTarget] = useState<NavigateTarget | null>(null);

  useEffect(() => {
    if (!target || dirty) return;
    setTarget(null);
    navigate(target.to, { replace: target.replace });
  }, [target, dirty, navigate]);

  return (to: string, replace = false) => setTarget({ to, replace });
}
