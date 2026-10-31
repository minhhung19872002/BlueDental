using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Labo;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.Staff;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Content;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// The slip's Bảo hành tab (P3110 REQ-B1..B7). Read under the slip's own
/// rights — Kế hoạch điều trị › Xem plus the caller's treating scope — and
/// activated under Công đoạn › Sửa, as Bảo hành was a công đoạn action (G4).
/// </summary>
[Authorize]
public class PlanWarrantyAppService : BlueDentalAppService, IPlanWarrantyAppService
{
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;
    private readonly IRepository<ServiceWarrantyCard, Guid> _cardRepository;
    private readonly IRepository<LaboOrder, Guid> _laboRepository;
    private readonly IRepository<LaboSupplier, Guid> _supplierRepository;
    private readonly IRepository<LaboMaterial, Guid> _materialRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<PatientImage, Guid> _imageRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly IPatientImageAppService _imageService;
    private readonly BranchAccessChecker _branchAccess;
    private readonly OrgChartScopeResolver _orgChartScope;

    public PlanWarrantyAppService(
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<TreatmentStage, Guid> stageRepository,
        IRepository<ServiceWarrantyCard, Guid> cardRepository,
        IRepository<LaboOrder, Guid> laboRepository,
        IRepository<LaboSupplier, Guid> supplierRepository,
        IRepository<LaboMaterial, Guid> materialRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<PatientImage, Guid> imageRepository,
        IIdentityUserRepository userRepository,
        IPatientImageAppService imageService,
        BranchAccessChecker branchAccess,
        OrgChartScopeResolver orgChartScope)
    {
        _planRepository = planRepository;
        _stageRepository = stageRepository;
        _cardRepository = cardRepository;
        _laboRepository = laboRepository;
        _supplierRepository = supplierRepository;
        _materialRepository = materialRepository;
        _catalogRepository = catalogRepository;
        _imageRepository = imageRepository;
        _userRepository = userRepository;
        _imageService = imageService;
        _branchAccess = branchAccess;
        _orgChartScope = orgChartScope;
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentConsultation.Read)]
    public async Task<PlanWarrantyOverviewDto> GetOverviewAsync(Guid planId)
    {
        var (plan, ownLines) = await LoadAsync(planId);
        return await OverviewOfAsync(plan, ownLines);
    }

    [Authorize(BlueDentalAbilityPermissions.TreatmentStage.Update)]
    public async Task<PlanWarrantyOverviewDto> ActivateAsync(
        Guid planId, Guid lineId, ActivateServiceWarrantyDto input)
    {
        var (plan, ownLines) = await LoadAsync(planId);
        var line = plan.GetService(lineId);
        if (ownLines is not null && !ownLines.Contains(line.Id))
        {
            throw OutsideScope();
        }

        var photos = CardPhotosOf(input);
        var stages = await _stageRepository.GetListAsync(s => s.TreatmentServiceId == line.Id);
        var warrantyDays = await WarrantyDaysAsync(line.ServiceId);
        var activated = (await _cardRepository.GetListAsync(c => c.TreatmentServiceId == line.Id))
            .Select(c => c.ToothNumber)
            .ToList();

        var cards = ServiceWarrantyCard.ActivateAll(
            GuidGenerator.Create,
            line,
            new ServiceWarrantyTerms(warrantyDays, PlanWarrantyOverviewBuilder.CompletedOn(line, stages)),
            activated,
            input.Cards
                .Select(c => new ServiceWarrantyActivation(c.ToothNumber, c.StartDate, c.Months, c.Conditions))
                .ToList(),
            DateTimeOffset.UtcNow,
            CurrentUser.Id);
        await _cardRepository.InsertManyAsync(cards, autoSave: true);

        var cardOfTooth = cards.ToDictionary(c => c.ToothNumber ?? 0);
        foreach (var photo in photos)
        {
            await _imageService.UploadAsync(new UploadPatientImageDto
            {
                PatientId = plan.PatientId,
                ClinicBranchId = plan.BranchId,
                TreatmentPlanId = plan.Id,
                ServiceWarrantyCardId = cardOfTooth[photo.Tooth].Id,
                WarrantyCardSide = photo.Side,
                File = photo.File,
            });
        }

        return await OverviewOfAsync(plan, ownLines);
    }

    private sealed record CardPhoto(IRemoteStreamContent File, int Tooth, WarrantyCardSide Side);

    /// <summary>
    /// Ảnh thẻ: each names a card being activated (its tooth, 0 for a line
    /// without teeth) and a face of it, one photo per face.
    /// </summary>
    private static List<CardPhoto> CardPhotosOf(ActivateServiceWarrantyDto input)
    {
        var files = input.CardPhotos ?? [];
        var teeth = input.CardPhotoTeeth ?? [];
        var sides = input.CardPhotoSides ?? [];
        var activated = input.Cards.Select(c => c.ToothNumber ?? 0).ToHashSet();
        var faces = teeth.Zip(sides).ToList();
        if (files.Count != teeth.Count
            || files.Count != sides.Count
            || teeth.Any(t => !activated.Contains(t))
            || sides.Any(s => !Enum.IsDefined(s))
            || faces.Distinct().Count() != faces.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.TreatmentManagement.WarrantyCardPhotoInvalid);
        }

        return files.Select((file, i) => new CardPhoto(file, teeth[i], sides[i])).ToList();
    }

    /// <summary>The slip, in the caller's branch and treating scope, and the lines that scope shows.</summary>
    private async Task<(TreatmentPlan Plan, IReadOnlySet<Guid>? OwnLines)> LoadAsync(Guid planId)
    {
        var query = await _planRepository.WithDetailsAsync(x => x.Services);
        var plan = await AsyncExecuter.FirstOrDefaultAsync(query.Where(x => x.Id == planId))
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.TreatmentPlanNotFound,
                "Treatment plan not found.");
        await _branchAccess.CheckAsync(plan.BranchId);

        var scope = await _orgChartScope.VisibleSlipsAsync();
        if (scope is not null && !scope.Covers(plan))
        {
            throw OutsideScope();
        }

        return (plan, scope.OwnLinesOf(plan));
    }

    private static BusinessException OutsideScope() => new(
        BlueDentalDomainErrorCodes.TreatmentManagement.PlanOutsideTreatingScope,
        "This treatment plan belongs to no dentist the caller looks after.");

    private async Task<PlanWarrantyOverviewDto> OverviewOfAsync(TreatmentPlan plan, IReadOnlySet<Guid>? ownLines)
    {
        var lines = plan.Services
            .Where(s => s.Status is not (TreatmentServiceStatus.Cancelled
                or TreatmentServiceStatus.Replaced
                or TreatmentServiceStatus.Transferred))
            .Where(s => ownLines is null || ownLines.Contains(s.Id))
            .OrderBy(s => s.SortOrder)
            .ToList();
        var lineIds = lines.Select(l => l.Id).ToList();

        var stages = await _stageRepository.GetListAsync(s => lineIds.Contains(s.TreatmentServiceId));
        var cards = await _cardRepository.GetListAsync(c => lineIds.Contains(c.TreatmentServiceId));
        var orders = lineIds.Count == 0
            ? []
            : await _laboRepository.GetListAsync(
                o => o.TreatmentServiceId != null
                     && lineIds.Contains(o.TreatmentServiceId.Value)
                     && o.Status != LaboStatus.Cancelled,
                includeDetails: true);

        var serviceIds = lines.Select(l => l.ServiceId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.WithDetailsAsync(c => c.ServiceConfig);
        var catalog = await AsyncExecuter.ToListAsync(catalogQuery.Where(c => serviceIds.Contains(c.Id)));

        var supplierIds = orders.Where(o => o.SupplierId.HasValue).Select(o => o.SupplierId!.Value).Distinct().ToList();
        var suppliers = supplierIds.Count == 0
            ? []
            : await _supplierRepository.GetListAsync(s => supplierIds.Contains(s.Id));
        var materialIds = orders.Where(o => o.MaterialId.HasValue).Select(o => o.MaterialId!.Value).Distinct().ToList();
        var materials = materialIds.Count == 0
            ? []
            : await _materialRepository.GetListAsync(m => materialIds.Contains(m.Id));

        var staffIds = lines.Select(l => l.DentistId ?? plan.DentistId)
            .Concat(stages.Select(s => s.StaffId))
            .Distinct()
            .ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);

        return new PlanWarrantyOverviewBuilder(new PlanWarrantySnapshot(
            ClinicCalendar.DateOf(DateTimeOffset.UtcNow),
            plan,
            lines,
            stages,
            cards,
            orders,
            catalog.ToDictionary(c => c.Id, c => c.Name),
            catalog.ToDictionary(c => c.Id, c => c.ServiceConfig?.WarrantyDays ?? 0),
            suppliers.ToDictionary(s => s.Id, s => s.Name),
            materials.ToDictionary(m => m.Id, m => m.Name),
            users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName),
            await CardPhotosAsync(cards, orders))).Build();
    }

    /// <summary>Danh mục's "Thời gian bảo hành (ngày)" of one service; 0 when it has none.</summary>
    private async Task<int> WarrantyDaysAsync(Guid serviceId)
    {
        var query = await _catalogRepository.WithDetailsAsync(c => c.ServiceConfig);
        var entry = await AsyncExecuter.FirstOrDefaultAsync(query.Where(c => c.Id == serviceId));
        return entry?.ServiceConfig?.WarrantyDays ?? 0;
    }

    /// <summary>Ảnh thẻ of the dental cards and of the Labo orders' activated teeth.</summary>
    private async Task<List<PlanWarrantyPhoto>> CardPhotosAsync(
        IReadOnlyCollection<ServiceWarrantyCard> cards, IReadOnlyCollection<LaboOrder> orders)
    {
        var cardIds = cards.Select(c => c.Id).ToList();
        var orderIds = orders.Select(o => o.Id).ToList();
        if (cardIds.Count == 0 && orderIds.Count == 0)
        {
            return [];
        }

        var query = await _imageRepository.GetQueryableAsync();
        return await AsyncExecuter.ToListAsync(query
            .Where(x => x.WarrantyCardSide != null)
            .Where(x => (x.ServiceWarrantyCardId != null && cardIds.Contains(x.ServiceWarrantyCardId.Value))
                        || (x.LaboOrderId != null && orderIds.Contains(x.LaboOrderId.Value)))
            .OrderBy(x => x.CreationTime)
            .Select(x => new PlanWarrantyPhoto(
                x.Id, x.ServiceWarrantyCardId, x.LaboOrderId, x.LaboToothNumber, x.WarrantyCardSide!.Value)));
    }
}
