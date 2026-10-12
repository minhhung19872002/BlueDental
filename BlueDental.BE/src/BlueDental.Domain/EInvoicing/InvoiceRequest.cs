using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// "Yêu cầu xuất HĐ" — the THÔNG TIN XUẤT HÓA ĐƠN form for one receipt (phiếu
/// thu), filled in by the customer through the QR on the PHIẾU THU or by staff
/// (BA 2026-10-12). The accountant works it to an invoice number:
/// Chờ xử lý → Đang xử lý → Đã xuất HĐ, with Cần bổ sung and Đã hủy on the side.
/// <para>
/// The service and amount are copied from the receipt when the request is made
/// so the list reads without joining it. A receipt has at most one live
/// (not cancelled) request.
/// </para>
/// </summary>
public class InvoiceRequest : FullAuditedAggregateRoot<Guid>
{
    public const int MaxCodeLength = 20;
    public const int MaxNameLength = 200;
    public const int MaxPhoneLength = 20;
    public const int MaxNationalIdLength = 20;
    public const int MaxEmailLength = 256;
    public const int MaxAddressLength = 500;
    public const int MaxTaxCodeLength = 20;
    public const int MaxServiceNameLength = 1000;
    public const int MaxInvoiceNoLength = 50;
    public const int MaxReasonLength = 500;

    /// <summary>Hạn xử lý: the request time plus this (UNKNOWN_REFERENCE_BEHAVIOR — BA to confirm).</summary>
    public static readonly TimeSpan ProcessingWindow = TimeSpan.FromHours(24);

    public Guid ClinicBranchId { get; private set; }
    public Guid PatientId { get; private set; }
    public Guid PatientPaymentId { get; private set; }
    public Guid? TreatmentPlanId { get; private set; }

    /// <summary>Mã yêu cầu, "YC-HD-0001", numbered per branch.</summary>
    public string Code { get; private set; } = string.Empty;

    public InvoiceRequestSource Source { get; private set; }

    public string FullName { get; private set; } = string.Empty;
    public int? BirthYear { get; private set; }
    public string Phone { get; private set; } = string.Empty;
    public string? NationalId { get; private set; }
    public string? PersonalAddress { get; private set; }
    public string? CompanyName { get; private set; }
    public string? TaxCode { get; private set; }
    public string? CompanyAddress { get; private set; }
    public string Email { get; private set; } = string.Empty;

    /// <summary>"Khách hàng có lấy hoá đơn giấy không"; null when left unticked.</summary>
    public bool? WantsPaperInvoice { get; private set; }

    /// <summary>Dịch vụ — the receipt's services, as the form shows them.</summary>
    public string ServiceName { get; private set; } = string.Empty;

    /// <summary>Số tiền — the receipt's amount.</summary>
    public decimal Amount { get; private set; }

    public DateTimeOffset RequestedAt { get; private set; }
    public DateTimeOffset DueAt { get; private set; }

    public InvoiceRequestStatus Status { get; private set; }

    /// <summary>Phụ trách — the accountant who took it; null is "Chưa phân công".</summary>
    public Guid? AssigneeId { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Số HĐ, once issued.</summary>
    public string? InvoiceNo { get; private set; }

    /// <summary>Why it was sent back (Cần bổ sung) or cancelled.</summary>
    public string? Reason { get; private set; }

    /// <summary>Company when a company name or tax code was given, otherwise a person.</summary>
    public bool IsCompany => !string.IsNullOrWhiteSpace(CompanyName) || !string.IsNullOrWhiteSpace(TaxCode);

    /// <summary>Counted in "Cần xử lý".</summary>
    public bool IsOpen => Status is InvoiceRequestStatus.Pending or InvoiceRequestStatus.Processing
        or InvoiceRequestStatus.NeedsInfo;

    protected InvoiceRequest() { }

    public static InvoiceRequest Create(
        Guid id,
        Guid clinicBranchId,
        Guid patientId,
        Guid patientPaymentId,
        Guid? treatmentPlanId,
        string code,
        InvoiceRequestSource source,
        InvoiceRequestDetails details,
        string serviceName,
        decimal amount,
        DateTimeOffset requestedAt)
    {
        Check.NotNullOrWhiteSpace(code, nameof(code), MaxCodeLength);

        var request = new InvoiceRequest
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            PatientId = patientId,
            PatientPaymentId = patientPaymentId,
            TreatmentPlanId = treatmentPlanId,
            Code = code,
            Source = source,
            ServiceName = Truncate(serviceName, MaxServiceNameLength),
            Amount = amount,
            RequestedAt = requestedAt,
            DueAt = requestedAt + ProcessingWindow,
            Status = InvoiceRequestStatus.Pending
        };
        request.Apply(details);
        return request;
    }

    /// <summary>
    /// Staff corrects the form. Allowed until it is issued or cancelled; a
    /// request sent back for more information goes back to Chờ xử lý.
    /// </summary>
    public void UpdateDetails(InvoiceRequestDetails details)
    {
        if (!IsOpen)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }

        Apply(details);
        if (Status == InvoiceRequestStatus.NeedsInfo)
        {
            Status = InvoiceRequestStatus.Pending;
            Reason = null;
        }
    }

    /// <summary>Xử lý — the accountant takes it.</summary>
    public void Start(Guid assigneeId)
    {
        if (Status is not (InvoiceRequestStatus.Pending or InvoiceRequestStatus.NeedsInfo))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }

        Status = InvoiceRequestStatus.Processing;
        AssigneeId = assigneeId;
        Reason = null;
    }

    /// <summary>Cần bổ sung — sent back with what is missing or wrong.</summary>
    public void RequestMoreInfo(string reason, Guid assigneeId)
    {
        if (Status is not (InvoiceRequestStatus.Pending or InvoiceRequestStatus.Processing))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }

        Reason = RequiredReason(reason);
        AssigneeId ??= assigneeId;
        Status = InvoiceRequestStatus.NeedsInfo;
    }

    /// <summary>Hoàn tất — the invoice went out under <paramref name="invoiceNo"/>.</summary>
    public void Complete(string invoiceNo, Guid assigneeId, DateTimeOffset completedAt)
    {
        if (Status != InvoiceRequestStatus.Processing)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }

        if (string.IsNullOrWhiteSpace(invoiceNo))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvoiceNoRequired);
        }

        InvoiceNo = Truncate(invoiceNo.Trim(), MaxInvoiceNoLength);
        AssigneeId ??= assigneeId;
        CompletedAt = completedAt;
        Status = InvoiceRequestStatus.Issued;
    }

    public void Cancel(string reason)
    {
        if (!IsOpen)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }

        Reason = RequiredReason(reason);
        Status = InvoiceRequestStatus.Cancelled;
    }

    private void Apply(InvoiceRequestDetails details)
    {
        var valid = details.Validated();
        FullName = valid.FullName!;
        BirthYear = valid.BirthYear;
        Phone = valid.Phone!;
        NationalId = valid.NationalId;
        PersonalAddress = valid.PersonalAddress;
        CompanyName = valid.CompanyName;
        TaxCode = valid.TaxCode;
        CompanyAddress = valid.CompanyAddress;
        Email = valid.Email!;
        WantsPaperInvoice = valid.WantsPaperInvoice;
    }

    private static string RequiredReason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.ReasonRequired);
        }

        return Truncate(reason.Trim(), MaxReasonLength);
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
