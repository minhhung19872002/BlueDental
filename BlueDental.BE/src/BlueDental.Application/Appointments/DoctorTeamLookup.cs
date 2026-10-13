using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Staff;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Appointments;

/// <summary>
/// The Team bác sĩ boxes of Nhân sự → Sơ đồ tổ chức, as the reception board's
/// Nhóm bác sĩ filter sees them. Read under appointment permissions, not the
/// org chart's: whoever works the board picks a team without managing the chart.
/// </summary>
public class DoctorTeamLookup(
    IRepository<OrgUnit, Guid> unitRepository,
    IRepository<OrgUnitMember, Guid> memberRepository,
    IIdentityUserRepository userRepository) : ITransientDependency
{
    private static readonly StringComparer VietnameseOrder =
        StringComparer.Create(CultureInfo.GetCultureInfo("vi-VN"), true);

    /// <summary>Every Team bác sĩ whose head is ticked "Bác sĩ", by name.</summary>
    public async Task<List<AppointmentDoctorTeamDto>> GetTeamsAsync()
    {
        var teams = await unitRepository.GetListAsync(u => u.Kind == OrgUnitKind.DoctorTeam && u.HeadStaffId != null);
        var heads = (await userRepository.GetListByIdsAsync(teams.Select(t => t.HeadStaffId!.Value).Distinct()))
            .Where(u => u.ExtraProperties.GetOrDefault("IsDentist") is true)
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return teams
            .Where(t => heads.ContainsKey(t.HeadStaffId!.Value))
            .Select(t => new AppointmentDoctorTeamDto
            {
                Id = t.Id,
                Code = t.Code,
                Name = t.Name,
                HeadName = heads[t.HeadStaffId!.Value],
            })
            .OrderBy(t => t.Name, VietnameseOrder)
            .ToList();
    }

    /// <summary>Who sits in the team now — empty for an unknown or deleted one.</summary>
    public async Task<List<Guid>> GetMemberIdsAsync(Guid teamId)
    {
        var members = await memberRepository.GetListAsync(m => m.OrgUnitId == teamId);
        return members.Select(m => m.StaffId).ToList();
    }
}
