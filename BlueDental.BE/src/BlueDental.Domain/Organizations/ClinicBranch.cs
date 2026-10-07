using System;
using System.Linq;
using System.Net;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Organizations;

public class ClinicBranch : FullAuditedAggregateRoot<Guid>
{
    public string Code { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? Address { get; private set; }
    public string? ProvinceId { get; private set; }
    public string? WardId { get; private set; }
    public string? PhoneNumber { get; private set; }
    public string? Email { get; private set; }
    public string? Slogan { get; private set; }
    public string? TaxCode { get; private set; }
    public string? ContactPerson { get; private set; }
    public BranchStatus Status { get; private set; }
    public TimeOnly? OpeningTime { get; private set; }
    public TimeOnly? ClosingTime { get; private set; }

    /// <summary>
    /// Networks staff of this branch may sign in from, one entry per line
    /// (Cụm 11 mục 11). Empty means the branch does not restrict sign-in by IP.
    /// Stored normalized: each entry parsed and rewritten by <see cref="IpAddressRange"/>.
    /// </summary>
    public string? AllowedIpRanges { get; private set; }

    public bool RestrictsLoginByIp => !string.IsNullOrWhiteSpace(AllowedIpRanges);

    /// <summary>
    /// "Giờ được phép sử dụng" on the clinic's wall clock (Cụm 11 mục 13):
    /// staff of this branch may use the software from <see cref="UsageStartTime"/>
    /// up to <see cref="UsageEndTime"/>. Both or neither; an end before the
    /// start spans midnight (22:00 → 06:00). Neither means no restriction.
    /// </summary>
    public TimeOnly? UsageStartTime { get; private set; }

    public TimeOnly? UsageEndTime { get; private set; }

    public bool RestrictsUsageHours => UsageStartTime.HasValue && UsageEndTime.HasValue;

    /// <summary>The window as people read it, e.g. "06:00–20:00"; null when unrestricted.</summary>
    public string? UsageHoursText => RestrictsUsageHours
        ? $"{UsageStartTime!.Value:HH\\:mm}–{UsageEndTime!.Value:HH\\:mm}"
        : null;

    protected ClinicBranch() { }

    public ClinicBranch(
        Guid id,
        string code,
        string name,
        string? address = null,
        string? phoneNumber = null,
        string? email = null)
        : base(id)
    {
        Code = Check.NotNullOrWhiteSpace(code, nameof(code));
        Name = Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: 200);
        Address = address;
        PhoneNumber = phoneNumber;
        Email = email;
        Status = BranchStatus.Active;
    }

    public ClinicBranch SetName(string name)
    {
        Name = Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: 200);
        return this;
    }

    public ClinicBranch SetContactInfo(string? phoneNumber, string? email, string? address, string? provinceId = null, string? wardId = null)
    {
        PhoneNumber = phoneNumber;
        Email = email;
        Address = address;
        ProvinceId = provinceId;
        WardId = wardId;
        return this;
    }

    public ClinicBranch SetOperatingHours(TimeOnly? opening, TimeOnly? closing)
    {
        if (opening.HasValue && closing.HasValue && closing <= opening)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.InvalidOperatingHours);
        }

        OpeningTime = opening;
        ClosingTime = closing;
        return this;
    }

    public ClinicBranch SetSlogan(string? slogan)
    {
        Slogan = slogan?.Trim();
        return this;
    }

    public ClinicBranch SetTaxCode(string? taxCode)
    {
        TaxCode = taxCode?.Trim();
        return this;
    }

    public ClinicBranch SetContactPerson(string? contactPerson)
    {
        ContactPerson = contactPerson?.Trim();
        return this;
    }

    public ClinicBranch SetAllowedIpRanges(string? allowedIpRanges)
    {
        var ranges = IpAddressRange.ParseList(allowedIpRanges);
        AllowedIpRanges = ranges.Count == 0 ? null : string.Join('\n', ranges.Select(r => r.ToString()));
        return this;
    }

    public bool AllowsLoginFrom(IPAddress? address) =>
        IpAddressRange.ParseList(AllowedIpRanges).Any(r => r.Contains(address));

    public ClinicBranch SetUsageHours(TimeOnly? start, TimeOnly? end)
    {
        if (start.HasValue != end.HasValue || (start.HasValue && start == end))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.InvalidUsageHours);
        }

        UsageStartTime = start;
        UsageEndTime = end;
        return this;
    }

    /// <summary>Whether <paramref name="clinicTime"/> falls in the window; start inclusive, end exclusive.</summary>
    public bool AllowsUsageAt(TimeOnly clinicTime)
    {
        if (!RestrictsUsageHours) return true;

        var start = UsageStartTime!.Value;
        var end = UsageEndTime!.Value;
        return start < end
            ? clinicTime >= start && clinicTime < end
            : clinicTime >= start || clinicTime < end;
    }

    public ClinicBranch Deactivate()
    {
        Status = BranchStatus.Inactive;
        return this;
    }

    public ClinicBranch Activate()
    {
        Status = BranchStatus.Active;
        return this;
    }
}
