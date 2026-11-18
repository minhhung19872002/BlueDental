using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.EInvoicing;

/// <summary>
/// "Yêu cầu xuất HĐ" — the THÔNG TIN XUẤT HÓA ĐƠN form for one receipt (phiếu
/// thu), filled in by the customer through the QR on the PHIẾU THU or by staff
/// (BA 2026-10-12). Since P1811 its status follows EasyInvoice: Mới → Xử lý
/// sends it (Chờ xử lý) → signed on the portal (Đã xuất HĐ) or cancelled there
/// (Đã hủy, Xử lý lại sends it again); Hủy yêu cầu drops it (Đã hủy yêu cầu).
/// <para>
/// The service and amount are copied from the receipt when the request is made
/// so the list reads without joining it. A receipt has at most one live
/// (not withdrawn) request.
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

    /// <summary>Phụ trách — who last pressed Xử lý; null until it was sent.</summary>
    public Guid? AssigneeId { get; private set; }

    /// <summary>When it was last sent to EasyInvoice (Xử lý / Xử lý lại).</summary>
    public DateTimeOffset? ProcessedAt { get; private set; }

    public DateTimeOffset? CompletedAt { get; private set; }

    /// <summary>Số HĐ, once issued.</summary>
    public string? InvoiceNo { get; private set; }

    /// <summary>Why the e-invoice was cancelled on EasyInvoice, or why the request was withdrawn.</summary>
    public string? Reason { get; private set; }

    /// <summary>Company when a company name or tax code was given, otherwise a person.</summary>
    public bool IsCompany => !string.IsNullOrWhiteSpace(CompanyName) || !string.IsNullOrWhiteSpace(TaxCode);

    /// <summary>Waiting on staff — Mới or Đã hủy: counted in "Cần xử lý", and the only states that edit or send.</summary>
    public bool NeedsAction => Status is InvoiceRequestStatus.Pending or InvoiceRequestStatus.Cancelled;

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

    /// <summary>Staff corrects the form — only while it waits on them (Mới, Đã hủy).</summary>
    public void UpdateDetails(InvoiceRequestDetails details)
    {
        EnsureNeedsAction();
        Apply(details);
    }

    /// <summary>
    /// Xử lý / Xử lý lại — it went to EasyInvoice: Chờ xử lý until the
    /// accountant signs or cancels it there. Records who sent it and when.
    /// </summary>
    public void Process(Guid assigneeId, DateTimeOffset processedAt)
    {
        EnsureNeedsAction();
        Status = InvoiceRequestStatus.Processing;
        AssigneeId = assigneeId;
        ProcessedAt = processedAt;
        Reason = null;
    }

    /// <summary>
    /// The e-invoice it asked for was signed on the provider's portal: done,
    /// whoever sent it (BA 2026-11-18). Nothing happens to one already issued
    /// or withdrawn.
    /// </summary>
    public bool CompleteFromProvider(string invoiceNo, DateTimeOffset completedAt)
    {
        if (Status is InvoiceRequestStatus.Issued or InvoiceRequestStatus.Withdrawn
            || string.IsNullOrWhiteSpace(invoiceNo))
        {
            return false;
        }

        InvoiceNo = Truncate(invoiceNo.Trim(), MaxInvoiceNoLength);
        CompletedAt = completedAt;
        Reason = null;
        Status = InvoiceRequestStatus.Issued;
        return true;
    }

    /// <summary>
    /// The e-invoice was cancelled on EasyInvoice, signed or not: Đã hủy, with
    /// why, until staff sends it again (Xử lý lại) or withdraws it.
    /// </summary>
    public bool CancelFromProvider(string reason)
    {
        if (Status is not (InvoiceRequestStatus.Processing or InvoiceRequestStatus.Issued))
        {
            return false;
        }

        InvoiceNo = null;
        CompletedAt = null;
        Reason = RequiredReason(reason);
        Status = InvoiceRequestStatus.Cancelled;
        return true;
    }

    /// <summary>Hủy yêu cầu — dropped by staff while it waits on them (Mới, Đã hủy).</summary>
    public void Withdraw(string reason)
    {
        EnsureNeedsAction();
        Reason = RequiredReason(reason);
        Status = InvoiceRequestStatus.Withdrawn;
    }

    /// <summary>
    /// Its receipt was cancelled, so the request goes with it. An issued one
    /// stays: a receipt with a signed invoice cannot be cancelled anyway.
    /// </summary>
    public bool WithdrawWithReceipt(string reason)
    {
        if (Status is InvoiceRequestStatus.Issued or InvoiceRequestStatus.Withdrawn)
        {
            return false;
        }

        Reason = RequiredReason(reason);
        Status = InvoiceRequestStatus.Withdrawn;
        return true;
    }

    private void EnsureNeedsAction()
    {
        if (!NeedsAction)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTransition);
        }
    }

    private void Apply(InvoiceRequestDetails details)
    {
        var valid = details.Validated();
        FullName = valid.FullName!;
        BirthYear = valid.BirthYear;
        // Công ty asks no phone and Cá nhân no email: the columns keep an empty string.
        Phone = valid.Phone ?? string.Empty;
        NationalId = valid.NationalId;
        PersonalAddress = valid.PersonalAddress;
        CompanyName = valid.CompanyName;
        TaxCode = valid.TaxCode;
        CompanyAddress = valid.CompanyAddress;
        Email = valid.Email ?? string.Empty;
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
