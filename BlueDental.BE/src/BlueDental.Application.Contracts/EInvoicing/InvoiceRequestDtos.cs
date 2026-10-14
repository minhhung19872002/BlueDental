using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using BlueDental.PatientManagement;

namespace BlueDental.EInvoicing;

/// <summary>One row of "Yêu cầu xuất HĐ" on the patient's Hóa đơn tab.</summary>
public class InvoiceRequestDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid PatientId { get; set; }
    public Guid PatientPaymentId { get; set; }
    public Guid? TreatmentPlanId { get; set; }

    public string Code { get; set; } = string.Empty;
    public InvoiceRequestSource Source { get; set; }

    /// <summary>Who keyed it in: the staff member's name, or null when the customer sent it by QR.</summary>
    public string? RequesterName { get; set; }

    /// <summary>Mã phiếu thu.</summary>
    public string PaymentCode { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    [PatientPhone]
    public string Phone { get; set; } = string.Empty;
    public string? NationalId { get; set; }
    public string? PersonalAddress { get; set; }
    public string? CompanyName { get; set; }
    public string? TaxCode { get; set; }
    public string? CompanyAddress { get; set; }
    public string Email { get; set; } = string.Empty;
    public bool? WantsPaperInvoice { get; set; }
    public bool IsCompany { get; set; }

    public string ServiceName { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    public DateTimeOffset RequestedAt { get; set; }
    public DateTimeOffset DueAt { get; set; }
    public InvoiceRequestStatus Status { get; set; }

    public Guid? AssigneeId { get; set; }
    public string? AssigneeName { get; set; }

    public DateTimeOffset? CompletedAt { get; set; }
    public string? InvoiceNo { get; set; }
    public string? Reason { get; set; }
}

/// <summary>Filters for the request list; a branch the caller cannot see is never returned.</summary>
public class GetInvoiceRequestListInput : PagedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }

    /// <summary>One status; ignored when <see cref="OpenOnly"/> is set.</summary>
    public InvoiceRequestStatus? Status { get; set; }

    /// <summary>"Cần xử lý": Chờ xử lý, Đang xử lý and Cần bổ sung together.</summary>
    public bool OpenOnly { get; set; }
}

/// <summary>Counts behind the chips and the warning banner.</summary>
public class InvoiceRequestStatsDto
{
    public int Total { get; set; }
    public int Open { get; set; }
    public int Pending { get; set; }
    public int Processing { get; set; }
    public int NeedsInfo { get; set; }
    public int Issued { get; set; }
    public int Cancelled { get; set; }

    /// <summary>Open requests past their Hạn xử lý.</summary>
    public int Overdue { get; set; }
}

public class GetInvoiceRequestStatsInput
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
}

/// <summary>A receipt the create dialog may pick: a payment, not a refund, not cancelled, not yet requested.</summary>
public class InvoiceRequestPaymentOptionDto
{
    public Guid PatientPaymentId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public string PaymentCode { get; set; } = string.Empty;
    public DateTimeOffset PaidAt { get; set; }
    public decimal Amount { get; set; }
    public string ServiceName { get; set; } = string.Empty;
}

/// <summary>The address behind a receipt's QR.</summary>
public class InvoiceRequestLinkDto
{
    public string Url { get; set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? SubmittedAt { get; set; }
}

/// <summary>The create dialog prefilled from the patient and the receipt.</summary>
public class InvoiceRequestDraftDto
{
    public Guid PatientPaymentId { get; set; }
    public string PaymentCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    public string FullName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    [PatientPhone]
    public string? Phone { get; set; }
    public string? NationalId { get; set; }
    public string? PersonalAddress { get; set; }
    public string? Email { get; set; }
}

/// <summary>The THÔNG TIN XUẤT HÓA ĐƠN fields; the server checks them again.</summary>
public class InvoiceRequestFormDto
{
    /// <summary>Loại hóa đơn: Công ty (true) or Cá nhân; the other kind's lines are ignored.</summary>
    public bool IsCompany { get; set; }

    /// <summary>Asked on Cá nhân only; Công ty takes the patient's name.</summary>
    [StringLength(200)]
    public string? FullName { get; set; }

    public int? BirthYear { get; set; }

    [StringLength(30)]
    public string? Phone { get; set; }

    [StringLength(20)]
    public string? NationalId { get; set; }

    [StringLength(500)]
    public string? PersonalAddress { get; set; }

    [StringLength(200)]
    public string? CompanyName { get; set; }

    [StringLength(20)]
    public string? TaxCode { get; set; }

    [StringLength(500)]
    public string? CompanyAddress { get; set; }

    [StringLength(256)]
    public string? Email { get; set; }

    public bool? WantsPaperInvoice { get; set; }
}

/// <summary>"+ Tạo yêu cầu xuất HĐ" — staff keys the form in for a receipt.</summary>
public class CreateInvoiceRequestDto : InvoiceRequestFormDto
{
    public Guid PatientPaymentId { get; set; }
}

public class UpdateInvoiceRequestDto : InvoiceRequestFormDto;

/// <summary>Cần bổ sung / Hủy.</summary>
public class InvoiceRequestReasonDto
{
    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>Hoàn tất — the number of the invoice that went out.</summary>
public class CompleteInvoiceRequestDto
{
    [Required]
    [StringLength(50)]
    public string InvoiceNo { get; set; } = string.Empty;
}

/// <summary>
/// The public form behind the QR. Only the plain name and birth year come back
/// whole; the contact details are hints (masked) that the customer may keep by
/// leaving the field blank.
/// </summary>
public class PublicInvoiceRequestFormDto
{
    public string ClinicName { get; set; } = string.Empty;
    public string PaymentCode { get; set; } = string.Empty;
    public string ServiceName { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    public string FullName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    public string? PhoneHint { get; set; }
    public string? NationalIdHint { get; set; }
    public string? EmailHint { get; set; }
    public string? AddressHint { get; set; }

    /// <summary>The form was already sent (from this link or by staff); nothing more to fill.</summary>
    public bool Submitted { get; set; }

    public bool Expired { get; set; }
}

/// <summary>What the customer sends; a blank contact field keeps the hinted value on file.</summary>
public class SubmitPublicInvoiceRequestDto : InvoiceRequestFormDto;

/// <summary>The receipt the customer just asked an invoice for.</summary>
public class PublicInvoiceRequestResultDto
{
    public string Code { get; set; } = string.Empty;
    public DateTimeOffset DueAt { get; set; }
}

