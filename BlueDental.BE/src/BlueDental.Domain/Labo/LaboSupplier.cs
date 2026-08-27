using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

/// <summary>
/// Nhà cung cấp Labo — a dental laboratory the clinic sends work to.
///
/// The reference keeps these in a table of their own rather than in the shared
/// taxonomy, and its dialog collects a logo, a contact person, a tax code and a
/// structured address on top of the name — see docs/clone/pages/labo.md §3.
///
/// The address is held as codes plus a street line, the way the reference holds
/// it; the readable form is composed on the way out rather than stored, so a
/// renamed province does not leave stale text behind.
/// </summary>
public class LaboSupplier : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    public string Name { get; private set; } = default!;
    public string? Phone { get; private set; }
    public string? Email { get; private set; }

    /// <summary>"Người liên hệ" — who to call at the lab.</summary>
    public string? ContactPerson { get; private set; }

    /// <summary>"Mã số thuế".</summary>
    public string? TaxCode { get; private set; }

    /// <summary>Street line only; the rest of the address is the two codes.</summary>
    public string? Address { get; private set; }

    public string? ProvinceCode { get; private set; }
    public string? WardCode { get; private set; }

    /// <summary>Blob name of the logo in MinIO, and the URL it is served from.</summary>
    public string? LogoFileId { get; private set; }
    public string? LogoPath { get; private set; }

    public bool IsActive { get; private set; }

    protected LaboSupplier() { }

    public static LaboSupplier Create(Guid id, Guid clinicBranchId, string name)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        return new LaboSupplier
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Name = name,
            IsActive = true,
        };
    }

    /// <summary>
    /// Everything the dialog collects, in one call — the reference saves the
    /// whole form or none of it, so there is no partial update to model.
    /// </summary>
    public LaboSupplier SetDetails(
        string name,
        string? phone,
        string? email,
        string? contactPerson,
        string? taxCode,
        string? provinceCode,
        string? wardCode,
        string? address)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        Name = name;
        Phone = phone;
        Email = email;
        ContactPerson = contactPerson;
        TaxCode = taxCode;
        ProvinceCode = provinceCode;
        // A ward outside its province is not an address, so clearing the
        // province clears what hung off it.
        WardCode = string.IsNullOrWhiteSpace(provinceCode) ? null : wardCode;
        Address = address;
        // The logo is not part of the form — see SetLogo.
        return this;
    }

    /// <summary>Where the logo now lives, and where it is served from.</summary>
    public LaboSupplier SetLogo(string? blobName, string? url)
    {
        LogoFileId = blobName;
        LogoPath = url;
        return this;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
