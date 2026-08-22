using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

public class CallAssignment : FullAuditedEntity<Guid>
{
    public Guid PatientId { get; private set; }
    public Guid StaffId { get; private set; }
    public string PatientName { get; private set; } = string.Empty;
    public string PhoneNumber { get; private set; } = string.Empty;
    public string? Notes { get; private set; }
    public CallAssignmentStatus Status { get; private set; }
    public DateTime? CalledAt { get; private set; }

    private CallAssignment() { }

    public CallAssignment(
        Guid id, Guid patientId, Guid staffId,
        string patientName, string phoneNumber, string? notes)
        : base(id)
    {
        PatientId = patientId;
        StaffId = staffId;
        PatientName = patientName;
        PhoneNumber = phoneNumber;
        Notes = notes;
        Status = CallAssignmentStatus.Pending;
    }

    public void MarkCalled(string? notes)
    {
        Status = CallAssignmentStatus.Called;
        CalledAt = DateTime.UtcNow;
        if (notes is not null) Notes = notes;
    }

    public void MarkUnreachable(string? notes)
    {
        Status = CallAssignmentStatus.Unreachable;
        CalledAt = DateTime.UtcNow;
        if (notes is not null) Notes = notes;
    }
}

public enum CallAssignmentStatus
{
    Pending = 0,
    Called = 1,
    Unreachable = 2,
}
