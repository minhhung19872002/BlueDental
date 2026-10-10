using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Staff;

/// <summary>
/// Nhân sự → Sơ đồ tổ chức (F-67, BlueDental-local). The chart is clinic-wide
/// on purpose — the Tổng giám đốc sits above every branch — so it is guarded by
/// the orgChart leaves alone, not by branch scope. Every write leaves one line
/// in <see cref="OrgUnitChangeLog"/> for the Lịch sử thay đổi popup.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.OrgChart.Read)]
public class OrgChartAppService(
    IRepository<OrgUnit, Guid> unitRepository,
    IRepository<OrgUnitMember, Guid> memberRepository,
    IRepository<OrgUnitChangeLog, Guid> logRepository,
    IIdentityUserRepository userRepository) : BlueDentalAppService, IOrgChartAppService
{
    public const string RootCode = "BD";
    public const string RootName = "BlueDental";

    private static readonly Dictionary<OrgUnitKind, string> CodePrefixes = new()
    {
        [OrgUnitKind.Department] = "PB",
        [OrgUnitKind.DoctorTeam] = "TBS",
    };

    public async Task<OrgChartDto> GetAsync()
    {
        await EnsureRootAsync();
        var units = await unitRepository.GetListAsync();
        var members = await memberRepository.GetListAsync();
        var staff = await LoadStaffAsync();

        var placed = members.Select(m => m.StaffId).ToHashSet();
        return new OrgChartDto
        {
            Units = units
                .OrderBy(u => u.Kind).ThenBy(u => u.CreationTime)
                .Select(u => MapUnit(u, members, staff))
                .ToList(),
            Unassigned = staff.Values
                .Where(s => s.IsActive && !placed.Contains(s.Id))
                .OrderBy(s => s.Name, StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true))
                .ToList(),
        };
    }

    public async Task<OrgUnitCodeDto> GetNextCodeAsync(OrgUnitKind kind)
    {
        if (!CodePrefixes.ContainsKey(kind))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.RootLocked);
        }

        var codes = (await unitRepository.GetListAsync()).Select(u => u.Code).ToList();
        return new OrgUnitCodeDto { Code = NextCode(kind, codes) };
    }

    [Authorize(BlueDentalAbilityPermissions.OrgChart.Create)]
    public async Task<OrgUnitDto> CreateAsync(CreateOrgUnitDto input)
    {
        if (!CodePrefixes.ContainsKey(input.Kind))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.RootLocked);
        }

        await EnsureRootAsync();
        var units = await unitRepository.GetListAsync();
        var staff = await LoadStaffAsync();
        var parent = ParentOf(input.ParentId, units);
        var code = string.IsNullOrWhiteSpace(input.Code) ? NextCode(input.Kind, units.Select(u => u.Code)) : input.Code;

        EnsureValid(null, input, code, units, staff);

        var unit = OrgUnit.Create(GuidGenerator.Create(), input.Kind, code, input.Name, parent, input.HeadStaffId);
        await unitRepository.InsertAsync(unit, autoSave: true);
        var after = await SyncMembersAsync(unit.Id, input.HeadStaffId, input.MemberStaffIds);

        await LogAsync(unit, OrgChartAction.Created,
        [
            new("code", null, unit.Code),
            new("name", null, unit.Name),
            new("parent", null, parent.Name),
            new("head", null, NameOf(unit.HeadStaffId, staff)),
            new("members", null, Names(after, staff)),
        ]);

        return MapUnit(unit, await memberRepository.GetListAsync(m => m.OrgUnitId == unit.Id), staff);
    }

    [Authorize(BlueDentalAbilityPermissions.OrgChart.Update)]
    public async Task<OrgUnitDto> UpdateAsync(Guid id, UpdateOrgUnitDto input)
    {
        var unit = await unitRepository.GetAsync(id);
        unit.EnsureNotRoot();
        var units = await unitRepository.GetListAsync();
        var staff = await LoadStaffAsync();
        var parent = ParentOf(input.ParentId, units);
        var code = string.IsNullOrWhiteSpace(input.Code) ? unit.Code : input.Code;

        EnsureValid(unit.Id, input, code, units, staff);

        var beforeMembers = (await memberRepository.GetListAsync(m => m.OrgUnitId == id)).Select(m => m.StaffId).ToList();
        var before = new
        {
            unit.Code,
            unit.Name,
            Parent = units.FirstOrDefault(u => u.Id == unit.ParentId)?.Name,
            Head = NameOf(unit.HeadStaffId, staff),
        };

        unit.Update(code, input.Name, parent, input.HeadStaffId);
        await unitRepository.UpdateAsync(unit, autoSave: true);
        var afterMembers = await SyncMembersAsync(unit.Id, input.HeadStaffId, input.MemberStaffIds);

        var changes = new List<OrgUnitFieldChange>
        {
            new("code", before.Code, unit.Code),
            new("name", before.Name, unit.Name),
            new("parent", before.Parent, parent.Name),
            new("head", before.Head, NameOf(unit.HeadStaffId, staff)),
            new("members", Names(beforeMembers, staff), Names(afterMembers, staff)),
        }.Where(c => !string.Equals(c.Before ?? "", c.After ?? "", StringComparison.Ordinal)).ToList();

        if (changes.Count > 0)
        {
            var headChangedOnly = changes.All(c => c.Field is "head" or "members");
            await LogAsync(unit, headChangedOnly && changes.Any(c => c.Field == "head")
                ? OrgChartAction.HeadChanged
                : OrgChartAction.Updated, changes);
        }

        return MapUnit(unit, await memberRepository.GetListAsync(m => m.OrgUnitId == unit.Id), staff);
    }

    /// <summary>
    /// Xoá đơn vị. A Phòng ban with teams under it stays; its people go back to
    /// "Chưa thuộc đơn vị nào". The root is never deleted.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.OrgChart.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var unit = await unitRepository.GetAsync(id);
        unit.EnsureNotRoot();
        if (await unitRepository.AnyAsync(u => u.ParentId == id))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.HasChildren).WithData("name", unit.Name);
        }

        var members = await memberRepository.GetListAsync(m => m.OrgUnitId == id);
        var staff = await LoadStaffAsync();
        await memberRepository.DeleteManyAsync(members, autoSave: true);
        await unitRepository.DeleteAsync(unit, autoSave: true);

        await LogAsync(unit, OrgChartAction.Deleted,
        [
            new("code", unit.Code, null),
            new("name", unit.Name, null),
            new("head", NameOf(unit.HeadStaffId, staff), null),
            new("members", Names(members.Select(m => m.StaffId), staff), null),
        ]);
    }

    /// <summary>"Có thể thay đổi người đứng đầu" — the one edit the root allows.</summary>
    [Authorize(BlueDentalAbilityPermissions.OrgChart.Update)]
    public async Task<OrgUnitDto> ChangeRootHeadAsync(ChangeOrgRootHeadDto input)
    {
        var root = await EnsureRootAsync();
        var units = await unitRepository.GetListAsync();
        var staff = await LoadStaffAsync();
        var headId = input.HeadStaffId is { } h && h != Guid.Empty ? h : (Guid?)null;
        var before = NameOf(root.HeadStaffId, staff);

        if (headId is { } newHead)
        {
            EnsureStaff(newHead, staff);
            EnsureNotHeadingOther(newHead, root.Id, units, staff, BlueDentalDomainErrorCodes.OrgChart.AlreadyHeadsUnit);
        }

        root.ChangeRootHead(headId);
        await unitRepository.UpdateAsync(root, autoSave: true);
        if (headId is { } placedHead)
        {
            await PlaceAsync(placedHead, root.Id);
        }

        var after = NameOf(root.HeadStaffId, staff);
        if (!string.Equals(before, after, StringComparison.Ordinal))
        {
            await LogAsync(root, OrgChartAction.HeadChanged, [new("head", before, after)]);
        }

        return MapUnit(root, await memberRepository.GetListAsync(m => m.OrgUnitId == root.Id), staff);
    }

    /// <summary>"Phân vào đơn vị": people from the unassigned strip (or another unit) into one unit.</summary>
    [Authorize(BlueDentalAbilityPermissions.OrgChart.Update)]
    public async Task AssignAsync(AssignOrgUnitMembersDto input)
    {
        var unit = await unitRepository.GetAsync(input.OrgUnitId);
        var units = await unitRepository.GetListAsync();
        var staff = await LoadStaffAsync();
        var ids = input.StaffIds.Where(s => s != Guid.Empty).Distinct().ToList();
        foreach (var staffId in ids)
        {
            EnsureStaff(staffId, staff);
            EnsureNotHeadingOther(staffId, unit.Id, units, staff, BlueDentalDomainErrorCodes.OrgChart.MemberHeadsOtherUnit);
        }

        var before = (await memberRepository.GetListAsync(m => m.OrgUnitId == unit.Id)).Select(m => m.StaffId).ToList();
        foreach (var staffId in ids)
        {
            await PlaceAsync(staffId, unit.Id);
        }

        var after = before.Union(ids).ToList();
        if (after.Count != before.Count)
        {
            await LogAsync(unit, OrgChartAction.MembersAssigned, [new("members", Names(before, staff), Names(after, staff))]);
        }
    }

    public async Task<PagedResultDto<OrgUnitChangeLogDto>> GetHistoryAsync(GetOrgChartHistoryInput input)
    {
        var query = await logRepository.GetQueryableAsync();
        if (input.Action is { } action)
        {
            query = query.Where(l => l.Action == action);
        }

        if (input.OrgUnitId is { } unitId)
        {
            query = query.Where(l => l.OrgUnitId == unitId);
        }

        // Dates are clinic days (UTC+7), like every other history in the app.
        if (input.FromDate is { } from)
        {
            var start = ClinicCalendar.StartOfDay(from).UtcDateTime;
            query = query.Where(l => l.OccurredAt >= start);
        }

        if (input.ToDate is { } to)
        {
            var end = ClinicCalendar.StartOfDay(to.AddDays(1)).UtcDateTime;
            query = query.Where(l => l.OccurredAt < end);
        }

        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(l => l.OrgUnitName.ToLower().Contains(term)
                || (l.ActorName != null && l.ActorName.ToLower().Contains(term)));
        }

        var total = await AsyncExecuter.CountAsync(query);
        var page = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(l => l.OccurredAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount));

        return new PagedResultDto<OrgUnitChangeLogDto>(total, page.Select(l => new OrgUnitChangeLogDto
        {
            Id = l.Id,
            OrgUnitId = l.OrgUnitId,
            OrgUnitName = l.OrgUnitName,
            OrgUnitKind = l.OrgUnitKind,
            Action = l.Action,
            Changes = l.ReadChanges()
                .Select(c => new OrgUnitFieldChangeDto { Field = c.Field, Before = c.Before, After = c.After })
                .ToList(),
            ActorUserId = l.ActorUserId,
            ActorName = l.ActorName,
            OccurredAt = l.OccurredAt,
        }).ToList());
    }

    /// <summary>Next free "PB-001" / "TBS-001", counted over the codes in use.</summary>
    public static string NextCode(OrgUnitKind kind, IEnumerable<string> codes)
    {
        var prefix = CodePrefixes[kind] + "-";
        var highest = codes
            .Where(c => c.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            .Select(c => int.TryParse(c[prefix.Length..], NumberStyles.None, CultureInfo.InvariantCulture, out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();
        return $"{prefix}{highest + 1:000}";
    }

    /// <summary>
    /// Name, code and head checks. Any active staff member may head a unit, a
    /// Team bác sĩ included: a lễ tân team can have its trưởng phòng too (BA, 2026-10-10).
    /// </summary>
    private static void EnsureValid(
        Guid? selfId,
        OrgUnitInputDto input,
        string code,
        List<OrgUnit> units,
        Dictionary<Guid, OrgStaffDto> staff)
    {
        var others = units.Where(u => u.Id != selfId).ToList();
        CatalogNames.EnsureFree(input.Name, others.Select(u => u.Name), BlueDentalDomainErrorCodes.OrgChart.DuplicateName);
        if (others.Any(u => string.Equals(u.Code, code.Trim(), StringComparison.OrdinalIgnoreCase)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.DuplicateCode).WithData("code", code.Trim());
        }

        if (input.HeadStaffId == Guid.Empty)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.HeadRequired);
        }

        EnsureStaff(input.HeadStaffId, staff);
        var self = selfId ?? Guid.Empty;
        EnsureNotHeadingOther(input.HeadStaffId, self, units, staff, BlueDentalDomainErrorCodes.OrgChart.AlreadyHeadsUnit);
        foreach (var memberId in input.MemberStaffIds.Where(m => m != Guid.Empty).Distinct())
        {
            EnsureStaff(memberId, staff);
            EnsureNotHeadingOther(memberId, self, units, staff, BlueDentalDomainErrorCodes.OrgChart.MemberHeadsOtherUnit);
        }
    }

    private static OrgUnit ParentOf(Guid parentId, List<OrgUnit> units) =>
        units.FirstOrDefault(u => u.Id == parentId)
        ?? throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.InvalidParent);

    private static OrgStaffDto EnsureStaff(Guid staffId, Dictionary<Guid, OrgStaffDto> staff) =>
        staff.TryGetValue(staffId, out var person) && person.IsActive
            ? person
            : throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.UnknownStaff);

    /// <summary>Someone heading a unit other than <paramref name="unitId"/> cannot head or join it.</summary>
    private static void EnsureNotHeadingOther(
        Guid staffId, Guid unitId, List<OrgUnit> units, Dictionary<Guid, OrgStaffDto> staff, string errorCode)
    {
        var headed = units.FirstOrDefault(u => u.HeadStaffId == staffId && u.Id != unitId);
        if (headed is not null)
        {
            throw new BusinessException(errorCode)
                .WithData("staff", staff.GetValueOrDefault(staffId)?.Name ?? "")
                .WithData("unit", headed.Name);
        }
    }

    /// <summary>
    /// Makes <paramref name="memberIds"/> (plus the head) the unit's people:
    /// newcomers move in from wherever they were, and those left out return to
    /// the unassigned strip. Returns the member ids now in the unit.
    /// </summary>
    private async Task<List<Guid>> SyncMembersAsync(Guid unitId, Guid headStaffId, IEnumerable<Guid> memberIds)
    {
        var wanted = memberIds.Where(m => m != Guid.Empty).Prepend(headStaffId).Distinct().ToList();
        var current = await memberRepository.GetListAsync(m => m.OrgUnitId == unitId);
        var leaving = current.Where(m => !wanted.Contains(m.StaffId)).ToList();
        if (leaving.Count > 0)
        {
            await memberRepository.DeleteManyAsync(leaving, autoSave: true);
        }

        foreach (var staffId in wanted)
        {
            await PlaceAsync(staffId, unitId);
        }

        return wanted;
    }

    /// <summary>Sets someone's đơn vị chính, moving the one row they have.</summary>
    private async Task PlaceAsync(Guid staffId, Guid unitId)
    {
        var row = await memberRepository.FirstOrDefaultAsync(m => m.StaffId == staffId);
        if (row is null)
        {
            await memberRepository.InsertAsync(new OrgUnitMember(GuidGenerator.Create(), unitId, staffId), autoSave: true);
        }
        else if (row.OrgUnitId != unitId)
        {
            row.MoveTo(unitId);
            await memberRepository.UpdateAsync(row, autoSave: true);
        }
    }

    /// <summary>The root row is inserted by its migration; this only covers a database built without it.</summary>
    private async Task<OrgUnit> EnsureRootAsync()
    {
        var root = await unitRepository.FindAsync(OrgUnit.RootId);
        if (root is not null)
        {
            return root;
        }

        root = OrgUnit.CreateRoot(OrgUnit.RootId, RootCode, RootName, null);
        return await unitRepository.InsertAsync(root, autoSave: true);
    }

    private async Task LogAsync(OrgUnit unit, OrgChartAction action, IReadOnlyList<OrgUnitFieldChange> changes)
    {
        changes = changes.Where(c => !string.Equals(c.Before ?? "", c.After ?? "", StringComparison.Ordinal)).ToList();
        var actorName = CurrentUser.Id is { } actorId
            ? (await userRepository.FindAsync(actorId, includeDetails: false)) is { } actor ? FullName(actor) : CurrentUser.UserName
            : null;
        await logRepository.InsertAsync(
            OrgUnitChangeLog.Record(GuidGenerator.Create(), unit, action, changes, CurrentUser.Id, actorName, Clock.Now),
            autoSave: true);
    }

    private async Task<Dictionary<Guid, OrgStaffDto>> LoadStaffAsync()
    {
        var users = await userRepository.GetListAsync();

        return users.ToDictionary(u => u.Id, u => new OrgStaffDto
        {
            Id = u.Id,
            Name = FullName(u),
            UserName = u.UserName,
            Position = u.ExtraProperties.GetOrDefault("Position") as string,
            AvatarUrl = u.ExtraProperties.GetOrDefault("AvatarBlobName") is string ? $"/api/v1/app/staff/{u.Id}/avatar" : null,
            IsDentist = u.ExtraProperties.GetOrDefault("IsDentist") is true,
            IsActive = u.IsActive,
        });
    }

    private static OrgUnitDto MapUnit(OrgUnit unit, List<OrgUnitMember> members, Dictionary<Guid, OrgStaffDto> staff) => new()
    {
        Id = unit.Id,
        Code = unit.Code,
        Name = unit.Name,
        Kind = unit.Kind,
        ParentId = unit.ParentId,
        HeadStaffId = unit.HeadStaffId,
        Members = members
            .Where(m => m.OrgUnitId == unit.Id && staff.ContainsKey(m.StaffId))
            .Select(m => staff[m.StaffId])
            .OrderBy(s => s.Id == unit.HeadStaffId ? 0 : 1)
            .ThenBy(s => s.Name, StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true))
            .ToList(),
        CreationTime = unit.CreationTime,
    };

    private static string? NameOf(Guid? staffId, Dictionary<Guid, OrgStaffDto> staff) =>
        staffId is { } id ? staff.GetValueOrDefault(id)?.Name : null;

    private static string? Names(IEnumerable<Guid> staffIds, Dictionary<Guid, OrgStaffDto> staff)
    {
        var names = staffIds
            .Select(id => staff.GetValueOrDefault(id)?.Name)
            .OfType<string>()
            .Order(StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true))
            .ToList();
        return names.Count == 0 ? null : string.Join(", ", names);
    }

    private static string FullName(IdentityUser user)
    {
        var fullName = string.Join(" ", new[] { user.Surname, user.Name }.Where(x => !string.IsNullOrWhiteSpace(x)));
        return string.IsNullOrWhiteSpace(fullName) ? user.UserName : fullName;
    }
}
