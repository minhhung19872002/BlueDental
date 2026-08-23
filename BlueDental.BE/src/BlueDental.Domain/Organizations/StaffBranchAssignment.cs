using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Organizations;

/// <summary>
/// Which clinic branches a staff member may work in.
///
/// The reference carries the same idea as <c>staff.branchIds[]</c>. BlueDental
/// keeps it as its own aggregate so branch scope can be resolved without loading
/// the identity user, and so an assignment is auditable on its own.
///
/// A staff member with **no** assignment is treated as clinic-wide (back office,
/// clinic admin) — see <see cref="BranchAccessChecker"/>.
/// </summary>
public class StaffBranchAssignment : CreationAuditedAggregateRoot<Guid>
{
    public Guid StaffId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The branch this staff member lands on when they sign in.</summary>
    public bool IsPrimary { get; private set; }

    protected StaffBranchAssignment() { }

    public static StaffBranchAssignment Assign(
        Guid id,
        Guid staffId,
        Guid clinicBranchId,
        bool isPrimary = false)
    {
        return new StaffBranchAssignment
        {
            Id = id,
            StaffId = staffId,
            ClinicBranchId = clinicBranchId,
            IsPrimary = isPrimary
        };
    }

    public StaffBranchAssignment MakePrimary()
    {
        IsPrimary = true;
        return this;
    }

    public StaffBranchAssignment ClearPrimary()
    {
        IsPrimary = false;
        return this;
    }
}
