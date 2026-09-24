import { useState } from "react";
import { Button, Select } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import {
  useLaboOrderList,
  LABO_KIND_CONFIG,
  LABO_SAMPLE_FILTER,
  LABO_STATUS_CONFIG,
  type LaboOrderDto,
  type LaboSampleFilter,
} from "../api/laboApi";
import { DataTable } from "@/components/DataTable";
import { PeriodPicker, periodRange, type Period } from "@/components/PeriodPicker";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { useAbility } from "@/hooks/useAbility";
import { useDebounce } from "@/hooks/useDebounce";
import { usePatientOptions } from "@/hooks/usePatientOptions";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { exportToExcel } from "@/utils/exportExcel";
import { formatDate, formatDateTime } from "@/utils/format";
import { LaboOrderDialogHost } from "./LaboOrderDialogHost";
import { buildLaboOrderColumns } from "./laboOrderColumns";
import { LABO_MODAL_PARAM, LABO_ROW_PARAM, type LaboModalKey } from "./order-dialogs/laboModalKeys";

/**
 * Mẫu Labo.
 *
 * The reference gives this screen no create button — a new labo order is
 * raised from the patient's own screen — but every row can open its detail
 * and raise "Tiếp tục công đoạn" / "Bảo hành" on itself, the same dialogs the
 * patient's Labo tab uses. See docs/clone/pages/labo.md §2.
 */

/** The four filters the reference puts above the table, keyed as it keys them. */
type SampleTabKey = "all" | "chua-nhan" | "giao-tre" | "da-nhan";

const SAMPLE_FILTER_OF: Record<SampleTabKey, LaboSampleFilter> = {
  all: LABO_SAMPLE_FILTER.All,
  "chua-nhan": LABO_SAMPLE_FILTER.AwaitingReturn,
  "giao-tre": LABO_SAMPLE_FILTER.Overdue,
  "da-nhan": LABO_SAMPLE_FILTER.Returned,
};

function sampleTabs() {
  return [
    { key: "all" as const, label: t("Labo:Orders:AllSamples") },
    { key: "chua-nhan" as const, label: t("Labo:Orders:NotReceived") },
    { key: "giao-tre" as const, label: t("Labo:Orders:LateDelivery") },
    { key: "da-nhan" as const, label: t("Labo:Orders:Received") },
  ];
}

/** The reference exports the paired columns split apart — labo.md §2.8. */
function exportOrders(items: LaboOrderDto[]) {
  const rows = items.map((row) => ({
    orderCode: row.orderCode,
    supplier: row.supplierName ?? row.labProviderName,
    createdAt: formatDate(row.creationTime),
    patientName: row.patientName ?? "",
    treatmentPlan: row.treatmentPlanCode ?? "",
    sentDate: row.sentAt ? formatDateTime(row.sentAt) : "",
    kind: t(LABO_KIND_CONFIG[row.kind].label),
    deliveryDate: row.dueAt ? formatDateTime(row.dueAt) : "",
    status: t(LABO_STATUS_CONFIG[row.status].label),
    dentistName: row.dentistName ?? "",
    materialName: row.materialName ?? "",
    teeth: row.toothNumbers ?? "",
  }));

  exportToExcel(
    rows,
    [
      { header: t("Patient:Labo:Code"), key: "orderCode" },
      { header: t("Labo:Orders:Supplier"), key: "supplier" },
      { header: t("Common:CreatedAt"), key: "createdAt" },
      { header: t("Labo:Orders:CustomerName"), key: "patientName" },
      { header: t("Labo:Orders:TreatmentSlip"), key: "treatmentPlan" },
      { header: t("Labo:Orders:SentDate"), key: "sentDate" },
      { header: t("Labo:Orders:Status"), key: "kind" },
      { header: t("Labo:Orders:DeliveryDate"), key: "deliveryDate" },
      { header: t("Labo:Orders:DeliveryStatus"), key: "status" },
      { header: t("Labo:Orders:DentistAssigned"), key: "dentistName" },
      { header: t("Labo:Orders:Material"), key: "materialName" },
      { header: t("Labo:Orders:Teeth"), key: "teeth" },
    ],
    "mau-labo",
  );
}

