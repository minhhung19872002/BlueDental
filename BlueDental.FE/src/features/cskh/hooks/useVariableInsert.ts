import { useState } from "react";
import { MESSAGE_CHANNEL, type ZnsTemplateParam } from "../api/templateApi";
import { quoteVariable } from "../messageVariables";
import type { CaretField } from "./useCaretField";
import type { TemplateForm } from "./useTemplateEditor";

/** The box a library or chip click writes into: the last one the user was in. */
export type InsertTarget = { kind: "content" } | { kind: "subject" } | { kind: "param"; name: string };

interface InsertFields {
  content: CaretField;
  subject: CaretField;
}

/**
 * "Biến hay dùng" chips and the Thư viện biến "+": SMS and Email write at the
 * caret of Nội dung (or Tiêu đề, when the user was there last); Zalo has no
 * free text, so the variable goes to the ZNS parameter in focus, else the first
 * one still unmapped.
 */
export function useVariableInsert(
  form: TemplateForm,
  setParamMap: (paramMap: Record<string, string>) => void,
  fields: InsertFields,
  znsParams: readonly ZnsTemplateParam[],
) {
  const [target, setTarget] = useState<InsertTarget>({ kind: "content" });
  const isZalo = form.channel === MESSAGE_CHANNEL.Zalo;

  const paramToFill = (): string | undefined => {
    if (target.kind === "param" && znsParams.some((param) => param.name === target.name)) return target.name;
    return (znsParams.find((param) => !form.paramMap[param.name]) ?? znsParams[0])?.name;
  };

  const insert = (key: string) => {
    const token = quoteVariable(key);
    if (!isZalo) {
      const toSubject = target.kind === "subject" && form.channel === MESSAGE_CHANNEL.Email;
      (toSubject ? fields.subject : fields.content).insertAtCaret(token);
      return;
    }
    const name = paramToFill();
    if (!name) return;
    const current = form.paramMap[name]?.trim();
    setParamMap({ ...form.paramMap, [name]: current ? `${current} ${token}` : token });
  };

  return {
    insert,
    canInsert: !isZalo || znsParams.length > 0,
    focusOn: setTarget,
  };
}

export type VariableInserter = ReturnType<typeof useVariableInsert>;
