using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using BlueDental.PatientManagement;

namespace BlueDental.EInvoicing;

/// <summary>An e-invoice BlueDental created at the provider for one receipt or one slip.</summary>
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

    public DateTimeOffset? LastSyncedAt { get; set; }
    public string? LastError { get; set; }
    public DateTime CreationTime { get; set; }
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

    /// <summary>The invoice already filed for this source, if any.</summary>
    public ElectronicInvoiceDto? Existing { get; set; }
}

/// <summary>A Mẫu số with the ký hiệu it went out under.</summary>
public class ElectronicInvoiceNumberingDto
{
    public string Pattern { get; set; } = string.Empty;
    public string? Serial { get; set; }
}

/// <summary>Lưu Nháp / Phát Hành from the Hóa đơn dialog.</summary>
public class IssueElectronicInvoiceDto
{
    /// <summary>Exactly one of the receipt or the slip.</summary>
    public Guid? PatientPaymentId { get; set; }

    public Guid? TreatmentPlanId { get; set; }

    /// <summary>False saves a draft; true signs it too (needs the account's HSM).</summary>
    public bool Publish { get; set; }

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
