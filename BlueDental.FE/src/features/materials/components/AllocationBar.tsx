import { Button, Select, Tooltip } from "antd";
import { CloseOutlined, InfoCircleOutlined, SlidersOutlined } from "@ant-design/icons";
import { useDepartmentList, type DepartmentDto } from "../api/departmentApi";
import { t } from "@/lib/i18n";

/** The two notes the reference hangs off the ⓘ beside "Phân bổ". */
const ALLOCATION_NOTES = [
  "Vật tư sẽ được phân bổ trực tiếp từ kho tổng về chi nhánh hoặc phòng ban nhận.",
  "Số lượng phân bổ tối đa dựa trên số lượng còn lại chưa phân bổ của vật tư.",
];

interface Props {
  /** Names of the ticked materials, in the order they appear in the table. */
  selectedNames: string[];
  departmentId: string | null;
  onDepartmentChange: (id: string | null) => void;
  onClear: () => void;
  /** Opens the quantity dialog. */
  onAllocate: () => void;
}

/**
 * The bar that rises from the bottom once materials are ticked.
 *
 * The reference names the receiving branch and department here and only then
 * lets you go on to quantities — which is why "Phân bổ" stays disabled until a
 * department is chosen. BlueDental issues within the current branch, so the
 * branch selector the reference shows is not repeated: the header already says
 * which branch you are in, and materials belong to it.
 */
export function AllocationBar({
  selectedNames,
  departmentId,
  onDepartmentChange,
  onClear,
  onAllocate,
}: Props) {
  const departmentsQuery = useDepartmentList();
  const departments = departmentsQuery.data?.items ?? [];

  // The reference names the first two and counts the rest.
  const summary =
    selectedNames.slice(0, 2).join(", ") +
    (selectedNames.length > 2 ? `, +${selectedNames.length - 2}` : "");

  return (
    <div className="bd-alloc-bar" role="region" aria-label={t("Phân bổ vật tư đã chọn")}>
      <div className="bd-alloc-bar-count">
        <Button
          type="text"
          shape="circle"
          size="small"
          icon={<CloseOutlined />}
          aria-label={t("Bỏ chọn")}
          onClick={onClear}
        />
        <div className="bd-min0">
          <p className="bd-alloc-bar-title">
            {t("{0} vật tư đã chọn", selectedNames.length)}
          </p>
          {summary ? <p className="bd-alloc-bar-names">{summary}</p> : null}
        </div>
      </div>

      <span className="bd-alloc-bar-divider" aria-hidden="true" />

      <Select<string>
        className="bd-alloc-bar-dept"
        placeholder={t("Phòng ban nhận")}
        aria-label={t("Phòng ban nhận")}
        value={departmentId ?? undefined}
        onChange={(value) => onDepartmentChange(value ?? null)}
        loading={departmentsQuery.isLoading}
        showSearch
        allowClear
        optionFilterProp="label"
        options={departments.map((department: DepartmentDto) => ({
          value: department.id,
          label: department.name,
        }))}
      />

      <Tooltip title={departmentId ? undefined : t("Chọn phòng ban nhận trước")}>
        <span>
          <Button
            type="primary"
            icon={<SlidersOutlined />}
            // Named explicitly: with only its text, the icon makes the
            // accessible name "sliders Phân bổ", and "Lưu ý phân bổ" beside it
            // then matches the same substring.
            aria-label={t("Phân bổ")}
            disabled={!departmentId}
            onClick={onAllocate}
          >
            {t("Phân bổ")}
          </Button>
        </span>
      </Tooltip>

      <Tooltip
        placement="topRight"
        title={
          <div className="bd-alloc-notes">
            <p className="bd-semibold">{t("Lưu ý")}</p>
            <ul>
              {ALLOCATION_NOTES.map((note) => (
                <li key={note}>{t(note)}</li>
              ))}
            </ul>
          </div>
        }
      >
        <Button
          type="text"
          shape="circle"
          icon={<InfoCircleOutlined />}
          aria-label={t("Lưu ý phân bổ")}
        />
      </Tooltip>
    </div>
  );
}
