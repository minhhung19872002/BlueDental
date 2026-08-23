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
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(v => v.BranchId == branchId);
        if (input.PatientId.HasValue)
            query = query.Where(v => v.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(v => v.Status == input.Status.Value);

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

    [Authorize(BlueDentalPermissions.Visits.View)]
    public async Task<VisitDto> GetAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
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
        visit.Update(input.DentistId, input.ScheduledAt, input.ChiefComplaint, input.Notes);
        await _repository.UpdateAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CheckInAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        visit.CheckIn();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task StartAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        visit.Start();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CompleteAsync(Guid id, string? notes)
    {
        var visit = await _repository.GetAsync(id);
        visit.Complete(notes);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CancelAsync(Guid id, string reason)
    {
        var visit = await _repository.GetAsync(id);
        visit.Cancel(reason);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task MarkNoShowAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        visit.MarkNoShow();
        await _repository.UpdateAsync(visit, autoSave: true);
    }
}
