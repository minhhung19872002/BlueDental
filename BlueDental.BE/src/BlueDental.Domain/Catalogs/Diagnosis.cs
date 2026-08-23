using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

public class Diagnosis : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }

    protected Diagnosis() { }

    public Diagnosis(Guid id, string code, string name, string? description = null, int sortOrder = 0)
        : base(id)
    {
        Code = code;
        Name = name;
        Description = description;
        SortOrder = sortOrder;
        IsActive = true;
    }

    public void Update(string name, string? description, int sortOrder)
    {
        Name = name;
        Description = description;
        SortOrder = sortOrder;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
