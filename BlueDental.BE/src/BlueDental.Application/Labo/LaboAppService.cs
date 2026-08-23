using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Exporting;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

[Authorize(BlueDentalPermissions.LaboOrders.Default)]
public class LaboAppService : ApplicationService, ILaboAppService
{
    private readonly IRepository<LaboOrder, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public LaboAppService(
        IRepository<LaboOrder, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(o => o.BranchId == branchId);
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

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<LaboStatsDto> GetStatsAsync(GetLaboOrderListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(o => o.BranchId == branchId);

        if (input.PatientId.HasValue)
            query = query.Where(o => o.PatientId == input.PatientId.Value);

        var orders = query.ToList();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        return new LaboStatsDto
        {
            Total = orders.Count,
            New = orders.Count(o => o.Status == LaboStatus.Draft),
            ContinueStage = orders.Count(o => o.Status == LaboStatus.InProgress),
            Guarantee = 0,
            AwaitingReturn = orders.Count(o => o.Status == LaboStatus.Sent),
            Overdue = orders.Count(o => o.Status == LaboStatus.Sent && o.DueDate.HasValue && o.DueDate.Value < today),
            Returned = orders.Count(o => o.Status == LaboStatus.Received || o.Status == LaboStatus.Completed),
        };
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<LaboOrderDto> GetAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Create)]
    public async Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var code = $"LB{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var order = new LaboOrder(
            GuidGenerator.Create(),
            code,
            input.PatientId,
            branchId,
            input.LabProviderName,
            input.EstimatedCost,
            input.DentistId,
            input.ToothNumbers,
            input.WorkDescription,
            input.DueDate);
        await _repository.InsertAsync(order, autoSave: true);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Edit)]
    public async Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input)
    {
        var order = await _repository.GetAsync(id);
        order.Update(input.LabProviderName, input.ToothNumbers, input.WorkDescription,
            input.Notes, input.DueDate, input.EstimatedCost);
        await _repository.UpdateAsync(order, autoSave: true);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task SendAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        order.Send();
        await _repository.UpdateAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task ReceiveAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        order.Receive();
        await _repository.UpdateAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task CompleteAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        order.Complete();
        await _repository.UpdateAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task RejectAsync(Guid id, string reason)
    {
        var order = await _repository.GetAsync(id);
        order.Reject(reason);
        await _repository.UpdateAsync(order, autoSave: true);
    }
    [Authorize]
    public async Task<byte[]> ExportAsync(GetLaboOrderListInput input)
    {
        var page = await GetListAsync(new GetLaboOrderListInput
        {
            BranchId = input.BranchId,
            PatientId = input.PatientId,
            Status = input.Status,
            Kind = input.Kind,
            SampleFilter = input.SampleFilter,
            MaxResultCount = 1000
        });

        return ExcelSheet.Build(
            "Labo",
            "Mẫu Labo",
            new List<ExcelColumn<LaboOrderDto>>
            {
                new("Mã phiếu", row => row.OrderCode, 18),
                new("Khách hàng", row => row.PatientName, 26),
                new("Nhà cung cấp", row => row.LabProviderName, 24),
                new("Răng", row => row.ToothNumbers, 12),
                new("Hẹn trả", row => row.DueDate?.ToDateTime(TimeOnly.MinValue), 14),
                new("Chi phí", row => row.EstimatedCost, 16),
                new("Trạng thái", row => row.Status.ToString(), 16),
                new("Trễ hẹn", row => row.IsOverdue ? "Có" : "Không", 12)
            },
            page.Items);
    }

}
