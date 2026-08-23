using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

public class CallLog : CreationAuditedEntity<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public Guid? PatientId { get; private set; }
    public Guid? StaffId { get; private set; }
    public string PatientName { get; private set; } = string.Empty;
    public string PhoneNumber { get; private set; } = string.Empty;
    public string? StaffName { get; private set; }
    public int DurationSeconds { get; private set; }
    public CallDirection Direction { get; private set; }
    public CallLogStatus Status { get; private set; }
    public string? Notes { get; private set; }

    private CallLog() { }

    public CallLog(
        Guid id, Guid clinicBranchId, Guid? patientId, Guid? staffId,
        string patientName, string phoneNumber, string? staffName,
        int durationSeconds, CallDirection direction,
        CallLogStatus status, string? notes)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        PatientId = patientId;
        StaffId = staffId;
        PatientName = patientName;
        PhoneNumber = phoneNumber;
        StaffName = staffName;
        DurationSeconds = durationSeconds;
        Direction = direction;
        Status = status;
        Notes = notes;
    }
}

public enum CallDirection
{
    Inbound = 0,
    Outbound = 1,
}

public enum CallLogStatus
{
    Answered = 0,
    Missed = 1,
    Voicemail = 2,
}
