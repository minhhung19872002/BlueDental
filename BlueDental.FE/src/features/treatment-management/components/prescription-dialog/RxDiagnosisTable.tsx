import { Button, Table, Tooltip } from "antd";
import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { t } from "@/lib/i18n";
import type { RxDiagnosisRow } from "../../types/prescription";

interface Props {
  rows: RxDiagnosisRow[];
  /** What goes on the printed slip — the picks, or a pre-F-58 slip's own text. */
  printedText: string | null;
  onRemove: (key: string) => void;
}

/** Waits on the ICD-10 protocols; shown disabled so the layout is the final one. */
function PendingAction({ label }: { label: string }) {
  return (
    <Tooltip title={t("Treatment:Rx:IcdPending")}>
      <span className="rx-pending-action">
        <Button size="small" icon={<PlusOutlined />} disabled>
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}

/** The picked diagnoses: slip, diagnosis, teeth, the (pending) suggested medicines. */
export function RxDiagnosisTable({ rows, printedText, onRemove }: Props) {
  const columns: ColumnsType<RxDiagnosisRow> = [
    {
      key: "slip",
      title: t("Treatment:Rx:ColSlip"),
      width: 110,
      render: (_, row) => <span className="rx-code-tag">{row.planCode}</span>,
    },
    {
      key: "diagnosis",
      title: t("Treatment:Rx:Diagnosis"),
      render: (_, row) => <strong className="rx-dx-name">{row.diagnosisName}</strong>,
    },
    {
      key: "teeth",
      title: t("Treatment:Rx:ColTeeth"),
      width: 160,
      render: (_, row) => (
        <span className="rx-teeth">
          {row.toothCodes.map((code) => (
            <span key={code} className="rx-tooth-chip">
              {t("Treatment:Rx:ToothShort", code)}
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "suggested",
      title: t("Treatment:Rx:ColSuggested"),
      width: 220,
      render: () => <span className="rx-muted">{t("Treatment:Rx:NoProtocol")}</span>,
    },
    {
      key: "actions",
      title: "",
      width: 170,
      align: "right",
      render: (_, row) => (
        <span className="rx-dx-actions">
          <PendingAction label={t("Treatment:Rx:AddToPrescription")} />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label={t("Treatment:Rx:RemoveDiagnosis", `${row.planCode} ${row.diagnosisName}`)}
            onClick={() => onRemove(row.key)}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="rx-dx-table">
      <Table<RxDiagnosisRow>
        columns={columns}
        dataSource={rows}
        rowKey="key"
        pagination={false}
        size="small"
        scroll={{ x: 720 }}
        locale={{ emptyText: t("Treatment:Rx:NoDiagnosisPicked") }}
      />
      <div className="rx-dx-foot">
        <span className="rx-dx-printed">
          {printedText ? t("Treatment:Rx:PrintedAs", printedText) : null}
        </span>
        <PendingAction label={t("Treatment:Rx:AddAllSuggested")} />
      </div>
    </div>
  );
}
