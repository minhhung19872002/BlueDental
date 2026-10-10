import { useMemo } from "react";
import { Button, Select } from "antd";
import { CloseOutlined, LockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { OrgStaffDto } from "../../api/orgChartApi";
import { OrgPersonRow } from "./OrgPersonRow";
import type { OrgChartIndex } from "./orgChartModel";
import { staffPickerOptions } from "./orgStaffOptions";

interface Props {
  index: OrgChartIndex;
  /** The unit being edited; null while creating. */
  selfUnitId: string | null;
  /** Shown first and locked — the server keeps the head among the members. */
  headStaffId?: string;
  /** People the picker leaves out, e.g. those already in the target unit. */
  excludeIds?: string[];
  /** Member ids other than the head. Form.Item passes value / onChange. */
  value?: string[];
  onChange?: (value: string[]) => void;
}

/**
 * "Thành viên" as a list (BA: "optimize dạng list"): one row per person with a
 * remove button, a picker underneath. Anyone coming from another unit gets the
 * warning that their đơn vị chính moves here on save.
 */
export function OrgMembersField({ index, selfUnitId, headStaffId, excludeIds = [], value = [], onChange }: Props) {
  const staffById = useMemo(() => new Map(index.activeStaff.map((s) => [s.id, s])), [index]);
  const head = headStaffId ? staffById.get(headStaffId) : undefined;
  const members = value
    .filter((id) => id !== headStaffId)
    .map((id) => staffById.get(id))
    .filter((s): s is OrgStaffDto => Boolean(s));

  const options = staffPickerOptions(index, {
    selfUnitId,
    exclude: new Set([...value, ...excludeIds, ...(headStaffId ? [headStaffId] : [])]),
    blockOtherHeads: true,
  });

  const movingNote = (person: OrgStaffDto) => {
    const from = index.unitOfStaff.get(person.id);
    if (!from || from.id === selfUnitId) return undefined;
    return t("OrgChart:Members:Moving", from.name);
  };

  const handleAdd = (id: string) => onChange?.([...value.filter((v) => v !== id), id]);
  const handleRemove = (id: string) => onChange?.(value.filter((v) => v !== id));

  return (
    <div className="org-members">
      <div className="org-members__list" role="list" aria-label={t("OrgChart:Field:members")}>
        {head && (
          <div role="listitem">
            <OrgPersonRow
              person={head}
              isHead
              note={movingNote(head)}
              action={<LockOutlined className="org-members__lock" aria-label={t("OrgChart:Members:HeadLocked")} />}
            />
          </div>
        )}
        {members.map((person) => (
          <div role="listitem" key={person.id}>
            <OrgPersonRow
              person={person}
              note={movingNote(person)}
              action={
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  aria-label={t("OrgChart:Members:Remove", person.name)}
                  onClick={() => handleRemove(person.id)}
                />
              }
            />
          </div>
        ))}
        {!head && members.length === 0 && <p className="org-muted">{t("OrgChart:Detail:NoMembers")}</p>}
      </div>
      <Select<string>
        className="org-members__picker"
        showSearch
        value={null}
        placeholder={t("OrgChart:Members:Add")}
        aria-label={t("OrgChart:Members:Add")}
        optionFilterProp="label"
        options={options}
        onChange={handleAdd}
      />
    </div>
  );
}
