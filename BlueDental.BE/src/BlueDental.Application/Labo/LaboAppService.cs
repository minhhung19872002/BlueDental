using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

[Authorize]
public class LaboAppService(IRepository<LaboOrder, Guid> repository) : ApplicationService, ILaboAppService
{
    public async Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input)
    {
        var query = await repository.GetQueryableAsync();

        if (input.BranchId.HasValue)
            query = query.Where(o => o.BranchId == input.BranchId.Value);
        if (input.PatientId.HasValue)
            query = query.Where(o => o.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(o => o.Status == input.Status.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(o => o.OrderCode.Contains(input.Filter) || o.LabProviderName.Contains(input.Filter));

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(o => o.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<LaboOrderDto>(
            totalCount,
            ObjectMapper.Map<List<LaboOrder>, List<LaboOrderDto>>(items));
    }

    public async Task<LaboOrderDto> GetAsync(Guid id)
    {
        var order = await repository.GetAsync(id);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    public async Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input)
    {
        var code = $"LB{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var order = new LaboOrder(
            GuidGenerator.Create(),
            code,
            input.PatientId,
            input.BranchId,
            input.LabProviderName,
            input.EstimatedCost,
            input.DentistId,
            input.ToothNumbers,
            input.WorkDescription,
            input.DueDate);
        await repository.InsertAsync(order, autoSave: true);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    public async Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input)
    {
        var order = await repository.GetAsync(id);
        await repository.UpdateAsync(order, autoSave: true);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    public async Task SendAsync(Guid id)
    {
        var order = await repository.GetAsync(id);
        order.Send();
        await repository.UpdateAsync(order, autoSave: true);
    }

    public async Task ReceiveAsync(Guid id)
    {
        var order = await repository.GetAsync(id);
        order.Receive();
        await repository.UpdateAsync(order, autoSave: true);
    }

    public async Task CompleteAsync(Guid id)
    {
        var order = await repository.GetAsync(id);
        order.Complete();
        await repository.UpdateAsync(order, autoSave: true);
    }

    public async Task RejectAsync(Guid id, string reason)
    {
        var order = await repository.GetAsync(id);
        order.Reject(reason);
        await repository.UpdateAsync(order, autoSave: true);
    }
}
