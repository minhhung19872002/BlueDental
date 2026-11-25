interface Props {
  /** The picture peeking out between the back and the front; none draws the folder plain. */
  coverUrl: string | null;
}

/** The back panel with its tab, drawn first. */
const BACK = "M8 2h14l6 6h28a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z";
/** The front panel of an empty folder: closed up to under the tab. */
const FRONT_EMPTY = "M4 16a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z";
/** The front of a folder with pictures: lower, so the newest one shows above it. */
const FRONT_FULL = "M4 25a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v21a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z";

/**
 * A Windows-style yellow folder (F-98). With pictures in it, the newest one
 * sticks out of the top like a photo slipped in; an empty one is plain yellow.
 */
export function PatientImageFolderIcon({ coverUrl }: Props) {
  return (
    <span className={["pi-folder-icon", coverUrl && "pi-folder-icon--full"].filter(Boolean).join(" ")} aria-hidden="true">
      <svg className="pi-folder-svg" viewBox="0 0 64 52">
        <path className="pi-folder-back" d={BACK} />
      </svg>
      {coverUrl && <img className="pi-folder-cover" src={coverUrl} alt="" loading="lazy" draggable={false} />}
      <svg className="pi-folder-svg" viewBox="0 0 64 52">
        <path className="pi-folder-front" d={coverUrl ? FRONT_FULL : FRONT_EMPTY} />
      </svg>
    </span>
  );
}
