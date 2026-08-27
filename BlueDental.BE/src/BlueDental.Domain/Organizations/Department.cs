using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Organizations;

public class Department : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public Guid? BranchId { get; private set; }
    public bool IsActive { get; private set; }

    /// <summary>
    /// Where the department sits in the panel. The reference orders its list
    /// by this ("orderBy=order"), and its dialog collects it as "Số thứ tự".
    /// </summary>
    public int SortOrder { get; private set; }

    protected Department() { }

    public Department(
        Guid id,
        string name,
        string? description = null,
        Guid? branchId = null,
        int sortOrder = 0)
        : base(id)
    {
        Name = name;
        Description = description;
        BranchId = branchId;
        IsActive = true;
        SortOrder = sortOrder;
    }

    public void Update(string name, string? description, int? sortOrder = null)
    {
        Name = name;
        Description = description;

        if (sortOrder.HasValue)
        {
            SortOrder = sortOrder.Value;
        }
    }

    public void MoveTo(int sortOrder) => SortOrder = sortOrder;

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
