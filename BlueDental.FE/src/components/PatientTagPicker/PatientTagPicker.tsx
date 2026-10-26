import { useMemo, useState } from "react";
import { Button, Input, Popover } from "antd";
import { CheckOutlined, SearchOutlined, TagsOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { SelectLoading } from "@/components/SelectLoading";
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { useSetPatientTags } from "@/hooks/useSetPatientTags";
import { t } from "@/lib/i18n";
import { PatientTagChip } from "./PatientTagChip";
import "./patient-tag-picker.css";

interface PatientTagPickerProps {
  patientId: string;
  /** The record's branch: only its own Thẻ hồ sơ catalog is offered. */
  branchId: string;
  tagIds: readonly string[];
  /** Added to the trigger, which each screen sizes to its own row. */
  buttonClassName?: string;
}

/**
 * The 🏷 button and its "Tìm tag" panel. Each tick saves at once.
 *
 * The answer is held until the screen's own copy of the record catches up, so
 * a second tick made while it refetches does not undo the first.
 */
export function PatientTagPicker({ patientId, branchId, tagIds, buttonClassName }: PatientTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [saved, setSaved] = useState<{ base: readonly string[]; ids: string[] } | null>(null);
  const tags = usePatientTagOptions(branchId);
  const setTags = useSetPatientTags(patientId);
  const current = saved?.base === tagIds ? saved.ids : tagIds;
  const visible = useMemo(
    () =>
      (tags.data ?? []).filter((tag) =>
        tag.label.toLocaleLowerCase("vi").includes(filter.trim().toLocaleLowerCase("vi")),
      ),
    [filter, tags.data],
  );

  const toggle = (tagId: string) => {
    const selected = current.includes(tagId);
    const next = selected ? current.filter((id) => id !== tagId) : [...current, tagId];
    setTags.mutate(next, {
      onSuccess: (ids) => {
        setSaved({ base: tagIds, ids });
        toast.success(selected ? t("Patient:Tag:RemoveSuccess") : t("Patient:Tag:AddSuccess"));
      },
    });
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      // No arrow on the reference, and AntD reserves room for one — which was
      // the whole difference between its 9px gap and ours.
      arrow={false}
      classNames={{ root: "pd-tag-popover" }}
      content={
        <div className="pd-tag-picker">
          <Input
            allowClear
            value={filter}
            prefix={<SearchOutlined />}
            placeholder={t("Patient:List:SearchTag")}
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="pd-tag-options">
            {tags.isLoading && visible.length === 0 ? <SelectLoading rows={4} /> : null}
            {visible.map((tag) => {
              const selected = current.includes(tag.value);
              return (
                <button
                  type="button"
                  key={tag.value}
                  className={selected ? "selected" : ""}
                  onClick={() => toggle(tag.value)}
                  disabled={setTags.isPending}
                >
                  <PatientTagChip color={tag.color} label={tag.label} />
                  <em>{tag.label}</em>
                  {selected ? <CheckOutlined className="pd-tag-tick" /> : null}
                </button>
              );
            })}
            {!tags.isLoading && visible.length === 0 ? (
              <div className="pd-tag-empty">{t("Patient:Filter:TagNotFound")}</div>
            ) : null}
          </div>
        </div>
      }
    >
      <Button
        className={["pd-tag-button", buttonClassName].filter(Boolean).join(" ")}
        icon={<TagsOutlined />}
        aria-label={t("Patient:List:PatientTag")}
      />
    </Popover>
  );
}
