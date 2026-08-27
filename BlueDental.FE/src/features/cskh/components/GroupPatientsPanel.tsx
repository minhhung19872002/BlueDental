import { useMemo, useState } from "react";
import { DatePicker, Input, Table } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { SearchSelect } from "@/components/SearchSelect/SearchSelect";
import { useDebounce } from "@/hooks/useDebounce";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { useServiceGroupOptions } from "@/hooks/useServiceGroupOptions";
import { usePatientTagOptions } from "@/hooks/usePatientTagOptions";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useCareGroupingPatients, type CareGroupingPatientDto } from "../api/careApi";
import { buildGroupColumns } from "./groupColumns";
import { BaseCareDialog } from "./BaseCareDialog";
import { MessageField } from "./MessageField";
import { SaveMessageDialog } from "./SaveMessageDialog";

interface GroupPatientsPanelProps {
  branchId: string;
  taxonomyId: string | undefined;
  onTaxonomyChange: (value: string | undefined) => void;
}

/** Phân nhóm CSKH tab: filter row + 12-column patient table. */
export function GroupPatientsPanel({ branchId, taxonomyId, onTaxonomyChange }: GroupPatientsPanelProps) {
  const [tagId, setTagId] = useState<string | undefined>();
  const [birthday, setBirthday] = useState<Dayjs | null>(null);
  const [search, setSearch] = useState("");
  const [staffId, setStaffId] = useState<string | undefined>();
  const pagination = useTablePagination(20);
  const [carePatient, setCarePatient] = useState<CareGroupingPatientDto | null>(null);
  const [messagePatient, setMessagePatient] = useState<CareGroupingPatientDto | null>(null);

  const debouncedSearch = useDebounce(search);
  const serviceGroups = useServiceGroupOptions();
  const patientTags = usePatientTagOptions();
  const staff = useStaffOptions();

  const query = useCareGroupingPatients({
    branchId,
    taxonomyId,
    tagId,
    birthdayDate: birthday ? birthday.format("YYYY-MM-DD") : undefined,
    staffId,
    filter: debouncedSearch || undefined,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const columns = useMemo(
    () =>
      buildGroupColumns(branchId, {
        onCall: () => toast.error(t("Chưa có cấu hình tổng đài gọi điện")),
        onMessage: setMessagePatient,
        onCare: setCarePatient,
      }),
    [branchId],
  );

  return (
    <>
      <div className="cskh-toolbar cskh-toolbar--split">
        <div className="cskh-select">
          <MessageField label={t("Nhóm dịch vụ")} hasValue={Boolean(taxonomyId)}>
            <SearchSelect
              value={taxonomyId}
              options={serviceGroups.data ?? []}
              allowClear
              onChange={(value) => {
                onTaxonomyChange(value);
                pagination.resetToFirstPage();
              }}
            />
          </MessageField>
        </div>
        <div className="cskh-select">
          <MessageField label={t("Thẻ tag")} hasValue={Boolean(tagId)}>
            <SearchSelect
              value={tagId}
              options={patientTags.data ?? []}
              allowClear
              onChange={(value) => {
                setTagId(value);
                pagination.resetToFirstPage();
              }}
            />
          </MessageField>
        </div>
        <div className="cskh-select">
          <MessageField label={t("Ngày sinh nhật")} hasValue={Boolean(birthday)}>
            <DatePicker
              format="DD/MM/YYYY"
              value={birthday}
              onChange={(next) => {
                setBirthday(next);
                pagination.resetToFirstPage();
              }}
            />
          </MessageField>
        </div>
        <div className="cskh-toolbar-search">
          <MessageField label={t("Tìm kiếm")} hasValue={Boolean(search)}>
            <Input
              allowClear
              aria-label={t("Tìm kiếm")}
              prefix={<SearchOutlined />}
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                pagination.resetToFirstPage();
              }}
            />
          </MessageField>
        </div>
        <div className="cskh-select">
          <MessageField label={t("Bác sĩ điều trị")} hasValue={Boolean(staffId)}>
            <SearchSelect
              value={staffId}
              options={staff.data ?? []}
              allowClear
              onChange={(value) => {
                setStaffId(value);
                pagination.resetToFirstPage();
              }}
            />
          </MessageField>
        </div>
      </div>

      <div className="cskh-table-card">
        <Table<CareGroupingPatientDto>
          rowKey="id"
          className="cskh-table"
          columns={columns}
          dataSource={query.data?.items ?? []}
          loading={query.isLoading}
          locale={{ emptyText: t("Không có dữ liệu") }}
          scroll={{ x: "max-content" }}
          pagination={pagination.buildConfig(query.data?.totalCount)}
        />
      </div>

      <BaseCareDialog
        open={Boolean(carePatient)}
        patient={carePatient ? { id: carePatient.id, code: carePatient.code, name: carePatient.name } : null}
        onClose={() => setCarePatient(null)}
      />
      <SaveMessageDialog
        open={Boolean(messagePatient)}
        patient={messagePatient ? { code: messagePatient.code, name: messagePatient.name } : null}
        onClose={() => setMessagePatient(null)}
      />
    </>
  );
}
