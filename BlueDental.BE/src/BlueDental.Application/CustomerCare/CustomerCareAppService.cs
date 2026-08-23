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

namespace BlueDental.CustomerCare;

[Authorize(BlueDentalPermissions.CustomerCare.Default)]
public class CustomerCareAppService : ApplicationService, ICustomerCareAppService
{
    private readonly IRepository<CareRecord, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public CustomerCareAppService(
        IRepository<CareRecord, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(r => r.BranchId == branchId);
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

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<CareRecordDto> GetAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Create)]
    public async Task<CareRecordDto> CreateAsync(CreateCareRecordDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var record = new CareRecord(
            GuidGenerator.Create(),
            input.PatientId,
            branchId,
            input.Type,
            input.Subject,
            input.AssignedStaffId,
            input.Description,
            input.DueAt);
        await _repository.InsertAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task StartAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        record.Start();
        await _repository.UpdateAsync(record, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task CompleteAsync(Guid id, string resolution)
    {
        var record = await _repository.GetAsync(id);
        record.Complete(resolution);
        await _repository.UpdateAsync(record, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task CancelAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        record.Cancel();
        await _repository.UpdateAsync(record, autoSave: true);
    }
}
