using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

public class LaboMaterial : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Category { get; private set; }
    public string? Description { get; private set; }
    public Guid? SupplierId { get; private set; }
    public bool IsActive { get; private set; }

    protected LaboMaterial() { }

    public LaboMaterial(Guid id, string name, string? category = null, string? description = null, Guid? supplierId = null)
        : base(id)
    {
        Name = name;
        Category = category;
        Description = description;
        SupplierId = supplierId;
        IsActive = true;
    }

    public void Update(string name, string? category, string? description, Guid? supplierId)
    {
        Name = name;
        Category = category;
        Description = description;
        SupplierId = supplierId;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
