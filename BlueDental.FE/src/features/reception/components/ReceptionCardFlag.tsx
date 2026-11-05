import React from "react";
import { Dropdown, type MenuProps } from "antd";
import { EllipsisVertical, Flag, FlagOff } from "lucide-react";
import { t } from "@/lib/i18n";
import { FLAG_PENNANT_SRC } from "../utils/flagPennant";

interface ReceptionCardFlagProps {
  flagged: boolean;
  /** Absent when the viewer may not flag: a flagged card still shows its pennant. */
  onChange?: (flagged: boolean) => void;
}

/**
 * A chip in the top-left corner of a reception card: "⋮" offers "Đặt cờ";
 * once flagged the waving pennant takes its place and offers "Gỡ cờ"
 * (owner 2026-11-05).
 */
export const ReceptionCardFlag: React.FC<ReceptionCardFlagProps> = ({ flagged, onChange }) => {
  if (!onChange) {
    if (!flagged) return null;
    return (
      <span className="rc-flag rc-flag--on" role="img" aria-label={t("Reception:Flagged")}>
        <img className="rc-flag-img" src={FLAG_PENNANT_SRC} alt="" />
      </span>
    );
  }

  const items: MenuProps["items"] = [
    flagged
      ? { key: "clear", icon: <FlagOff size={16} aria-hidden />, label: t("Reception:FlagClear") }
      : { key: "set", icon: <Flag size={16} aria-hidden />, label: t("Reception:FlagSet") },
  ];

  const handleMenuClick: MenuProps["onClick"] = () => onChange(!flagged);

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={["click"]} placement="bottomLeft">
      <button
        type="button"
        className={["rc-flag", flagged ? "rc-flag--on" : "rc-flag--menu"].join(" ")}
        aria-label={t("Reception:FlagMenu")}
        title={flagged ? t("Reception:Flagged") : undefined}
      >
        {flagged ? (
          <img className="rc-flag-img" src={FLAG_PENNANT_SRC} alt="" />
        ) : (
          <EllipsisVertical size={16} aria-hidden />
        )}
      </button>
    </Dropdown>
  );
};
