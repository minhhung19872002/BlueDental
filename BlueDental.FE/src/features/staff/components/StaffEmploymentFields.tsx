import { AutoComplete, Col, DatePicker, Input, Row, Select } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { useStaffPositions } from "../api/staffQueries";
import { CONTRACT_TYPES } from "../api/staffApi";

const DATE_FORMAT = "DD/MM/YYYY";

/**
 * Cụm 11 mục 1 — "Hồ sơ công việc" on the staff dialog: chức vụ, chứng chỉ
 * hành nghề and hợp đồng. Chức vụ is typed freely and suggests the ones the
 * clinic already uses; the server checks the dates hold together.
 */
export function StaffEmploymentFields() {
  const { data: positions = [] } = useStaffPositions();

  return (
    <div className="staff-employment">
      <div className="staff-employment__title">{t("Staff:Section:Employment")}</div>
      <Row gutter={[16, { xs: 20, sm: 12 }]}>
        <Col xs={24} sm={12}>
          <FloatingField name="position" label={t("Staff:Position")}>
            <AutoComplete
              options={positions.map((value) => ({ value }))}
              filterOption={(input, option) => (option?.value ?? "").toLowerCase().includes(input.toLowerCase())}
            >
              <Input maxLength={100} />
            </AutoComplete>
          </FloatingField>
        </Col>
        <Col xs={24} sm={12}>
          <FloatingField name="contractType" label={t("Staff:ContractType")}>
            <Select
              allowClear
              options={CONTRACT_TYPES.map((value) => ({ value, label: t(`Staff:ContractType:${value}`) }))}
            />
          </FloatingField>
        </Col>
        <Col xs={24} sm={12}>
          <FloatingField name="contractStartDate" label={t("Staff:ContractStartDate")}>
            <DatePicker format={DATE_FORMAT} className="staff-employment__date" />
          </FloatingField>
        </Col>
        <Col xs={24} sm={12}>
          <FloatingField
            name="contractEndDate"
            label={t("Staff:ContractEndDate")}
            dependencies={["contractStartDate"]}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const start = getFieldValue("contractStartDate");
                  return !value || !start || !value.isBefore(start, "day")
                    ? Promise.resolve()
                    : Promise.reject(new Error(t("Staff:ContractEndBeforeStart")));
                },
              }),
            ]}
          >
            <DatePicker format={DATE_FORMAT} className="staff-employment__date" />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField name="practiceCertificateNumber" label={t("Staff:PracticeCertificateNumber")}>
            <Input maxLength={50} />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField name="practiceCertificateIssuedOn" label={t("Staff:PracticeCertificateIssuedOn")}>
            <DatePicker
              format={DATE_FORMAT}
              className="staff-employment__date"
              disabledDate={(day) => day.isAfter(new Date(), "day")}
            />
          </FloatingField>
        </Col>
        <Col xs={24} sm={8}>
          <FloatingField name="practiceCertificateIssuedPlace" label={t("Staff:PracticeCertificateIssuedPlace")}>
            <Input maxLength={200} />
          </FloatingField>
        </Col>
      </Row>
    </div>
  );
}
