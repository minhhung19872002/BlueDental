using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Staff;

/// <summary>
/// Loại vi phạm — the list a Chế tài nhân viên record is filed under, kept per
/// branch. Its fine is only a default: picking the type pre-fills the record's
/// amount, and the record keeps its own copy, so changing the type later never
/// rewrites a penalty already given.
/// </summary>
public class StaffViolationType : FullAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 200;

    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = default!;

    /// <summary>Mức phạt mặc định, in VNĐ. Zero when the type carries no fine.</summary>
    public decimal DefaultFineAmount { get; private set; }

    protected StaffViolationType() { }

    public static StaffViolationType Create(Guid id, Guid clinicBranchId, string name, decimal defaultFineAmount)
    {
        var type = new StaffViolationType { Id = id, ClinicBranchId = clinicBranchId };
        type.SetDetails(name, defaultFineAmount);
        return type;
    }

    public StaffViolationType SetDetails(string name, decimal defaultFineAmount)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name), MaxNameLength);
        if (defaultFineAmount < 0)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.StaffPenalty.InvalidAmount);
        }

        Name = name.Trim();
        DefaultFineAmount = defaultFineAmount;
        return this;
    }
}
