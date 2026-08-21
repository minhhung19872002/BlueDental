using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Organizations;

/// <summary>
/// Represents a physical dental clinic branch / location.
/// Aggregate root for the Organizations bounded context.
/// </summary>
public class ClinicBranch : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? Address { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? Email { get; private set; }
    public BranchStatus Status { get; private set; }
    public TimeOnly? OpeningTime { get; private set; }
    public TimeOnly? ClosingTime { get; private set; }

    protected ClinicBranch() { }

    public ClinicBranch(
        Guid id,
        string code,
        string name,
        string? address = null,
        string? phoneNumber = null,
        string? email = null)
        : base(id)
    {
        Code = code;
        Name = name;
        Address = address;
        PhoneNumber = phoneNumber;
        Email = email;
        Status = BranchStatus.Active;
    }

    public ClinicBranch SetName(string name)
    {
        Name = name;
        return this;
    }

    public ClinicBranch SetContactInfo(string? phoneNumber, string? email, string? address)
    {
        PhoneNumber = phoneNumber;
        Email = email;
        Address = address;
        return this;
    }

    public ClinicBranch SetOperatingHours(TimeOnly? opening, TimeOnly? closing)
    {
        OpeningTime = opening;
        ClosingTime = closing;
        return this;
    }

    public ClinicBranch Deactivate()
    {
        Status = BranchStatus.Inactive;
        return this;
    }

    public ClinicBranch Activate()
    {
        Status = BranchStatus.Active;
        return this;
    }
}
