import { useState } from "react";
import { Button, Input, Popover } from "antd";
import { FilterOutlined, SaveOutlined, SearchOutlined } from "@ant-design/icons";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { t } from "@/lib/i18n";
import {
  PatientListFilters,
  treatmentTabs,
  type PatientFilterOptions,
} from "./PatientListFilters";
import type { PatientFilters } from "../hooks/usePatientListFilters";

interface Props {
  filters: PatientFilters;
  options: PatientFilterOptions;
  onApply: (next: PatientFilters) => void;
  onClear: () => void;
}

/**
 * "Bộ lọc" — the same filters, condensed into a panel.
 *
 * The reference offers this wherever the filter row cannot be shown: on a
 * narrow window, and behind the compact toolbar once the page has scrolled.
 * Unlike the row, it is a draft: nothing is applied until "Lưu", so a narrow
 * screen is not refetching on every tap.
 */
export function PatientFilterPopover({ filters, options, onApply, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PatientFilters>(filters);

  const handleOpenChange = (next: boolean) => {
    // Opening starts from what is actually applied, not from an abandoned draft.
    if (next) setDraft(filters);
    setOpen(next);
  };

  const handleSave = () => {
    onApply(draft);
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setOpen(false);
  };

  const content = (
    <div className="bd-patient-filterpop">
      <div className="bd-patient-filterpop-head">
        <h3>{t("Bộ lọc")}</h3>
      </div>

      <div className="bd-patient-filterpop-body">
        <div className="bd-patient-filterpop-section">
          <span className="bd-patient-filterpop-label">{t("Trạng thái")}</span>
          <SegmentedTabs
            items={treatmentTabs()}
            activeKey={draft.tab}
            onChange={(tab) => setDraft((current) => ({ ...current, tab }))}
          />
        </div>

        <div className="bd-patient-filterpop-section">
          <span className="bd-patient-filterpop-label">{t("Tìm kiếm")}</span>
          <Input
            type="search"
            prefix={<SearchOutlined />}
            placeholder={t("Tìm theo tên, mã khách hàng, số điện thoại...")}
            value={draft.keyword}
            maxLength={100}
            allowClear
            onChange={(event) =>
              setDraft((current) => ({ ...current, keyword: event.target.value }))
            }
          />
        </div>

        <PatientListFilters
          filters={draft}
          options={options}
          layout="stacked"
          onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
        />
      </div>

      <div className="bd-patient-filterpop-foot">
        <Button type="link" onClick={handleClear}>
          {t("Xóa bộ lọc")}
        </Button>

        <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
          {t("Lưu")}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={handleOpenChange}
      trigger="click"
      placement="bottomRight"
      content={content}
      classNames={{ container: "bd-patient-filterpop-shell" }}
    >
      <Button icon={<FilterOutlined />}>{t("Bộ lọc")}</Button>
    </Popover>
  );
}
