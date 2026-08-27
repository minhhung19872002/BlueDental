using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using Volo.Abp.Identity;
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
    private readonly IRepository<PatientManagement.Patient, Guid> _patientRepository;
    private readonly IRepository<LaboSupplier, Guid> _supplierRepository;
    private readonly IRepository<LaboMaterial, Guid> _materialRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public LaboAppService(
        IRepository<LaboOrder, Guid> repository,
        IRepository<PatientManagement.Patient, Guid> patientRepository,
        IRepository<LaboSupplier, Guid> supplierRepository,
        IRepository<LaboMaterial, Guid> materialRepository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _supplierRepository = supplierRepository;
        _materialRepository = materialRepository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
    }

    /// <summary>
    /// An order stores ids, but the table shows names — the customer, the
    /// dentist who ordered it, the lab and the material. Without this the
    /// columns read "—" on every row even while the filters above them work,
    /// because those filter by id.
    ///
    /// Resolved in one read per kind rather than one per row.
    /// </summary>
    private async Task FillNamesAsync(
        IReadOnlyList<LaboOrder> entities,
        IReadOnlyList<LaboOrderDto> dtos)
    {
        if (entities.Count == 0)
        {
            return;
        }

        var patientIds = entities.Select(o => o.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = (await AsyncExecuter.ToListAsync(
                patientQuery.Where(p => patientIds.Contains(p.Id))))
            .ToDictionary(p => p.Id, p => (p.LastName + " " + p.FirstName).Trim());

        var dentistIds = entities
            .Where(o => o.DentistId.HasValue)
            .Select(o => o.DentistId!.Value)
            .Distinct()
            .ToList();
        var dentists = dentistIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _userRepository.GetListByIdsAsync(dentistIds))
                .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var supplierIds = entities
            .Where(o => o.SupplierId.HasValue)
            .Select(o => o.SupplierId!.Value)
            .Distinct()
            .ToList();
        var suppliers = new Dictionary<Guid, string>();
        if (supplierIds.Count > 0)
        {
            var supplierQuery = await _supplierRepository.GetQueryableAsync();
            suppliers = (await AsyncExecuter.ToListAsync(
                    supplierQuery.Where(s => supplierIds.Contains(s.Id))))
                .ToDictionary(s => s.Id, s => s.Name);
        }

        var materialIds = entities
            .Where(o => o.MaterialId.HasValue)
            .Select(o => o.MaterialId!.Value)
            .Distinct()
            .ToList();
        var materials = new Dictionary<Guid, string>();
        if (materialIds.Count > 0)
        {
            var materialQuery = await _materialRepository.GetQueryableAsync();
            materials = (await AsyncExecuter.ToListAsync(
                    materialQuery.Where(m => materialIds.Contains(m.Id))))
                .ToDictionary(m => m.Id, m => m.Name);
        }

        for (var i = 0; i < entities.Count; i++)
        {
            var entity = entities[i];
            var dto = dtos[i];

            dto.PatientName = patients.GetValueOrDefault(entity.PatientId);
            dto.DentistName = entity.DentistId.HasValue
                ? dentists.GetValueOrDefault(entity.DentistId.Value)
                : null;
            // The lab is a record where one was picked, and free text on the
            // older orders that only ever carried a name.
            dto.SupplierName = entity.SupplierId.HasValue
                ? suppliers.GetValueOrDefault(entity.SupplierId.Value)
                : null;
            dto.MaterialName = entity.MaterialId.HasValue
                ? materials.GetValueOrDefault(entity.MaterialId.Value)
                : null;
        }
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(o => o.BranchId == branchId);
        if (input.PatientId.HasValue)
            query = query.Where(o => o.PatientId == input.PatientId.Value);
        if (input.DentistId.HasValue)
            query = query.Where(o => o.DentistId == input.DentistId.Value);
        if (input.Status.HasValue)
            query = query.Where(o => o.Status == input.Status.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(o => o.OrderCode.Contains(input.Filter) || o.LabProviderName.Contains(input.Filter));

        // The window is named in whole days, so the upper bound covers all of
        // the day it names rather than stopping at its midnight.
        if (input.FromDate.HasValue)
        {
            var from = input.FromDate.Value.ToDateTime(TimeOnly.MinValue);
            query = query.Where(o => o.CreationTime >= from);
        }

        if (input.ToDate.HasValue)
        {
            var toExclusive = input.ToDate.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
            query = query.Where(o => o.CreationTime < toExclusive);
        }

        var today = DateOnly.FromDateTime(Clock.Now);
        query = ApplySampleFilter(query, input.SampleFilter, today);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(o => o.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = ObjectMapper.Map<List<LaboOrder>, List<LaboOrderDto>>(items);
        await FillNamesAsync(items, dtos);
        for (var i = 0; i < items.Count; i++)
        {
            dtos[i].IsAwaitingReturn = IsAwaitingReturn(items[i]);
            dtos[i].IsOverdue = IsOverdue(items[i], today);
        }

        return new PagedResultDto<LaboOrderDto>(totalCount, dtos);
    }

    /// <summary>
    /// The four chips above the Mẫu Labo table.
    ///
    /// The reference sends one status code per chip because it keeps a status
    /// for "giao trễ"; BlueDental works it out from the due date instead, so
    /// the chip — not a status — is what the client sends.
    /// </summary>
    private static IQueryable<LaboOrder> ApplySampleFilter(
        IQueryable<LaboOrder> query,
        LaboSampleFilter? filter,
        DateOnly today)
        => filter switch
        {
            LaboSampleFilter.AwaitingReturn =>
                query.Where(o => o.Status == LaboStatus.Sent || o.Status == LaboStatus.InProgress),
            LaboSampleFilter.Overdue =>
                query.Where(o =>
                    (o.Status == LaboStatus.Sent || o.Status == LaboStatus.InProgress) &&
                    o.DueDate != null && o.DueDate < today),
            LaboSampleFilter.Returned =>
                query.Where(o => o.Status == LaboStatus.Received || o.Status == LaboStatus.Completed),
            _ => query
        };

    /// <summary>Sent to the lab and not back yet.</summary>
    private static bool IsAwaitingReturn(LaboOrder order)
        => order.Status is LaboStatus.Sent or LaboStatus.InProgress;

    /// <summary>Still out, and the day it was due has passed.</summary>
    private static bool IsOverdue(LaboOrder order, DateOnly today)
        => IsAwaitingReturn(order) && order.DueDate.HasValue && order.DueDate.Value < today;

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<LaboStatsDto> GetStatsAsync(GetLaboOrderListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(o => o.BranchId == branchId);

        if (input.PatientId.HasValue)
            query = query.Where(o => o.PatientId == input.PatientId.Value);

        var orders = query.ToList();
        // The counters and the chips above the table have to agree, so both
        // read "chưa nhận" and "giao trễ" from the same two rules.
        var today = DateOnly.FromDateTime(Clock.Now);

        return new LaboStatsDto
        {
            Total = orders.Count,
            New = orders.Count(o => o.Kind == LaboOrderKind.New),
            ContinueStage = orders.Count(o => o.Kind == LaboOrderKind.ContinueStage),
            Guarantee = orders.Count(o => o.Kind == LaboOrderKind.Guarantee),
            AwaitingReturn = orders.Count(IsAwaitingReturn),
            Overdue = orders.Count(o => IsOverdue(o, today)),
            Returned = orders.Count(o => o.Status == LaboStatus.Received || o.Status == LaboStatus.Completed),
        };
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<LaboOrderDto> GetAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        var dto = ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
        await FillNamesAsync([order], [dto]);
        return dto;
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
            input.DueDate,
            input.Kind,
            input.SupplierId,
            input.MaterialId,
            input.BiteId,
            input.FinishLineId,
            input.RhythmId);
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
