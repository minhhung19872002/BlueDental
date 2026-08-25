using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Visits;

[Authorize(BlueDentalPermissions.Visits.Default)]
public class VisitAppService : ApplicationService, IVisitAppService
{
    private readonly IRepository<Visit, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public VisitAppService(
        IRepository<Visit, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.Visits.View)]
    public async Task<PagedResultDto<VisitDto>> GetListAsync(GetVisitListInput input)
    {
        var query = await FilteredQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(v => v.ScheduledAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<VisitDto>(
            totalCount,
            ObjectMapper.Map<List<Visit>, List<VisitDto>>(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    public async Task<VisitStatsDto> GetStatsAsync(GetVisitListInput input)
    {
        // The counters describe the whole filtered set, so they ignore paging.
        var items = (await FilteredQueryAsync(input)).ToList();

        return new VisitStatsDto
        {
            Total = items.Count,
            Scheduled = items.Count(v => v.Status == VisitStatus.Scheduled),
            CheckedIn = items.Count(v => v.Status == VisitStatus.CheckedIn),
            InProgress = items.Count(v => v.Status == VisitStatus.InProgress),
            Completed = items.Count(v => v.Status == VisitStatus.Completed),
            Cancelled = items.Count(v => v.Status == VisitStatus.Cancelled),
            NoShow = items.Count(v => v.Status == VisitStatus.NoShow)
        };
    }

    /// <summary>Shared so the list and the counters can never drift apart.</summary>
    private async Task<IQueryable<Visit>> FilteredQueryAsync(GetVisitListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        // The caller does not get to choose the branch — it comes from the
        // signed-in user, which is what closes the IDOR the audit found. An
        // explicit BranchId is only honoured when it is the user's own.
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        query = query.Where(v => v.BranchId == branchId);

        if (input.PatientId.HasValue)
            query = query.Where(v => v.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(v => v.Status == input.Status.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(v =>
                (v.ChiefComplaint != null && v.ChiefComplaint.Contains(filter))
                || (v.Notes != null && v.Notes.Contains(filter)));
        }

        return query;
    }

    [Authorize(BlueDentalPermissions.Visits.View)]
    public async Task<VisitDto> GetAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Create)]
    public async Task<VisitDto> CreateAsync(CreateVisitDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var visit = new Visit(
            GuidGenerator.Create(),
            input.PatientId,
            branchId,
            input.ScheduledAt,
            input.DentistId,
            input.ChiefComplaint);
        await _repository.InsertAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Edit)]
    public async Task<VisitDto> UpdateAsync(Guid id, UpdateVisitDto input)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.Update(input.DentistId, input.ScheduledAt, input.ChiefComplaint, input.Notes);
        await _repository.UpdateAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CheckInAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.CheckIn();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task StartAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.Start();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CompleteAsync(Guid id, string? notes)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.Complete(notes);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CancelAsync(Guid id, string reason)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.Cancel(reason);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task MarkNoShowAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.MarkNoShow();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    /// <summary>
    /// Recording how a visit ended is part of running it, not editing its
    /// booking, so it sits behind the workflow permission alongside check-in
    /// and complete rather than behind Edit.
    /// </summary>
    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task<VisitDto> RecordOutcomeAsync(Guid id, RecordVisitOutcomeDto input)
    {
        var visit = await _repository.GetAsync(id);
        GuardBranchAccess(visit);
        visit.RecordOutcome(input.Outcome);
        await _repository.UpdateAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    private void GuardBranchAccess(Visit entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Visit), entity.Id);
    }
}
