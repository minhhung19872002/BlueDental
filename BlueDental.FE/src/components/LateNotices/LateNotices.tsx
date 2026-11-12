import React from "react";
import { useLateNoticeStore } from "@/hooks/lateNoticeStore";
import { LateNoticeStack } from "./LateNoticeStack";

/** The Trễ hẹn cards `announceLateAppointments` pushes (R-1217). */
export const LateNotices: React.FC = () => {
  const notices = useLateNoticeStore((state) => state.notices);
  const dismiss = useLateNoticeStore((state) => state.dismiss);
  return <LateNoticeStack notices={notices} onDismiss={dismiss} />;
};
