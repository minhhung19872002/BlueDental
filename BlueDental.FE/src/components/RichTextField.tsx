import { useMemo } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { cn } from "@/lib/cn";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * The rich-text body the reference gives a diagnosis and a piece of consulting
 * data. The toolbar is laid out group for group as the reference's is, so the
 * two read as the same editor.
 *
 * Quill writes HTML, which is what the API stores. Anything it produces is
 * rendered back through the same editor rather than injected into the page, so
 * the stored markup is never trusted as page HTML elsewhere.
 */
export function RichTextField({ value, onChange, placeholder, className }: Props) {
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ font: [] }, { size: ["small", false, "large", "huge"] }],
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline", "strike"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ indent: "-1" }, { indent: "+1" }],
        [{ script: "super" }, { script: "sub" }],
        ["blockquote", { direction: "rtl" }],
        [{ align: [] }],
        [{ color: [] }, { background: [] }],
        ["link", "image", "video", "formula", "code-block"],
        ["clean"],
      ],
    }),
    [],
  );

  return (
    <div className={cn("bd-rich-text", className)}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
      />
    </div>
  );
}