interface LaboOrdersScreenProps {
  /** `laboTemplate:export` — without it the Xuất Excel button is hidden. */
  canExport?: boolean;
  /** `laboTemplate:update` — the detail dialog's status, pictures and Lưu. */
  canUpdate?: boolean;
}

export function LaboOrdersScreen({ canExport, canUpdate }: LaboOrdersScreenProps) {
  const branchId = useCurrentBranchId();
  // Staging gates the row's plus and shield on `treatmentLabo:create` and the
  // detail's "Tạo Lịch Hẹn Mới" on `appointment:create` — not on this tab's
  // own subject (docs/clone/pages/labo.md §2.6, R-532).
  const canRaiseChild = useAbility("treatmentLabo").canCreate;
  const canCreateAppointment = useAbility("appointment").canCreate;
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<SampleTabKey>("all");
  const [period, setPeriod] = useState<Period>({ mode: null, anchor: new Date() });
  const [patientId, setPatientId] = useState<string | undefined>();
  const [dentistId, setDentistId] = useState<string | undefined>();
  const [patientKeyword, setPatientKeyword] = useState("");
  const [detail, setDetail] = useState<LaboOrderDto | null>(null);

  const pagination = useTablePagination(20);
  const range = periodRange(period);

  const debouncedPatientKeyword = useDebounce(patientKeyword, 300);
  const patientOptions = usePatientOptions(debouncedPatientKeyword);
  const staffOptions = useStaffOptions();

  const query = useLaboOrderList({
    sampleFilter: SAMPLE_FILTER_OF[tab],
    patientId,
    dentistId,
    fromDate: range?.from,
    toDate: range?.to,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  /** Any change to the filters narrows the list, so the page starts over. */
  const refilter = (apply: () => void) => {
    apply();
    pagination.resetToFirstPage();
  };

  /** The child-order dialog is URL-driven, keyed on the parent row. */
  const openChildDialog = (key: LaboModalKey, order: LaboOrderDto) => {
    const next = new URLSearchParams(searchParams);
    next.set(LABO_MODAL_PARAM, key);
    next.set(LABO_ROW_PARAM, order.id);
    setSearchParams(next, { replace: true });
  };

  const columns = buildLaboOrderColumns({
    branchId,
    onDetail: setDetail,
    onContinue: canRaiseChild ? (order) => openChildDialog("continue-process", order) : undefined,
    onWarranty: canRaiseChild ? (order) => openChildDialog("warranty", order) : undefined,
  });

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-header bd-labo-header--stacked">
        <div className="bd-labo-headrow">
          <PeriodPicker value={period} onChange={(next) => refilter(() => setPeriod(next))} clearableMode />

          {canExport && (
            <Button icon={<DownloadOutlined />} disabled={items.length === 0} onClick={() => exportOrders(items)}>
              {t("Common:ExportExcel")}
            </Button>
          )}
        </div>

        <div className="bd-labo-headrow">
          <div className="bd-labo-headgroup">
            <SegmentedTabs
              items={sampleTabs()}
              activeKey={tab}
              onChange={(key) => refilter(() => setTab(key))}
            />

            <Select
              className="bd-labo-picker"
              showSearch
              allowClear
              filterOption={false}
              placeholder={t("Common:SelectCustomer")}
              aria-label={t("Common:SelectCustomer")}
              value={patientId}
              onSearch={setPatientKeyword}
              onChange={(value) => refilter(() => setPatientId(value))}
              options={(patientOptions.data ?? []).map((patient) => ({
                value: patient.id,
                label: `[${patient.code}] - ${patient.name}`,
              }))}
            />

            <Select
              className="bd-labo-picker"
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t("Common:SelectDoctor")}
              aria-label={t("Common:SelectDoctor")}
              value={dentistId}
              onChange={(value) => refilter(() => setDentistId(value))}
              options={staffOptions.data ?? []}
            />
          </div>
        </div>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<LaboOrderDto>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={query.isFetching}
            locale={{ emptyText: t("Common:NoData") }}
            pagination={pagination.buildConfig(totalCount, countedTotal(t("Labo:Noun:LaboSample")))}
          />
        </div>
      </div>

      <LaboOrderDialogHost
        branchId={branchId}
        rows={items}
        detail={detail}
        canUpdate={Boolean(canUpdate)}
        canCreateAppointment={canCreateAppointment}
        onCloseDetail={() => setDetail(null)}
      />
    </div>
  );
}
