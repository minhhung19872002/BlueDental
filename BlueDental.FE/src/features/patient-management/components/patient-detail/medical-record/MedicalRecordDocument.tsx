import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FieldValues } from "./fieldValues";
import { renderSheetHtml, sheetDocument } from "./renderSheet";
import { GENERATED_ROW_ATTR } from "./rowEditing";
import { attachRowHandles } from "./rowHandles";

/** A4 at 96dpi, plus the 20px margin the sheet's own page leaves around it. */
const PAGE_WIDTH = 834;
const PAGE_HEIGHT = 1163;

interface Props {
  /** The blank form this sheet is printed from. */
  template: string;
  /** Facts from the record and the letterhead. */
  auto: FieldValues;
  /** What has been written on this sheet. */
  stored: FieldValues;
  /**
   * Changes identity when the sheet being shown changes, or when the server
   * hands back a newer copy of it. The page is rebuilt only then: rebuilding
   * it as someone types would take the caret with it.
   */
  documentKey: string;
  editable: boolean;
  /** 1 = 100%. */
  zoom: number;
  /** Whether this form's table offers `+` and `−` on the row under the pointer. */
  canAddRows?: boolean;
  canDeleteRows?: boolean;
  onChange?: (next: FieldValues) => void;
}

/**
 * One record, drawn in its own document.
 *
 * The sheet is an iframe rather than part of the page: it is Times New Roman at
 * a fixed 13px on a 210mm page, and BlueDental's own stylesheet reaching it
 * would move the layout off the printed original. Editing happens inside that
 * document — the blanks are `contenteditable`, exactly as the reference has
 * them — and what is typed is reported out; it is never pushed back in, which
 * is what keeps the caret still.
 */
export function MedicalRecordDocument({
  template,
  auto,
  stored,
  documentKey,
  editable,
  zoom,
  canAddRows = false,
  canDeleteRows = false,
  onChange,
}: Props) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(PAGE_HEIGHT);

  // Read through refs: the page is built once per documentKey, and the values
  // it started from must not rebuild it when the parent re-renders.
  const startingValues = useRef({ auto, stored });
  startingValues.current = { auto, stored };

  const report = useRef(onChange);
  report.current = onChange;

  const srcDoc = useMemo(() => {
    const body = renderSheetHtml(template, {
      auto: startingValues.current.auto,
      stored: startingValues.current.stored,
      editable,
    });
    return sheetDocument(body);
    // Keyed on documentKey, not on the values: rebuilding the page as someone
    // types would take the caret with it. See the prop's note.
  }, [template, documentKey, editable]);

  /**
   * What has been written on the sheet, read back off its own document.
   *
   * Only what differs from the record is kept. A blank left as the record
   * answered it stays absent, so a later correction to the patient still shows
   * through — storing the answer would freeze it.
   *
   * `instanceof HTMLInputElement` would be wrong here: the sheet is a separate
   * document with its own copy of every DOM class, so a checkbox inside it is
   * not an instance of ours. The tag name is what crosses that line.
   */
  const collect = useCallback((): FieldValues => {
    const doc = frame.current?.contentDocument;
    const next: FieldValues = {};
    if (!doc) return next;

    const { auto } = startingValues.current;

    doc.querySelectorAll("[data-medical-record-field]").forEach((node) => {
      const id = node.getAttribute("data-medical-record-field");
      if (!id) return;
      const source = node.getAttribute("data-field-source") ?? id;
      const answer = id in auto ? auto[id] : auto[source];

      /*
       * A row the clinic added is kept whole, even where its cells are empty:
       * on that row the emptiness *is* the information — it is what says the
       * row exists at all, and the sheet is drawn back from these values.
       */
      const generated = Boolean(node.closest(`[${GENERATED_ROW_ATTR}]`));

      if (node.tagName === "INPUT") {
        const ticked = (node as HTMLInputElement).checked;
        if (generated || ticked !== (answer === true)) next[id] = ticked;
        return;
      }

      const written = node.textContent ?? "";
      if (generated || written !== (typeof answer === "string" ? answer : "")) next[id] = written;
    });

    return next;
  }, []);

  const handleLoad = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;

    // Height only: the width of a sheet of A4 does not depend on what is on it,
    // and measuring it would read a scrollbar's width off a long record.
    const measure = () => {
      const next = Math.ceil(doc.documentElement.scrollHeight);
      if (next > 0) setHeight((current) => (current === next ? current : next));
    };
    measure();

    // Typing grows the page; the frame has no scrollbar of its own, so it has
    // to grow with it.
    const observer = new ResizeObserver(measure);
    observer.observe(doc.body);

    const push = () => report.current?.(collect());
    doc.addEventListener("input", push);
    doc.addEventListener("change", push);

    // Adding or removing a row is an edit like any other, and it changes how
    // tall the sheet is.
    const detachHandles =
      editable && (canAddRows || canDeleteRows)
        ? attachRowHandles(doc, {
            canAdd: canAddRows,
            canDelete: canDeleteRows,
            onChanged: () => {
              push();
              window.requestAnimationFrame(measure);
            },
          })
        : () => undefined;

    frame.current?.addEventListener(
      "beforeunload",
      () => {
        observer.disconnect();
        doc.removeEventListener("input", push);
        doc.removeEventListener("change", push);
        detachHandles();
      },
      { once: true },
    );
  }, [collect, editable, canAddRows, canDeleteRows]);

  // A page swapped out while its observers are live would keep measuring a
  // document nobody can see.
  useEffect(() => () => setHeight(PAGE_HEIGHT), [srcDoc]);

  /*
   * A value written from outside the sheet — the day picked in the heading, say
   * — reaches the open document rather than waiting for a reload. The blank
   * under the caret is left alone, so this can never fight someone's typing,
   * and values that already agree are not touched.
   */
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;

    for (const [id, value] of Object.entries(stored)) {
      const node = doc.querySelector(`[data-medical-record-field="${id}"]`);
      if (!node || node === doc.activeElement) continue;

      if (node.tagName === "INPUT") {
        const box = node as HTMLInputElement;
        if (typeof value === "boolean" && box.checked !== value) box.checked = value;
        continue;
      }
      if (typeof value === "string" && node.textContent !== value) node.textContent = value;
    }
  }, [stored]);

  return (
    <div className="mr-doc" style={{ "--mr-zoom": zoom } as CSSProperties}>
      <iframe
        ref={frame}
        className="mr-doc-frame"
        title="Bệnh án"
        srcDoc={srcDoc}
        onLoad={handleLoad}
        style={{ width: PAGE_WIDTH, height }}
      />
    </div>
  );
}
