using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Billing;

public class InvoiceDto : FullAuditedEntityDto<Guid>
{
    public string InvoiceNumber { get; set; } = default!;
    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = default!;
    public Guid BranchId { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal BalanceDue { get; set; }
    public string Currency { get; set; } = "USD";
    public InvoiceStatus Status { get; set; }
    public DateTimeOffset IssuedAt { get; set; }
    public DateTimeOffset DueAt { get; set; }
}

public class CreateInvoiceDto
{
    public Guid PatientId { get; set; }
    public Guid BranchId { get; set; }
    public Guid? AppointmentId { get; set; }
    public decimal SubTotal { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public string Currency { get; set; } = "USD";
    public DateTimeOffset DueAt { get; set; }
}

public class RecordPaymentDto
{
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "USD";
    public PaymentMethod Method { get; set; }
    public string? Reference { get; set; }
}

public class VoidInvoiceDto
{
    public string? Reason { get; set; }
}

public class GetInvoiceListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? PatientId { get; set; }
    public InvoiceStatus? Status { get; set; }
}
