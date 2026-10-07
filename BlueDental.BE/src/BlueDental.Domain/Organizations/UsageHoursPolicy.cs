using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Organizations;

/// <summary>
/// Cụm 11 mục 13 — "Quản lý thời gian sử dụng": whether an account may sign in
/// (or keep using a session) at a given clinic time.
///
/// Same shape as <see cref="LoginIpPolicy"/> (see
/// docs/clone/pages/usage-hours.md): an exempt account — the admin role, or a
/// staff member ticked "Cho phép dùng ngoài giờ" — is never restricted; only
/// the account's own branches count; branches without a window restrict
/// nothing; otherwise the time must fall in the window of at least one of them.
/// </summary>
public static class UsageHoursPolicy
{
    public static bool IsAllowed(bool isExempt, IEnumerable<ClinicBranch> accountBranches, TimeOnly clinicTime)
    {
        if (isExempt) return true;

        var restricting = accountBranches.Where(b => b.RestrictsUsageHours).ToList();
        return restricting.Count == 0 || restricting.Any(b => b.AllowsUsageAt(clinicTime));
    }

    /// <summary>The windows that apply, for the refusal message: "06:00–20:00, 07:00–21:00".</summary>
    public static string Describe(IEnumerable<ClinicBranch> accountBranches) =>
        string.Join(", ", accountBranches
            .Where(b => b.RestrictsUsageHours)
            .Select(b => b.UsageHoursText)
            .Distinct());
}
