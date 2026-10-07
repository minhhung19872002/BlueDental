using System.Collections.Generic;
using System.Linq;
using System.Net;

namespace BlueDental.Organizations;

/// <summary>
/// Cụm 11 mục 11 — "Xác thực IP theo chi nhánh": whether an account may sign
/// in (or keep using a session) from a given address.
///
/// Rules (BlueDental-local, the reference has no such screen — see
/// docs/clone/pages/branch-ip-restriction.md):
/// <list type="bullet">
/// <item>An exempt account — the admin role, or a staff member ticked "Cho
/// phép đăng nhập ngoài công ty" — is never restricted.</item>
/// <item>Only the account's own branches count. Branches without an IP list
/// do not restrict anything, so an account none of whose branches has a list
/// signs in from anywhere — nothing changes until someone types a list.</item>
/// <item>Otherwise the address must fall inside the list of at least one of
/// those branches.</item>
/// </list>
/// </summary>
public static class LoginIpPolicy
{
    public static bool IsAllowed(bool isExempt, IEnumerable<ClinicBranch> accountBranches, IPAddress? clientAddress)
    {
        if (isExempt) return true;

        var restricting = accountBranches.Where(b => b.RestrictsLoginByIp).ToList();
        if (restricting.Count == 0) return true;

        return restricting.Any(b => b.AllowsLoginFrom(clientAddress));
    }
}
