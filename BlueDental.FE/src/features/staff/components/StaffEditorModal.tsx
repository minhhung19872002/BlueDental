import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
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
import { validateImageFile, IMAGE_ACCEPT } from "@/utils/validateImageFile";
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
      title={isEditing ? t("Staff:EditStaff") : t("Staff:AddStaff")}
      width={772}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Button type="primary" loading={loading} onClick={handleFinish} icon={<SaveOutlined style={{ fontSize: 16 }} />} style={{ padding: "0 24px", fontSize: 14 }}>
          {t("Common:Save")}
        </Button>
      }
    >
      {/* Avatar */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const error = validateImageFile(file);
            if (error) { toast.error(error); e.target.value = ""; return; }
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
            background: "var(--bd-bg)",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" style={{ fill: "var(--bd-faint)" }}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 8 }}>
          <Button size="small" icon={<PlusOutlined />} onClick={() => fileInputRef.current?.click()}>
            {t("Staff:UploadPhoto")}
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
              {t("Staff:DeletePhoto")}
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
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="roleNames"
              label={t("Staff:PermissionGroup")}
              required
              rules={[{ required: true, message: t("Staff:PermissionGroupRequired") }]}
            >
              <Select
                placeholder={t("Staff:PermissionGroupPlaceholder")}
                options={roleNames.map((r) => ({ value: r, label: r }))}
              />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField
              name="branchIds"
              label={t("Staff:Branch")}
              required
              rules={[{ required: true, message: t("Staff:BranchRequired") }]}
            >
              <Select
                mode="multiple"
                placeholder={t("Staff:BranchPlaceholder")}
                options={branchOptions}
              />
            </FloatingField>
          </Col>
        </Row>

        {/* Họ và tên + Email + Số điện thoại */}
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={8}>
            <FloatingField
              name="name"
              label={t("Staff:FullName")}
              required
              rules={[{ required: true, message: t("Staff:FullNameRequired") }]}
            >
              <Input />
            </FloatingField>
          </Col>
          <Col xs={24} sm={8}>
            <FloatingField
              name="email"
              label={t("Staff:Email")}
              required
              rules={[
                { required: true, message: t("Staff:EmailRequired") },
                { type: "email", message: t("Staff:EmailInvalid") },
              ]}
            >
              <Input />
            </FloatingField>
          </Col>
          <Col xs={24} sm={8}>
            <FloatingField
              name="phoneNumber"
              label={t("Staff:Phone")}
              rules={[
                {
                  pattern: /^0\d{9}$/,
                  message: t("Staff:PhoneInvalid"),
                },
              ]}
            >
              <Input />
            </FloatingField>
          </Col>
        </Row>

        {/* Mật khẩu + Nhập lại mật khẩu */}
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField
              name="password"
              label={t("Staff:Password")}
              required={!isEditing}
              rules={isEditing ? [] : [{ required: true, message: t("Staff:PasswordRequired") }]}
            >
              <Input.Password />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField
              name="confirmPassword"
              label={t("Staff:ConfirmPassword")}
              required={!isEditing}
              dependencies={["password"]}
              rules={[
                ...(!isEditing ? [{ required: true, message: t("Staff:ConfirmPasswordRequired") }] : []),
                ({ getFieldValue }: { getFieldValue: (name: string) => string }) => ({
                  validator(_: unknown, val: string) {
                    if (!val || getFieldValue("password") === val) return Promise.resolve();
                    return Promise.reject(new Error(t("Staff:PasswordMismatch")));
                  },
                }),
              ]}
            >
              <Input.Password />
            </FloatingField>
          </Col>
        </Row>

        {/* Tỉnh/Thành phố + Xã/Phường */}
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={24} sm={12}>
            <FloatingField name="provinceId" label={t("Staff:Province")}>
              <Select
                showSearch
                allowClear
                placeholder={t("Staff:ProvincePlaceholder")}
                optionFilterProp="label"
                options={provinces.map((p) => ({ value: p.code, label: p.name }))}
                onChange={handleProvinceChange}
              />
            </FloatingField>
          </Col>
          <Col xs={24} sm={12}>
            <FloatingField name="wardId" label={t("Staff:Ward")}>
              <Select
                showSearch
                allowClear
                placeholder={t("Staff:WardPlaceholder")}
                optionFilterProp="label"
                options={wards.map((w) => ({ value: w.code, label: w.name }))}
                disabled={!selectedProvinceId}
              />
            </FloatingField>
          </Col>
        </Row>

        {/* Địa chỉ */}
        <FloatingField name="address" label={t("Staff:Address")}>
          <Input />
        </FloatingField>

        {/* Working hours */}
        <Row gutter={[16, { xs: 20, sm: 12 }]}>
          <Col xs={12} sm={6}>
            <FloatingField
              name="morningStartTime"
              label={t("Staff:MorningIn")}
              required
              rules={[{ required: true, message: t("Staff:Required") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col xs={12} sm={6}>
            <FloatingField
              name="morningEndTime"
              label={t("Staff:MorningOut")}
              required
              rules={[{ required: true, message: t("Staff:Required") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col xs={12} sm={6}>
            <FloatingField
              name="afternoonStartTime"
              label={t("Staff:AfternoonIn")}
              required
              rules={[{ required: true, message: t("Staff:Required") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
          <Col xs={12} sm={6}>
            <FloatingField
              name="afternoonEndTime"
              label={t("Staff:AfternoonOut")}
              required
              rules={[{ required: true, message: t("Staff:Required") }]}
            >
              <TimePicker format={TIME_FORMAT} style={{ width: "100%" }} />
            </FloatingField>
          </Col>
        </Row>

        {/* Chức danh checkboxes */}
        <div style={{ display: "flex", gap: 24 }}>
            <Form.Item name="isDentist" valuePropName="checked" noStyle>
              <Checkbox>{t("Staff:RoleDoctor")}</Checkbox>
            </Form.Item>
            <Form.Item name="isAssistant" valuePropName="checked" noStyle>
              <Checkbox>{t("Staff:RoleAssistant")}</Checkbox>
            </Form.Item>
            <Form.Item name="isHygienist" valuePropName="checked" noStyle>
              <Checkbox>{t("Staff:RoleMedic")}</Checkbox>
            </Form.Item>
        </div>

        {/* Tình trạng làm việc */}
        <Form.Item name="isActive" label={t("Staff:WorkStatus")}>
          <Radio.Group>
            <Radio value={true}>{t("Staff:Working")}</Radio>
            <Radio value={false}>{t("Staff:Resigned")}</Radio>
          </Radio.Group>
        </Form.Item>
        </div>
      </Form>
    </Modal>
  );
}
