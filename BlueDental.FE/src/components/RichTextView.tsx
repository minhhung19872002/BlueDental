import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { cn } from "@/lib/cn";

interface Props {
  /** Stored markup, as {@link RichTextField} wrote it. */
  html: string;
  className?: string;
}

const NO_TOOLBAR = { toolbar: false } as const;

/**
 * Reads back what {@link RichTextField} wrote, without an editor around it.
 *
 * The body goes through Quill rather than into the page as raw HTML: Quill
 * parses it into its own document and re-renders that, so only the marks the
 * editor knows survive and nothing stored can become page script. That is why
 * this exists at all instead of `dangerouslySetInnerHTML` — see §5 of CLAUDE.md.
 */
export function RichTextView({ html, className }: Props) {
  return (
    <div className={cn("bd-rich-view", className)}>
      <ReactQuill theme="snow" readOnly value={html} modules={NO_TOOLBAR} />
    </div>
  );
}
