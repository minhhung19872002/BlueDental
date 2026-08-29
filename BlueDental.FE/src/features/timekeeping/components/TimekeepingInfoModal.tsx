import { useEffect, useState } from "react";
import { Modal, Input, DatePicker, Switch, TimePicker, Button } from "antd";
import { SearchOutlined, SaveOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import dayjs from "dayjs";

import { FloatingLabel } from "@/components/FloatingLabel";
import { useUpdateInfo, useOpenWorkDay } from "../api/timekeepingQueries";
import type { TimeKeepingRecordDto } from "../api/timekeepingApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  record: TimeKeepingRecordDto | null;
  onClose: () => void;
}

const TIME_FORMAT = "HH:mm";

function parseTime(s: string) {
  const [h, m] = s.split(":").map(Number);
  return dayjs().hour(h).minute(m).second(0);
}

export function TimekeepingInfoModal({ open, record, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const updateInfo = useUpdateInfo();
  const openWorkDay = useOpenWorkDay();

  const [note, setNote] = useState("");
  const [morningEnabled, setMorningEnabled] = useState(true);
  const [afternoonEnabled, setAfternoonEnabled] = useState(true);
  const [morningStart, setMorningStart] = useState(dayjs().hour(8).minute(0));
  const [morningEnd, setMorningEnd] = useState(dayjs().hour(12).minute(0));
  const [afternoonStart, setAfternoonStart] = useState(dayjs().hour(13).minute(0));
  const [afternoonEnd, setAfternoonEnd] = useState(dayjs().hour(17).minute(0));
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [overtimeValue, setOvertimeValue] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    if (!record) return;
    setNote(record.note ?? "");
    setMorningStart(parseTime(record.morningShift.plannedStart));
    setMorningEnd(parseTime(record.morningShift.plannedEnd));
    setAfternoonStart(parseTime(record.afternoonShift.plannedStart));
    setAfternoonEnd(parseTime(record.afternoonShift.plannedEnd));
    setMorningEnabled(true);
    setAfternoonEnabled(true);
    const ot = record.overtimeMinutes ?? 0;
    setOvertimeEnabled(ot > 0);
    setOvertimeValue(ot > 0 ? dayjs().hour(Math.floor(ot / 60)).minute(ot % 60) : null);
  }, [record]);

  if (!record) return null;

  const isVirtual = record.id.startsWith("virtual-");
  const loading = updateInfo.isPending || openWorkDay.isPending;

  const handleSave = async () => {
    try {
      let recordId = record.id;
      if (isVirtual) {
        const created = await openWorkDay.mutateAsync({
          staffId: record.staffId,
          clinicBranchId: branchId,
          workDate: record.workDate,
        });
        recordId = created.id;
      }

      let overtimeMinutes: number | undefined;
      if (overtimeEnabled && overtimeValue) {
        overtimeMinutes = overtimeValue.hour() * 60 + overtimeValue.minute();
      }

      await updateInfo.mutateAsync({
        id: recordId,
        input: {
          note: note || null,
          morningStart: morningEnabled ? morningStart.format(TIME_FORMAT) : undefined,
          morningEnd: morningEnabled ? morningEnd.format(TIME_FORMAT) : undefined,
          afternoonStart: afternoonEnabled ? afternoonStart.format(TIME_FORMAT) : undefined,
          afternoonEnd: afternoonEnabled ? afternoonEnd.format(TIME_FORMAT) : undefined,
          morningEnabled,
          afternoonEnabled,
          overtimeMinutes,
        },
      });
      toast.success(t("Đã cập nhật thông tin."));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const staffName = record.staffName ?? t("Nhân viên");
  const workDate = dayjs(record.workDate);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t("Cập nhật thông tin")}
      footer={null}
      width={772}
      destroyOnClose
    >
      <div className="tk-info-form">
        <div className="tk-info-row">
          <FloatingLabel label={t("CBNV")} floated>
            <Input
              prefix={<SearchOutlined style={{ color: "#98a4b4" }} />}
              value={staffName}
              readOnly
            />
          </FloatingLabel>
          <FloatingLabel label={t("Ngày")} floated>
            <DatePicker
              value={workDate}
              format="DD/MM/YYYY"
              disabled
              style={{ width: "100%" }}
            />
          </FloatingLabel>
        </div>

        <FloatingLabel label={t("Ghi chú")} floated={Boolean(note)}>
          <Input.TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </FloatingLabel>

        <div className="tk-info-section">
          <p className="tk-info-section-title">{t("Lịch làm việc")}</p>

          <div className="tk-info-shift-row">
            <Switch checked={morningEnabled} onChange={setMorningEnabled} />
            <FloatingLabel label={t("Buổi sáng: giờ vào")} floated>
              <TimePicker
                value={morningEnabled ? morningStart : null}
                onChange={(v) => v && setMorningStart(v)}
                format={TIME_FORMAT}
                placeholder="HH:mm"
                disabled={!morningEnabled}
                style={{ width: "100%" }}
              />
            </FloatingLabel>
            <FloatingLabel label={t("Buổi sáng: giờ ra")} floated>
              <TimePicker
                value={morningEnabled ? morningEnd : null}
                onChange={(v) => v && setMorningEnd(v)}
                format={TIME_FORMAT}
                placeholder="HH:mm"
                disabled={!morningEnabled}
                style={{ width: "100%" }}
              />
            </FloatingLabel>
          </div>

          <div className="tk-info-shift-row">
            <Switch checked={afternoonEnabled} onChange={setAfternoonEnabled} />
            <FloatingLabel label={t("Buổi chiều: giờ vào")} floated>
              <TimePicker
                value={afternoonEnabled ? afternoonStart : null}
                onChange={(v) => v && setAfternoonStart(v)}
                format={TIME_FORMAT}
                placeholder="HH:mm"
                disabled={!afternoonEnabled}
                style={{ width: "100%" }}
              />
            </FloatingLabel>
            <FloatingLabel label={t("Buổi chiều: giờ ra")} floated>
              <TimePicker
                value={afternoonEnabled ? afternoonEnd : null}
                onChange={(v) => v && setAfternoonEnd(v)}
                format={TIME_FORMAT}
                placeholder="HH:mm"
                disabled={!afternoonEnabled}
                style={{ width: "100%" }}
              />
            </FloatingLabel>
          </div>
        </div>

        <div className="tk-info-section">
          <div className="tk-info-overtime-header">
            <p className="tk-info-section-title">{t("Làm thêm giờ")}</p>
            <Switch checked={overtimeEnabled} onChange={setOvertimeEnabled} />
          </div>
          <FloatingLabel label={t("Số giờ")} floated>
            <TimePicker
              value={overtimeValue}
              onChange={setOvertimeValue}
              format={TIME_FORMAT}
              placeholder="HH:mm"
              disabled={!overtimeEnabled}
              style={{ width: 200 }}
            />
          </FloatingLabel>
        </div>

        <div className="tk-info-footer">
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={loading}
            disabled={loading}
            onClick={handleSave}
          >
            {t("Lưu")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
