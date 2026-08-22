using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Organizations;

public class Department : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public Guid? BranchId { get; private set; }
    public bool IsActive { get; private set; }

    protected Department() { }

    public Department(Guid id, string name, string? description = null, Guid? branchId = null)
        : base(id)
    {
        Name = name;
        Description = description;
        BranchId = branchId;
        IsActive = true;
    }

    public void Update(string name, string? description)
    {
        Name = name;
        Description = description;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
