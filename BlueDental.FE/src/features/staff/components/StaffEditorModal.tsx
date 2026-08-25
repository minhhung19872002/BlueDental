import { useEffect, useRef, useState, useCallback } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Radio,
  TimePicker,
  Row,
  Col,
  Button,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";
import { FloatingField } from "@/components/FloatingField";
import type { StaffDto } from "../api/staffApi";
import { t } from "@/lib/i18n";

export interface StaffFormValues {
  userName: string;
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  phoneNumber: string;
  roleNames: string[];
  branchIds: string[];
  address: string;
  provinceId: string;
  wardId: string;
  isDentist: boolean;
  isAssistant: boolean;
  isHygienist: boolean;
  isActive: boolean;
  morningStartTime: string;
  morningEndTime: string;
  afternoonStartTime: string;
  afternoonEndTime: string;
}

interface Props {
  open: boolean;
  staff: StaffDto | null;
  roleNames: string[];
  branchOptions: { value: string; label: string }[];
  loading: boolean;
  onSubmit: (values: StaffFormValues, avatarFile?: File | null | undefined) => void;
  onClose: () => void;
}

const TIME_FORMAT = "HH:mm";

export function StaffEditorModal({
  open,
  staff,
  roleNames,
  branchOptions,
  loading,
  onSubmit,
  onClose,
}: Props) {
  const [form] = Form.useForm();
  const isEditing = Boolean(staff);
  const selectedProvinceId = Form.useWatch("provinceId", form);

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null | undefined>(undefined);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getAllProvinces().then(setProvinces);
  }, []);

  const loadWards = useCallback((provinceCode: string) => {
    if (!provinceCode) {
      setWards([]);
      return;
    }
    getWardsByProvince(provinceCode).then(setWards);
  }, []);

  useEffect(() => {
    if (open) {
      if (staff) {
        form.setFieldsValue({
          name: staff.fullName || staff.name || "",
          email: staff.email ?? "",
          phoneNumber: staff.phoneNumber ?? "",
          roleNames: staff.roleNames?.[0] ?? undefined,
          branchIds: staff.branchIds,
          isActive: staff.isActive,
          address: staff.address ?? "",
          provinceId: staff.provinceId ?? undefined,
          wardId: staff.wardId ?? undefined,
          isDentist: staff.isDentist,
          isAssistant: staff.isAssistant,
          isHygienist: staff.isHygienist,
          morningStartTime: dayjs(staff.morningStartTime ?? "08:00", TIME_FORMAT),
          morningEndTime: dayjs(staff.morningEndTime ?? "12:00", TIME_FORMAT),
          afternoonStartTime: dayjs(staff.afternoonStartTime ?? "13:00", TIME_FORMAT),
          afternoonEndTime: dayjs(staff.afternoonEndTime ?? "17:00", TIME_FORMAT),
        });
        if (staff.provinceId) loadWards(staff.provinceId);
        else setWards([]);
      } else {
        form.resetFields();
        setWards([]);
      }
      setAvatarFile(undefined);
      setAvatarPreview(staff?.avatarUrl ?? null);
    }
  }, [open, staff, form, loadWards]);

  const handleFinish = () => {
    form.validateFields().then((values) => {
      const roleNames = Array.isArray(values.roleNames) ? values.roleNames : values.roleNames ? [values.roleNames] : [];
      const result: StaffFormValues = {
        ...values,
        userName: isEditing ? (staff?.userName ?? "") : (values.email?.split("@")[0] ?? ""),
        roleNames,
        provinceId: values.provinceId ?? "",
        wardId: values.wardId ?? "",
        morningStartTime: values.morningStartTime?.format(TIME_FORMAT) ?? "08:00",
        morningEndTime: values.morningEndTime?.format(TIME_FORMAT) ?? "12:00",
        afternoonStartTime: values.afternoonStartTime?.format(TIME_FORMAT) ?? "13:00",
        afternoonEndTime: values.afternoonEndTime?.format(TIME_FORMAT) ?? "17:00",
        isDentist: values.isDentist ?? false,
        isAssistant: values.isAssistant ?? false,
        isHygienist: values.isHygienist ?? false,
        isActive: values.isActive ?? true,
      };
      onSubmit(result, avatarFile);
    });
  };

  const handleProvinceChange = (value: string) => {
    form.setFieldsValue({ wardId: undefined });
    loadWards(value ?? "");
  };

  return (
    <Modal
      open={open}
      title={isEditing ? t("Cập nhật nhân viên") : t("Thêm nhân viên")}
      width={772}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Button type="primary" loading={loading} onClick={handleFinish} icon={<SaveOutlined style={{ fontSize: 16 }} />} style={{ padding: "0 24px", fontSize: 14 }}>
          {t("Lưu")}
        </Button>
      }
    >
      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setAvatarFile(file);
            const url = URL.createObjectURL(file);
            setAvatarPreview((prev) => {
              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
              return url;
            });
            e.target.value = "";
          }}
        />
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#f3f4f6",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#9ca3af">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 8 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={() => fileInputRef.current?.click()}>
            {t("Tải ảnh lên")}
          </Button>
          {avatarPreview && (
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
                setAvatarFile(null);
                setAvatarPreview(null);
              }}
            >
              {t("Xóa ảnh")}
            </Button>
          )}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark
        initialValues={{
          isActive: true,
          isDentist: false,
          isAssistant: false,
          isHygienist: false,
          branchIds: [],
          morningStartTime: dayjs("08:00", TIME_FORMAT),
          morningEndTime: dayjs("12:00", TIME_FORMAT),
          afternoonStartTime: dayjs("13:00", TIME_FORMAT),
          afternoonEndTime: dayjs("17:00", TIME_FORMAT),
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Nhóm quyền + Chi nhánh */}
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField
              name="roleNames"
              label={t("Nhóm quyền")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn nhóm quyền") }]}
            >
              <Select
                placeholder={t("Chọn nhóm quyền")}
                options={roleNames.map((r) => ({ value: r, label: r }))}
              />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField
              name="branchIds"
              label={t("Chi nhánh")}
              required
              rules={[{ required: true, message: t("Vui lòng chọn chi nhánh") }]}
            >
              <Select
                mode="multiple"
                placeholder={t("Chọn chi nhánh")}
                options={branchOptions}
              />
            </FloatingField>
          </Col>
        </Row>

        {/* Họ và tên + Email + Số điện thoại */}
        <Row gutter={[16, 12]}>
          <Col span={8}>
            <FloatingField
              name="name"
              label={t("Họ và tên")}
              required
              rules={[{ required: true, message: t("Vui lòng nhập họ và tên") }]}
            >
              <Input />
            </FloatingField>
          </Col>
          <Col span={8}>
            <FloatingField
              name="email"
              label={t("Email")}
              required
              rules={[
                { required: true, message: t("Email không được để trống") },
                { type: "email", message: t("Email không hợp lệ") },
              ]}
            >
              <Input />
            </FloatingField>
          </Col>
          <Col span={8}>
            <FloatingField
              name="phoneNumber"
              label={t("Số điện thoại")}
              rules={[
                {
                  pattern: /^0\d{9}$/,
                  message: t("Số điện thoại không hợp lệ (VD: 0901234567)"),
                },
              ]}
            >
              <Input />
            </FloatingField>
          </Col>
        </Row>

        {/* Mật khẩu + Nhập lại mật khẩu */}
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField
              name="password"
              label={t("Mật khẩu")}
              required={!isEditing}
              rules={isEditing ? [] : [{ required: true, message: t("Mật khẩu không được để trống") }]}
            >
              <Input.Password />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField
              name="confirmPassword"
              label={t("Nhập lại mật khẩu")}
              required={!isEditing}
              dependencies={["password"]}
              rules={
                isEditing
                  ? []
                  : [
                      { required: true, message: t("Vui lòng nhập lại mật khẩu") },
                      ({ getFieldValue }) => ({
                        validator(_, val) {
                          if (!val || getFieldValue("password") === val) return Promise.resolve();
                          return Promise.reject(new Error(t("Mật khẩu không khớp")));
                        },
                      }),
                    ]
              }
            >
              <Input.Password />
            </FloatingField>
          </Col>
        </Row>

        {/* Tỉnh/Thành phố + Xã/Phường */}
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <FloatingField name="provinceId" label={t("Tỉnh/ Thành phố")}>
              <Select
                showSearch
                allowClear
                placeholder={t("Chọn tỉnh/ thành phố")}
                optionFilterProp="label"
                options={provinces.map((p) => ({ value: p.code, label: p.name }))}
                onChange={handleProvinceChange}
              />
            </FloatingField>
          </Col>
          <Col span={12}>
            <FloatingField name="wardId" label={t("Xã/ Phường")}>
              <Select
                showSearch
                allowClear
                placeholder={t("Chọn xã/ phường")}
                optionFilterProp="label"
                options={wards.map((w) => ({ value: w.code, label: w.name }))}
                disabled={!selectedProvinceId}
              />
            </FloatingField>
          </Col>
        </Row>

        {/* Địa chỉ */}
        <FloatingField name="address" label={t("Địa chỉ")}>
          <Input />
        </FloatingField>

        {/* Working hours */}
        <Row gutter={[16, 12]}>
          <Col span={6}>
            <FloatingField
              name="morningStartTime"
              label={t("Sáng: giờ vào")}
              required
              rules={[{ required: true, message: t("Bắt buộc") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col span={6}>
            <FloatingField
              name="morningEndTime"
              label={t("Sáng: giờ ra")}
              required
              rules={[{ required: true, message: t("Bắt buộc") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col span={6}>
            <FloatingField
              name="afternoonStartTime"
              label={t("Chiều: giờ vào")}
              required
              rules={[{ required: true, message: t("Bắt buộc") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col span={6}>
            <FloatingField
              name="afternoonEndTime"
              label={t("Chiều: giờ ra")}
              required
              rules={[{ required: true, message: t("Bắt buộc") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>

        {/* Chức danh checkboxes */}
        <div style={{ display: "flex", gap: 24 }}>
            <Form.Item name="isDentist" valuePropName="checked" noStyle>
              <Checkbox>{t("Bác sĩ")}</Checkbox>
            </Form.Item>
            <Form.Item name="isAssistant" valuePropName="checked" noStyle>
              <Checkbox>{t("Phụ tá")}</Checkbox>
            </Form.Item>
            <Form.Item name="isHygienist" valuePropName="checked" noStyle>
              <Checkbox>{t("Y sĩ")}</Checkbox>
            </Form.Item>
        </div>

        {/* Tình trạng làm việc */}
        <Form.Item name="isActive" label={t("Tình trạng làm việc")}>
          <Radio.Group>
            <Radio value={true}>{t("Đang làm việc")}</Radio>
            <Radio value={false}>{t("Đã nghỉ")}</Radio>
          </Radio.Group>
        </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
