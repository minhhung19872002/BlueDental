import { cloneElement, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode, type RefObject } from "react";
import { Form, Input } from "antd";
import type { Rule } from "antd/es/form";
import { t } from "@/lib/i18n";
import { PaperChoiceRow, paperFieldClass, type PaperWidth } from "./InvoicePaper";

/** What a blank hands down to the AntD control it wraps. */
interface PaperControlProps {
  id?: string;
  variant?: "borderless";
}

interface PaperInputProps {
  label: string;
  name: string;
  rules?: Rule[];
  required?: boolean;
  extra?: ReactNode;
  width?: PaperWidth;
  strong?: boolean;
  children: ReactElement<PaperControlProps>;
}

function PaperLabel({ htmlFor, label, required }: { htmlFor: string; label: ReactNode; required?: boolean }) {
  return (
    <label className="inv-paper__label" htmlFor={htmlFor}>
      {label}
      {required && (
        <span className="inv-paper__required" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

/** "Label: ……" whose dotted line is the input. */
export function PaperInput({ label, name, rules, required, extra, width, strong, children }: PaperInputProps) {
  const id = useId();
  return (
    <div className={paperFieldClass(width, strong)}>
      <PaperLabel htmlFor={id} label={`${label}:`} required={required} />
      <Form.Item name={name} rules={rules} extra={extra} className="inv-paper__control">
        {cloneElement(children, { id, variant: "borderless" })}
      </Form.Item>
    </div>
  );
}

/** The label's width, so the first written line starts after it as on paper. */
function useWidthOf(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.offsetWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

interface PaperLinedInputProps {
  label: string;
  name: string;
  rules?: Rule[];
  extra?: ReactNode;
  maxLength: number;
}

/** "Label: (hint) ……" over two dotted lines: the text starts after the label, then runs full width. */
export function PaperLinedInput({ label, name, rules, extra, maxLength }: PaperLinedInputProps) {
  const id = useId();
  const labelRef = useRef<HTMLSpanElement>(null);
  const indent = useWidthOf(labelRef);
  return (
    <div className="inv-paper__lined-field" style={{ "--paper-indent": `${indent}px` } as CSSProperties}>
      <span ref={labelRef} className="inv-paper__lined-label">
        <PaperLabel htmlFor={id} label={label} />
      </span>
      <Form.Item name={name} rules={rules} extra={extra} className="inv-paper__control">
        <Input.TextArea id={id} variant="borderless" maxLength={maxLength} autoSize={{ minRows: 2, maxRows: 6 }} />
      </Form.Item>
    </div>
  );
}

interface PaperYesNoProps {
  label: string;
  value?: boolean | null;
  onChange?: (value: boolean) => void;
}

const ANSWERS = [true, false] as const;

/** ☐ Có ☐ Không as one choice; neither is ticked until one is picked. */
function PaperYesNo({ label, value, onChange }: PaperYesNoProps) {
  return (
    <span role="radiogroup" aria-label={label} className="inv-paper__choices">
      {ANSWERS.map((answer) => (
        <button
          key={String(answer)}
          type="button"
          role="radio"
          aria-checked={value === answer}
          className="inv-paper__choice inv-paper__choice--button"
          onClick={() => onChange?.(answer)}
        >
          <span className={value === answer ? "inv-paper__box inv-paper__box--checked" : "inv-paper__box"} aria-hidden="true" />
          {answer ? t("Common:Yes") : t("Common:No")}
        </button>
      ))}
    </span>
  );
}

/** "Question: ☐ Có ☐ Không" bound to a boolean form field. */
export function PaperChoiceInput({ label, name }: { label: string; name: string }) {
  return (
    <PaperChoiceRow label={label}>
      <Form.Item name={name} noStyle>
        <PaperYesNo label={label} />
      </Form.Item>
    </PaperChoiceRow>
  );
}
