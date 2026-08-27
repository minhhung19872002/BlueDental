import { DatePicker, Form, Input, Radio } from "antd";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { PatientDiseaseHistoryPanel } from "./PatientDiseaseHistoryPanel";

interface Props {
  tab: "basic" | "history";
  onTabChange: (tab: "basic" | "history") => void;
  diseaseHistoryEntryIds: string[];
  onDiseaseHistoryChange: (next: string[]) => void;
}

/**
 * Column two of the hồ sơ dialog, behind two pills: the basic details, or the
 * "Tiểu sử bệnh" tick list.
 *
 * Both panes stay mounted-on-demand as the reference does — switching tabs is
 * not supposed to lose what has been typed, so the values live in the form,
 * not in the pane.
 */
export function PatientBasicColumn({
  tab,
  onTabChange,
  diseaseHistoryEntryIds,
  onDiseaseHistoryChange,
}: Props) {
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation);

  return (
    <>
      <div className="bd-patient-subtabs" role="tablist">
        {(
          [
            { key: "basic" as const, label: t("Thông tin cơ bản") },
            { key: "history" as const, label: t("Tiểu sử bệnh") },
          ]
        ).map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={[
              "bd-patient-subtab",
              tab === item.key && "bd-patient-subtab--active",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onTabChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Hidden rather than unmounted: an unmounted Form.Item drops its value,
          and switching to the history list must not clear the details. */}
      <div hidden={tab !== "basic"}>
        <Form.Item name="gender" label={t("Giới tính")} className="bd-patient-gender">
          <Radio.Group>
            <Radio value="male">{t("Nam")}</Radio>
            <Radio value="female">{t("Nữ")}</Radio>
            <Radio value="other">{t("Khác")}</Radio>
          </Radio.Group>
        </Form.Item>

        <FloatingField label={t("Ngày sinh")} name="dateOfBirth">
          <DatePicker
            format="DD/MM/YYYY"
            // The reference refuses a future birth date; so does the server.
            disabledDate={(date) => date.isAfter(dayjs(), "day")}
          />
        </FloatingField>

        <FloatingField
          label="Email"
          name="email"
          rules={[{ type: "email", message: t("Email không hợp lệ") }]}
        >
          <Input type="email" />
        </FloatingField>

        <FloatingField label={t("Ghi chú")} name="note">
          <Input.TextArea rows={3} maxLength={1000} />
        </FloatingField>

        <FloatingField label={t("Nghề nghiệp")} name="occupationEntryId">
          <SearchSelect
            options={(occupations.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            placeholder={t("Nghề nghiệp")}
            emptyText={t("Không tìm thấy nghề nghiệp")}
            allowClear
          />
        </FloatingField>
      </div>

      <div hidden={tab !== "history"}>
        <PatientDiseaseHistoryPanel
          value={diseaseHistoryEntryIds}
          onChange={onDiseaseHistoryChange}
        />
      </div>
    </>
  );
}
