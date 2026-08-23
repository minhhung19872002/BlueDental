using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.CustomerCare;

public class CskhGroup : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Criteria { get; private set; }
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    protected CskhGroup() { }

    public CskhGroup(Guid id, string name, string? criteria = null, string? description = null)
        : base(id)
    {
        Name = name;
        Criteria = criteria;
        Description = description;
        IsActive = true;
    }

    public void Update(string name, string? criteria, string? description)
    {
        Name = name;
        Criteria = criteria;
        Description = description;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
