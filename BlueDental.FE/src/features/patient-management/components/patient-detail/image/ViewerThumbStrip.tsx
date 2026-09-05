import { useEffect, useRef } from "react";
import type { PatientImageViewModel } from "../../../api/patientImageAdapters";

interface Props {
  images: PatientImageViewModel[];
  index: number;
  onSelect: (index: number) => void;
}

/** The 160×96 thumbnails along the foot of the viewer; the one on show has a blue frame. */
export function ViewerThumbStrip({ images, index, onSelect }: Props) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = stripRef.current?.children.item(index);
    if (active instanceof HTMLElement) {
      active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, [index]);

  return (
    <div className="pi-viewer-thumbs" ref={stripRef}>
      {images.map((image, position) => (
        <button
          key={image.id}
          type="button"
          className={["pi-viewer-thumb", position === index && "pi-viewer-thumb--active"]
            .filter(Boolean)
            .join(" ")}
          aria-label={image.fileName}
          aria-current={position === index ? "true" : undefined}
          onClick={() => onSelect(position)}
        >
          <img src={image.url} alt={image.fileName} loading="lazy" draggable={false} />
        </button>
      ))}
    </div>
  );
}
