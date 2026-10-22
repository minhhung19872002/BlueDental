import { Button, Input } from "antd";
import {
  FileExcelOutlined,
  LoadingOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { SearchSelect } from "@/components/SearchSelect/SearchSelect";
import { useDentistStaffOptions, useStaffOptions } from "@/hooks/useStaffOptions";
import { MessageField } from "./MessageField";
import type { CareTabConfig } from "../careTabs";

/** The row's buttons; each is hidden when its handler is absent. */
interface CareToolbarActions {
  exporting: boolean;
  onExport?: () => void;
  onCreate?: () => void;
}

interface CareToolbarProps {
  tab: CareTabConfig;
  search: string;
  doctorId: string | undefined;
  careStaffId: string | undefined;
  onSearchChange: (value: string) => void;
  onDoctorChange: (value: string | undefined) => void;
  onCareStaffChange: (value: string | undefined) => void;
  actions: CareToolbarActions;
}

/** Per-tab toolbar row: Xuất Excel · Tìm kiếm · Bác sĩ · NV CSKH · Tạo mới. */
export function CareToolbar({
  tab,
  search,
  doctorId,
  careStaffId,
  onSearchChange,
  onDoctorChange,
  onCareStaffChange,
  actions,
}: CareToolbarProps) {
  const { exporting, onExport, onCreate } = actions;
  const doctors = useDentistStaffOptions();
  const staff = useStaffOptions();

  return (
    <div className="cskh-toolbar">
      {onExport && (
        <Button
          className="cskh-excel-btn"
          icon={exporting ? <LoadingOutlined /> : <FileExcelOutlined />}
          disabled={exporting}
          onClick={onExport}
        >
          {t("CSKH:Action:ExportExcel")}
        </Button>
      )}

      <div className="cskh-toolbar-search">
        <MessageField label={t("Common:Search")} hasValue={Boolean(search)}>
          <Input
            allowClear
            aria-label={t("Common:Search")}
            prefix={<SearchOutlined />}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </MessageField>
      </div>

      {tab.showDoctor && (
        <div className="cskh-select">
          <MessageField label={t("CSKH:DoctorTreat")} hasValue={Boolean(doctorId)}>
            <SearchSelect
              value={doctorId}
              options={doctors.data ?? []}
              allowClear
              onChange={onDoctorChange}
            />
          </MessageField>
        </div>
      )}

      {tab.showCareStaff && (
        <div className="cskh-select">
          <MessageField label={t("CSKH:CareStaffFilter")} hasValue={Boolean(careStaffId)}>
            <SearchSelect
              value={careStaffId}
              options={staff.data ?? []}
              allowClear
              onChange={onCareStaffChange}
            />
          </MessageField>
        </div>
      )}

      {tab.showCreate && onCreate && (
        <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
          {t("CSKH:Action:CreateNew")}
        </Button>
      )}
    </div>
  );
}
