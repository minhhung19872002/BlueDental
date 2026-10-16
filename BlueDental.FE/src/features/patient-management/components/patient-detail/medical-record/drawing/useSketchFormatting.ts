import { useCallback, useRef, useState } from "react";
import type { SketchSettings, TextStyle } from "./sketch";
import type { RunLook } from "./richText";
import type { SketchPad } from "./useSketchCanvas";

/**
 * What the text bar and the colour box show and do. While words are typed they
 * show the look at the caret and change only the highlighted words — or, with
 * none highlighted, what is typed next — as Paint does. Otherwise they set what
 * the next box, or the selected item, is drawn in.
 */
export function useSketchFormatting(
  pad: SketchPad,
  settings: SketchSettings,
  adopt: (patch: Partial<SketchSettings>) => void,
) {
  const [caretLook, setCaretLook] = useState<RunLook | null>(null);
  const { typing, textEditor, setTypingBox, selected, updateSelected } = pad;
  const text = useRef(settings.text);
  text.current = settings.text;

  const atCaret = typing && caretLook;
  const textStyle: TextStyle = atCaret ? { ...caretLook.style, align: typing.align } : settings.text;
  const color = atCaret ? caretLook.color : settings.color;

  const changeTextStyle = useCallback(
    (patch: Partial<TextStyle>) => {
      adopt({ text: { ...text.current, ...patch } });
      if (!typing) return;
      const { align, ...run } = patch;
      if (align) {
        setTypingBox({ align });
        textEditor.current?.focus();
      }
      if (Object.keys(run).length) textEditor.current?.applyStyle(run);
    },
    [adopt, typing, setTypingBox, textEditor],
  );

  const pickColor = useCallback(
    (next: string) => {
      adopt({ color: next });
      if (typing) textEditor.current?.applyStyle({ color: next });
      else if (selected) updateSelected({ color: next });
    },
    [adopt, typing, textEditor, selected, updateSelected],
  );

  return { textStyle, color, onLook: setCaretLook, changeTextStyle, pickColor };
}
