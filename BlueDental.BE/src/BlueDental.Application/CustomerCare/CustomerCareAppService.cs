using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.CustomerCare;

[Authorize]
public class CustomerCareAppService(IRepository<CareRecord, Guid> repository) : ApplicationService, ICustomerCareAppService
{
    public async Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input)
    {
        var query = await repository.GetQueryableAsync();

        if (input.BranchId.HasValue)
            query = query.Where(r => r.BranchId == input.BranchId.Value);
        if (input.PatientId.HasValue)
            query = query.Where(r => r.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(r => r.Status == input.Status.Value);
        if (input.Type.HasValue)
            query = query.Where(r => r.Type == input.Type.Value);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(r => r.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<CareRecordDto>(
            totalCount,
            ObjectMapper.Map<List<CareRecord>, List<CareRecordDto>>(items));
    }

    public async Task<CareRecordDto> GetAsync(Guid id)
    {
        var record = await repository.GetAsync(id);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    public async Task<CareRecordDto> CreateAsync(CreateCareRecordDto input)
    {
        var record = new CareRecord(
            GuidGenerator.Create(),
            input.PatientId,
            input.BranchId,
            input.Type,
            input.Subject,
            input.AssignedStaffId,
            input.Description,
            input.DueAt);
        await repository.InsertAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    public async Task StartAsync(Guid id)
    {
        var record = await repository.GetAsync(id);
        record.Start();
        await repository.UpdateAsync(record, autoSave: true);
    }

    public async Task CompleteAsync(Guid id, string resolution)
    {
        var record = await repository.GetAsync(id);
        record.Complete(resolution);
        await repository.UpdateAsync(record, autoSave: true);
    }

    public async Task CancelAsync(Guid id)
    {
        var record = await repository.GetAsync(id);
        record.Cancel();
        await repository.UpdateAsync(record, autoSave: true);
    }
}
