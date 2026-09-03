import { useEffect, useRef, useState, useCallback } from "react";
import { Modal, Form, Input, Select, Row, Col, Button } from "antd";
import { PlusOutlined, DeleteOutlined, SaveOutlined } from "@ant-design/icons";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";
import { FloatingField } from "@/components/FloatingField";
import type { BranchManagerDto } from "../api/branchManagerApi";
import { t } from "@/lib/i18n";

export interface BranchManagerFormValues {
  password: string;
  confirmPassword: string;
  name: string;
  email: string;
  phoneNumber: string;
  branchIds: string[];
  address: string;
  provinceId: string;
  wardId: string;
}

interface Props {
  open: boolean;
  manager: BranchManagerDto | null;
  branchOptions: { value: string; label: string }[];
  loading: boolean;
  onSubmit: (values: BranchManagerFormValues, avatarFile?: File | null | undefined) => void;
  onClose: () => void;
}

export function BranchManagerEditorModal({
  open,
  manager,
  branchOptions,
  loading,
  onSubmit,
  onClose,
}: Props) {
  const [form] = Form.useForm();
  const isEditing = Boolean(manager);
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
      if (manager) {
        form.setFieldsValue({
          name: manager.fullName || manager.name || "",
          email: manager.email ?? "",
          phoneNumber: manager.phoneNumber ?? "",
          branchIds: manager.branchIds,
          address: manager.address ?? "",
          provinceId: manager.provinceId ?? undefined,
          wardId: manager.wardId ?? undefined,
        });
        if (manager.provinceId) loadWards(manager.provinceId);
        else setWards([]);
      } else {
        form.resetFields();
        setWards([]);
      }
      setAvatarFile(undefined);
      setAvatarPreview(manager?.avatarUrl ?? null);
    }
  }, [open, manager, form, loadWards]);

  const handleFinish = () => {
    form.validateFields().then((values) => {
      const result: BranchManagerFormValues = {
        ...values,
        provinceId: values.provinceId ?? "",
        wardId: values.wardId ?? "",
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
      title={isEditing ? t("Cập nhật quản lý chi nhánh") : t("Tạo quản lý chi nhánh")}
      width={772}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Button
          type="primary"
          loading={loading}
          onClick={handleFinish}
          icon={<SaveOutlined style={{ fontSize: 16 }} />}
          style={{ padding: "0 24px", fontSize: 14 }}
        >
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
            background: "#f0f2fa",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          {avatarPreview ? (
            <img
              src={avatarPreview}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="#99a0bd">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </div>
        <div style={{ marginTop: 8, display: "flex", justifyContent: "center", gap: 8 }}>
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
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

      <Form form={form} layout="vertical" requiredMark initialValues={{ branchIds: [] }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Họ và tên + Email + Số điện thoại */}
          <Row gutter={[16, { xs: 20, sm: 12 }]}>
            <Col xs={24} sm={8}>
              <FloatingField
                name="name"
                label={t("Họ và tên")}
                required
                rules={[{ required: true, message: t("Vui lòng nhập họ và tên") }]}
              >
                <Input />
              </FloatingField>
            </Col>
            <Col xs={24} sm={8}>
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
            <Col xs={24} sm={8}>
              <FloatingField
                name="phoneNumber"
                label={t("Số điện thoại")}
                required
                rules={[
                  { required: true, message: t("Vui lòng nhập số điện thoại") },
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

          {/* Chi nhánh + Địa chỉ */}
          <Row gutter={[16, { xs: 20, sm: 12 }]}>
            <Col xs={24} sm={12}>
              <FloatingField
                name="branchIds"
                label={t("Chọn chi nhánh")}
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
            <Col xs={24} sm={12}>
              <FloatingField name="address" label={t("Địa chỉ")}>
                <Input />
              </FloatingField>
            </Col>
          </Row>

          {/* Mật khẩu + Nhập lại mật khẩu (only on create) */}
          {!isEditing && (
            <Row gutter={[16, { xs: 20, sm: 12 }]}>
              <Col xs={24} sm={12}>
                <FloatingField
                  name="password"
                  label={t("Mật khẩu")}
                  required
                  rules={[{ required: true, message: t("Mật khẩu không được để trống") }]}
                >
                  <Input.Password />
                </FloatingField>
              </Col>
              <Col xs={24} sm={12}>
                <FloatingField
                  name="confirmPassword"
                  label={t("Nhập lại mật khẩu")}
                  required
                  dependencies={["password"]}
                  rules={[
                    { required: true, message: t("Vui lòng nhập lại mật khẩu") },
                    ({ getFieldValue }) => ({
                      validator(_, val) {
                        if (!val || getFieldValue("password") === val) return Promise.resolve();
                        return Promise.reject(new Error(t("Mật khẩu không khớp")));
                      },
                    }),
                  ]}
                >
                  <Input.Password />
                </FloatingField>
              </Col>
            </Row>
          )}

          {/* Tỉnh/Thành phố + Xã/Phường */}
          <Row gutter={[16, { xs: 20, sm: 12 }]}>
            <Col xs={24} sm={12}>
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
            <Col xs={24} sm={12}>
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
        </div>
      </Form>
    </Modal>
  );
}
