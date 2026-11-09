import type { ArrivalPunctuality } from "../utils/arrivalPunctuality";

/** A patient on the floating "Đã đến" panel — arrived today, not yet in the chair. */
export interface ArrivalCall {
  id: string;
  patientId: string;
  patientName: string;
  patientYearOfBirth?: number;
  /** A "Lịch tạm": reception makes its record before "Tiếp nhận". */
  isTemporary: boolean;
  /** The "Lịch tạm"'s own phone, prefilled into "Tạo hồ sơ". */
  patientPhone?: string;
  /** The visit's doctor; any doctor may press "Mời lên" for it (R-1171). */
  doctorId: string;
  doctorName: string;
  /** The doctor's "Màu nhãn"; null = the staff default (R-1155). */
  doctorLabelColor: string | null;
  /** When "Đã đến" was pressed (ISO); the row's "Đang chờ" clock runs from it. */
  checkedInAt?: string;
  /** The booked time, HH:mm. */
  time: string;
  /** When "Đã đến" was pressed, HH:mm — empty when it has not been. */
  arrivedTime: string;
  /** "Trễ 8p" / "Sớm 5p" against the booked time; null on the booked minute (R-1183). */
  punctuality: ArrivalPunctuality | null;
  /** Nội dung đặt lịch, or the Ghi chú of a visit booked without one. */
  content: string;
  /** The doctor already pressed "Mời lên". */
  invited: boolean;
  /** "Đặt cờ" on its reception card: the row glows here too. */
  isFlagged: boolean;
}

/** "invite" is the doctor's "Mời lên"; "admit" is reception's "Tiếp nhận". */
export type ArrivalCallAction = "invite" | "admit";

/** One list of the panel, with the button its rows carry. */
export interface ArrivalCallSection {
  action: ArrivalCallAction;
  title: string;
  items: ArrivalCall[];
  loading: boolean;
  /** What an empty list says, when not "no patient waiting" — e.g. no doctor picked (R-1164). */
  emptyText?: string;
  /** Whether a row carries its button: not when the role may only view. */
  canAct: (item: ArrivalCall) => boolean;
}

/** A doctor the 👁 on "Khách đã đến" offers (R-1164). */
export interface ArrivalDoctor {
  id: string;
  name: string;
  /** "Màu nhãn"; null = the staff default (R-1155). */
  labelColor: string | null;
}

/**
 * Whose arrived patients "Khách đã đến" shows, as picked with the 👁 on this
 * device (R-1164): every doctor's, or the ones ticked — possibly none.
 */
export type ArrivalDoctorPick = { all: true } | { all: false; doctorIds: string[] };
