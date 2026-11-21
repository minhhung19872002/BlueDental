import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { t } from "@/lib/i18n";
import { MEDICAL_RECORD_FORM } from "../../../api/medicalRecordApi";
import type { FieldValues } from "./fieldValues";
import { renderSheetHtml, sheetDocument } from "./renderSheet";
import { GENERATED_ROW_ATTR } from "./rowEditing";
import { attachRowHandles } from "./rowHandles";
import { attachLineEditing } from "./lineEditing";
import { drawingOf, isDrawingField, showDrawing } from "./drawing/drawingField";
import { SheetDrawingDialogs } from "./drawing/SheetDrawingDialogs";
import { useSheetDrawing } from "./drawing/useSheetDrawing";
import {
  isMaterialField,
  materialCatalogKey,
  materialKindOf,
  materialsOf,
  parseMaterials,
  parsePicked,
  showMaterials,
} from "./materials/materialField";
import { MaterialTypeDialog } from "./materials/MaterialTypeDialog";
import { useSheetMaterials } from "./materials/useSheetMaterials";
import { attachSections } from "./sheetSections";
import { fitBlanksToLines } from "./fitBlanks";
import { holdLines } from "./holdLines";
import { whenSheetTypeReady } from "./sheetFont";
import { flowLongBlanks, flowedText, isPartOf, writeFlowed } from "./flowLines";
import { attachMultiLineSelect } from "./multiLineSelect";
import { attachSheetUndo, createSheetHistory } from "./sheetHistory";
import { attachSheetPaste } from "./sheetPaste";
import { SheetSuggestions } from "./suggestions/SheetSuggestions";
import { useSheetSuggestions } from "./suggestions/useSheetSuggestions";

/** A4 at 96dpi, plus the 20px margin the sheet's own page leaves around it. */
const PORTRAIT = { width: 834, height: 1163 };
/** Bảng kiểm an toàn phẫu thuật (mẫu 11) is printed on A4 lying on its side. */
const LANDSCAPE = { width: PORTRAIT.height, height: PORTRAIT.width };

const pageOf = (form?: number) => (form === MEDICAL_RECORD_FORM.SurgicalSafetyChecklist ? LANDSCAPE : PORTRAIT);

interface Props {
  /** Which sheet this is, so printing can find the frame drawing it. */
  sheetId: string;
  /** The blank form this sheet is printed from. */
  template: string;
  /** Which of the nine forms it is: each prints at its own type size. */
  form?: number;
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
  sheetId,
  template,
  form,
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
  const page = pageOf(form);
  const [height, setHeight] = useState(page.height);

  // Read through refs: the page is built once per documentKey, and the values
  // it started from must not rebuild it when the parent re-renders.
  const startingValues = useRef({ auto, stored });
  startingValues.current = { auto, stored };

  const report = useRef(onChange);
  report.current = onChange;

  /*
   * What the record answers, by content: the parent hands a fresh object every
   * render. When it really changes — the set's slips arrive, or one is added
   * and the end date goes — the page is drawn again so the blanks follow
   * without a reload. What has been written survives: it is in `stored`.
   */
  const autoKey = JSON.stringify(auto);

  const srcDoc = useMemo(() => {
    const body = renderSheetHtml(template, {
      auto: startingValues.current.auto,
      stored: startingValues.current.stored,
      editable,
    });
    return sheetDocument(body, editable, form);
    // Keyed on documentKey, not on the values: rebuilding the page as someone
    // types would take the caret with it. See the prop's note.
  }, [template, form, documentKey, autoKey, editable]);

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

      // A drawing is never answered by the record: it is kept when there is one.
      if (isDrawingField(node)) {
        const drawn = drawingOf(node);
        if (drawn) next[id] = drawn;
        return;
      }

      // The ticked types are kept whenever there are any — or when clearing
      // them is what was done to a sheet that had some.
      if (isMaterialField(node)) {
        const picked = materialsOf(node);
        if (picked || id in startingValues.current.stored) next[id] = picked;
        return;
      }

      if (node.tagName === "INPUT") {
        const ticked = (node as HTMLInputElement).checked;
        if (generated || ticked !== (answer === true)) next[id] = ticked;
        return;
      }

