import { COMMISSION_TYPE, type CardTypeDto, type CommissionType, type SaveCardTypeInput } from "./index";

/** The "Loại thẻ" form, as AntD holds it: empty money fields are undefined. */
export interface CardTypeFormValues {
  name: string;
  salePrice?: number;
  usageValue?: number;
  maxUses?: number | null;
  commissionType: CommissionType;
  commissionValue?: number;
  allowFamily: boolean;
  isOnSale: boolean;
  serviceIds: string[];
  serviceGroupIds: string[];
  note?: string;
}

export const CARD_TYPE_FORM_DEFAULTS: CardTypeFormValues = {
  name: "",
  commissionType: COMMISSION_TYPE.Percent,
  allowFamily: false,
  isOnSale: true,
  serviceIds: [],
  serviceGroupIds: [],
};

export function cardTypeToForm(type: CardTypeDto): CardTypeFormValues {
  return {
    name: type.name,
    salePrice: type.salePrice,
    usageValue: type.usageValue,
    maxUses: type.maxUses,
    commissionType: type.commissionType,
    commissionValue: type.commissionValue,
    allowFamily: type.allowFamily,
    isOnSale: type.isOnSale,
    serviceIds: type.serviceIds,
    serviceGroupIds: type.serviceGroupIds,
    note: type.note ?? undefined,
  };
}

export function formToCardType(values: CardTypeFormValues): SaveCardTypeInput {
  return {
    name: values.name.trim(),
    salePrice: values.salePrice ?? 0,
    usageValue: values.usageValue ?? 0,
    maxUses: values.maxUses ?? null,
    commissionType: values.commissionType,
    commissionValue: values.commissionValue ?? 0,
    allowFamily: values.allowFamily,
    isOnSale: values.isOnSale,
    serviceIds: values.serviceIds ?? [],
    serviceGroupIds: values.serviceGroupIds ?? [],
    note: values.note?.trim() || null,
  };
}
