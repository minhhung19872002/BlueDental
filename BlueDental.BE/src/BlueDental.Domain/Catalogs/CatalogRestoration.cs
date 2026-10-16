using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// The fields only the "Vật liệu nha khoa" catalog carries: whether the type
/// is a crown or an implant, and the brand, origin and warranty mẫu 5 fills in
/// when the type is ticked (clinic, 2026-10-16).
/// </summary>
public class CatalogRestoration : Entity<Guid>
{
    public const int MaxBrandLength = 128;
    public const int MaxOriginLength = 128;
    public const int MaxWarrantyLength = 64;

    public Guid CatalogEntryId { get; private set; }

    /// <summary>Phân loại: răng sứ hay implant.</summary>
    public RestorationKind Kind { get; private set; }

    /// <summary>Hãng.</summary>
    public string? Brand { get; private set; }

    /// <summary>Xuất xứ.</summary>
    public string? Origin { get; private set; }

    /// <summary>Bảo hành, as printed — "15 năm", "Trọn đời".</summary>
    public string? Warranty { get; private set; }

    protected CatalogRestoration() { }

    public CatalogRestoration(Guid id, Guid catalogEntryId) : base(id)
    {
        CatalogEntryId = catalogEntryId;
        Kind = RestorationKind.Crown;
    }

    public void Update(RestorationKind kind, string? brand, string? origin, string? warranty)
    {
        if (!Enum.IsDefined(kind))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Catalogs.InvalidRestorationKind);
        }

        Kind = kind;
        Brand = Clean(brand, MaxBrandLength);
        Origin = Clean(origin, MaxOriginLength);
        Warranty = Clean(warranty, MaxWarrantyLength);
    }

    private static string? Clean(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null;
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
