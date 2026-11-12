import { create } from "zustand";
import { nextNoticeOrder } from "@/lib/cornerNotices";

/** One "bookings just turned Trễ hẹn" card in the top-right column (R-1217). */
export interface LateNotice {
  id: number;
  /** Its place in the shared column, newest first. */
  order: number;
  title: string;
  lines: string[];
}

/** Cards kept at once; a fourth push drops the oldest, like the chat toasts. */
const MAX_NOTICES = 3;

interface LateNoticeState {
  notices: LateNotice[];
  push: (title: string, lines: string[]) => void;
  dismiss: (id: number) => void;
}

let lastId = 0;

export const useLateNoticeStore = create<LateNoticeState>((set) => ({
  notices: [],
  push: (title, lines) => {
    lastId += 1;
    const notice: LateNotice = { id: lastId, order: nextNoticeOrder(), title, lines };
    set((state) => ({ notices: [notice, ...state.notices].slice(0, MAX_NOTICES) }));
  },
  dismiss: (id) => set((state) => ({ notices: state.notices.filter((notice) => notice.id !== id) })),
}));
