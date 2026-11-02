using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Staff;
using BlueDental.PatientManagement;
using BlueDental.TreatmentManagement;
using Volo.Abp;
using Volo.Abp.BlobStoring;
using Volo.Abp.Content;
using Volo.Abp.Data;
using Volo.Abp.Identity;
using BlueDental.Exporting;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Labo;

/// <summary>
/// Phiếu Labo and the P2910_03 workflow. The order's own rules live on the
/// <see cref="LaboOrder"/> aggregate; this service reads the branch, resolves
/// names and keeps the pictures with the order they belong to.
/// </summary>
[Authorize(BlueDentalPermissions.LaboOrders.Default)]
public class LaboAppService : BlueDentalAppService, ILaboAppService
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
    private readonly IRepository<PatientImage, Guid> _imageRepository;
    private readonly IBlobContainer _blobContainer;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;

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
        IPatientImageAppService imageService,
        IRepository<PatientImage, Guid> imageRepository,
        IBlobContainer blobContainer,
        BranchAccessChecker branchAccess,
        IRepository<TreatmentStage, Guid> stageRepository)
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
        _imageRepository = imageRepository;
        _blobContainer = blobContainer;
        _branchAccess = branchAccess;
        _stageRepository = stageRepository;
    }

    /// <summary>One service line of a plan, as the order form names it.</summary>
    private sealed record ServiceLineInfo(
        Guid PlanId, string PlanCode, Guid PlanDentistId, Guid PatientId, Guid ServiceId, TreatmentServiceStatus Status,
        string LineCode);

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
                result[line.Id] = new ServiceLineInfo(
                    plan.Id, plan.Code, plan.DentistId, plan.PatientId, line.ServiceId, line.Status, line.Code);
            }
        }

        return result;
    }

    /// <summary>
    /// Dịch vụ điều trị has to be one of this customer's lines, and still
    /// open ("Dịch vụ điều trị đã hoàn tất, không thể tạo phiếu Labo."). A
    /// draft that names no line yet has nothing to check.
    /// </summary>
    private async Task EnsureServiceLineOpenAsync(Guid patientId, Guid? treatmentServiceId)
    {
        if (!treatmentServiceId.HasValue)
        {
            return;
        }

        var lines = await GetServiceLinesAsync([treatmentServiceId.Value]);
        if (!lines.TryGetValue(treatmentServiceId.Value, out var line) || line.PatientId != patientId)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.TreatmentServiceMismatch);
        }

        if (line.Status == TreatmentServiceStatus.Done)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.TreatmentServiceCompleted);
        }
    }

    /// <summary>
    /// "Tạo Labo" is frozen on a công đoạn older than its line's newest
    /// "Ngày điều trị" (BA 2026-11-02) — see <see cref="StageDateLock"/>.
    /// </summary>
    private async Task EnsureStageNotDateLockedAsync(Guid? stageId)
    {
        if (!stageId.HasValue)
        {
            return;
        }

        var stage = await _stageRepository.FindAsync(stageId.Value);
        if (stage is null)
        {
            return;
        }

        var lineStages = await _stageRepository.GetListAsync(x => x.TreatmentServiceId == stage.TreatmentServiceId);
        if (StageDateLock.IsLocked(stage, lineStages))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.StageDateLocked);
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
        // The whole record: the Mẫu Labo screen links the row to the patient by
        // code and prints the sheet with the date of birth.
        var patients = (await AsyncExecuter.ToListAsync(
                patientQuery.Where(p => patientIds.Contains(p.Id))))
            .ToDictionary(p => p.Id);

        var dentistIds = entities
            .Where(o => o.DentistId.HasValue)
            .Select(o => o.DentistId!.Value)
            .Distinct()
            .ToList();
        var dentistUsers = dentistIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(dentistIds);
        var dentists = dentistUsers.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
        var dentistJobTitles = StaffJobTitles.Of(dentistUsers);

        var supplierIds = entities
            .Where(o => o.SupplierId.HasValue)
            .Select(o => o.SupplierId!.Value)
            .Distinct()
            .ToList();
        var suppliers = new Dictionary<Guid, LaboSupplier>();
        if (supplierIds.Count > 0)
        {
            var supplierQuery = await _supplierRepository.GetQueryableAsync();
            suppliers = (await AsyncExecuter.ToListAsync(
                    supplierQuery.Where(s => supplierIds.Contains(s.Id))))
                .ToDictionary(s => s.Id);
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
        // the labo service a material belongs to ("BE:LaboField:CurrentService").
        var taxonomyIds = entities
            .SelectMany(o => new[] { o.BiteId, o.FinishLineId, o.RhythmId }
                .Concat(o.Teeth.SelectMany(t => new[] { t.BiteId, t.FinishLineId, t.RhythmId })))
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

        // A plan line's ServiceId is a Danh mục "BE:Common:Service" row (CatalogEntry),
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

        // The plan's doctor and whoever saved each Nhận hàng are named the
        // same way the ordering dentist is.
        var otherUserIds = lines.Values.Select(l => l.PlanDentistId)
            .Concat(entities.SelectMany(o => o.Rounds)
                .Where(r => r.ReceiverId.HasValue)
                .Select(r => r.ReceiverId!.Value))
            .Where(id => !dentists.ContainsKey(id))
            .Distinct()
            .ToList();
        if (otherUserIds.Count > 0)
        {
            foreach (var user in await _userRepository.GetListByIdsAsync(otherUserIds))
            {
                dentists[user.Id] = user.Name ?? user.UserName;
            }
        }

        var images = await GetImagesAsync(entities.Select(o => o.Id).Distinct().ToList());
        var today = ClinicToday();

        for (var i = 0; i < entities.Count; i++)
        {
            var entity = entities[i];
            var dto = dtos[i];

            dto.BiteName = entity.BiteId.HasValue ? taxonomies.GetValueOrDefault(entity.BiteId.Value) : null;
            dto.FinishLineName = entity.FinishLineId.HasValue ? taxonomies.GetValueOrDefault(entity.FinishLineId.Value) : null;
            dto.RhythmName = entity.RhythmId.HasValue ? taxonomies.GetValueOrDefault(entity.RhythmId.Value) : null;
            foreach (var tooth in dto.Teeth)
            {
                tooth.BiteName = tooth.BiteId.HasValue ? taxonomies.GetValueOrDefault(tooth.BiteId.Value) : null;
                tooth.FinishLineName = tooth.FinishLineId.HasValue ? taxonomies.GetValueOrDefault(tooth.FinishLineId.Value) : null;
                tooth.RhythmName = tooth.RhythmId.HasValue ? taxonomies.GetValueOrDefault(tooth.RhythmId.Value) : null;
            }

            if (entity.TreatmentServiceId.HasValue &&
                lines.TryGetValue(entity.TreatmentServiceId.Value, out var line))
            {
                dto.TreatmentPlanId = line.PlanId;
                dto.TreatmentPlanCode = line.PlanCode;
                dto.TreatmentPlanDentistName = dentists.GetValueOrDefault(line.PlanDentistId);
                dto.TreatmentServiceName = services.GetValueOrDefault(line.ServiceId);
                dto.TreatmentServiceStatus = line.Status;
            }

            var patient = patients.GetValueOrDefault(entity.PatientId);
            dto.PatientName = patient?.FullName;
            dto.PatientCode = patient?.PatientCode;
            dto.PatientDateOfBirth = patient?.DateOfBirth;
            dto.DentistName = entity.DentistId.HasValue
                ? dentists.GetValueOrDefault(entity.DentistId.Value)
                : null;
            dto.DentistJobTitle = StaffJobTitles.Lookup(dentistJobTitles, entity.DentistId);
            // The lab is a record where one was picked, and free text on the
            // older orders that only ever carried a name.
            var supplier = entity.SupplierId.HasValue
                ? suppliers.GetValueOrDefault(entity.SupplierId.Value)
                : null;
            dto.SupplierName = supplier?.Name;
            dto.SupplierLabelColor = supplier?.LabelColor;
            var material = entity.MaterialId.HasValue
                ? materials.GetValueOrDefault(entity.MaterialId.Value)
                : null;
            dto.MaterialName = material?.Name;
            dto.LaboServiceName = material is null ? null : taxonomies.GetValueOrDefault(material.TaxonomyId);
            dto.LaboServiceId = material?.TaxonomyId;
            dto.Images = images.GetValueOrDefault(entity.Id) ?? [];

            FillWorkflow(entity, dto, today);
            foreach (var round in dto.Rounds.Where(r => r.ReceiverId.HasValue))
            {
                round.ReceiverName = dentists.GetValueOrDefault(round.ReceiverId!.Value);
            }
        }
    }

    /// <summary>
    /// What the workflow reads off the order on the clinic's today: the due
    /// tags, Hết hạn bảo hành and each card's expiry. Never stored.
    /// </summary>
    private static void FillWorkflow(LaboOrder entity, LaboOrderDto dto, DateOnly today)
    {
        dto.IsAwaitingReturn = IsAtLab(entity);
        dto.IsOverdue = IsOverdueOn(entity, today);
        dto.IsWarrantyExpired = entity.IsWarrantyExpiredOn(today);
        dto.ReturnCount = entity.ReturnCount;
        dto.Teeth = dto.Teeth.OrderBy(t => t.ToothNumber).ToList();
        dto.Rounds = dto.Rounds.OrderBy(r => r.RoundNo).ToList();
        foreach (var tooth in dto.Teeth)
        {
            tooth.ReturnCount = entity.ToothReturnCount(tooth.ToothNumber);
            tooth.IsWarrantyExpired = tooth.WarrantyActivatedAt.HasValue && tooth.WarrantyEndDate < today;
        }
    }

    private static DateOnly ClinicToday() => ClinicCalendar.DateOf(DateTimeOffset.UtcNow);

    /// <summary>
    /// The pictures of each order, oldest first, keyed by order: those sent to
    /// the lab and each round's Ảnh kiểm tra. The URL is the one the image
    /// service serves the bytes at.
    /// </summary>
    private async Task<Dictionary<Guid, List<LaboOrderImageDto>>> GetImagesAsync(IReadOnlyList<Guid> orderIds)
    {
        var query = await _imageRepository.GetQueryableAsync();
        var images = await AsyncExecuter.ToListAsync(
            query.Where(x => x.LaboOrderId.HasValue && orderIds.Contains(x.LaboOrderId.Value))
                .OrderBy(x => x.CreationTime)
                .Select(x => new { x.Id, x.FileName, OrderId = x.LaboOrderId!.Value, x.LaboRoundNo, x.LaboToothNumber, x.WarrantyCardSide }));
        return images
            .GroupBy(x => x.OrderId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => new LaboOrderImageDto
                {
                    Id = x.Id,
                    FileName = x.FileName,
                    Url = $"/api/v1/app/patient-images/{x.Id}/content",
                    RoundNo = x.LaboRoundNo,
                    ToothNumber = x.LaboToothNumber,
                    WarrantyCardSide = x.WarrantyCardSide,
                }).ToList());
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
        if (input.TreatmentPlanId.HasValue)
        {
            // An order names its line, not its plan: the plan's lines are read first.
            var planId = input.TreatmentPlanId.Value;
            var lineIds = await AsyncExecuter.ToListAsync((await _planRepository.GetQueryableAsync())
                .Where(p => p.Id == planId)
                .SelectMany(p => p.Services.Select(s => s.Id)));
            query = query.Where(o => o.TreatmentServiceId.HasValue && lineIds.Contains(o.TreatmentServiceId.Value));
        }
        if (input.Kind.HasValue)
            query = query.Where(o => o.Kind == input.Kind.Value);
        if (input.Status.HasValue)
            query = query.Where(o => o.Status == input.Status.Value);
        foreach (var term in SearchTerms.From(input.Filter))
            query = query.Where(o => o.OrderCode.ToLower().Contains(term) || DbText.Unaccent(o.LabProviderName.ToLower()).Contains(DbText.Unaccent(term)));

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

        var today = ClinicToday();
        query = ApplySampleFilter(query, input.SampleFilter, today);
        query = ApplyStatusFilter(query, input.StatusFilter, today);

        // Paged on the bare rows, then read with their teeth and rounds: a
        // page taken over the joined collections would count tooth rows.
        var totalCount = await AsyncExecuter.CountAsync(query);
        var ids = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(o => o.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .Select(o => o.Id));

        var detailed = await _repository.WithDetailsAsync();
        var loaded = (await AsyncExecuter.ToListAsync(detailed.Where(o => ids.Contains(o.Id))))
            .ToDictionary(o => o.Id);
        var items = ids.Select(id => loaded[id]).ToList();

        return new PagedResultDto<LaboOrderDto>(totalCount, await ToDtosAsync(items));
    }

    /// <summary>
    /// The three chips above the Mẫu Labo table, read off the P2910_03
    /// statuses: "chưa nhận" is at the lab and not yet due, "giao trễ" is at
    /// the lab past the day it was due (worked out from the date — owner,
    /// 2026-10-30), "đã nhận" has come back at least once. Draft and
    /// cancelled orders appear under Tất cả only.
    /// </summary>
    private static IQueryable<LaboOrder> ApplySampleFilter(
        IQueryable<LaboOrder> query,
        LaboSampleFilter? filter,
        DateOnly today)
    {
        var startOfToday = ClinicCalendar.StartOfDay(today);
        return filter switch
        {
            LaboSampleFilter.AwaitingReturn => query.Where(o =>
                (o.Status == LaboStatus.Sent || o.Status == LaboStatus.Returned)
                && (o.DueAt == null || o.DueAt >= startOfToday)),
            LaboSampleFilter.Overdue => query.Where(o =>
                (o.Status == LaboStatus.Sent || o.Status == LaboStatus.Returned)
                && o.DueAt < startOfToday),
            LaboSampleFilter.Returned => query.Where(o =>
                o.Status == LaboStatus.AwaitingCheck || o.Status == LaboStatus.Completed
                || o.Status == LaboStatus.Warranty),
            _ => query
        };
    }

    /// <summary>
    /// The six cards on the patient's Labo tab. Đang bảo hành and Hết hạn bảo
    /// hành split Bảo hành by the same expression the rows are read with.
    /// </summary>
    private static IQueryable<LaboOrder> ApplyStatusFilter(
        IQueryable<LaboOrder> query,
        LaboStatusFilter? filter,
        DateOnly today)
        => filter switch
        {
            LaboStatusFilter.Draft => query.Where(o => o.Status == LaboStatus.Draft),
            LaboStatusFilter.Returned => query.Where(o => o.Status == LaboStatus.Returned),
            LaboStatusFilter.AwaitingCheck => query.Where(o => o.Status == LaboStatus.AwaitingCheck),
            LaboStatusFilter.Completed => query.Where(o => o.Status == LaboStatus.Completed),
            LaboStatusFilter.InWarranty => query
                .Where(o => o.Status == LaboStatus.Warranty)
                .Where(NotExpired(today)),
            LaboStatusFilter.WarrantyExpired => query.Where(LaboOrder.WarrantyExpiredOn(today)),
            _ => query
        };

    private static System.Linq.Expressions.Expression<Func<LaboOrder, bool>> NotExpired(DateOnly today) =>
        o => o.Teeth.Any(t => t.WarrantyActivatedAt != null && t.WarrantyEndDate >= today);

    /// <summary>Still at the lab: Đã gửi Labo, or sent back as Trả hàng.</summary>
    private static bool IsAtLab(LaboOrder order)
        => order.Status is LaboStatus.Sent or LaboStatus.Returned;

    /// <summary>At the lab past the clinic day it was due.</summary>
    private static bool IsOverdueOn(LaboOrder order, DateOnly today)
        => IsAtLab(order) && order.DueAt.HasValue && ClinicCalendar.DateOf(order.DueAt.Value) < today;

    /// <summary>
    /// The clinic keeps its days in UTC+7, as the appointment book does; the
    /// Excel "Hẹn trả" column is written in it.
    /// </summary>
    private static readonly TimeSpan ClinicUtcOffset = TimeSpan.FromHours(7);

    /// <summary>
    /// One order by id with its teeth and rounds, refused when it sits in a
    /// branch the caller may not act on. The list is scoped the same way, so a
    /// guessed id cannot reach across clinics through the row endpoints.
    /// </summary>
    private async Task<LaboOrder> GetInBranchAsync(Guid id)
    {
        var order = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(order.BranchId);
        return order;
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<LaboStatsDto> GetStatsAsync(GetLaboOrderListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(o => o.BranchId == branchId);

        if (input.PatientId.HasValue)
            query = query.Where(o => o.PatientId == input.PatientId.Value);

        // The counters and the cards / chips above the table have to agree,
        // so each one is the filter it sits over, counted.
        var today = ClinicToday();
        var byStatus = (await AsyncExecuter.ToListAsync(query
                .GroupBy(o => o.Status)
                .Select(g => new { Status = g.Key, Count = g.Count() })))
            .ToDictionary(x => x.Status, x => x.Count);
        int Count(LaboStatus status) => byStatus.GetValueOrDefault(status);

        var expired = await AsyncExecuter.CountAsync(query.Where(LaboOrder.WarrantyExpiredOn(today)));
        var overdue = await AsyncExecuter.CountAsync(ApplySampleFilter(query, LaboSampleFilter.Overdue, today));

        return new LaboStatsDto
        {
            Total = byStatus.Values.Sum(),
            Draft = Count(LaboStatus.Draft),
            Returned = Count(LaboStatus.Returned),
            AwaitingCheck = Count(LaboStatus.AwaitingCheck),
            Completed = Count(LaboStatus.Completed),
            InWarranty = Count(LaboStatus.Warranty) - expired,
            WarrantyExpired = expired,
            AwaitingReturn = Count(LaboStatus.Sent) + Count(LaboStatus.Returned) - overdue,
            Overdue = overdue,
            Received = Count(LaboStatus.AwaitingCheck) + Count(LaboStatus.Completed) + Count(LaboStatus.Warranty),
        };
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<LaboOrderDto> GetAsync(Guid id)
    {
        return await ToDtoAsync(await GetInBranchAsync(id));
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Create)]
    public async Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        await EnsureServiceLineOpenAsync(input.PatientId, input.TreatmentServiceId);
        await EnsureStageNotDateLockedAsync(input.TreatmentStageId);

        var code = await ResolveOrderCodeAsync(input.OrderCode);
        var order = new LaboOrder(
            GuidGenerator.Create(), code, input.PatientId, branchId, await ToDetailsAsync(input));
        var pictures = OrderPicturesOf(input, order);
        EnsurePictureSets(pictures.Select(p => p.ToothNumber));
        if (input.Submit)
        {
            order.Submit();
        }

        await _repository.InsertAsync(order, autoSave: true);
        await AttachPicturesAsync(order, pictures, roundNo: null);
        return await ToDtoAsync(order);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Create)]
    public async Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input)
    {
        var order = await GetInBranchAsync(id);
        await EnsureServiceLineOpenAsync(order.PatientId, input.TreatmentServiceId);
        order.UpdateDraft(await ToDetailsAsync(input));

        // Only the pictures sent to the lab are on the Đặt hàng tab; a
        // round's Ảnh kiểm tra are never touched from here. A tooth taken off
        // the order takes its row's pictures with it.
        var saved = await _imageRepository.GetListAsync(
            x => x.LaboOrderId == order.Id && x.LaboRoundNo == null);
        var onOrder = order.Teeth.Select(t => t.ToothNumber).ToHashSet();
        var removed = saved.Where(x =>
                (input.KeepImageIds is not null && !input.KeepImageIds.Contains(x.Id))
                || (x.LaboToothNumber is { } tooth && tooth != PatientImage.AllLaboTeeth && !onOrder.Contains(tooth)))
            .ToList();
        var pictures = OrderPicturesOf(input, order);
        EnsurePictureSets(saved.Except(removed).Select(x => x.LaboToothNumber)
            .Concat(pictures.Select(p => p.ToothNumber)));
        if (input.Submit)
        {
            order.Submit();
        }

        await _repository.UpdateAsync(order, autoSave: true);
        if (removed.Count > 0)
        {
            // Rows first, then their files: a blob that outlives its row
            // is only waste, a row that outlives its blob is a broken picture.
            await _imageRepository.DeleteManyAsync(removed, autoSave: true);
            foreach (var image in removed)
            {
                await _blobContainer.DeleteAsync(image.BlobName);
            }
        }

        await AttachPicturesAsync(order, pictures, roundNo: null);
        return await ToDtoAsync(order);
    }

    /// <summary>A picture headed for the patient's Hình ảnh, and the Labo tooth row it belongs to (null = shared).</summary>
    private sealed record LaboPicture(IRemoteStreamContent File, int? ToothNumber, WarrantyCardSide? CardSide = null);

    private static List<LaboPicture> CommonPictures(List<IRemoteStreamContent>? files) =>
        (files ?? []).Select(f => new LaboPicture(f, null)).ToList();

    /// <summary>
    /// Ảnh đính kèm chung plus each tooth row's cột Ảnh. Every tooth picture
    /// names a tooth on the order, or the "Dùng chung" row (0).
    /// </summary>
    private static List<LaboPicture> OrderPicturesOf(SaveLaboOrderDto input, LaboOrder order)
    {
        var files = input.ToothPictures ?? [];
        var teeth = input.ToothPictureTeeth ?? [];
        var onOrder = order.Teeth.Select(t => t.ToothNumber).ToHashSet();
        if (files.Count != teeth.Count
            || teeth.Any(t => t != PatientImage.AllLaboTeeth && !onOrder.Contains(t)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothNotOnOrder);
        }

        return CommonPictures(input.Pictures)
            .Concat(files.Select((file, i) => new LaboPicture(file, teeth[i])))
            .ToList();
    }

    /// <summary>The shared pictures, and each tooth row's, are separate sets of at most five.</summary>
    private static void EnsurePictureSets(IEnumerable<int?> toothOfEachPicture)
    {
        foreach (var set in toothOfEachPicture.GroupBy(t => t))
        {
            LaboOrder.EnsureImageCount(set.Count());
        }
    }

    /// <summary>
    /// The Đặt hàng tab as the aggregate takes it. The lab's name is copied
    /// from the supplier picked, so the list, print and Excel keep showing it
    /// even if the supplier is later renamed or removed.
    /// </summary>
    private async Task<LaboOrderDetails> ToDetailsAsync(SaveLaboOrderDto input)
    {
        var supplier = input.SupplierId.HasValue
            ? await _supplierRepository.FindAsync(input.SupplierId.Value)
            : null;
        return new LaboOrderDetails
        {
            DentistId = input.DentistId,
            LabProviderName = supplier?.Name,
            SupplierId = supplier?.Id,
            MaterialId = input.MaterialId,
            BiteId = input.BiteId,
            FinishLineId = input.FinishLineId,
            RhythmId = input.RhythmId,
            Teeth = input.Teeth,
            ToothSpecs = input.ToothSpecs?
                .Select(s => new LaboToothSpec(s.ToothNumber, s.Shade, s.FinishLineId, s.RhythmId, s.BiteId, s.LabNote))
                .ToList(),
            SharedSpec = input.SharedSpec,
            ToothShade = input.ToothShade,
            Quantity = input.Quantity,
            WorkDescription = input.WorkDescription,
            Notes = input.Notes,
            SentAt = input.SentAt,
            DueAt = input.DueAt,
            EstimatedCost = input.EstimatedCost,
            TreatmentServiceId = input.TreatmentServiceId,
            TreatmentStageId = input.TreatmentStageId,
        };
    }

    /// <summary>
    /// The dialog's pictures go to the patient's Hình ảnh, under the plan that
    /// owns the order's service line and the công đoạn it was raised from;
    /// a round's Ảnh kiểm tra carry the round number too. The image service
    /// applies its own permission and branch checks.
    /// </summary>
    private async Task AttachPicturesAsync(LaboOrder order, IReadOnlyList<LaboPicture> pictures, int? roundNo)
    {
        if (pictures.Count == 0)
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
                LaboOrderId = order.Id,
                LaboRoundNo = roundNo,
                LaboToothNumber = picture.ToothNumber,
                WarrantyCardSide = picture.CardSide,
                File = picture.File,
            });
        }
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

        bool taken;
        using (DataFilter.Disable<ISoftDelete>())
        {
            var query = await _repository.GetQueryableAsync();
            taken = await AsyncExecuter.AnyAsync(
                query.Where(x => x.ParentOrderId == null && x.OrderCode == code));
        }

        return taken ? await NextOrderCodeAsync() : code!;
    }

    /// <summary>
    /// "LABO-" + the day + a per-day sequence, the shape the reference shows
    /// ("LABO-202609061"). The sequence runs across branches because the code
    /// is unique across the whole table (IX_bd_labo_orders_OrderCode), so a
    /// second clinic's first sample of the day must not repeat the first's.
    /// A deleted Nháp keeps its row, and its code, under that index.
    /// </summary>
    private async Task<string> NextOrderCodeAsync()
    {
        var prefix = $"LABO-{DateTime.UtcNow:yyyyMMdd}";
        List<string> used;
        using (DataFilter.Disable<ISoftDelete>())
        {
            var query = await _repository.GetQueryableAsync();
            used = await AsyncExecuter.ToListAsync(query
                .Where(x => x.ParentOrderId == null && x.OrderCode.StartsWith(prefix))
                .Select(x => x.OrderCode));
        }

        var next = 1;
        while (used.Contains($"{prefix}{next}"))
        {
            next++;
        }

        return $"{prefix}{next}";
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task<LaboOrderDto> CancelAsync(Guid id)
    {
        var order = await GetInBranchAsync(id);
        order.Cancel();
        await _repository.UpdateAsync(order, autoSave: true);
        return await ToDtoAsync(order);
    }

    /// <summary>
    /// The bin on a Nháp row. The order is soft-deleted; any picture it took
    /// stays in the patient's Hình ảnh, where it was filed.
    /// </summary>
    [Authorize(BlueDentalAbilityPermissions.TreatmentLabo.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var order = await GetInBranchAsync(id);
        order.EnsureDeletable();
        await _repository.DeleteAsync(order, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task<LaboOrderDto> ReceiveAsync(Guid id, ReceiveLaboOrderDto input)
    {
        var order = await GetInBranchAsync(id);
        order.Receive(GuidGenerator.Create(), input.ReceivedAt, input.ReceivedQuantity, CurrentUser.Id);
        await _repository.UpdateAsync(order, autoSave: true);
        return await ToDtoAsync(order);
    }

    /// <summary>
    /// Kiểm tra từng răng + Kết luận. The Ảnh kiểm tra — each Lỗi tooth's
    /// Hình ảnh lỗi (P3110) — are filed under the round being checked, and
    /// only once the aggregate has accepted the check.
    /// </summary>
    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task<LaboOrderDto> CheckAsync(Guid id, CheckLaboOrderDto input)
    {
        var order = await GetInBranchAsync(id);
        var results = input.Teeth
            .Select(t => new LaboRoundToothResult(t.ToothNumber, t.Result, t.Note))
            .ToList();
        var pictures = CheckPicturesOf(input, results);
        var roundNo = order.LatestRound?.RoundNo;
        var now = DateTimeOffset.UtcNow;

        if (input.Conclusion == LaboCheckConclusion.Pass)
        {
            order.ConfirmPassed(results, now);
        }
        else
        {
            var pictured = pictures.Where(p => p.ToothNumber.HasValue).Select(p => p.ToothNumber!.Value).ToHashSet();
            if (roundNo.HasValue)
                pictured.UnionWith(await SavedPicturedTeethAsync(order.Id, roundNo.Value));
            order.ReturnToLab(results, new LaboReturnRequest(
                input.Conclusion == LaboCheckConclusion.ReturnAll,
                input.Description,
                input.ReturnedAt,
                input.RedeliveryDueAt,
                pictured), now);
        }

        await _repository.UpdateAsync(order, autoSave: true);
        await AttachPicturesAsync(order, pictures, roundNo);
        return await ToDtoAsync(order);
    }

    /// <summary>The teeth already holding a Hình ảnh lỗi filed under this round.</summary>
    private async Task<List<int>> SavedPicturedTeethAsync(Guid orderId, int roundNo)
    {
        var query = await _imageRepository.GetQueryableAsync();
        return await AsyncExecuter.ToListAsync(query
            .Where(x => x.LaboOrderId == orderId && x.LaboRoundNo == roundNo && x.LaboToothNumber != null)
            .Select(x => x.LaboToothNumber!.Value)
            .Distinct());
    }

    /// <summary>
    /// The check's loose Ảnh kiểm tra plus each checked tooth's pictures — a
    /// Lỗi tooth's Hình ảnh lỗi, or what a Đạt tooth looked like on arrival
    /// (P0111_02, R-1110): a tooth picture names a tooth marked Đạt or Lỗi in
    /// this check, five at most each.
    /// </summary>
    private static List<LaboPicture> CheckPicturesOf(CheckLaboOrderDto input, List<LaboRoundToothResult> results)
    {
        var files = input.ToothPictures ?? [];
        var teeth = input.ToothPictureTeeth ?? [];
        var checkedTeeth = results.Where(r => r.Result != LaboToothCheckResult.None)
            .Select(r => r.ToothNumber).ToHashSet();
        if (files.Count != teeth.Count || teeth.Any(t => !checkedTeeth.Contains(t)))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.ToothNotOnOrder);
        }

        EnsurePictureSets(teeth.Select(t => (int?)t));
        return CommonPictures(input.Pictures)
            .Concat(files.Select((file, i) => new LaboPicture(file, teeth[i])))
            .ToList();
    }

    [Authorize(BlueDentalPermissions.LaboOrders.Workflow)]
    public async Task<LaboOrderDto> ActivateWarrantyAsync(Guid id, ActivateLaboWarrantyDto input)
    {
        var order = await GetInBranchAsync(id);
        var cards = input.Cards
            .Select(c => new LaboWarrantyActivation(c.ToothNumber, c.StartDate, c.Months, c.ManufacturerSerial, c.Conditions))
            .ToList();
        var photos = CardPhotosOf(input);
        // A Labo card is numbered on its service line, shared with the line's Dịch vụ cards.
        if (order.TreatmentServiceId is not { } lineId
            || !(await GetServiceLinesAsync([lineId])).TryGetValue(lineId, out var line))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.WarrantyNeedsServiceLine);
        }

        var codes = await LazyServiceProvider.LazyGetRequiredService<IWarrantyCardNumberer>()
            .IssueAsync(lineId, line.LineCode, cards.Select(c => c.StartDate).ToList());
        order.ActivateWarranty(cards, codes, DateTimeOffset.UtcNow, CurrentUser.Id);
        await _repository.UpdateAsync(order, autoSave: true);
        await AttachPicturesAsync(order, photos, roundNo: null);
        return await ToDtoAsync(order);
    }

    /// <summary>
    /// Ảnh thẻ: each names a tooth whose card is being activated and a face
    /// of it, one photo per face.
    /// </summary>
    private static List<LaboPicture> CardPhotosOf(ActivateLaboWarrantyDto input)
    {
        var files = input.CardPhotos ?? [];
        var teeth = input.CardPhotoTeeth ?? [];
        var sides = input.CardPhotoSides ?? [];
        var activated = input.Cards.Select(c => c.ToothNumber).ToHashSet();
        var faces = teeth.Zip(sides).ToList();
        if (files.Count != teeth.Count
            || files.Count != sides.Count
            || teeth.Any(t => !activated.Contains(t))
            || sides.Any(s => !Enum.IsDefined(s))
            || faces.Distinct().Count() != faces.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.WarrantyCardPhotoInvalid);
        }

        return files.Select((file, i) => new LaboPicture(file, teeth[i], sides[i])).ToList();
    }

    private async Task<LaboOrderDto> ToDtoAsync(LaboOrder order) => (await ToDtosAsync([order]))[0];

    private async Task<List<LaboOrderDto>> ToDtosAsync(List<LaboOrder> orders)
    {
        var dtos = ObjectMapper.Map<List<LaboOrder>, List<LaboOrderDto>>(orders);
        await FillNamesAsync(orders, dtos);
        return dtos;
    }

    [Authorize(BlueDentalPermissions.LaboOrders.View)]
    public async Task<byte[]> ExportAsync(GetLaboOrderListInput input)
    {
        var page = await GetListAsync(new GetLaboOrderListInput
        {
            BranchId = input.BranchId,
            PatientId = input.PatientId,
            Status = input.Status,
            StatusFilter = input.StatusFilter,
            Kind = input.Kind,
            SampleFilter = input.SampleFilter,
            MaxResultCount = 1000
        });

        return ExcelSheet.Build(
            "Labo",
            L["BE:LaboField:LaboModels"],
            new List<ExcelColumn<LaboOrderDto>>
            {
                new(L["BE:Field:RecordNo"], row => row.OrderCode, 18),
                new(L["BE:Perm:Customers"], row => row.PatientName, 26),
                new(L["BE:Common:Supplier"], row => row.LabProviderName, 24),
                new(L["BE:Field:Tooth"], row => row.ToothNumbers, 12),
                new(L["BE:LaboField:DueBack"], row => row.DueAt?.ToOffset(ClinicUtcOffset).DateTime, 14),
                new(L["BE:Col:Expenses"], row => row.EstimatedCost, 16),
                new(L["BE:Field:Status"], row => StatusLabel(row), 16),
                new(L["BE:Status:LateArrival"], row => row.IsOverdue ? L["BE:Common:Yes"].Value : L["BE:Common:No"].Value, 12)
            },
            page.Items);
    }

    /// <summary>Hết hạn bảo hành is read, not stored, so it is named here rather than by the enum.</summary>
    private string StatusLabel(LaboOrderDto row) =>
        row.IsWarrantyExpired
            ? L["Patient:Labo:Status:WarrantyExpired"].Value
            : L["Patient:Labo:Status:" + row.Status].Value;
}
