import { Form, Input, Select } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { PatientSearchSelect } from "@/components/SearchSelect";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useCardTypes } from "../api/prepaidCardApi";
import { COMMISSION_TYPE, SALE_METHOD, type CardTypeDto, type SaleMethod, type SellCardInput } from "../types";
import { MemberPicker, type MemberChoice } from "./MemberPicker";
import { MoneyTakenFields } from "./MoneyTakenFields";
import { scopeSummary } from "./ServiceScopeFields";

/** Cards may be shared with up to this many family members (PrepaidCardConsts.MaxMembers). */
const MAX_MEMBERS = 10;

interface FormValues {
  cardTypeId?: string;
  ownerPatientId?: string;
  members: MemberChoice[];
  sellerStaffId?: string;
  method: SaleMethod;
  paymentAccountId?: string;
  note?: string;
}

interface Props {
  open: boolean;
  saving: boolean;
  /** Who is signed in — the default seller. */
  currentStaffId?: string;
  onSubmit: (input: SellCardInput) => void;
  onClose: () => void;
}

function commissionOf(type: CardTypeDto): number {
  return type.commissionType === COMMISSION_TYPE.Percent
    ? Math.round((type.salePrice * type.commissionValue) / 100)
    : type.commissionValue;
}

/** One "label — value" line of the chosen type's terms. */
function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="prepaid-term">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

/** "Bán thẻ" — sell a card of a type on sale, loaded with its usage value. */
export function SellCardDialog({ open, saving, currentStaffId, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { data: types = [] } = useCardTypes(true);
  const { data: staff = [], isLoading: staffLoading } = useStaffOptions();
  const cardTypeId = Form.useWatch("cardTypeId", form);
  const ownerId = Form.useWatch("ownerPatientId", form);
  const type = types.find((x) => x.id === cardTypeId);

  const handleFinish = (values: FormValues) =>
    onSubmit({
      cardTypeId: values.cardTypeId ?? "",
      ownerPatientId: values.ownerPatientId ?? "",
      memberPatientIds: type?.allowFamily ? values.members.map((m) => m.patientId) : [],
      sellerStaffId: values.sellerStaffId ?? "",
      method: values.method,
      paymentAccountId: values.paymentAccountId ?? null,
      note: values.note?.trim() || null,
    });

  return (
    <AppDialog
      open={open}
      title={t("PrepaidCard:Sell:Title")}
      width={720}
      className="prepaid-dialog"
      canSave
      saving={saving}
      saveLabel={t("PrepaidCard:Sell:Submit")}
      cancelLabel={t("Common:Cancel")}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {open && (
        <Form<FormValues>
          form={form}
          layout="vertical"
          preserve={false}
          initialValues={{ members: [], method: SALE_METHOD.Cash, sellerStaffId: currentStaffId }}
          onFinish={handleFinish}
        >
          <Form.Item
            name="cardTypeId"
            label={t("PrepaidCard:Field:CardType")}
            rules={[{ required: true, message: t("PrepaidCard:Validation:CardType") }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("PrepaidCard:Field:CardType")}
              notFoundContent={t("PrepaidCard:Type:NoneOnSale")}
              options={types.map((x) => ({ value: x.id, label: x.name }))}
            />
          </Form.Item>
          {type ? (
            <div className="prepaid-terms">
              <Term label={t("PrepaidCard:Field:SalePrice")} value={formatVND(type.salePrice)} />
              <Term label={t("PrepaidCard:Field:UsageValue")} value={formatVND(type.usageValue)} />
              <Term label={t("PrepaidCard:Field:MaxUses")} value={type.maxUses ? String(type.maxUses) : t("PrepaidCard:Unlimited")} />
              <Term
                label={t("PrepaidCard:Field:Validity")}
                value={type.validityMonths ? `${type.validityMonths} ${t("PrepaidCard:Months")}` : t("PrepaidCard:NoExpiry")}
              />
              <Term label={t("PrepaidCard:Field:Commission")} value={formatVND(commissionOf(type))} />
              <Term label={t("PrepaidCard:Field:Scope")} value={scopeSummary(type)} />
            </div>
          ) : null}
          <Form.Item
            name="ownerPatientId"
            label={t("PrepaidCard:Field:Owner")}
            rules={[{ required: true, message: t("PrepaidCard:Validation:Owner") }]}
          >
            <PatientSearchSelect placeholder={t("PrepaidCard:Field:Owner")} />
          </Form.Item>
          {type?.allowFamily ? (
            <Form.Item name="members" label={t("PrepaidCard:Field:Members")} extra={t("PrepaidCard:Members:Hint")}>
              <MemberPicker ownerId={ownerId} max={MAX_MEMBERS} />
            </Form.Item>
          ) : null}
          <Form.Item
            name="sellerStaffId"
            label={t("PrepaidCard:Field:Seller")}
            rules={[{ required: true, message: t("PrepaidCard:Validation:Seller") }]}
          >
            <Select showSearch optionFilterProp="label" loading={staffLoading} options={staff} />
          </Form.Item>
          <MoneyTakenFields />
          <Form.Item name="note" label={t("PrepaidCard:Field:Note")}>
            <Input.TextArea rows={2} maxLength={500} />
          </Form.Item>
        </Form>
      )}
    </AppDialog>
  );
}
