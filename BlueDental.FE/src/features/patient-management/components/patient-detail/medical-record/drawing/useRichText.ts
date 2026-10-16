import { useCallback, useEffect, useImperativeHandle, useRef, type KeyboardEvent, type Ref, type RefObject } from "react";
import { SKETCH_WIDTH, sameRunStyle, type RunStyle, type TextRun } from "./sketch";
import {
  MARK,
  dropStrayMarks,
  patchLook,
  patchRuns,
  readRuns,
  runAt,
  selectSpan,
  selectionIn,
  spliceRuns,
  textOf,
  tidyAfterTyping,
  writeRuns,
  type CharSpan,
  type RunLook,
  type RunPatch,
} from "./richText";

/** What the text bar and the page reach into the box being typed in for. */
export interface RichTextHandle {
  /** The runs typed so far, marks and all. */
  read: () => TextRun[];
  /** As in Paint: on the highlighted words, or — with none highlighted — on what is typed next. */
  applyStyle: (patch: RunPatch) => void;
  /** The caret back where it was, after a list or the colour box took it. */
  focus: () => void;
}

interface Options {
  /** The words the box opens with. */
  runs: readonly TextRun[];
  /** What an empty box types in. */
  look: RunLook;
  handle: Ref<RichTextHandle>;
  /** The look at the caret, for the text bar to show. */
  onLook: (look: RunLook) => void;
  onCommit: () => void;
  onCancel: () => void;
}

interface Snapshot {
  runs: TextRun[];
  span: CharSpan;
}

/** Letters typed closer together than this are one step back. */
const TYPING_PAUSE = 1000;
const TOGGLE_KEYS: Partial<Record<string, keyof RunStyle>> = { b: "bold", i: "italic", u: "underline" };

/** CSS pixels per page pixel, off the page the box lies on. */
function scaleOf(root: HTMLElement): number {
  const page = root.closest<HTMLElement>(".sketch-page");
  return (page?.clientWidth || SKETCH_WIDTH) / SKETCH_WIDTH;
}

const sameLook = (a: RunLook, b: RunLook) => a.color === b.color && sameRunStyle(a.style, b.style);

/**
 * The editable box behind the text tool. The browser types; styles, line
 * breaks, pasting and undo are done here on the runs and written back, since
 * the browser's own would nest tags the page cannot draw and undo past them.
 */
