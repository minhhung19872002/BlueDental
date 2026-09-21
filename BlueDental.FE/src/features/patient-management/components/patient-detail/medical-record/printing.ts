import { PRINT_COPY_CSS } from "./sheetCss";

/**
 * Getting a record onto paper.
 *
 * A sheet is drawn in its own document, inside an iframe, and that document
 * already knows how to print itself: A4 with no printer margin, a page break at
 * every `<hr>`, and rows that may not be split. None of that reaches the
 * printer when the *app's* page is what is printed — to the printer an iframe
 * is a single box, sliced wherever the outer page happens to end, straight
 * through the middle of a row.
 *
 * So the sheets are copied into the app's own document for the duration of the
 * print — the reference does the same, into a hidden block off the left of the
 * page — and the copy is what goes to the printer. The iframe itself is never
 * moved: moving it reloads it and what has been typed is gone.
 */

/** On the body while a record is going to the printer. */
export const PRINTING_CLASS = "mr-printing";

/** The block holding the copies. It is a direct child of `<body>`. */
export const COPY_CLASS = "mr-print-copy";

/** The sheet inside a frame's document — the form itself, not its chrome. */
const SHEET_SELECTOR = ".nfc-tpl";

/**
 * `cloneNode` copies the markup, and the markup is where a blank's text lives,
 * so the writing comes across on its own. A tick box is different: `checked` is
 * a property the clone does not inherit, and the attribute is what the copy
 * will be drawn from.
 */
function carryTickBoxes(from: Element, to: Element): void {
  const live = from.querySelectorAll("input");
  const copies = to.querySelectorAll("input");

  live.forEach((input, at) => {
    const copy = copies[at];
    if (!copy) return;
    if (input.type === "checkbox" || input.type === "radio") {
      if (input.checked) copy.setAttribute("checked", "");
      else copy.removeAttribute("checked");
      return;
    }
    copy.setAttribute("value", input.value);
  });
}

/**
 * Copies these sheets into the app's document, hides everything else, and
 * returns the call that puts the page back.
 *
 * The caller prints between the two.
 */
export function copySheetsForPrint(frames: readonly HTMLIFrameElement[]): () => void {
  const holder = document.createElement("div");
  holder.className = COPY_CLASS;

  const style = document.createElement("style");
  style.textContent = PRINT_COPY_CSS;
  holder.append(style);

  for (const frame of frames) {
    const sheet = frame.contentDocument?.querySelector(SHEET_SELECTOR);
    if (!sheet) continue;
    // From another document, so it has to be imported rather than adopted.
    const copy = document.importNode(sheet, true);
    carryTickBoxes(sheet, copy);
    holder.append(copy);
  }

  document.body.append(holder);
  document.body.classList.add(PRINTING_CLASS);

  return () => {
    document.body.classList.remove(PRINTING_CLASS);
    holder.remove();
  };
}

/**
 * The frames drawing these sheets, once each of them has a form in it.
 *
 * Printing usually follows a click that opens the sheet, and React has not
 * drawn it yet when the handler runs — let alone loaded the document inside.
 * Whoever asked to print waits here for the paper to exist.
 */
export async function framesForSheets(
  ids: readonly string[],
  within = 4000,
): Promise<HTMLIFrameElement[]> {
  const deadline = performance.now() + within;

  for (;;) {
    const frames = ids.map((id) =>
      document.querySelector<HTMLIFrameElement>(`[data-sheet-id="${CSS.escape(id)}"] iframe`),
    );
    const ready = frames.filter(
      (frame): frame is HTMLIFrameElement =>
        frame !== null && Boolean(frame.contentDocument?.querySelector(SHEET_SELECTOR)),
    );

    if (ready.length === ids.length) return ready;
    if (performance.now() > deadline) return ready;
    await new Promise((settle) => requestAnimationFrame(settle));
  }
}
