import { useCallback, useMemo } from "react";
import { Button, Modal, type TableColumnsType } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { formatDate, formatMoneyUnit } from "@/utils/format";
import { useClinicBranch } from "@/features/organizations/api";
import { usePatientDto } from "@/features/patient-management/api/patientQueries";
import { paymentChannelLabels, type SalesEntryDto } from "../api/financeApi";
import { salesEntryCustomerLabel } from "./cashflowColumns";
import { ReportTableCard } from "./ReportTableCard";
import { SalesEntryPrintSheet, type PartyInfo } from "./SalesEntryPrintSheet";
import { voucherLabels, type VoucherLabels } from "./voucherLabels";

interface Props {
  open: boolean;
  entry: SalesEntryDto;
  onClose: () => void;
}

const NONE = () => t("Không có");

function PartySection({ title, rows }: { title: string } & PartyInfo) {
  return (
    <section className="report-detail-section">
      <h3 className="report-detail-title">{title}</h3>
      {rows.map((row) => (
        <p key={row.label} className="report-detail-row">
          <span className="report-detail-label">{row.label}:</span>
          <span>{row.value}</span>
        </p>
      ))}
    </section>
  );
}

/** The reference's per-type labels (`ev(type)`); its detail table shows both dates for either type. */
function buildColumns(labels: VoucherLabels): TableColumnsType<SalesEntryDto> {
  const channels = paymentChannelLabels();
  const dateCell = (v: string) => formatDate(v);
  return [
    { title: t("Ngày tạo"), dataIndex: "entryDate", width: 130, render: dateCell },
    { title: labels.actualDate, dataIndex: "entryDate", width: 140, render: dateCell },
    { title: t("Khách hàng"), key: "customer", width: 150, render: (_: unknown, r) => salesEntryCustomerLabel(r) },
    { title: labels.content, dataIndex: "description", width: 220 },
    { title: labels.staff, dataIndex: "staffName", width: 140 },
    { title: labels.category, dataIndex: "categoryName", width: 140 },
    { title: t("Hình thức"), dataIndex: "channel", width: 130, render: (v: SalesEntryDto["channel"]) => channels[v] },
    {
      title: labels.amount,
      dataIndex: "amount",
      width: 140,
      align: "right",
      render: (v: number) => <strong>{formatMoneyUnit(v)}</strong>,
    },
  ];
}

/**
 * "Chi tiết phiếu": the reference's printer button opens this preview —
 * clinic and customer blocks, the voucher as a one-row table, the total, and
 * an "In …" button that prints the hidden A4 sheet. No request is made
 * beyond loading the branch and, when the voucher names one, the patient.
 */
export function SalesEntryDetailModal({ open, entry, onClose }: Props) {
  const labels = useMemo(() => voucherLabels(entry.type), [entry.type]);
  const { data: branch } = useClinicBranch(open ? entry.clinicBranchId : "");
  const { data: patient } = usePatientDto(open ? (entry.patientId ?? "") : "");

  const clinic: PartyInfo = useMemo(
    () => ({
      rows: [
        { label: t("Phòng khám"), value: branch?.name ?? "" },
        { label: t("Địa chỉ"), value: branch?.address ?? "" },
        { label: t("ĐT"), value: branch?.phoneNumber ?? "" },
        { label: t("Email"), value: branch?.email ?? "" },
      ],
    }),
    [branch],
  );
  const customer: PartyInfo = useMemo(
    () => ({
      rows: [
        { label: t("Mã khách hàng"), value: patient?.patientCode ?? NONE() },
        { label: t("Tên khách hàng"), value: patient?.fullName ?? NONE() },
        { label: t("Số điện thoại"), value: patient?.phoneNumber ?? NONE() },
        { label: t("Địa chỉ"), value: patient?.address ?? NONE() },
        { label: t("Ngày sinh"), value: patient?.dateOfBirth ? formatDate(patient.dateOfBirth) : NONE() },
      ],
    }),
    [patient],
  );
  const columns = useMemo(() => buildColumns(labels), [labels]);
  const handlePrint = useCallback(() => window.print(), []);

  return (
    <Modal
      open={open}
      title={<h2 className="bd-modal-title">{t("Chi tiết phiếu")}</h2>}
      onCancel={onClose}
      width={1024}
      destroyOnHidden
      className="report-detail-modal"
      footer={
        <div className="report-confirm-footer">
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
            {labels.printButton}
          </Button>
        </div>
      }
    >
      <div className="report-detail-body">
        <div className="report-detail-grid">
          <PartySection title={t("THÔNG TIN PHÒNG KHÁM")} rows={clinic.rows} />
          <PartySection title={t("KHÁCH HÀNG")} rows={customer.rows} />
        </div>
        <section className="report-detail-section">
          <h3 className="report-detail-title report-detail-title--bold">{t("CHI TIẾT")}</h3>
          <ReportTableCard<SalesEntryDto>
            rowKey="id"
            columns={columns}
            dataSource={[entry]}
            loading={false}
            totalCount={1}
            page={1}
            pageSize={5}
            onPageChange={() => undefined}
          />
        </section>
        <section className="report-detail-total">
          <p className="report-detail-total-row">
            <strong>{t("Tổng cộng")}:</strong>
            <span>{formatMoneyUnit(entry.amount)}</span>
          </p>
        </section>
      </div>
      <SalesEntryPrintSheet entry={entry} labels={labels} clinic={clinic} customer={customer} />
    </Modal>
  );
}
