import { offsetInFlowed, placeCaretAt } from "./flowCaret";
import { FLOW_BREAK, flowOwner, flowedText, lineEnd, renameFlowed, writeFlowed } from "./flowLines";
import { GENERATED_ROW_ATTR } from "./rowEditing";

/**
 * Ctrl+Z / Ctrl+Y for what the sheet itself writes (clinic, 2026-11-21,
 * R-1263): a paste over several lines, erasing a selection across lines, and a
 * line Enter adds or Backspace takes away. The browser keeps its own undo for
 * what is typed, but it knows nothing of these: they rewrite blanks whole and
 * add lines of their own.
 *
 * Each step keeps the sheet's writing before and after it — every blank's
 * value, its id and the added line it sits on. Ctrl+Z puts back the "before"
 * only while the sheet is still exactly as the step left it; anything typed
 * since is the browser's to undo first, and once that is undone the sheet is
 * as the step left it again. Ctrl+Y works the same way the other round.
 *
 * Steps the browser recorded before one of these, in a blank it rewrote, have
 * nothing left to act on: those blanks were written anew.
 */

const TEXT_BLANK = '[data-medical-record-field][data-field-type="text"]';
/** A blank, or a line one flowed onto: where Ctrl+Z on the sheet is ours to take. */
const ANY_TEXT_BLANK = '[data-field-type="text"]';
const FLOW_OF = "data-flow-of";
const LIMIT = 100;

interface BlankState {
  blank: Element;
  id: string;
  text: string;
  /** The added line the blank sits on, or null for one the form prints. */
  line: Element | null;
}

interface SheetState {
  blanks: BlankState[];
  caret: { blank: Element; offset: number } | null;
}

interface Step {
  before: SheetState;
  after: SheetState;
  tag?: string;
}

export interface RecordOptions {
  /** Names the step, for one that follows to `join`. */
  tag?: string;
  /** Folds this step into the last one when that carries this tag and nothing came between. */
  join?: string;
}

export interface SheetHistory {
  /** Runs `action` and keeps it as one step, if it changed any writing. */
  record(action: () => void, options?: RecordOptions): void;
  /** Takes back the last step; false when the sheet is not as it left it. */
  undo(): boolean;
  redo(): boolean;
  /** Something new was written: what was undone cannot be done again. */
  forgetRedo(): void;
}

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/** Every blank's value, from one pass over the lines that flowed. */
function texts(doc: Document, blanks: readonly Element[]): string[] {
  const flowed = new Map<string, Element[]>();
  doc.querySelectorAll(`[${FLOW_OF}]`).forEach((line) => {
    const of = line.getAttribute(FLOW_OF) ?? "";
    flowed.set(of, [...(flowed.get(of) ?? []), line]);
  });
  return blanks.map((blank) =>
    (flowed.get(blank.getAttribute("data-medical-record-field") ?? "") ?? []).reduce(
      (text, line) => `${text}${line.getAttribute(FLOW_BREAK) === "hard" ? "\n" : " "}${line.textContent ?? ""}`,
      blank.textContent ?? "",
    ),
  );
}

function caretOf(doc: Document): SheetState["caret"] {
  const selection = doc.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const host = elementOf(range.startContainer)?.closest(ANY_TEXT_BLANK);
  const owner = host ? flowOwner(host) : null;
  if (!owner) return null;
  const offset = offsetInFlowed(owner, range.startContainer, range.startOffset);
  return offset === null ? null : { blank: owner, offset };
}

function snapshot(doc: Document): SheetState {
  const blanks = Array.from(doc.querySelectorAll(TEXT_BLANK));
  const values = texts(doc, blanks);
  return {
    blanks: blanks.map((blank, at) => ({
      blank,
      id: blank.getAttribute("data-medical-record-field") ?? "",
      text: values[at],
      line: blank.closest(`p[${GENERATED_ROW_ATTR}]`),
    })),
    caret: caretOf(doc),
  };
}

function same(a: SheetState, b: SheetState): boolean {
  return (
    a.blanks.length === b.blanks.length &&
    a.blanks.every((state, at) => {
      const other = b.blanks[at];
      return state.blank === other.blank && state.id === other.id && state.text === other.text;
    })
  );
}

