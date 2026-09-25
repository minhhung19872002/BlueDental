/**
 * A placeholder that carries the required asterisk inside the control — the
 * reference's "Chọn bác sĩ*" / "Tên thuốc*" pickers name the field and mark it
 * required in one breath, with no label above or on the border.
 *
 * Ant Design's Select and Input accept a node here, so this drops straight
 * into `placeholder`. The accessible name should still come from `aria-label`
 * (or a label element): a placeholder is a hint, not a name.
 */
export function RequiredPlaceholder({ text }: { text: string }) {
  return (
    <>
      {text}
      <span className="bd-required-mark" aria-hidden="true">
        *
      </span>
    </>
  );
}
