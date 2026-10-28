import { useState } from "react";
import { Input } from "antd";
import { Search } from "lucide-react";
import { filterOptions } from "@/components/SearchSelect/filterOptions";
import type { SearchSelectOption } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";

interface FollowUpDoctorListProps {
  options: SearchSelectOption[];
  value?: string;
  onPick: (doctorId: string) => void;
}

/**
 * What "Đổi bác sĩ" opens: the doctors free that day, searched as every
 * search box is (no accents needed); Enter takes the top row.
 */
export function FollowUpDoctorList({ options, value, onPick }: FollowUpDoctorListProps) {
  const [keyword, setKeyword] = useState("");
  const shown = filterOptions(options, keyword);

  const handlePressEnter = () => {
    if (shown.length) onPick(shown[0].value);
  };

  return (
    <div className="fu-doctor-pop">
      <Input
        autoFocus
        allowClear
        prefix={<Search size={14} aria-hidden />}
        placeholder={t("Reception:FollowUpSearchDoctor")}
        aria-label={t("Reception:FollowUpSearchDoctor")}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        onPressEnter={handlePressEnter}
      />
      <div className="fu-doctor-list">
        {shown.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`fu-doctor-option${o.value === value ? " fu-doctor-option--on" : ""}`}
            aria-pressed={o.value === value}
            onClick={() => onPick(o.value)}
          >
            {o.label}
          </button>
        ))}
        {!shown.length && <p className="fu-doctor-empty">{t("Common:NoResults")}</p>}
      </div>
    </div>
  );
}
