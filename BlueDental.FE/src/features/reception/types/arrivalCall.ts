/** A patient on the floating "Đã đến" panel — arrived today, not yet in the chair. */
export interface ArrivalCall {
  id: string;
  patientId: string;
  patientName: string;
  patientYearOfBirth?: number;
  isTemporary: boolean;
  doctorName: string;
  /** The booked time, HH:mm. */
  time: string;
  /** Nội dung đặt lịch, or the Ghi chú of a visit booked without one. */
  content: string;
  /** The doctor already pressed "Mời lên". */
  invited: boolean;
}

/** "invite" is the doctor's "Mời lên"; "admit" is reception's "Tiếp nhận". */
export type ArrivalCallAction = "invite" | "admit";

/** One list of the panel, with the button its rows carry. */
export interface ArrivalCallSection {
  action: ArrivalCallAction;
  title: string;
  items: ArrivalCall[];
  loading: boolean;
  /** Whether the rows carry their button — the role may only view. */
  canAct: boolean;
}
