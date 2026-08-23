using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

public class LaboBiteType : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public bool IsActive { get; private set; }

    protected LaboBiteType() { }

    public LaboBiteType(Guid id, string name, string? description = null)
        : base(id)
    {
        Name = name;
        Description = description;
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
