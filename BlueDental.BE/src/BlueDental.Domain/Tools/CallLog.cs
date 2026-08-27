using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

/// <summary>
/// One PBX call as the provider reported it — the rows of the
/// "Danh Sách Cuộc Gọi" tab under Công cụ → Gọi thoại.
/// </summary>
public class CallLog : CreationAuditedEntity<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The staff member the call belonged to, when known.</summary>
    public Guid? StaffId { get; private set; }

    /// <summary>Kept denormalized so history outlives staff-account changes.</summary>
    public string? StaffName { get; private set; }

    /// <summary>"Mã cuộc gọi" — the provider's call id.</summary>
    public string CallCode { get; private set; } = string.Empty;

    /// <summary>"Mã mở rộng" — the SIP extension involved, when the provider sent one.</summary>
    public string? ExtensionCode { get; private set; }

    public string PhoneNumber { get; private set; } = string.Empty;

    // UNKNOWN_REFERENCE_BEHAVIOR: the reference call list was empty, so its
    // status labels could not be observed. These values are a placeholder.
    public CallLogStatus Status { get; private set; }

    public CallProvider Provider { get; private set; }
    public DateTime CalledAt { get; private set; }

    private CallLog() { }

    public CallLog(
        Guid id, Guid clinicBranchId, Guid? staffId, string? staffName,
        string callCode, string? extensionCode, string phoneNumber,
        CallLogStatus status, CallProvider provider, DateTime calledAt)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        StaffId = staffId;
        StaffName = staffName;
        CallCode = Check.NotNullOrWhiteSpace(callCode, nameof(callCode), maxLength: 100);
        ExtensionCode = extensionCode;
        PhoneNumber = Check.NotNullOrWhiteSpace(phoneNumber, nameof(phoneNumber), maxLength: 20);
        Status = status;
        Provider = provider;
        CalledAt = calledAt;
    }
}

public enum CallLogStatus
{
    Answered = 0,
    Missed = 1,
    Busy = 2,
}
