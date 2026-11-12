using System;
using System.Collections.Generic;
using Volo.Abp.Domain.Values;

namespace BlueDental.Labo;

/// <summary>
/// One Loại phục hình ticked on the Phiếu yêu cầu (F-91): a Dịch vụ - vật
/// liệu row, plain or "Trên implant" (only where the material allows it).
/// </summary>
public class LaboToothRestoration : ValueObject
{
    public Guid MaterialId { get; private set; }
    public bool OnImplant { get; private set; }

    protected LaboToothRestoration() { }

    public LaboToothRestoration(Guid materialId, bool onImplant)
    {
        MaterialId = materialId;
        OnImplant = onImplant;
    }

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return MaterialId;
        yield return OnImplant;
    }
}
