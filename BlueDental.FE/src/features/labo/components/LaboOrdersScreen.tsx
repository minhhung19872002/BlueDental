import { useState } from "react";
import { Button, Select } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import {
  laboOrderNo,
  useLaboOrderList,
  LABO_SAMPLE_FILTER,
  type LaboOrderDto,
  type LaboSampleFilter,
} from "../api/laboApi";
import { DataTable } from "@/components/DataTable";
import { pagedSelectProps } from "@/components/pagedSelectProps";
import { PeriodPicker, periodRange, type Period } from "@/components/PeriodPicker";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { useAbility } from "@/hooks/useAbility";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { useDentistStaffOptions } from "@/hooks/useStaffOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { exportToExcel } from "@/utils/exportExcel";
import { formatDate } from "@/utils/format";
import { foldFilterOption } from "@/utils/foldForSearch";
import { laboStatusPill } from "../api/laboStatus";
import { buildLaboOrderColumns } from "./laboOrderColumns";
import { LaboDetailDialog } from "./order-dialogs/LaboDetailDialog";
import { laboWorkOf } from "./order-dialogs/laboRequestSlipText";

/**
 * Mẫu Labo.
 *
 * The reference gives this screen no create button — a new labo order is
 * raised from the patient's own screen. Since P2910_03 a row only opens its
 * read-only detail: receiving, checking and warranty run on the patient's
 * Labo tab. See docs/clone/pages/labo.md §2.
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
    orderCode: laboOrderNo(row),
    createdAt: formatDate(row.creationTime),
    patientName: row.patientName ?? "",
    sentDate: row.sentAt ? formatDate(row.sentAt) : "",
    deliveryDate: row.dueAt ? formatDate(row.dueAt) : "",
    status: t(laboStatusPill(row).label),
    dentistName: row.dentistName ?? "",
    materialName: laboWorkOf(row) ?? "",
    teeth: row.toothNumbers ?? "",
  }));

  exportToExcel(
    rows,
    [
      { header: t("Labo:Slip:SlipNo"), key: "orderCode" },
      { header: t("Common:CreatedAt"), key: "createdAt" },
      { header: t("Labo:Orders:CustomerName"), key: "patientName" },
      { header: t("Labo:Orders:SentDate"), key: "sentDate" },
      { header: t("Labo:Orders:DeliveryDate"), key: "deliveryDate" },
      { header: t("Common:Status"), key: "status" },
      { header: t("Labo:Orders:DentistAssigned"), key: "dentistName" },
      { header: t("Patient:Labo:ProsthesisType"), key: "materialName" },
      { header: t("Labo:Orders:Teeth"), key: "teeth" },
    ],
    "mau-labo",
  );
}

interface LaboOrdersScreenProps {
  /** `laboTemplate:export` — without it the Xuất Excel button is hidden. */
  canExport?: boolean;
}

export function LaboOrdersScreen({ canExport }: LaboOrdersScreenProps) {
  const branchId = useCurrentBranchId();
  // Staging gates the detail's "Tạo Lịch Hẹn Mới" on `appointment:create` —
  // not on this tab's own subject (docs/clone/pages/labo.md §2.6, R-532).
  const canCreateAppointment = useAbility("appointment").canCreate;
  const [tab, setTab] = useState<SampleTabKey>("all");
  const [period, setPeriod] = useState<Period>({ mode: null, anchor: new Date() });
  const [patientId, setPatientId] = useState<string | undefined>();
  const [dentistId, setDentistId] = useState<string | undefined>();
  const [detail, setDetail] = useState<LaboOrderDto | null>(null);

  const pagination = useTablePagination(20);
  const range = periodRange(period);

  const patientPicker = usePatientPicker(patientId);
  const dentistOptions = useDentistStaffOptions();

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

  const columns = buildLaboOrderColumns({ branchId, onDetail: setDetail });

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
              onSearch={patientPicker.search}
              onOpenChange={(open) => !open && patientPicker.resetSearch()}
              onChange={(value) => refilter(() => setPatientId(value))}
              {...pagedSelectProps(patientPicker)}
              options={patientPicker.patients.map((patient) => ({
                value: patient.id,
                label: `[${patient.code}] - ${patient.name}`,
              }))}
            />

            <Select
              className="bd-labo-picker"
              showSearch
              allowClear
              filterOption={foldFilterOption}
              placeholder={t("Common:SelectDoctor")}
              aria-label={t("Common:SelectDoctor")}
              value={dentistId}
              onChange={(value) => refilter(() => setDentistId(value))}
              options={dentistOptions.data ?? []}
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

      <LaboDetailDialog
        order={detail}
        branchId={branchId}
        canCreateAppointment={canCreateAppointment}
        onClose={() => setDetail(null)}
      />
    </div>
  );
}
