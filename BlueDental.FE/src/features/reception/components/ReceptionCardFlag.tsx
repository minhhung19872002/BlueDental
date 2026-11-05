import React from "react";
import { Dropdown, type MenuProps } from "antd";
import { EllipsisVertical, Flag, FlagOff } from "lucide-react";
import { t } from "@/lib/i18n";
import { FLAG_PENNANT_SRC } from "../utils/flagPennant";

interface ReceptionCardFlagMenuProps {
  flagged: boolean;
  onChange: (flagged: boolean) => void;
}

/**
 * "⋮" beside the ticket's folder icon: "Đặt cờ" on a plain card, "Gỡ cờ" on a
 * flagged one. It stays the only way to clear the flag — the pennant itself
 * does not answer clicks (owner 2026-11-05).
 */
export const ReceptionCardFlagMenu: React.FC<ReceptionCardFlagMenuProps> = ({ flagged, onChange }) => {
  const items: MenuProps["items"] = [
    flagged
      ? { key: "clear", icon: <FlagOff size={16} aria-hidden />, label: t("Reception:FlagClear") }
      : { key: "set", icon: <Flag size={16} aria-hidden />, label: t("Reception:FlagSet") },
  ];

  const handleMenuClick: MenuProps["onClick"] = () => onChange(!flagged);

  return (
    <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={["click"]} placement="bottomLeft">
      <button type="button" className="rc-flag-menu" aria-label={t("Reception:FlagMenu")}>
        <EllipsisVertical size={16} aria-hidden />
      </button>
    </Dropdown>
  );
};

/** The waving pennant in the card's top-left corner while the visit is flagged: a marker, not a button. */
export const ReceptionCardPennant: React.FC = () => (
  <img className="rc-pennant" src={FLAG_PENNANT_SRC} alt={t("Reception:Flagged")} />
);
