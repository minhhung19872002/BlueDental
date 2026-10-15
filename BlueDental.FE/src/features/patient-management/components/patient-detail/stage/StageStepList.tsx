import { useMemo, useState } from "react";
import { Checkbox, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { foldForSearch } from "@/utils/foldForSearch";

interface Step {
  id: string;
  name: string;
}

interface Props {
  /** The steps the service declares, in its own order. */
  steps: Step[];
  /** Step ids currently ticked. */
  checked: string[];
  /** The full set of ticked ids after a change. Omitted, the list is read-only. */
  onChange?: (next: string[]) => void;
  /**
   * How the step names are drawn. The reference prints them plain on a form
   * and bold-primary on the read-only "Tạo tái khám" rows.
   */
  tone?: "plain" | "accent";
}

/**
 * "Danh sách công đoạn" — a list of steps as checkboxes.
 *
 * Used wherever that heading appears, which is why it takes its state rather
 * than owning it: on the công đoạn form it picks which of the service's steps
 * the công đoạn will cover, and on the tái khám screens it carries the single synthesised
 * entry from {@link reExaminationChecklist}. An empty list prints "(Trống)",
 * the reference's own empty state.
 *
 * Editable, it also carries a search box and a "Chọn tất cả" box (BA, R-960):
 * a service can declare a long list of steps, so the list scrolls at five rows
 * and the box — ticked, unticked or half-ticked — selects or clears the rows the
 * search left showing, with a "Đã chọn x/y" count beside it.
 */
export function StageStepList({ steps, checked, onChange, tone = "plain" }: Props) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const folded = foldForSearch(query);
    return folded ? steps.filter((step) => foldForSearch(step.name).includes(folded)) : steps;
  }, [steps, query]);

  const editable = onChange !== undefined && steps.length > 0;
  const visibleIds = visible.map((step) => step.id);
  const tickedVisible = visibleIds.filter((id) => checked.includes(id)).length;
  const allTicked = visibleIds.length > 0 && tickedVisible === visibleIds.length;

  const handleToggle = (stepId: string, next: boolean) =>
    onChange?.(next ? [...checked, stepId] : checked.filter((id) => id !== stepId));
  const handleToggleAll = () =>
    onChange?.(
      allTicked
        ? checked.filter((id) => !visibleIds.includes(id))
        : [...checked, ...visibleIds.filter((id) => !checked.includes(id))],
    );

  return (
    <div className={tone === "accent" ? "pd-stage-steps pd-stage-steps--accent" : "pd-stage-steps"}>
      <div className="pd-stage-listhead">
        <p className="pd-stage-list">{t("Patient:Stage:List")}</p>
        {editable && (
          <Input
            className="pd-stage-listsearch"
            allowClear
            prefix={<SearchOutlined />}
            placeholder={t("Patient:Stage:ListSearch")}
            aria-label={t("Patient:Stage:ListSearch")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </div>
      {editable && (
        <div className="pd-stage-listbulk">
          <Checkbox
            checked={allTicked}
            indeterminate={tickedVisible > 0 && !allTicked}
            disabled={visible.length === 0}
            onChange={handleToggleAll}
          >
            {t("Patient:Stage:ListSelectAll")}
          </Checkbox>
          <span className="pd-stage-listcount">
            {t("Patient:Stage:ListPicked", checked.length, steps.length)}
          </span>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="pd-stage-listempty">{t("Patient:QuoteSheet:Empty")}</p>
      ) : (
        <div className="pd-stage-steplist">
          {visible.map((step) => (
            <Checkbox
              key={step.id}
              checked={checked.includes(step.id)}
              disabled={!onChange}
              onChange={(event) => handleToggle(step.id, event.target.checked)}
            >
              {step.name}
            </Checkbox>
          ))}
        </div>
      )}
    </div>
  );
}
