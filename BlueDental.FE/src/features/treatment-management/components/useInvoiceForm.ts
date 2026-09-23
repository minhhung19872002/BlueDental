import { useState, useCallback, useEffect } from "react";
import dayjs, { type Dayjs } from "dayjs";
import type { PatientDto } from "@/features/patient-management/types/patient";
import type { TreatmentPlanSlipDto } from "../api/treatmentPlanApi";
import type { InvoiceServiceRow, InvoicePaymentMethod } from "./invoiceTypes";
import { t } from "@/lib/i18n";
import {
  INVOICE_TEMPLATES,
  DEFAULT_TAX_TYPE,
  DEFAULT_UNIT_KEY,
  DEFAULT_CURRENCY,
  DEFAULT_EXCHANGE_RATE,
} from "./invoiceConstants";

/**
 * The reception's "Hóa đơn" bills the slip, not its services: the reference
 * hands the dialog a single line called "Kế hoạch điều trị DT32", quantity 1,
 * priced at the slip's Thành tiền (measured 2026-09-21, and confirmed against
 * its own row adapter).
 */
function buildPlanRow(plan: TreatmentPlanSlipDto): InvoiceServiceRow {
  const amount = plan.payment.totalPrice;
  return {
    key: `invoice-${plan.id}`,
    stt: 1,
    serviceName: t("Treatment:Plan:ServiceName", plan.code),
    taxType: DEFAULT_TAX_TYPE,
    unit: t(DEFAULT_UNIT_KEY),
    quantity: 1,
    unitPrice: amount,
    taxBasePrice: amount,
    taxPercent: DEFAULT_TAX_TYPE,
    taxAmount: 0,
    totalAfterTax: amount,
    selected: true,
  };
}

export function useInvoiceForm(open: boolean, patient: PatientDto, plan: TreatmentPlanSlipDto) {
  const [customerName, setCustomerName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [templateId, setTemplateId] = useState(INVOICE_TEMPLATES[0].id);
  const [invoiceDate, setInvoiceDate] = useState<Dayjs>(dayjs());
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>("cash");
  const [serviceRows, setServiceRows] = useState<InvoiceServiceRow[]>([]);

  useEffect(() => {
    if (open) {
      setCustomerName(patient.fullName);
      setNationalId(patient.nationalId ?? "");
      setCompanyName("");
      setAddress(patient.address ?? "-");
      setTaxCode("");
      setEmail(patient.email ?? "-");
      setPhone(patient.phoneNumber ?? "");
      setTemplateId(INVOICE_TEMPLATES[0].id);
      setTemplateSymbol(INVOICE_TEMPLATES[0].symbol);
      setCurrency(DEFAULT_CURRENCY);
      setExchangeRate(String(DEFAULT_EXCHANGE_RATE));
      setInvoiceDate(dayjs());
      setPaymentMethod("cash");
      setServiceRows([buildPlanRow(plan)]);
    }
  }, [open, patient, plan]);

  const [templateSymbol, setTemplateSymbol] = useState("");
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState(String(DEFAULT_EXCHANGE_RATE));

  const handleTemplateChange = useCallback((id: string) => {
    setTemplateId(id);
    const tpl = INVOICE_TEMPLATES.find((t) => t.id === id);
    if (tpl) setTemplateSymbol(tpl.symbol);
  }, []);
  const handleDateChange = useCallback((d: Dayjs | null) => {
    if (d) setInvoiceDate(d);
  }, []);

  const allSelected = serviceRows.length > 0 && serviceRows.every((r) => r.selected);

  const handleToggleAll = useCallback(
    (checked: boolean) =>
      setServiceRows((prev) => prev.map((r) => ({ ...r, selected: checked }))),
    [],
  );

  const handleToggleRow = useCallback(
    (key: string, checked: boolean) =>
      setServiceRows((prev) => prev.map((r) => (r.key === key ? { ...r, selected: checked } : r))),
    [],
  );

  const handleTaxTypeChange = useCallback((key: string, taxType: string) => {
    setServiceRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, taxType, taxPercent: taxType } : r)),
    );
  }, []);

  const handleUnitPriceChange = useCallback((key: string, price: number | undefined) => {
    setServiceRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const unitPrice = price ?? 0;
        const taxBasePrice = unitPrice * r.quantity;
        return { ...r, unitPrice, taxBasePrice, totalAfterTax: taxBasePrice };
      }),
    );
  }, []);

  const selected = serviceRows.filter((r) => r.selected);
  const totalAmount = selected.reduce((sum, r) => sum + r.totalAfterTax, 0);
  const totalTax = selected.reduce((sum, r) => sum + r.taxAmount, 0);
  const grandTotal = totalAmount;

  return {
    customerName,
    onCustomerNameChange: setCustomerName,
    nationalId,
    onNationalIdChange: setNationalId,
    companyName,
    onCompanyNameChange: setCompanyName,
    address,
    onAddressChange: setAddress,
    taxCode,
    onTaxCodeChange: setTaxCode,
    email,
    onEmailChange: setEmail,
    phone,
    onPhoneChange: setPhone,
    templateId,
    onTemplateChange: handleTemplateChange,
    templateSymbol,
    onTemplateSymbolChange: setTemplateSymbol,
    invoiceDate,
    onInvoiceDateChange: handleDateChange,
    paymentMethod,
    onPaymentMethodChange: setPaymentMethod,
    currency,
    onCurrencyChange: setCurrency,
    exchangeRate,
    onExchangeRateChange: setExchangeRate,
    serviceRows,
    allSelected,
    onToggleAll: handleToggleAll,
    onToggleRow: handleToggleRow,
    onTaxTypeChange: handleTaxTypeChange,
    onUnitPriceChange: handleUnitPriceChange,
    totalAmount,
    totalTax,
    grandTotal,
  };
}
