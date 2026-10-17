export interface PickedDoctor {
  id: string;
  name: string;
}

/** A slot clicked in "Lịch đã hẹn": its day, its start and, on a doctor's row, that doctor. */
export interface MiniCalSlotPick {
  date: string;
  time: string;
  doctor?: PickedDoctor;
}
