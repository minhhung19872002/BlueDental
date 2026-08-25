using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Organizations;

public class BranchManagerAssignment : CreationAuditedAggregateRoot<Guid>
{
    public Guid ManagerId { get; private set; }
    public Guid ClinicBranchId { get; private set; }

    protected BranchManagerAssignment() { }

    public static BranchManagerAssignment Assign(
        Guid id,
        Guid managerId,
        Guid clinicBranchId)
    {
        return new BranchManagerAssignment
        {
            Id = id,
            ManagerId = managerId,
            ClinicBranchId = clinicBranchId
        };
    }
}
