using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

public class LaboSupplier : FullAuditedAggregateRoot<Guid>
{
    public string Name { get; private set; } = default!;
    public string? Phone { get; private set; }
    public string? Email { get; private set; }
    public string? Address { get; private set; }
    public bool IsActive { get; private set; }

    protected LaboSupplier() { }

    public LaboSupplier(Guid id, string name, string? phone = null, string? email = null, string? address = null)
        : base(id)
    {
        Name = name;
        Phone = phone;
        Email = email;
        Address = address;
        IsActive = true;
    }

    public void Update(string name, string? phone, string? email, string? address)
    {
        Name = name;
        Phone = phone;
        Email = email;
        Address = address;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
