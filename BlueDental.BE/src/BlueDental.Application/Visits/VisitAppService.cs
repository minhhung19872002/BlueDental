using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Visits;

[Authorize]
public class VisitAppService(IRepository<Visit, Guid> repository) : ApplicationService, IVisitAppService
{
    public async Task<PagedResultDto<VisitDto>> GetListAsync(GetVisitListInput input)
    {
        var query = await repository.GetQueryableAsync();

        if (input.BranchId.HasValue)
            query = query.Where(v => v.BranchId == input.BranchId.Value);
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

    public async Task<VisitDto> GetAsync(Guid id)
    {
        var visit = await repository.GetAsync(id);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    public async Task<VisitDto> CreateAsync(CreateVisitDto input)
    {
        var visit = new Visit(
            GuidGenerator.Create(),
            input.PatientId,
            input.BranchId,
            input.ScheduledAt,
            input.DentistId,
            input.ChiefComplaint);
        await repository.InsertAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    public async Task<VisitDto> UpdateAsync(Guid id, UpdateVisitDto input)
    {
        var visit = await repository.GetAsync(id);
        await repository.UpdateAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    public async Task CheckInAsync(Guid id)
    {
        var visit = await repository.GetAsync(id);
        visit.CheckIn();
        await repository.UpdateAsync(visit, autoSave: true);
    }

    public async Task StartAsync(Guid id)
    {
        var visit = await repository.GetAsync(id);
        visit.Start();
        await repository.UpdateAsync(visit, autoSave: true);
    }

    public async Task CompleteAsync(Guid id, string? notes)
    {
        var visit = await repository.GetAsync(id);
        visit.Complete(notes);
        await repository.UpdateAsync(visit, autoSave: true);
    }

    public async Task CancelAsync(Guid id, string reason)
    {
        var visit = await repository.GetAsync(id);
        visit.Cancel(reason);
        await repository.UpdateAsync(visit, autoSave: true);
    }

    public async Task MarkNoShowAsync(Guid id)
    {
        var visit = await repository.GetAsync(id);
        visit.MarkNoShow();
        await repository.UpdateAsync(visit, autoSave: true);
    }
}
