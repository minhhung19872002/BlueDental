interface Props {
  label: string;
  onClick: () => void;
}

/** The pencil that swaps a LỊCH SỬ ĐIỀU TRỊ cell for its editor, in place. */
export function StageEditPencil({ label, onClick }: Props) {
  return (
    <button type="button" aria-label={label} onClick={onClick}>
      {/* lucide-pencil, the reference's own glyph */}
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
        <path d="m15 5 4 4" />
      </svg>
    </button>
  );
}
