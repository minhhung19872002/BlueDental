import dayjs from "dayjs";
import { formatDateTime } from "@/utils/format";
import type { PatientImageDto, PatientImageType } from "./patientImageApi";

export interface PatientImageViewModel {
  id: string;
  fileName: string;
  url: string;
  type: PatientImageType;
  ordering: number;
  takenAt: string;
  /** Local calendar day, `YYYY-MM-DD`, which the timeline groups by. */
  dayKey: string;
  /** `dd/MM/yyyy`, the day pill on the timeline. */
  dayLabel: string;
  /** `dd/MM/yyyy HH:mm`, under the file name on the card. */
  takenLabel: string;
}

export interface PatientImageDay {
  key: string;
  label: string;
  images: PatientImageViewModel[];
}

export function adaptPatientImage(dto: PatientImageDto): PatientImageViewModel {
  const takenAt = dayjs(dto.takenAt);
  return {
    id: dto.id,
    fileName: dto.fileName,
    url: dto.url,
    type: dto.type,
    ordering: dto.ordering,
    takenAt: dto.takenAt,
    dayKey: takenAt.format("YYYY-MM-DD"),
    dayLabel: takenAt.format("DD/MM/YYYY"),
    takenLabel: formatDateTime(dto.takenAt),
  };
}

/**
 * The timeline the reference draws: one row per day, newest day first, and
 * within a day the cards in their stored order left to right (1, 2, 3 …).
 * The server hands the feed back newest first so paging reads down the days;
 * this puts each day's cards back in ascending order.
 */
export function groupImagesByDay(images: PatientImageViewModel[]): PatientImageDay[] {
  const byDay = new Map<string, PatientImageDay>();
  for (const image of images) {
    const day = byDay.get(image.dayKey);
    if (day) day.images.push(image);
    else byDay.set(image.dayKey, { key: image.dayKey, label: image.dayLabel, images: [image] });
  }

  return [...byDay.values()]
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .map((day) => ({ ...day, images: [...day.images].sort((a, b) => a.ordering - b.ordering) }));
}
