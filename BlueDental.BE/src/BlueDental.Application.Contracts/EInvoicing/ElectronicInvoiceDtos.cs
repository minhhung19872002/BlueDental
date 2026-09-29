using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.EInvoicing;

/// <summary>An e-invoice BlueDental created at the provider for one receipt.</summary>
public class ElectronicInvoiceDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid PatientId { get; set; }
    public Guid PatientPaymentId { get; set; }
    public Guid? TreatmentPlanId { get; set; }

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
