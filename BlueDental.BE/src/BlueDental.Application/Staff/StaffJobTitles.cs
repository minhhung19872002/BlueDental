using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Data;
using Volo.Abp.Identity;

namespace BlueDental.Staff;

/// <summary>
/// A person's Chức danh ("Hồ sơ công việc", an extra property of the IdentityUser).
/// Printed sheets name a doctor by it, and by their name only when none is set
/// (owner, 2026-10-19) — so the DTOs those sheets read carry it beside the name.
/// </summary>
public static class StaffJobTitles
{
    public const string Property = "JobTitle";

    public static string? Of(IdentityUser user) =>
        (user.ExtraProperties.GetOrDefault(Property) as string)?.Trim() is { Length: > 0 } title ? title : null;

    /// <summary>The titles of those who have one, by user id.</summary>
    public static Dictionary<Guid, string> Of(IEnumerable<IdentityUser> users) =>
        users
            .Select(user => (user.Id, Title: Of(user)))
            .Where(pair => pair.Title is not null)
            .ToDictionary(pair => pair.Id, pair => pair.Title!);

    /// <summary>How a printed sheet names them: the Chức danh, else the name.</summary>
    public static string PrintedName(IdentityUser user) => Of(user) ?? user.Name ?? user.UserName;

    public static string? Lookup(IReadOnlyDictionary<Guid, string> titles, Guid? id) =>
        id.HasValue ? titles.GetValueOrDefault(id.Value) : null;
}
