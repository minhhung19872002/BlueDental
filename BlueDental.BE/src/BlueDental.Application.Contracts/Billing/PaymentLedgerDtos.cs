using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Billing;

/// <summary>
/// One receipt on Tài chính → Thanh toán: a THANHTOAN-… slip written on a
/// treatment plan's Thanh toán tab, with the names the list needs already
/// resolved (BA note 2026-10-06).
/// </summary>
public class PaymentLedgerItemDto
{
    public Guid Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset PaidAt { get; set; }

    public Guid PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientCode { get; set; } = string.Empty;

    public Guid? TreatmentPlanId { get; set; }
    public string? TreatmentPlanCode { get; set; }
    public string? TreatmentPlanTitle { get; set; }

    /// <summary>The services this receipt paid, comma-joined from Danh mục dịch vụ.</summary>
    public string ServiceNames { get; set; } = string.Empty;

    public decimal Amount { get; set; }
    public PaymentMethodKind Method { get; set; }
    public string? StaffName { get; set; }
    public string? Note { get; set; }

    /// <summary>
    /// Whether "Xuất hoá đơn điện tử" is still offered: no published invoice of its
    /// own, and its slip not billed whole (EInvoicing:0012). The plan tab applies
    /// the same rule client-side from the slip's invoice list.
    /// </summary>
    public bool CanIssueEInvoice { get; set; }
}

public class GetPaymentLedgerInput : PagedAndSortedResultRequestDto
{
    /// <summary>Matches the receipt code, the patient's name or the patient's code.</summary>
    public string? Filter { get; set; }

    /// <summary>First clinic-local day of the window, inclusive (Ngày / Tuần / Tháng).</summary>
    public DateOnly? FromDate { get; set; }

    /// <summary>Last clinic-local day of the window, inclusive.</summary>
    public DateOnly? ToDate { get; set; }
}

/// <summary>
/// A page of receipts plus the sum of every receipt the filter matches, so the
/// screen's total is the window's and not just the page's.
/// </summary>
public class PaymentLedgerResultDto : PagedResultDto<PaymentLedgerItemDto>
{
    public decimal TotalAmount { get; set; }

    public PaymentLedgerResultDto() { }

    public PaymentLedgerResultDto(long totalCount, IReadOnlyList<PaymentLedgerItemDto> items, decimal totalAmount)
        : base(totalCount, items)
    {
        TotalAmount = totalAmount;
    }
}