/** Puts the sheet's writing back as `target` had it. */
function restore(doc: Document, target: SheetState) {
  const kept = new Set(target.blanks.map((state) => state.blank));

  // Lines the step added go.
  doc.querySelectorAll(`p[${GENERATED_ROW_ATTR}] ${TEXT_BLANK}`).forEach((blank) => {
    if (kept.has(blank)) return;
    writeFlowed(blank, "");
    blank.closest(`p[${GENERATED_ROW_ATTR}]`)?.remove();
  });

  // Lines it took away come back, each after the blank that came before it.
  target.blanks.forEach((state, at) => {
    const previous = target.blanks[at - 1]?.blank;
    if (!state.line || state.line.isConnected || !previous) return;
    lineEnd(previous).insertAdjacentElement("afterend", state.line);
  });

  renameFlowed(
    target.blanks
      .filter((state) => state.blank.getAttribute("data-medical-record-field") !== state.id)
      .map((state) => ({ field: state.blank, id: state.id })),
  );
  for (const state of target.blanks) {
    if (flowedText(state.blank) !== state.text) writeFlowed(state.blank, state.text);
  }
  if (target.caret) placeCaretAt(target.caret.blank, target.caret.offset);
}

/** The sheet's history; `onChanged` hears of every undo and redo, as of an edit. */
export function createSheetHistory(doc: Document, onChanged: () => void): SheetHistory {
  const done: Step[] = [];
  const undone: Step[] = [];

  return {
    record(action, options = {}) {
      const before = snapshot(doc);
      action();
      const after = snapshot(doc);
      if (same(before, after)) return;

      const last = done[done.length - 1];
      if (options.join && last?.tag === options.join && same(last.after, before)) {
        last.after = after;
        last.tag = undefined;
      } else {
        done.push({ before, after, tag: options.tag });
        if (done.length > LIMIT) done.shift();
      }
      undone.length = 0;
    },

    undo() {
      const step = done[done.length - 1];
      if (!step || !same(snapshot(doc), step.after)) return false;
      done.pop();
      restore(doc, step.before);
      undone.push(step);
      onChanged();
      return true;
    },

    redo() {
      const step = undone[undone.length - 1];
      if (!step || !same(snapshot(doc), step.before)) return false;
      undone.pop();
      restore(doc, step.after);
      done.push(step);
      onChanged();
      return true;
    },

    forgetRedo() {
      undone.length = 0;
    },
  };
}

/** Ctrl+Z on the sheet's writing, or on the page around it — never in a drawing's text. */
function onSheet(doc: Document, target: EventTarget | null): boolean {
  if (target === doc.body || target === doc.documentElement) return true;
  const element = target && "nodeType" in target ? elementOf(target as Node) : null;
  return Boolean(element?.closest(ANY_TEXT_BLANK));
}

/**
 * Listens for Ctrl+Z, Ctrl+Y and Ctrl+Shift+Z — and Undo / Redo from the
 * browser's menu — on the sheet. What is not a step of `history`, or not as
 * it left the sheet, goes on to the browser.
 */
export function attachSheetUndo(doc: Document, history: SheetHistory): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return;
    const key = event.key.toLowerCase();
    const undo = key === "z" && !event.shiftKey;
    const redo = key === "y" || (key === "z" && event.shiftKey);
    if ((!undo && !redo) || !onSheet(doc, event.target)) return;
    if (undo ? history.undo() : history.redo()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const onBeforeInput = (event: InputEvent) => {
    const undo = event.inputType === "historyUndo";
    if ((!undo && event.inputType !== "historyRedo") || !event.cancelable || !onSheet(doc, event.target)) return;
    if (undo ? history.undo() : history.redo()) event.preventDefault();
  };

  const onInput = (event: Event) => {
    const type = "inputType" in event ? String(event.inputType) : "";
    if (event.isTrusted && !type.startsWith("history")) history.forgetRedo();
  };

  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("beforeinput", onBeforeInput, true);
  doc.addEventListener("input", onInput, true);
  return () => {
    doc.removeEventListener("keydown", onKeyDown, true);
    doc.removeEventListener("beforeinput", onBeforeInput, true);
    doc.removeEventListener("input", onInput, true);
  };
}
