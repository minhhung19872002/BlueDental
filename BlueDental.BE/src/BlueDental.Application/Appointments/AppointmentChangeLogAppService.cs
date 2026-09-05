using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Appointments;

/// <summary>
/// Lịch sử thay đổi lịch hẹn. The reference reads it behind
/// <c>GET /schedule-logs</c> and <c>GET /schedule-logs/stats</c>, both keyed by
/// patient and a date range that defaults to the current week.
/// </summary>
[Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
public class AppointmentChangeLogAppService(
    IRepository<AppointmentChangeLog, Guid> repository,
    ICurrentClinicBranchResolver branchResolver)
    : ApplicationService, IAppointmentChangeLogAppService
{
    private static readonly TimeSpan ClinicUtcOffset = TimeSpan.FromHours(7);

    public async Task<PagedResultDto<AppointmentChangeLogDto>> GetListAsync(
        GetAppointmentChangeLogListInput input)
    {
        var query = await FilteredQueryAsync(input);
        var totalCount = await AsyncExecuter.CountAsync(query);

        var items = await AsyncExecuter.ToListAsync(
            query.OrderByDescending(x => x.OccurredAt)
                .ThenByDescending(x => x.Id)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        return new PagedResultDto<AppointmentChangeLogDto>(totalCount, items.Select(ToDto).ToList());
    }

    public async Task<AppointmentChangeLogStatsDto> GetStatsAsync(GetAppointmentChangeLogListInput input)
    {
        var query = await FilteredQueryAsync(input);
        var rows = await AsyncExecuter.ToListAsync(
            query.Select(x => new { x.Action, x.Source, x.StatusBefore, x.StatusAfter, x.IsImportant }));

        return new AppointmentChangeLogStatsDto
        {
            Total = rows.Count,
            Important = rows.Count(r => r.IsImportant),
            ByAction = rows.GroupBy(r => r.Action).ToDictionary(g => g.Key, g => g.Count()),
            BySource = rows.GroupBy(r => r.Source).ToDictionary(g => g.Key, g => g.Count()),
            // A creation always "ends up" in Đã hẹn; the reference only counts
            // statuses an existing appointment was moved to.
            ByStatusTo = rows.Where(r => r.StatusAfter.HasValue && r.Action != AppointmentChangeAction.Created)
                .GroupBy(r => r.StatusAfter!.Value).ToDictionary(g => g.Key, g => g.Count()),
            ByStatusFrom = rows.Where(r => r.StatusBefore.HasValue)
                .GroupBy(r => r.StatusBefore!.Value).ToDictionary(g => g.Key, g => g.Count()),
        };
    }

    private async Task<IQueryable<AppointmentChangeLog>> FilteredQueryAsync(GetAppointmentChangeLogListInput input)
    {
        var branchId = branchResolver.GetRequiredClinicBranchId();
        var query = (await repository.GetQueryableAsync()).Where(x => x.BranchId == branchId);

        if (input.PatientId.HasValue) query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.AppointmentId.HasValue) query = query.Where(x => x.AppointmentId == input.AppointmentId.Value);
        if (input.Action.HasValue) query = query.Where(x => x.Action == input.Action.Value);
        if (input.Actions is { Count: > 0 })
        {
            var actions = input.Actions;
            query = query.Where(x => actions.Contains(x.Action));
        }
        if (input.Status.HasValue) query = query.Where(x => x.StatusAfter == input.Status.Value);
        if (input.Statuses is { Count: > 0 })
        {
            var statuses = input.Statuses;
            query = query.Where(x => x.StatusAfter.HasValue && statuses.Contains(x.StatusAfter.Value));
        }
        if (input.Source.HasValue) query = query.Where(x => x.Source == input.Source.Value);
        if (input.Sources is { Count: > 0 })
        {
            var sources = input.Sources;
            query = query.Where(x => sources.Contains(x.Source));
        }
        if (input.ImportantOnly == true) query = query.Where(x => x.IsImportant);

        if (input.FromDate.HasValue)
        {
            var from = ToInstant(input.FromDate.Value);
            query = query.Where(x => x.OccurredAt >= from);
        }

        if (input.ToDate.HasValue)
        {
            var to = ToInstant(input.ToDate.Value).AddDays(1);
            query = query.Where(x => x.OccurredAt < to);
        }

        if (!string.IsNullOrWhiteSpace(input.Actor))
        {
            var actor = input.Actor.Trim().ToLower();
            query = query.Where(x =>
                (x.ActorName != null && x.ActorName.ToLower().Contains(actor))
                || (x.ActorUserName != null && x.ActorUserName.ToLower().Contains(actor)));
        }

        if (!string.IsNullOrWhiteSpace(input.Keyword))
        {
            var keyword = input.Keyword.Trim().ToLower();
            query = query.Where(x => x.ChangesJson.ToLower().Contains(keyword));
        }

        return query;
    }

    /// <summary>A clinic-local (UTC+7) calendar day as a UTC instant.</summary>
    private static DateTime ToInstant(DateOnly date) =>
        new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), ClinicUtcOffset).UtcDateTime;

    private AppointmentChangeLogDto ToDto(AppointmentChangeLog log)
    {
        var dto = ObjectMapper.Map<AppointmentChangeLog, AppointmentChangeLogDto>(log);
        dto.ChangedFields = log.ChangedFieldList().ToList();

        var payload = log.ReadPayload();
        dto.Before = payload.Before is null ? null : ObjectMapper.Map<AppointmentSnapshot, AppointmentSnapshotDto>(payload.Before);
        dto.After = payload.After is null ? null : ObjectMapper.Map<AppointmentSnapshot, AppointmentSnapshotDto>(payload.After);
        dto.Diff = payload.Diff
            .Select(d => new AppointmentFieldChangeDto { Field = d.Field, Before = d.Before, After = d.After })
            .ToList();

        return dto;
    }
}