      // A long blank is drawn over several lines; it is still one value.
      const written = flowedText(node);
      if (generated || written !== (typeof answer === "string" ? answer : "")) next[id] = written;
    });

    return next;
  }, []);

  const drawing = useSheetDrawing(frame, () => report.current?.(collect()));
  const attachDrawing = drawing.attach;
  const materials = useSheetMaterials(frame, () => report.current?.(collect()));
  const attachMaterials = materials.attach;
  const suggestions = useSheetSuggestions(frame, form, editable);
  const attachSuggestions = suggestions.attach;

  const layOut = useCallback((doc: Document) => {
    // Height only: the width of a sheet of A4 does not depend on what is on it,
    // and measuring it would read a scrollbar's width off a long record.
    // Laid out now: the lines keep to one line in the larger letters, then a
    // blank whose text runs past its line goes on to lines of its own, then a
    // line the larger letters still break takes its letters down until it holds.
    fitBlanksToLines(doc);
    flowLongBlanks(doc);
    holdLines(doc);

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

    const detachDrawing = editable ? attachDrawing(doc) : () => undefined;
    // Ticking a type fills the details; ticking a method shows its part.
    const detachMaterials = editable ? attachMaterials(doc) : () => undefined;
    const detachSections = editable ? attachSections(doc) : () => undefined;

    // Lines added or taken away, and writing the sheet does itself: an edit that changes how tall it is.
    const changed = () => {
      push();
      window.requestAnimationFrame(measure);
    };
    // Ctrl+Z for what the sheet writes itself (a paste over lines, an erase, an added line); see sheetHistory.
    const history = createSheetHistory(doc, changed);
    const record = (action: () => void) => history.record(action);

    // Enter moves to the blank below, or adds one; see lineEditing.
    const detachLines = editable ? attachLineEditing(doc, changed, record) : () => undefined;

    // A selection can run across the sheet's lines, for copying; see multiLineSelect.
    const detachSelect = editable ? attachMultiLineSelect(doc, history) : () => undefined;
    // Lines pasted go on lines of their own; see sheetPaste. After multiLineSelect, which erases a selection first.
    const detachPaste = editable ? attachSheetPaste(doc, history, changed) : () => undefined;
    const detachUndo = editable ? attachSheetUndo(doc, history) : () => undefined;
    // Typing in some blanks offers what the branch wrote there before; see useSheetSuggestions.
    const detachSuggestions = editable ? attachSuggestions(doc) : () => undefined;

    frame.current?.addEventListener(
      "beforeunload",
      () => {
        observer.disconnect();
        doc.removeEventListener("input", push);
        doc.removeEventListener("change", push);
        detachHandles();
        detachDrawing();
        detachLines();
        detachSelect();
        detachPaste();
        detachUndo();
        detachSuggestions();
        detachMaterials();
        detachSections();
      },
      { once: true },
    );
  }, [collect, editable, canAddRows, canDeleteRows, attachDrawing, attachMaterials, attachSuggestions]);

  // The lines are fitted by measuring them, so in the letters they are drawn
  // in — where those had to be fetched, once they are in (sheetFont).
  const handleLoad = useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    whenSheetTypeReady(doc, () => {
      // Reloaded or closed while the letters were on their way.
      if (frame.current?.contentDocument !== doc || !doc.defaultView) return;
      layOut(doc);
    });
  }, [layOut]);

  // A page swapped out while its observers are live would keep measuring a
  // document nobody can see.
  useEffect(() => () => setHeight(page.height), [srcDoc, page.height]);

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
      if (!node || isPartOf(node, doc.activeElement)) continue;
      // A form's MS is print (R-1069): a code stored on the sheet before must
      // not overwrite it when the stored values arrive again.
      if (node.hasAttribute("data-form-code")) continue;

      if (isDrawingField(node)) {
        if (drawingOf(node) !== value) showDrawing(node, value, editable);
        continue;
      }

      if (isMaterialField(node)) {
        if (materialsOf(node) !== value) {
          const catalog = parseMaterials(startingValues.current.auto[materialCatalogKey(materialKindOf(node))]);
          showMaterials(node, catalog, parsePicked(value), editable);
        }
        continue;
      }

      if (node.tagName === "INPUT") {
        const box = node as HTMLInputElement;
        if (typeof value === "boolean" && box.checked !== value) box.checked = value;
        continue;
      }
      if (typeof value === "string" && flowedText(node) !== value) {
        writeFlowed(node, value);
        window.requestAnimationFrame(() => setHeight(Math.ceil(doc.documentElement.scrollHeight)));
      }
    }
  }, [stored, editable]);

  return (
    <div
      className="mr-doc"
      data-sheet-id={sheetId}
      style={{ "--mr-zoom": zoom } as CSSProperties}
    >
      <iframe
        ref={frame}
        className="mr-doc-frame"
        title={t("Patient:View:MedicalRecord")}
        srcDoc={srcDoc}
        onLoad={handleLoad}
        style={{ width: page.width, height }}
      />
      {editable && <SheetDrawingDialogs drawing={drawing} />}
      {editable && <MaterialTypeDialog materials={materials} />}
      {editable && (
        <SheetSuggestions
          open={suggestions.open}
          onPick={suggestions.pick}
          onHighlight={suggestions.highlight}
          onMore={suggestions.more}
        />
      )}
    </div>
  );
}
