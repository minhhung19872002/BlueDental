import { useState, useCallback, useEffect } from "react";
import dayjs, { type Dayjs } from "dayjs";
import {
  EINVOICE_PAYMENT_METHOD,
  type ElectronicInvoiceDraftDto,
  type ElectronicInvoiceLineInput,
} from "../api/eInvoiceApi";
import type { InvoicePaymentMethod, InvoiceServiceRow, InvoiceTaxType } from "./invoiceTypes";
import {
  DEFAULT_CURRENCY,
  DEFAULT_EXCHANGE_RATE,
  taxOf,
  taxTypeOf,
  vatRateLabel,
  vatRateOf,
} from "./invoiceConstants";
import { missingRedInvoiceFields } from "./redInvoiceRules";

/** A line priced and taxed under the chosen type; CX falls back to the account's rate. */
function priced(row: InvoiceServiceRow, defaultVatRate: number): InvoiceServiceRow {
  const rate = vatRateOf(row.taxType) ?? defaultVatRate;
  const taxBasePrice = Math.round(row.unitPrice * row.quantity);
  const taxAmount = taxOf(taxBasePrice, rate);
  return { ...row, taxBasePrice, taxAmount, taxPercent: vatRateLabel(rate), totalAfterTax: taxBasePrice + taxAmount };
}

function rowsOf(draft: ElectronicInvoiceDraftDto): InvoiceServiceRow[] {
  return draft.lines.map((line, index) =>
    priced(
      {
        key: `${line.code}-${index}`,
        stt: index + 1,
        code: line.code,
        serviceName: line.name,
        // The service's own "% thuế", as the server worked it out for the line;
        // a line at the account's default opens on "Chưa xuất", as the original does.
        taxType: line.vatRate === draft.defaultVatRate ? "CX" : taxTypeOf(line.vatRate),
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        taxBasePrice: 0,
        taxPercent: "",
        taxAmount: 0,
        totalAfterTax: 0,
        selected: true,
      },
      draft.defaultVatRate,
    ),
  );
}

const blankToNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());

/** The original offers only Tiền mặt / Chuyển khoản; a mixed receipt starts on cash. */
const offeredMethod = (method: InvoicePaymentMethod): InvoicePaymentMethod =>
  method === EINVOICE_PAYMENT_METHOD.Transfer ? method : EINVOICE_PAYMENT_METHOD.Cash;

/** "1", "1,5" or "1.5"; blank means 1, unreadable goes as 0 so the server refuses it. */
function parseRate(value: string): number | null {
  if (value.trim() === "") return null;
  const rate = Number(value.trim().replace(",", "."));
  return Number.isNaN(rate) ? 0 : rate;
}

/** The dialog's editable state, seeded from the server draft each time it arrives. */
export function useInvoiceForm(draft: ElectronicInvoiceDraftDto | undefined) {
  const [customerName, setCustomerName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateSymbol, setTemplateSymbol] = useState("");
  const [invoiceDate, setInvoiceDate] = useState<Dayjs>(dayjs());
  const [paymentMethod, setPaymentMethod] = useState<InvoicePaymentMethod>(EINVOICE_PAYMENT_METHOD.Cash);
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [exchangeRate, setExchangeRate] = useState(String(DEFAULT_EXCHANGE_RATE));
  const [serviceRows, setServiceRows] = useState<InvoiceServiceRow[]>([]);
  const defaultVatRate = draft?.defaultVatRate ?? -1;

  useEffect(() => {
    if (!draft) return;
    setCustomerName(draft.buyerName);
    setNationalId(draft.nationalId ?? "");
    setCompanyName("");
    setAddress(draft.address ?? "");
    setTaxCode("");
    setEmail(draft.email ?? "");
    setPhone(draft.phone ?? "");
    setTemplateId(draft.pattern ?? "");
    setTemplateSymbol(draft.serial ?? "");
    setInvoiceDate(dayjs());
    setPaymentMethod(offeredMethod(draft.paymentMethod));
    setCurrency(DEFAULT_CURRENCY);
    setExchangeRate(String(DEFAULT_EXCHANGE_RATE));
    setServiceRows(rowsOf(draft));
  }, [draft]);

  /** Picking a Mẫu the branch used fills its Ký hiệu; a new one keeps what is typed. */
  const handleTemplateChange = useCallback(
    (pattern: string) => {
      setTemplateId(pattern);
      const known = draft?.numberings.find((n) => n.pattern === pattern);
      if (known) setTemplateSymbol(known.serial ?? "");
    },
    [draft],
  );

  const handleDateChange = useCallback((d: Dayjs | null) => {
    if (d) setInvoiceDate(d);
  }, []);

  const allSelected = serviceRows.length > 0 && serviceRows.every((r) => r.selected);

  const handleToggleAll = useCallback(
    (checked: boolean) => setServiceRows((prev) => prev.map((r) => ({ ...r, selected: checked }))),
    [],
  );

  const handleToggleRow = useCallback(
    (key: string, checked: boolean) =>
      setServiceRows((prev) => prev.map((r) => (r.key === key ? { ...r, selected: checked } : r))),
    [],
  );

  /** Each line keeps its own rate; the server refuses an invoice whose ticked lines disagree. */
  const handleTaxTypeChange = useCallback(
    (key: string, taxType: InvoiceTaxType) =>
      setServiceRows((prev) => prev.map((r) => (r.key === key ? priced({ ...r, taxType }, defaultVatRate) : r))),
    [defaultVatRate],
  );

  const handleUnitPriceChange = useCallback(
    (key: string, price: number | undefined) =>
      setServiceRows((prev) =>
        prev.map((r) => (r.key === key ? priced({ ...r, unitPrice: price ?? 0 }, defaultVatRate) : r)),
      ),
    [defaultVatRate],
  );

  const selected = serviceRows.filter((r) => r.selected);
  const totalBeforeTax = selected.reduce((sum, r) => sum + r.taxBasePrice, 0);
  const totalTax = selected.reduce((sum, r) => sum + r.taxAmount, 0);

  const buildLines = (): ElectronicInvoiceLineInput[] =>
    selected.map((r) => ({
      code: r.code,
      name: r.serviceName,
      unit: r.unit,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      vatRate: vatRateOf(r.taxType),
    }));

  const buildBuyer = () => ({
    buyerName: blankToNull(customerName),
    companyName: blankToNull(companyName),
    address: blankToNull(address),
    taxCode: blankToNull(taxCode),
    phone: blankToNull(phone),
    email: blankToNull(email),
    nationalId: blankToNull(nationalId),
    arisingDate: invoiceDate.format("YYYY-MM-DD"),
    paymentMethod,
    pattern: blankToNull(templateId),
    serial: blankToNull(templateSymbol),
    currency: blankToNull(currency),
    exchangeRate: parseRate(exchangeRate),
  });

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
    totalBeforeTax,
    totalTax,
    grandTotal: totalBeforeTax + totalTax,
    redInvoiceMissing: missingRedInvoiceFields({ customerName, taxCode, phone, email }),
    buildLines,
    buildBuyer,
  };
}
