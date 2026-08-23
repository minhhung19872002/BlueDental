using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Exporting;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Labo;

/// <summary>
/// Mẫu Labo — reference: <c>/api/v1/orders</c> for the clinic-wide list and
/// <c>/api/v1/clinic-orders</c> on the patient tab.
/// </summary>
[Authorize]
public class LaboAppService : ApplicationService, ILaboAppService
{
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

    private readonly IRepository<LaboOrder, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public LaboAppService(
        IRepository<LaboOrder, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Read)]
    public async Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input)
    {
        var items = await QueryAsync(input);

        var page = items
            .OrderByDescending(o => o.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var lookups = await BuildLookupsAsync(page);
        return new PagedResultDto<LaboOrderDto>(items.Count, page.Select(x => MapToDto(x, lookups)).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Read)]
    public async Task<LaboStatsDto> GetStatsAsync(GetLaboOrderListInput input)
    {
        // Counters describe the whole set, so they ignore the chip filter.
        var previousFilter = input.SampleFilter;
        input.SampleFilter = null;
        var items = await QueryAsync(input);
        input.SampleFilter = previousFilter;
        var today = Today();

        return new LaboStatsDto
        {
            Total = items.Count,
            New = items.Count(x => x.Kind == LaboOrderKind.New),
            ContinueStage = items.Count(x => x.Kind == LaboOrderKind.ContinueStage),
            Guarantee = items.Count(x => x.Kind == LaboOrderKind.Guarantee),
            AwaitingReturn = items.Count(x => x.IsAwaitingReturn),
            Overdue = items.Count(x => x.IsOverdueAsOf(today)),
            Returned = items.Count(x => x.IsReturned)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Read)]
    public async Task<LaboOrderDto> GetAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(order.BranchId);
        return MapToDto(order, await BuildLookupsAsync([order]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Create)]
    public async Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input)
    {
        await _branchAccess.CheckAsync(input.BranchId);

        var order = new LaboOrder(
            GuidGenerator.Create(),
            await GenerateOrderCodeAsync(input.BranchId),
            input.PatientId,
            input.BranchId,
            input.LabProviderName,
            input.EstimatedCost,
            input.DentistId,
            input.ToothNumbers,
            input.WorkDescription,
            input.DueDate);

        order.SetKind(input.Kind);
        order.SetCatalogSelections(
            input.SupplierId,
            input.MaterialId,
            input.BiteId,
            input.FinishLineId,
            input.RhythmId);

        await _repository.InsertAsync(order, autoSave: true);
        return MapToDto(order, await BuildLookupsAsync([order]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Update)]
    public async Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input)
    {
        var order = await LoadForWriteAsync(id);
        await _repository.UpdateAsync(order, autoSave: true);
        return MapToDto(order, await BuildLookupsAsync([order]));
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Update)]
    public async Task SendAsync(Guid id)
    {
        var order = await LoadForWriteAsync(id);
        order.Send();
        await _repository.UpdateAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Update)]
    public async Task ReceiveAsync(Guid id)
    {
        var order = await LoadForWriteAsync(id);
        order.Receive();
        await _repository.UpdateAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Update)]
    public async Task CompleteAsync(Guid id)
    {
        var order = await LoadForWriteAsync(id);
        order.Complete();
        await _repository.UpdateAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Update)]
    public async Task RejectAsync(Guid id, string reason)
    {
        var order = await LoadForWriteAsync(id);
        order.Reject(reason);
        await _repository.UpdateAsync(order, autoSave: true);
    }

    private async Task<LaboOrder> LoadForWriteAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(order.BranchId);
        return order;
    }

    /// <summary>
    /// The chip filters (chưa nhận / giao trễ / đã nhận hàng) are derived from
    /// dates and status, so they are applied after the database has narrowed the
    /// set as far as it can.
    /// </summary>
    private async Task<List<LaboOrder>> QueryAsync(GetLaboOrderListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(o => branchFilter.Contains(o.BranchId));
        if (input.PatientId.HasValue)
            query = query.Where(o => o.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(o => o.Status == input.Status.Value);
        if (input.Kind.HasValue)
            query = query.Where(o => o.Kind == input.Kind.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(o => o.OrderCode.Contains(filter) || o.LabProviderName.Contains(filter));
        }

        var items = query.ToList();
        var today = Today();

        return input.SampleFilter switch
        {
            LaboSampleFilter.AwaitingReturn => items.Where(x => x.IsAwaitingReturn).ToList(),
            LaboSampleFilter.Overdue => items.Where(x => x.IsOverdueAsOf(today)).ToList(),
            LaboSampleFilter.Returned => items.Where(x => x.IsReturned).ToList(),
            _ => items
        };
    }

    /// <summary>Sequential per-branch, per-year code — e.g. <c>LB26-0004</c>.</summary>
    private async Task<string> GenerateOrderCodeAsync(Guid branchId)
    {
        var year = Clock.Now.Year;
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x => x.BranchId == branchId && x.CreationTime.Year == year) + 1;

        var code = $"LB{year % 100:D2}-{sequence:D4}";
        while (query.Any(x => x.OrderCode == code))
        {
            sequence++;
            code = $"LB{year % 100:D2}-{sequence:D4}";
        }

        return code;
    }

    private DateOnly Today() => DateOnly.FromDateTime(Clock.Now);

    private sealed record LaboLookups(
        IReadOnlyDictionary<Guid, string> Patients,
        IReadOnlyDictionary<Guid, string> Catalog,
        IReadOnlyDictionary<Guid, string> Staff);

    private async Task<LaboLookups> BuildLookupsAsync(IReadOnlyCollection<LaboOrder> orders)
    {
        var patientIds = orders.Select(x => x.PatientId).Distinct().ToList();
        var catalogIds = orders
            .SelectMany(x => new[] { x.SupplierId, x.MaterialId, x.BiteId, x.FinishLineId, x.RhythmId })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        var staffIds = orders
            .Where(x => x.DentistId.HasValue)
            .Select(x => x.DentistId!.Value)
            .Distinct()
            .ToList();

        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery
            .Where(p => patientIds.Contains(p.Id))
            .ToDictionary(p => p.Id, p => $"{p.LastName} {p.FirstName}".Trim());

        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var catalog = catalogIds.Count == 0
            ? new Dictionary<Guid, string>()
            : catalogQuery.Where(c => catalogIds.Contains(c.Id)).ToDictionary(c => c.Id, c => c.Name);

        var users = staffIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(staffIds);

        return new LaboLookups(
            patients,
            catalog,
            users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName));
    }

    private LaboOrderDto MapToDto(LaboOrder entity, LaboLookups lookups)
    {
        var today = Today();

        string? catalogName(Guid? id) =>
            id.HasValue && lookups.Catalog.TryGetValue(id.Value, out var name) ? name : null;

        return new LaboOrderDto
        {
            Id = entity.Id,
            OrderCode = entity.OrderCode,
            PatientId = entity.PatientId,
            BranchId = entity.BranchId,
            DentistId = entity.DentistId,
            LabProviderName = entity.LabProviderName,
            Status = entity.Status,
            ToothNumbers = entity.ToothNumbers,
            WorkDescription = entity.WorkDescription,
            Notes = entity.Notes,
            DueDate = entity.DueDate,
            SentAt = entity.SentAt,
            ReceivedAt = entity.ReceivedAt,
            EstimatedCost = entity.EstimatedCost,
            RejectionReason = entity.RejectionReason,
            Kind = entity.Kind,
            SupplierId = entity.SupplierId,
            MaterialId = entity.MaterialId,
            BiteId = entity.BiteId,
            FinishLineId = entity.FinishLineId,
            RhythmId = entity.RhythmId,
            AttachmentUrl = entity.AttachmentUrl,
            IsOverdue = entity.IsOverdueAsOf(today),
            IsAwaitingReturn = entity.IsAwaitingReturn,
            PatientName = lookups.Patients.TryGetValue(entity.PatientId, out var patient) ? patient : null,
            SupplierName = catalogName(entity.SupplierId),
            MaterialName = catalogName(entity.MaterialId),
            DentistName = entity.DentistId.HasValue && lookups.Staff.TryGetValue(entity.DentistId.Value, out var dentist)
                ? dentist
                : null,
            CreationTime = entity.CreationTime,
            CreatorId = entity.CreatorId,
            LastModificationTime = entity.LastModificationTime,
            LastModifierId = entity.LastModifierId
        };
    }
}
