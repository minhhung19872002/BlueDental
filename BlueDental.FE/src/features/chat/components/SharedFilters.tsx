import React from "react";
import { DatePicker, Select } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { t } from "@/lib/i18n";
import type { ChatMemberDto } from "../types";
import type { SharedFilterState } from "../utils/chatShared";

interface SharedFiltersProps {
  members: ChatMemberDto[];
  value: SharedFilterState;
  onChange: (next: SharedFilterState) => void;
}

const isFuture = (day: Dayjs) => day.isAfter(dayjs(), "day");

/** Người gửi + Ngày gửi above the Kho lưu trữ tabs; both cleared means everything. */
export const SharedFilters: React.FC<SharedFiltersProps> = ({ members, value, onChange }) => (
  <div className="chat-shared-filters">
    <Select
      allowClear
      showSearch={{ optionFilterProp: "label" }}
      className="chat-shared-sender"
      placeholder={t("Chat:Sender")}
      aria-label={t("Chat:Sender")}
      value={value.senderId}
      options={members.map((member) => ({ value: member.userId, label: member.fullName }))}
      onChange={(senderId: string | undefined) => onChange({ ...value, senderId })}
    />
    <DatePicker.RangePicker
      allowClear
      className="chat-shared-period"
      format="DD/MM/YYYY"
      aria-label={t("Chat:SentDate")}
      placeholder={[t("Chat:SentFrom"), t("Chat:SentTo")]}
      disabledDate={isFuture}
      value={value.period}
      onChange={(period) => onChange({ ...value, period: period?.[0] && period[1] ? [period[0], period[1]] : null })}
    />
  </div>
);
