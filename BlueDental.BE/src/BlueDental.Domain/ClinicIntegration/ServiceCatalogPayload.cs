using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using BlueDental.Catalogs;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// Turns a catalog service into what the partner receives, and fingerprints
/// exactly that — so "changed since the last sync" means "the partner would
/// now receive something different", not "someone touched the row".
/// </summary>
public static class ServiceCatalogPayload
{
    /// <summary>Only call for an entry that has a code; codeless ones are never sent.</summary>
    public static PartnerServiceItem From(CatalogEntry entry, string? groupName)
    {
        var price = entry.Price ?? 0m;
        var config = entry.ServiceConfig;

        return new PartnerServiceItem(
            ExternalId: entry.Id.ToString(),
            Code: entry.Code ?? throw new InvalidOperationException("A service without a code cannot be sent."),
            Name: entry.Name,
            DetailName: entry.DetailName,
            GroupName: groupName,
            Unit: entry.Unit,
            Price: price,
            TaxRate: (config?.TaxRate ?? ServiceTaxRate.NotTaxable).ToString(),
            PriceIncludesTax: config?.PriceIncludesTax ?? false,
            DiscountIsPercent: config?.DiscountIsPercent ?? false,
            DiscountValue: config?.DiscountValue ?? 0m,
            PriceAfterDiscount: config?.PriceAfterDiscount(price) ?? price,
            AmountCollected: config?.AmountCollected(price) ?? price,
            IsActive: entry.IsActive,
            IsDeleted: entry.IsDeleted);
    }

    /// <summary>SHA-256 over every field, in a fixed order and invariant culture.</summary>
    public static string Fingerprint(PartnerServiceItem item)
    {
        var canonical = string.Join('\u001f',
            item.ExternalId,
            item.Code,
            item.Name,
            item.DetailName ?? string.Empty,
            item.GroupName ?? string.Empty,
            item.Unit ?? string.Empty,
            Number(item.Price),
            item.TaxRate,
            item.PriceIncludesTax,
            item.DiscountIsPercent,
            Number(item.DiscountValue),
            Number(item.PriceAfterDiscount),
            Number(item.AmountCollected),
            item.IsActive,
            item.IsDeleted);

        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    // "1000" and "1000.00" are the same price; normalise the scale away.
    private static string Number(decimal value) =>
        (value / 1.0000000000000000000000000000m).ToString(CultureInfo.InvariantCulture);
}
