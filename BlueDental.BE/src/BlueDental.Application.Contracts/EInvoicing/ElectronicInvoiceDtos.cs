using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using BlueDental.PatientManagement;

namespace BlueDental.EInvoicing;

/// <summary>
/// The e-invoice of one receipt or one slip: saved in BlueDental (Nháp), at
/// the provider unsigned (Chờ kiểm tra), signed (Đã xuất hóa đơn) or cancelled,
/// with every round it went out under.
/// </summary>
public class ElectronicInvoiceDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid PatientId { get; set; }

    /// <summary>Null when the invoice bills a whole slip.</summary>
    public Guid? PatientPaymentId { get; set; }

    public Guid? TreatmentPlanId { get; set; }

    /// <summary>The branch account it went out under; null for the server-wide one.</summary>
    public Guid? ProviderConfigId { get; set; }

    public string Provider { get; set; } = string.Empty;

    /// <summary>What it is of — one row per receipt or slip.</summary>
    public string SourceKey { get; set; } = string.Empty;

    /// <summary>How many times it went out under a new key; 0 while only saved.</summary>
    public int Round { get; set; }

    /// <summary>The provider key of the current round.</summary>
    public string Ikey { get; set; } = string.Empty;
    public string Pattern { get; set; } = string.Empty;
    public string? Serial { get; set; }

    public ElectronicInvoiceStatus Status { get; set; }

    /// <summary>Số hóa đơn, once the provider has signed it.</summary>
    public string? No { get; set; }

    public string? LookupCode { get; set; }
    public string? LinkView { get; set; }

    public decimal Total { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Amount { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public DateTime? ArisingDate { get; set; }

    /// <summary>When the current round was first read back signed.</summary>
    public DateTimeOffset? SignedAt { get; set; }

    /// <summary>The signed PDF is kept in BlueDental.</summary>
    public bool HasPdf { get; set; }

    public DateTimeOffset? LastSyncedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreationTime { get; set; }

    /// <summary>Every round sent, oldest first (BA 2026-11-18: re-issues are tracked on one record).</summary>
    public List<ElectronicInvoiceAttemptDto> Attempts { get; set; } = [];
}

/// <summary>One time the invoice went to the provider under its own key.</summary>
public class ElectronicInvoiceAttemptDto
{
    public int Round { get; set; }
    public string Ikey { get; set; } = string.Empty;
    public string Pattern { get; set; } = string.Empty;
    public string? Serial { get; set; }
    public ElectronicInvoiceStatus Status { get; set; }
    public string? No { get; set; }
    public decimal Amount { get; set; }
    public DateTimeOffset SentAt { get; set; }
    public DateTimeOffset? SignedAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
}

/// <summary>Filters for the e-invoice list; a branch the caller cannot see is never returned.</summary>
public class GetElectronicInvoiceListInput
{
    public Guid? PatientPaymentId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
}

/// <summary>"Hình thức thanh toán" on the invoice, in the provider's own words.</summary>
public enum ElectronicInvoicePaymentMethod
{
    Cash = 1,
    Transfer = 2,
    CashOrTransfer = 3
}

/// <summary>The source the Hóa đơn dialog opens on: a receipt, or a whole slip.</summary>
public class GetElectronicInvoiceDraftInput
{
    public Guid? PatientPaymentId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
}

/// <summary>One product row as the cashier edits it.</summary>
public class ElectronicInvoiceLineInput
{
    [Required]
    [StringLength(50)]
    public string Code { get; set; } = string.Empty;

    [Required]
    [StringLength(500)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [StringLength(50)]
    public string Unit { get; set; } = string.Empty;

    [Range(0.0001, 1000000)]
    public decimal Quantity { get; set; } = 1m;

    [Range(0, 100000000000)]
    public decimal UnitPrice { get; set; }

    /// <summary>Null takes the account's default rate; -1 is không chịu thuế.</summary>
    public int? VatRate { get; set; }
}

/// <summary>A row of the dialog, prefilled — totals worked out by the server.</summary>
public class ElectronicInvoiceLineDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Unit { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Total { get; set; }
    public int VatRate { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal Amount { get; set; }
}

/// <summary>What the Hóa đơn dialog opens with.</summary>
public class ElectronicInvoiceDraftDto
{
    public Guid? PatientPaymentId { get; set; }
    public Guid? TreatmentPlanId { get; set; }

    /// <summary>False when neither the branch nor the server has an account.</summary>
    public bool IsConfigured { get; set; }

    /// <summary>The branch config's name; null for the server-wide account.</summary>
    public string? ConfigName { get; set; }

    /// <summary>The suggested Mẫu số: the account's last one, else the server's.</summary>
    public string? Pattern { get; set; }

    public string? Serial { get; set; }

    /// <summary>Every Mẫu số / ký hiệu pair the branch has issued under, newest first, for the picker.</summary>
    public List<ElectronicInvoiceNumberingDto> Numberings { get; set; } = [];

    public int DefaultVatRate { get; set; }

    public string CustomerCode { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public string? Address { get; set; }
    [PatientPhone]
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }

    public ElectronicInvoicePaymentMethod PaymentMethod { get; set; }

    /// <summary>The most the invoice may bill before tax: the receipt, or the slip's total.</summary>
    public decimal MaxAmount { get; set; }

    public List<ElectronicInvoiceLineDto> Lines { get; set; } = [];

    /// <summary>The invoice already saved or filed for this source, if any.</summary>
    public ElectronicInvoiceDto? Existing { get; set; }

    /// <summary>The dialog as last saved (Lưu Nháp) or sent (Lưu), to reopen it as it was left.</summary>
    public IssueElectronicInvoiceDto? SavedForm { get; set; }
}

/// <summary>A Mẫu số with the ký hiệu it went out under.</summary>
public class ElectronicInvoiceNumberingDto
{
    public string Pattern { get; set; } = string.Empty;
    public string? Serial { get; set; }
}

/// <summary>Lưu Nháp / Lưu from the Hóa đơn dialog (BA 2026-11-18).</summary>
public class IssueElectronicInvoiceDto
{
    /// <summary>Exactly one of the receipt or the slip.</summary>
    public Guid? PatientPaymentId { get; set; }

    public Guid? TreatmentPlanId { get; set; }

    /// <summary>
    /// False (Lưu Nháp) keeps the dialog in BlueDental and sends nothing; true
    /// (Lưu) sends it to EasyInvoice unsigned, to be signed on the provider's portal.
    /// </summary>
    public bool Send { get; set; }

    [StringLength(200)]
    public string? BuyerName { get; set; }

    [StringLength(200)]
    public string? CompanyName { get; set; }

    [StringLength(500)]
    public string? Address { get; set; }

    [StringLength(20)]
    public string? TaxCode { get; set; }

    [StringLength(20)]
    public string? Phone { get; set; }

    /// <summary>Kept on the form for the cashier; not sent — never tried with the provider.</summary>
    [StringLength(256)]
    public string? Email { get; set; }

    /// <summary>CCCD; kept on the form, not sent (docs/clone/unknowns.md).</summary>
    [StringLength(20)]
    public string? NationalId { get; set; }

    public DateTime? ArisingDate { get; set; }

    public ElectronicInvoicePaymentMethod PaymentMethod { get; set; } = ElectronicInvoicePaymentMethod.CashOrTransfer;

    /// <summary>Mẫu số; blank takes the suggested one.</summary>
    [StringLength(20)]
    public string? Pattern { get; set; }

    /// <summary>Ký hiệu; blank lets the provider pick the pattern's serial.</summary>
    [StringLength(20)]
    public string? Serial { get; set; }

    /// <summary>Only VND is sent; anything else is refused.</summary>
    [StringLength(10)]
    public string? Currency { get; set; }

    public decimal? ExchangeRate { get; set; }

    /// <summary>Empty takes the lines the server would prefill.</summary>
    public List<ElectronicInvoiceLineInput> Lines { get; set; } = [];
}

/// <summary>
/// The PHIẾU THU that Lưu prints, from what the Hóa đơn dialog holds.
/// Nothing is stored: a wrong receipt is fixed in the dialog and printed again.
/// </summary>
public class RenderPaymentReceiptDto
{
    /// <summary>Exactly one of the receipt or the slip.</summary>
    public Guid? PatientPaymentId { get; set; }

    public Guid? TreatmentPlanId { get; set; }

    /// <summary>Họ tên khách hàng; blank takes the patient's name.</summary>
    [StringLength(200)]
    public string? BuyerName { get; set; }

    /// <summary>Ngày lập phiếu; blank is today on the clinic's calendar.</summary>
    public DateTime? ArisingDate { get; set; }

    /// <summary>The lines ticked in the dialog; empty takes the prefilled ones.</summary>
    public List<ElectronicInvoiceLineInput> Lines { get; set; } = [];
}

/// <summary>An invoice's PDF under the name EasyInvoice gives it (<c>2026_1118_1C26TYY_12_0318531468.pdf</c>).</summary>
public class ElectronicInvoicePdfDto
{
    public byte[] Content { get; set; } = [];

    public string FileName { get; set; } = string.Empty;
}
