import { Button, Input, Segmented, Table, Tooltip } from "antd";
import { useEffect, useState } from "react";
import { DeleteOutlined, EditOutlined, StarFilled, StarOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { CurrencyInput, MAX_VND } from "@/components/CurrencyInput";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import {
  SERVICE_STAGE_VALUE_TYPE,
  type ServiceStageDto,
  type ServiceStageValueType,
} from "../api/taxonomyApi";

interface Props {
  stages: ServiceStageDto[];
  onChange: (next: ServiceStageDto[]) => void;
}

/** The reference caps a stage name at 100 characters. */
const STAGE_NAME_MAX = 100;
/** Its footer offers this size menu, 20 by default. */
const STAGE_PAGE_SIZES = [5, 10, 20, 25, 50, 100];
const MAX_PERCENT = 100;

const VALUE_TYPE_OPTIONS: { value: ServiceStageValueType; label: string }[] = [
  { value: SERVICE_STAGE_VALUE_TYPE.Percentage, label: "%" },
  { value: SERVICE_STAGE_VALUE_TYPE.Amount, label: "VNĐ" },
];

/**
 * A service's stages, edited in place: rename by pencil, a %/VNĐ toggle beside
 * the value, a star for the marketing-salary flag, and a bin. The list lives in
 * the dialog; this only draws it and reports each change.
 */
export function ServiceStageTable({ stages, onChange }: Props) {
  const pagination = useTablePagination(20, { pageSizeOptions: STAGE_PAGE_SIZES });
  const [editing, setEditing] = useState<number | null>(null);

  // Deleting the last row of the last page must not leave an empty page behind.
  const { page, skipCount, resetToFirstPage } = pagination;
  useEffect(() => {
    if (page > 1 && skipCount >= stages.length) resetToFirstPage();
  }, [page, skipCount, resetToFirstPage, stages.length]);

  const patch = (index: number, changes: Partial<ServiceStageDto>) =>
    onChange(stages.map((stage, at) => (at === index ? { ...stage, ...changes } : stage)));

  const commitName = (index: number, raw: string) => {
    const trimmed = raw.trim().slice(0, STAGE_NAME_MAX);
    if (trimmed) patch(index, { name: trimmed });
    setEditing(null);
  };

  const changeValueType = (index: number, stage: ServiceStageDto, next: ServiceStageValueType) =>
    patch(index, {
      valueType: next,
      // A share cannot exceed the whole, whatever the amount was before.
      value:
        next === SERVICE_STAGE_VALUE_TYPE.Percentage
          ? Math.min(stage.value, MAX_PERCENT)
          : stage.value,
    });

  const columns: ColumnsType<ServiceStageDto> = [
    {
      key: "index",
      title: t("Taxonomy:Service:StageSeqCol"),
      width: 60,
      render: (_, stage) => <span className="bd-muted-text">{stages.indexOf(stage) + 1}</span>,
    },
    {
      key: "name",
      title: t("Taxonomy:Service:StageNameCol"),
      render: (_, stage) => {
        const index = stages.indexOf(stage);
        if (editing !== index) return stage.name;
        return (
          <Input
            autoFocus
            defaultValue={stage.name}
            maxLength={STAGE_NAME_MAX}
            aria-label={t("Taxonomy:Service:StageName")}
            onPressEnter={(event) => {
              event.preventDefault();
              commitName(index, event.currentTarget.value);
            }}
            onBlur={(event) => commitName(index, event.target.value)}
          />
        );
      },
    },
    {
      key: "value",
      title: t("Taxonomy:Service:StageValueCol"),
      width: 260,
      render: (_, stage) => {
        const index = stages.indexOf(stage);
        const isPercent = stage.valueType === SERVICE_STAGE_VALUE_TYPE.Percentage;
        return (
          <div className="bd-stage-value">
            <Segmented<ServiceStageValueType>
              value={stage.valueType}
              options={VALUE_TYPE_OPTIONS}
              onChange={(next) => changeValueType(index, stage, next)}
            />
            <CurrencyInput
              aria-label={t("Taxonomy:Service:StageValueAria", stage.name)}
              value={stage.value}
              // A share stops at 100; an amount keeps the shared ten-digit cap.
              isAllowed={(values) =>
                values.floatValue === undefined ||
                values.floatValue <= (isPercent ? MAX_PERCENT : MAX_VND)
              }
              onChange={(next) => patch(index, { value: next ?? 0 })}
            />
          </div>
        );
      },
    },
    {
      key: "actions",
      title: t("Common:Actions"),
      width: 124,
      align: "center",
      render: (_, stage) => {
        const index = stages.indexOf(stage);
        return (
          <div className="bd-stage-actions">
            <Tooltip title={t("Taxonomy:Service:StageRename")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Taxonomy:Service:StageRenameAria", stage.name)}
                onClick={() => setEditing(index)}
              />
            </Tooltip>
            <Tooltip title={t("Taxonomy:Service:StageMarketing")}>
              <Button
                type="text"
                size="small"
                className={
                  stage.isMarketingSalary ? "bd-stage-star bd-stage-star--on" : "bd-stage-star"
                }
                icon={stage.isMarketingSalary ? <StarFilled /> : <StarOutlined />}
                aria-label={t("Taxonomy:Service:StageMarketingAria", stage.name)}
                aria-pressed={stage.isMarketingSalary}
                onClick={() => patch(index, { isMarketingSalary: !stage.isMarketingSalary })}
              />
            </Tooltip>
            <Tooltip title={t("Common:Delete")}>
              <Button
                type="text"
                danger
                size="small"
                icon={<DeleteOutlined />}
                aria-label={t("Taxonomy:Service:StageDeleteAria", stage.name)}
                onClick={() => onChange(stages.filter((_, at) => at !== index))}
              />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <Table<ServiceStageDto>
      className="bd-stage-table bd-mt3"
      columns={columns}
      dataSource={stages}
      rowKey={(stage) => stage.id ?? `new-${stages.indexOf(stage)}`}
      pagination={pagination.buildConfig(stages.length, (total, range) =>
        t("Common:PaginationShort", total ? range[1] - range[0] + 1 : 0, total),
      )}
      scroll={{ x: "max-content" }}
      locale={{ emptyText: t("Taxonomy:Service:NoStages") }}
    />
  );
}
