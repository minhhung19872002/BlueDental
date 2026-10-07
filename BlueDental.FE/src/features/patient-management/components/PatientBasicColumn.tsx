import { useEffect, useState, type ReactNode } from "react";
import { Checkbox, DatePicker, Form, Input, Radio } from "antd";
import { CalendarOutlined, CheckOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { DATE_INPUT_FORMAT } from "@/utils/dateInput";
import { GUARDIAN_LIMITS } from "../types/patient";
import { PatientDiseaseHistoryPanel } from "./PatientDiseaseHistoryPanel";

export type PatientEditorTab = "basic" | "history" | "guardian";

/** The "Người giám hộ" pill's mark: a red dot while one is owed, a tick once some are in. */
export type GuardianMark = "missing" | "filled" | "none";

interface Props {
  tab: PatientEditorTab;
  onTabChange: (tab: PatientEditorTab) => void;
  diseaseHistoryEntryIds: string[];
  onDiseaseHistoryChange: (next: string[]) => void;
  /** Age by year, shown as a chip inside "Ngày sinh"; null without a birth date. */
  age: number | null;
  guardianMark: GuardianMark;
  guardianPane: ReactNode;
  /** BA: the under-16 warning sits right under "Ngày sinh". */
  ageNotice?: ReactNode;
}

/**
 * Column two of the hồ sơ dialog, behind three pills: the basic details, the
 * "Tiểu sử bệnh" tick list, or the guardians (BA, 2026-10-07).
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
  age,
  guardianMark,
  guardianPane,
  ageNotice,
}: Props) {
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation);
  const form = Form.useFormInstance();
  const occupationOther = Form.useWatch("occupationOther", form) as string | undefined;
  // Local, because the field is only *registered* while the box is on screen —
  // deriving the tick from the value it registers would be circular.
  const [otherChosen, setOtherChosen] = useState(false);

  // A record that already carries free text opens with the box showing.
  useEffect(() => {
    if (occupationOther) setOtherChosen(true);
  }, [occupationOther]);

  return (
    <>
      <div className="bd-patient-subtabs" role="tablist">
        {(
          [
            { key: "basic" as const, label: t("Patient:Form:BasicInfo"), count: 0 },
            // BA: the pill tells how many entries are ticked, so it reads from
            // the basic pane too. Nothing ticked shows no tag at all.
            {
              key: "history" as const,
              label: t("Patient:Tab:DiseaseHistory"),
              count: diseaseHistoryEntryIds.length,
            },
            { key: "guardian" as const, label: t("Patient:Guardian:Tab"), count: 0 },
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
            {item.count > 0 && <span className="bd-patient-subtab-count">{item.count}</span>}
            {item.key === "guardian" && guardianMark === "missing" && (
              <span className="bd-patient-subtab-dot" aria-label={t("Patient:Guardian:Missing")} />
            )}
            {item.key === "guardian" && guardianMark === "filled" && (
              <CheckOutlined className="bd-patient-subtab-check" aria-label={t("Patient:Guardian:Filled")} />
            )}
          </button>
        ))}
      </div>

      {/* Hidden rather than unmounted: an unmounted Form.Item drops its value,
          and switching to the history list must not clear the details. */}
      <div hidden={tab !== "basic"}>
        <Form.Item name="gender" label={t("Patient:Col:Gender")} className="bd-patient-gender">
          <Radio.Group>
            <Radio value="male">{t("Nam")}</Radio>
            <Radio value="female">{t("Patient:Misc:Female")}</Radio>
            <Radio value="other">{t("Patient:Misc:OtherLabel")}</Radio>
          </Radio.Group>
        </Form.Item>

        <FloatingField label={t("Patient:Col:DateOfBirth")} name="dateOfBirth">
          <DatePicker
            format={DATE_INPUT_FORMAT}
            // The reference refuses a future birth date; so does the server.
            disabledDate={(date) => date.isAfter(dayjs(), "day")}
            // BA: once there is a date, the age by year takes the calendar's place.
            suffixIcon={
              age === null ? (
                <CalendarOutlined />
              ) : (
                <span
                  className={[
                    "bd-patient-agechip",
                    age < GUARDIAN_LIMITS.requiredUnderAge && "bd-patient-agechip--minor",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {t("Patient:Guardian:AgeYears", age)}
                </span>
              )
            }
          />
        </FloatingField>

        {ageNotice}

        <FloatingField
          label={t("Patient:Form:NationalId")}
          name="nationalId"
          rules={[
            {
              pattern: /^\d{12}$/,
              message: t("Patient:Form:InvalidCCCD"),
            },
          ]}
        >
          <Input
            placeholder={t("Patient:Form:NationalIdPlaceholder")}
            maxLength={12}
            inputMode="numeric"
          />
        </FloatingField>

        <FloatingField
          label={t("Email")}
          name="email"
          rules={[{ type: "email", message: t("Patient:Form:InvalidEmail") }]}
        >
          <Input type="email" />
        </FloatingField>

        <FloatingField label={t("Patient:Misc:Note")} name="note">
          <Input.TextArea rows={3} maxLength={1000} />
        </FloatingField>

        {/* The list cannot cover every job, so the reference puts an "Khác"
            escape hatch in the dropdown with a free-text box behind it. Ticking
            it clears the chosen entry: an occupation is one or the other. */}
        <FloatingField label={t("Patient:Col:Occupation")} name="occupationEntryId">
          <SearchSelect
            options={(occupations.data ?? []).map((row) => ({ value: row.id, label: row.name }))}
            placeholder={t("Patient:Col:Occupation")}
            emptyText={t("Patient:Form:OccupationNotFound")}
            allowClear
            footer={
              <>
                <Checkbox
                  checked={otherChosen}
                  onChange={(event) => {
                    const on = event.target.checked;
                    setOtherChosen(on);
                    // An occupation is one or the other, never both.
                    if (on) form.setFieldValue("occupationEntryId", undefined);
                    else form.setFieldValue("occupationOther", "");
                  }}
                >
                  {t("Patient:Misc:OtherLabel")}
                </Checkbox>
                <Form.Item name="occupationOther" noStyle hidden={!otherChosen}>
                  <Input
                    maxLength={100}
                    placeholder={t("Patient:Form:PleaseEnter")}
                    onClick={(event) => event.stopPropagation()}
                  />
                </Form.Item>
              </>
            }
          />
        </FloatingField>
      </div>

      <div hidden={tab !== "history"}>
        <PatientDiseaseHistoryPanel
          value={diseaseHistoryEntryIds}
          onChange={onDiseaseHistoryChange}
        />
      </div>

      <div hidden={tab !== "guardian"}>{guardianPane}</div>
    </>
  );
}