export function useRichText(root: RefObject<HTMLDivElement | null>, options: Options) {
  const { handle, onCommit, onCancel } = options;
  const opening = useRef(options);
  const look = useRef(options.look);
  const last = useRef<CharSpan>({ start: 0, end: 0 });
  const composing = useRef(false);
  const history = useRef({ undo: [] as Snapshot[], redo: [] as Snapshot[], typedAt: 0 });
  const report = useRef(options.onLook);
  report.current = options.onLook;

  const snapshot = useCallback(
    (el: HTMLElement): Snapshot => ({ runs: readRuns(el, scaleOf(el)), span: selectionIn(el) ?? last.current }),
    [],
  );

  const remember = useCallback(
    (typing: boolean) => {
      const el = root.current;
      const now = Date.now();
      const kept = history.current;
      if (!el || (typing && now - kept.typedAt < TYPING_PAUSE)) {
        kept.typedAt = now;
        return;
      }
      kept.undo.push(snapshot(el));
      kept.redo = [];
      kept.typedAt = typing ? now : 0;
    },
    [root, snapshot],
  );

  /** The look typing takes next: the letter before the caret's, or the first highlighted one's. */
  const track = useCallback(() => {
    const el = root.current;
    const span = el && selectionIn(el);
    if (!el || !span) return;
    last.current = span;
    const runs = readRuns(el, scaleOf(el));
    const at = span.start === span.end ? (runAt(runs, span.start - 1) ?? runAt(runs, span.start)) : runAt(runs, span.start);
    if (!at) return;
    const next = { color: at.color, style: at.style };
    if (sameLook(next, look.current)) return;
    look.current = next;
    report.current(next);
  }, [root]);

  const show = useCallback(
    (el: HTMLElement, runs: readonly TextRun[], span: CharSpan) => {
      writeRuns(el, runs);
      el.focus({ preventScroll: true });
      selectSpan(el, span);
      last.current = span;
      track();
    },
    [track],
  );

  const type = useCallback(
    (text: string) => {
      const el = root.current;
      if (!el || !text) return;
      remember(false);
      const runs = readRuns(el, scaleOf(el));
      const span = selectionIn(el) ?? last.current;
      // Words typed at a mark take its place.
      const from = span.start === span.end && textOf(runs)[span.start - 1] === MARK ? span.start - 1 : span.start;
      const end = from + text.length;
      show(el, spliceRuns(runs, { start: from, end: span.end }, text, look.current), { start: end, end });
    },
    [root, remember, show],
  );

  const applyStyle = useCallback(
    (patch: RunPatch) => {
      const el = root.current;
      if (!el) return;
      remember(false);
      const runs = readRuns(el, scaleOf(el));
      const span = selectionIn(el) ?? last.current;
      if (span.start !== span.end) return show(el, patchRuns(runs, span, patch), span);
      if (textOf(runs)[span.start - 1] === MARK) {
        return show(el, patchRuns(runs, { start: span.start - 1, end: span.start }, patch), span);
      }
      const at = span.start + 1;
      show(el, spliceRuns(runs, span, MARK, patchLook(look.current, patch)), { start: at, end: at });
    },
    [root, remember, show],
  );

  const step = useCallback(
    (back: boolean) => {
      const el = root.current;
      const kept = history.current;
      const [from, to] = back ? [kept.undo, kept.redo] : [kept.redo, kept.undo];
      const target = from.pop();
      if (!el || !target) return;
      to.push(snapshot(el));
      kept.typedAt = 0;
      show(el, target.runs, target.span);
    },
    [root, snapshot, show],
  );

  useImperativeHandle(
    handle,
    () => ({
      read: () => (root.current ? readRuns(root.current, scaleOf(root.current)) : []),
      applyStyle,
      focus: () => {
        if (!root.current) return;
        root.current.focus({ preventScroll: true });
        selectSpan(root.current, last.current);
      },
    }),
    [root, applyStyle],
  );

  // The words it opens with, the caret after them.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const { runs, look: blank } = opening.current;
    const start = runs.length ? runs : [{ text: MARK, ...blank }];
    const end = textOf(start).length;
    show(el, start, { start: end, end });
    report.current(look.current);
  }, [root, show]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const tidy = () => {
      tidyAfterTyping(el, look.current);
      track();
    };
    const onBeforeInput = (event: InputEvent) => {
      const kind = event.inputType;
      if (kind === "insertParagraph" || kind === "insertLineBreak") {
        event.preventDefault();
        type("\n");
      } else if (kind.startsWith("format") || kind.startsWith("history") || kind === "insertFromDrop" || kind === "insertFromPaste") {
        event.preventDefault();
      } else {
        remember(true);
      }
    };
    const onInput = () => {
      if (!composing.current) tidy();
    };
    const onCompositionStart = () => {
      composing.current = true;
    };
    const onCompositionEnd = () => {
      composing.current = false;
      tidy();
    };
    const onPaste = (event: ClipboardEvent) => {
      event.preventDefault();
      type((event.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n"));
    };
    const onSelection = () => {
      if (composing.current || !selectionIn(el)) return;
      dropStrayMarks(el);
      track();
    };

    el.addEventListener("beforeinput", onBeforeInput);
    el.addEventListener("input", onInput);
    el.addEventListener("compositionstart", onCompositionStart);
    el.addEventListener("compositionend", onCompositionEnd);
    el.addEventListener("paste", onPaste);
    document.addEventListener("selectionchange", onSelection);
    return () => {
      el.removeEventListener("beforeinput", onBeforeInput);
      el.removeEventListener("input", onInput);
      el.removeEventListener("compositionstart", onCompositionStart);
      el.removeEventListener("compositionend", onCompositionEnd);
      el.removeEventListener("paste", onPaste);
      document.removeEventListener("selectionchange", onSelection);
    };
  }, [root, type, remember, track]);

  /** Esc drops the words, Ctrl+Enter puts them down; Ctrl+B / I / U and Ctrl+Z / Y act on them. */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.nativeEvent.isComposing) return;
      const key = event.key.toLowerCase();
      const toggle = TOGGLE_KEYS[key];
      if (key === "escape") {
        // The dialog closes on Esc too; here it only means "not these words".
        onCancel();
      } else if (!(event.ctrlKey || event.metaKey)) {
        return;
      } else if (key === "enter") {
        onCommit();
      } else if (toggle) {
        applyStyle({ [toggle]: !look.current.style[toggle] });
      } else if (key === "z" && !event.shiftKey) {
        step(true);
      } else if (key === "y" || key === "z") {
        step(false);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [onCancel, onCommit, applyStyle, step],
  );

  return { handleKeyDown };
}
