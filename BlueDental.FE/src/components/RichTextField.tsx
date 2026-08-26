import { useCallback, useMemo, useRef } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import { cn } from "@/lib/cn";

interface Props {
  /** Optional so an antd Form.Item can inject them: it controls the field. */
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * Where an image the user adds should be stored. Given one, the picked file
   * is handed over and whatever URL comes back is what the body links to.
   *
   * Left out, Quill does what it does by default and embeds the image in the
   * HTML as base64 — fine for a draft held in memory, wrong for anything that
   * is going to be written to a row.
   */
  onUploadImage?: (file: File) => Promise<string>;
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Wait until the browser holds the stored image.
 *
 * Swapping the placeholder for a URL the browser has never fetched leaves a gap
 * where the picture simply vanishes and comes back a moment later. Fetching it
 * first means the swap lands on something already in cache and nothing flickers.
 *
 * Resolves either way: a picture that will not load is still better swapped in,
 * because the URL is what gets saved and a broken image says so honestly.
 */
function preload(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
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
export function RichTextField({
  value,
  onChange,
  placeholder,
  className,
  onUploadImage,
}: Props) {
  const quillRef = useRef<ReactQuill>(null);

  // Read through a ref so the toolbar is not rebuilt on every keystroke —
  // Quill rebuilds its whole toolbar when `modules` changes identity.
  const uploadRef = useRef(onUploadImage);
  uploadRef.current = onUploadImage;

  const pickAndUpload = useCallback(() => {
    const upload = uploadRef.current;
    if (!upload) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";

    input.onchange = async () => {
      const file = input.files?.[0];
      const editor = quillRef.current?.getEditor();
      if (!file || !editor) return;

      // Straight in, before the upload is even started: picking an image and
      // watching nothing happen reads as a failure. This is what Quill's own
      // handler does — and so what the Dữ liệu tư vấn dialog does — except that
      // here the data URL is a placeholder rather than what gets saved.
      //
      // It has to be a data URL: Quill's image blot allows only http, https and
      // data, and rewrites anything else (a blob: URL included) to "//:0".
      const preview = await readAsDataUrl(file);
      // Where the caret was when the picker opened, or the end of the document.
      const at = editor.getSelection(true)?.index ?? editor.getLength();
      editor.insertEmbed(at, "image", preview, "user");
      editor.setSelection(at + 1, 0, "user");

      // Held as a blot rather than an index: the author may well keep typing
      // while the bytes are in flight, which moves the image along.
      const [placeholder] = editor.getLeaf(at + 1);
      const indexOfPlaceholder = () => {
        // A blot detached in the meantime — undone, or the body cleared —
        // reports an index outside the document.
        if (!placeholder) return -1;
        const index = editor.getIndex(placeholder);
        return index >= 0 && index < editor.getLength() ? index : -1;
      };

      try {
        const url = await upload(file);
        // Fetched before the swap, so the placeholder gives way to a picture
        // that is already there rather than to an empty box.
        await preload(url);

        const found = indexOfPlaceholder();
        if (found < 0) return;

        editor.deleteText(found, 1, "silent");
        editor.insertEmbed(found, "image", url, "user");
      } catch {
        // The caller reports the failure; this only takes back the placeholder
        // so its bytes are not left in the body to be saved.
        const found = indexOfPlaceholder();
        if (found >= 0) editor.deleteText(found, 1, "user");
      }
    };

    input.click();
  }, []);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
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
        // Only when the caller has somewhere to put the bytes; otherwise Quill's
        // own handler runs and embeds them.
        ...(onUploadImage ? { handlers: { image: pickAndUpload } } : {}),
      },
    }),
    // Whether an upload handler exists changes the toolbar; the handler itself
    // is read through a ref, so it does not.
    [Boolean(onUploadImage), pickAndUpload],
  );

  return (
    <div
      className={cn(
        "bd-rich-text",
        // Only an editor that uploads has an in-flight state to show, so only
        // that one dims its placeholders. Where Quill embeds the picture and
        // keeps it, the data URL is the final article and must look like it.
        onUploadImage && "bd-rich-text--uploads",
        className,
      )}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        modules={modules}
      />
    </div>
  );
}
