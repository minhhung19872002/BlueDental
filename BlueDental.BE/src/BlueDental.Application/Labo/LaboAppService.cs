using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.Content;
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
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IPatientImageAppService _imageService;

    public LaboAppService(
        IRepository<LaboOrder, Guid> repository,
        IRepository<PatientManagement.Patient, Guid> patientRepository,
        IRepository<LaboSupplier, Guid> supplierRepository,
        IRepository<LaboMaterial, Guid> materialRepository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IPatientImageAppService imageService)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _supplierRepository = supplierRepository;
        _materialRepository = materialRepository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
        _taxonomyRepository = taxonomyRepository;
        _planRepository = planRepository;
        _catalogRepository = catalogRepository;
        _imageService = imageService;
    }

    /// <summary>One service line of a plan, as the child form names it.</summary>
    private sealed record ServiceLineInfo(
        Guid PlanId, string PlanCode, Guid PlanDentistId, Guid ServiceId, TreatmentServiceStatus Status);

    /// <summary>
    /// The service lines a set of orders were raised from, keyed by line id.
    /// Lines live inside the plan aggregate, so this reads the plans that own
    /// them.
    /// </summary>
    private async Task<Dictionary<Guid, ServiceLineInfo>> GetServiceLinesAsync(IReadOnlyCollection<Guid> lineIds)
    {
        var result = new Dictionary<Guid, ServiceLineInfo>();
        if (lineIds.Count == 0)
        {
            return result;
        }

        var planQuery = await _planRepository.WithDetailsAsync(p => p.Services);
        var plans = await AsyncExecuter.ToListAsync(
            planQuery.Where(p => p.Services.Any(s => lineIds.Contains(s.Id))));

        foreach (var plan in plans)
        {
            foreach (var line in plan.Services.Where(s => lineIds.Contains(s.Id)))
            {
                result[line.Id] = new ServiceLineInfo(plan.Id, plan.Code, plan.DentistId, line.ServiceId, line.Status);
            }
        }

        return result;
    }

    /// <summary>
    /// The reference refuses a child order once the service line it hangs off
    /// is done ("Dịch vụ điều trị đã hoàn tất, không thể tạo phiếu Labo.").
    /// An order that names no line has nothing to check.
    /// </summary>
    private async Task EnsureServiceLineOpenAsync(Guid? treatmentServiceId)
    {
        if (!treatmentServiceId.HasValue)
        {
            return;
        }

        var lines = await GetServiceLinesAsync([treatmentServiceId.Value]);
        if (lines.TryGetValue(treatmentServiceId.Value, out var line) &&
            line.Status == TreatmentServiceStatus.Done)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.TreatmentServiceCompleted);
        }
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
        var materials = new Dictionary<Guid, LaboMaterial>();
        if (materialIds.Count > 0)
        {
            var materialQuery = await _materialRepository.GetQueryableAsync();
            materials = (await AsyncExecuter.ToListAsync(
                    materialQuery.Where(m => materialIds.Contains(m.Id))))
                .ToDictionary(m => m.Id);
        }

        // Khớp cắn, Đường hoàn tất and Kiểu nhịp are taxonomy rows, and so is
        // the labo service a material belongs to ("Dịch vụ hiện tại").
        var taxonomyIds = entities
            .SelectMany(o => new[] { o.BiteId, o.FinishLineId, o.RhythmId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Concat(materials.Values.Select(m => m.TaxonomyId))
            .Distinct()
            .ToList();
        var taxonomies = new Dictionary<Guid, string>();
        if (taxonomyIds.Count > 0)
        {
            var taxonomyQuery = await _taxonomyRepository.GetQueryableAsync();
            taxonomies = (await AsyncExecuter.ToListAsync(
                    taxonomyQuery.Where(t => taxonomyIds.Contains(t.Id))))
                .ToDictionary(t => t.Id, t => t.Name);
        }

        var lineIds = entities
            .Where(o => o.TreatmentServiceId.HasValue)
            .Select(o => o.TreatmentServiceId!.Value)
            .Distinct()
            .ToList();
        var lines = await GetServiceLinesAsync(lineIds);

        // A plan line's ServiceId is a Danh mục "Dịch vụ" row (CatalogEntry),
        // the same catalog the treatment-plan API names its lines from.
        var serviceIds = lines.Values.Select(l => l.ServiceId).Distinct().ToList();
        var services = new Dictionary<Guid, string>();
        if (serviceIds.Count > 0)
        {
            var catalogQuery = await _catalogRepository.GetQueryableAsync();
            services = (await AsyncExecuter.ToListAsync(
                    catalogQuery.Where(x => serviceIds.Contains(x.Id))))
                .ToDictionary(x => x.Id, x => x.Name);
        }

        var planDentistIds = lines.Values.Select(l => l.PlanDentistId)
            .Where(id => !dentists.ContainsKey(id))
            .Distinct()
            .ToList();
        if (planDentistIds.Count > 0)
        {
            foreach (var user in await _userRepository.GetListByIdsAsync(planDentistIds))
            {
                dentists[user.Id] = user.Name ?? user.UserName;
            }
        }

        for (var i = 0; i < entities.Count; i++)
        {
            var entity = entities[i];
            var dto = dtos[i];

            dto.BiteName = entity.BiteId.HasValue ? taxonomies.GetValueOrDefault(entity.BiteId.Value) : null;
            dto.FinishLineName = entity.FinishLineId.HasValue ? taxonomies.GetValueOrDefault(entity.FinishLineId.Value) : null;
            dto.RhythmName = entity.RhythmId.HasValue ? taxonomies.GetValueOrDefault(entity.RhythmId.Value) : null;

            if (entity.TreatmentServiceId.HasValue &&
                lines.TryGetValue(entity.TreatmentServiceId.Value, out var line))
            {
                dto.TreatmentPlanId = line.PlanId;
                dto.TreatmentPlanCode = line.PlanCode;
                dto.TreatmentPlanDentistName = dentists.GetValueOrDefault(line.PlanDentistId);
                dto.TreatmentServiceName = services.GetValueOrDefault(line.ServiceId);
                dto.TreatmentServiceStatus = line.Status;
            }

            dto.PatientName = patients.GetValueOrDefault(entity.PatientId);
            dto.DentistName = entity.DentistId.HasValue
                ? dentists.GetValueOrDefault(entity.DentistId.Value)
                : null;
            // The lab is a record where one was picked, and free text on the
            // older orders that only ever carried a name.
            dto.SupplierName = entity.SupplierId.HasValue
                ? suppliers.GetValueOrDefault(entity.SupplierId.Value)
                : null;
            var material = entity.MaterialId.HasValue
                ? materials.GetValueOrDefault(entity.MaterialId.Value)
                : null;
            dto.MaterialName = material?.Name;
            dto.LaboServiceName = material is null ? null : taxonomies.GetValueOrDefault(material.TaxonomyId);
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
        if (input.Kind.HasValue)
            query = query.Where(o => o.Kind == input.Kind.Value);
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
        if (input.Kind != LaboOrderKind.New)
        {
            return await CreateChildAsync(input, branchId);
        }

        var code = await ResolveOrderCodeAsync(input.OrderCode);
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
            input.RhythmId,
            input.Notes,
            input.SentAt,
            input.ToothShade,
            input.Quantity,
            input.TreatmentServiceId,
            input.TreatmentStageId);
        await _repository.InsertAsync(order, autoSave: true);
        await AttachPicturesAsync(order, input.Pictures);
        return ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
    }

    /// <summary>
    /// The dialog's Tải ảnh pictures go to the patient's Hình ảnh, under the
    /// plan that owns the order's service line and the công đoạn it was raised
    /// from — the same place the two-request flow used to put them, but now
    /// inside the order's own unit of work. The image service applies its own
    /// permission and branch checks.
    /// </summary>
    private async Task AttachPicturesAsync(LaboOrder order, List<IRemoteStreamContent>? pictures)
    {
        if (pictures is not { Count: > 0 })
        {
            return;
        }

        Guid? planId = null;
        if (order.TreatmentServiceId.HasValue)
        {
            var lines = await GetServiceLinesAsync([order.TreatmentServiceId.Value]);
            planId = lines.TryGetValue(order.TreatmentServiceId.Value, out var line) ? line.PlanId : null;
        }

        foreach (var picture in pictures)
        {
            await _imageService.UploadAsync(new UploadPatientImageDto
            {
                PatientId = order.PatientId,
                ClinicBranchId = order.BranchId,
                TreatmentPlanId = planId,
                TreatmentStageId = order.TreatmentStageId,
                File = picture,
            });
        }
    }

    /// <summary>
    /// Làm tiếp công đoạn / Bảo hành. The parent is read inside the caller's
    /// branch, so an order from another clinic is simply "not found".
    /// </summary>
    private async Task<LaboOrderDto> CreateChildAsync(CreateLaboOrderDto input, Guid branchId)
    {
        if (!input.ParentOrderId.HasValue)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ParentRequired);
        }

        var parent = await _repository.FirstOrDefaultAsync(
            o => o.Id == input.ParentOrderId.Value && o.BranchId == branchId)
            ?? throw new BusinessException(BlueDentalDomainErrorCodes.Labo.OrderNotFound);

        await EnsureServiceLineOpenAsync(parent.TreatmentServiceId);

        var order = LaboOrder.CreateChild(
            GuidGenerator.Create(),
            parent,
            input.Kind,
            input.PatientId,
            branchId,
            input.LabProviderName,
            input.MaterialId,
            input.DentistId,
            input.ToothNumbers,
            input.DueDate,
            input.SupplierId,
            input.BiteId,
            input.FinishLineId,
            input.RhythmId,
            input.Notes,
            input.SentAt,
            input.ToothShade,
            input.Quantity,
            input.EstimatedCost);
        await _repository.InsertAsync(order, autoSave: true);
        await AttachPicturesAsync(order, input.Pictures);

        var dto = ObjectMapper.Map<LaboOrder, LaboOrderDto>(order);
        await FillNamesAsync([order], [dto]);
        return dto;
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Create)]
    public async Task<string> GetNextOrderCodeAsync()
    {
        _branchResolver.GetRequiredClinicBranchId();
        return await NextOrderCodeAsync();
    }

    /// <summary>
    /// The dialog shows the code the server handed out when it opened, locked.
    /// By the time Lưu is pressed another user may have taken it, so a taken
    /// code is swapped for the next free one instead of surfacing the unique
    /// index as a 500. A blank code is simply the next free one.
    /// </summary>
    private async Task<string> ResolveOrderCodeAsync(string? requested)
    {
        var code = requested?.Trim();
        if (code.IsNullOrWhiteSpace())
        {
            return await NextOrderCodeAsync();
        }

        var query = await _repository.GetQueryableAsync();
        var taken = await AsyncExecuter.AnyAsync(
            query.Where(x => x.ParentOrderId == null && x.OrderCode == code));
        return taken ? await NextOrderCodeAsync() : code!;
    }

    /// <summary>
    /// "LABO-" + the day + a per-day sequence, the shape the reference shows
    /// ("LABO-202609061"). The sequence runs across branches because the code
    /// is unique across the whole table (IX_bd_labo_orders_OrderCode), so a
    /// second clinic's first sample of the day must not repeat the first's.
    /// </summary>
    private async Task<string> NextOrderCodeAsync()
    {
        var prefix = $"LABO-{DateTime.UtcNow:yyyyMMdd}";
        var query = await _repository.GetQueryableAsync();
        var used = await AsyncExecuter.ToListAsync(query
            .Where(x => x.ParentOrderId == null && x.OrderCode.StartsWith(prefix))
            .Select(x => x.OrderCode));

        var next = 1;
        while (used.Contains($"{prefix}{next}"))
        {
            next++;
        }

        return $"{prefix}{next}";
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
