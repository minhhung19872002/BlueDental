using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Auditing;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

/// <summary>
/// Mục danh mục — the entry table shared by every "Danh mục" sub-route.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class CatalogEntryAppService : ApplicationService, ICatalogEntryAppService
{
    private readonly IRepository<CatalogEntry, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;

    public CatalogEntryAppService(
        IRepository<CatalogEntry, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        BranchAccessChecker branchAccess,
        IDataFilter<ISoftDelete> softDeleteFilter)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchAccess = branchAccess;
        _softDeleteFilter = softDeleteFilter;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<CatalogEntryDto>> GetListAsync(GetCatalogEntryListInput input)
    {
        // The header can switch branches, so the caller names the one it wants;
        // the checker narrows it to what this account may actually see.
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

        // A soft-deleted row stays in the list for the catalogs whose dialog can
        // bring it back — it simply loses its delete action. Anywhere else the
        // flag has no way to be cleared again, so those rows stay hidden.
        using var _ = TaxonomyGroups.IsSoftDeletable(input.Group ?? string.Empty)
            ? _softDeleteFilter.Disable()
            : null;

        // WithDetails, not the bare queryable: the dialog behind each row edits
        // the catalog-specific parts, so the list has to carry them.
        var query = await _repository.WithDetailsAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.TaxonomyId.HasValue)
            query = query.Where(x => x.TaxonomyId == input.TaxonomyId.Value);
        if (!string.IsNullOrWhiteSpace(input.Group))
            query = query.Where(x => x.Group == input.Group);
        if (input.IsActive.HasValue)
            query = query.Where(x => x.IsActive == input.IsActive.Value);
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.Name.ToLower().Contains(term) ||
                (x.Code != null && x.Code.ToLower().Contains(term)) ||
                (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        var totalCount = query.Count();
        var items = query
            .OrderBy(x => x.SortOrder)
            // Newest first among equal priorities: a record just added carries
            // the default priority, so this is what puts it at the top of the
            // list the moment it is saved.
            .ThenByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var names = await GetTaxonomyNamesAsync(items);
        var medicines = await GetMedicineNamesAsync(items);
        return new PagedResultDto<CatalogEntryDto>(
            totalCount,
            items.Select(x => MapToDto(x, names, medicines)).ToList());
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<CatalogEntryDto> GetAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        var names = await GetTaxonomyNamesAsync([entry]);
        return MapToDto(entry, names, await GetMedicineNamesAsync([entry]));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Create)]
    public async Task<CatalogEntryDto> CreateAsync(CreateCatalogEntryDto input)
    {
        var taxonomy = await _taxonomyRepository.FindAsync(input.TaxonomyId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound,
                $"Taxonomy group {input.TaxonomyId} was not found.");

        // The entry belongs wherever its group belongs, so the branch comes from
        // the group rather than from the client or the caller's own branch.
        await _branchAccess.CheckAsync(taxonomy.ClinicBranchId);

        var entry = CatalogEntry.Create(
            GuidGenerator.Create(),
            taxonomy.ClinicBranchId,
            taxonomy.Id,
            // The group always comes from the taxonomy, never from the client.
            taxonomy.Group,
            input.Name,
            input.Code,
            input.Price,
            input.Content,
            input.Description,
            input.SortOrder);

        ApplyCatalogSpecificParts(entry, input.DetailName, input.Note, input.Unit,
            input.ServiceConfig, input.Medicine, input.Stages, input.PrescriptionLines);

        await _repository.InsertAsync(entry, autoSave: true);

        return MapToDto(
            entry,
            new Dictionary<Guid, string> { [taxonomy.Id] = taxonomy.Name },
            await GetMedicineNamesAsync([entry]));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<CatalogEntryDto> UpdateAsync(Guid id, UpdateCatalogEntryDto input)
    {
        // The row being edited may itself be soft-deleted — that is how it is
        // brought back — so it has to be reachable here.
        using var _ = _softDeleteFilter.Disable();

        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);

        if (entry.TaxonomyId != input.TaxonomyId)
        {
            var target = await _taxonomyRepository.FindAsync(input.TaxonomyId)
                ?? throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound,
                    $"Taxonomy group {input.TaxonomyId} was not found.");

            if (target.Group != entry.Group)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.UnknownTaxonomyGroup,
                    "An entry can only be moved between groups of the same catalog.");
            }

            entry.MoveTo(target.Id);
        }

        entry.Rename(input.Name);
        entry.ChangePrice(input.Price);
        entry.UpdateContent(input.Content);
        entry.UpdateDescription(input.Description);
        entry.Reorder(input.SortOrder);

        ApplyCatalogSpecificParts(entry, input.DetailName, input.Note, input.Unit,
            input.ServiceConfig, input.Medicine, input.Stages, input.PrescriptionLines);

        if (input.IsActive)
        {
            entry.Activate();
        }
        else
        {
            entry.Deactivate();
        }

        // "Đang hoạt động" and "Đã xoá" are one state, not two flags: whichever
        // the dialog sends decides whether this row is deleted.
        if (TaxonomyGroups.IsSoftDeletable(entry.Group))
        {
            entry.SetDeleted(input.IsDeleted);
        }

        await _repository.UpdateAsync(entry, autoSave: true);

        var names = await GetTaxonomyNamesAsync([entry]);
        return MapToDto(entry, names, await GetMedicineNamesAsync([entry]));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>
    /// Applies a whole new order in one call — see the note on the equivalent
    /// method for groups. The order is the row's absolute position in the
    /// catalog, so paging keeps working: page 3 sends 40, 41, 42…
    /// </summary>
    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task ReorderAsync(ReorderCatalogEntryDto input)
    {
        if (input.Items.Count == 0)
        {
            return;
        }

        var ids = input.Items.Select(x => x.Id).Distinct().ToList();
        var query = await _repository.GetQueryableAsync();
        var entries = query.Where(x => ids.Contains(x.Id)).ToList();

        if (entries.Count != ids.Count)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                "One of the entries being ordered no longer exists.");
        }

        foreach (var branchId in entries.Select(x => x.ClinicBranchId).Distinct())
        {
            await _branchAccess.CheckAsync(branchId);
        }

        // The screen orders one group at a time, so a payload spanning groups
        // is a crafted one rather than something the UI can produce.
        if (input.TaxonomyId.HasValue && entries.Any(x => x.TaxonomyId != input.TaxonomyId.Value))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                "The entries being ordered do not all belong to that group.");
        }

        var order = input.Items.ToDictionary(x => x.Id, x => x.Order);
        foreach (var entry in entries)
        {
            entry.Reorder(order[entry.Id]);
        }

        await _repository.UpdateManyAsync(entries, autoSave: true);
    }

    private async Task<Dictionary<Guid, string>> GetTaxonomyNamesAsync(
        IReadOnlyCollection<CatalogEntry> entries)
    {
        var ids = entries.Select(x => x.TaxonomyId).Distinct().ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _taxonomyRepository.GetQueryableAsync();
        return query
            .Where(x => ids.Contains(x.Id))
            .ToDictionary(x => x.Id, x => x.Name);
    }

    /// <summary>
    /// Writes the parts only one catalog carries. Each block is skipped unless
    /// the dialog for that catalog actually sent it, so saving a diagnosis never
    /// silently blanks a service's price configuration.
    /// </summary>
    private void ApplyCatalogSpecificParts(
        CatalogEntry entry,
        string? detailName,
        string? note,
        string? unit,
        ServiceConfigDto? serviceConfig,
        MedicineDto? medicine,
        List<ServiceStageDto>? stages,
        List<PrescriptionTemplateLineDto>? prescriptionLines)
    {
        entry.UpdateDetails(detailName, note, unit);

        if (serviceConfig != null)
        {
            entry.EnsureServiceConfig(GuidGenerator.Create()).Update(
                serviceConfig.TaxRate,
                serviceConfig.PriceIncludesTax,
                serviceConfig.DiscountIsPercent,
                serviceConfig.DiscountValue,
                serviceConfig.RequireImage,
                serviceConfig.DeductDoctorOnWarranty,
                serviceConfig.SeparateRevenue,
                serviceConfig.ShowToothOnInvoice,
                serviceConfig.RevenueByStage,
                serviceConfig.RequireStageSequence,
                serviceConfig.WarrantyDays);
        }

        if (medicine != null)
        {
            entry.EnsureMedicine(GuidGenerator.Create()).Update(
                medicine.ActiveIngredient,
                medicine.Usage,
                medicine.PurchasePrice,
                medicine.PrescriptionCode,
                medicine.UsageNote);
        }

        if (stages != null)
        {
            entry.ReplaceStages(stages.Select((stage, index) =>
                new CatalogServiceStage(
                    GuidGenerator.Create(), entry.Id, stage.Name, stage.Value, index)));
        }

        if (prescriptionLines != null)
        {
            entry.ReplacePrescriptionLines(prescriptionLines.Select((line, index) =>
                new PrescriptionTemplateLine(
                    GuidGenerator.Create(),
                    entry.Id,
                    line.MedicineEntryId,
                    line.TimesPerDay,
                    line.AmountPerTime,
                    line.Days,
                    line.Usage,
                    line.OtherUsage,
                    index)));
        }
    }

    /// <summary>Medicine names for the lines of a prescription template.</summary>
    private async Task<Dictionary<Guid, string>> GetMedicineNamesAsync(
        IReadOnlyCollection<CatalogEntry> entries)
    {
        var ids = entries
            .SelectMany(x => x.PrescriptionLines)
            .Select(x => x.MedicineEntryId)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var query = await _repository.GetQueryableAsync();
        return query.Where(x => ids.Contains(x.Id)).ToDictionary(x => x.Id, x => x.Name);
    }

    private static CatalogEntryDto MapToDto(
        CatalogEntry entity,
        IReadOnlyDictionary<Guid, string> taxonomyNames,
        IReadOnlyDictionary<Guid, string>? medicineNames = null) => new()
    {
        Id = entity.Id,
        ClinicBranchId = entity.ClinicBranchId,
        TaxonomyId = entity.TaxonomyId,
        Group = entity.Group,
        Name = entity.Name,
        Code = entity.Code,
        Description = entity.Description,
        Price = entity.Price,
        Content = entity.Content,
        IsActive = entity.IsActive,
        // Hand-mapped, so the soft-delete flag has to be carried explicitly —
        // the list shows deleted rows and the table keys its actions off this.
        IsDeleted = entity.IsDeleted,
        DeletionTime = entity.DeletionTime,
        SortOrder = entity.SortOrder,
        DetailName = entity.DetailName,
        Note = entity.Note,
        Unit = entity.Unit,
        ServiceConfig = entity.ServiceConfig == null
            ? null
            : new ServiceConfigDto
            {
                TaxRate = entity.ServiceConfig.TaxRate,
                PriceIncludesTax = entity.ServiceConfig.PriceIncludesTax,
                DiscountIsPercent = entity.ServiceConfig.DiscountIsPercent,
                DiscountValue = entity.ServiceConfig.DiscountValue,
                RequireImage = entity.ServiceConfig.RequireImage,
                DeductDoctorOnWarranty = entity.ServiceConfig.DeductDoctorOnWarranty,
                SeparateRevenue = entity.ServiceConfig.SeparateRevenue,
                ShowToothOnInvoice = entity.ServiceConfig.ShowToothOnInvoice,
                RevenueByStage = entity.ServiceConfig.RevenueByStage,
                RequireStageSequence = entity.ServiceConfig.RequireStageSequence,
                WarrantyDays = entity.ServiceConfig.WarrantyDays,
                // The two read-only boxes of the dialog, computed by the domain
                // so the browser never has to agree with the server about the
                // formula.
                PriceAfterDiscount = entity.ServiceConfig.PriceAfterDiscount(entity.Price ?? 0m),
                AmountCollected = entity.ServiceConfig.AmountCollected(entity.Price ?? 0m)
            },
        Medicine = entity.Medicine == null
            ? null
            : new MedicineDto
            {
                ActiveIngredient = entity.Medicine.ActiveIngredient,
                Usage = entity.Medicine.Usage,
                PurchasePrice = entity.Medicine.PurchasePrice,
                PrescriptionCode = entity.Medicine.PrescriptionCode,
                UsageNote = entity.Medicine.UsageNote
            },
        Stages = entity.Stages
            .OrderBy(x => x.SortOrder)
            .Select(x => new ServiceStageDto { Id = x.Id, Name = x.Name, Value = x.Value })
            .ToList(),
        PrescriptionLines = entity.PrescriptionLines
            .OrderBy(x => x.SortOrder)
            .Select(x => new PrescriptionTemplateLineDto
            {
                Id = x.Id,
                MedicineEntryId = x.MedicineEntryId,
                TimesPerDay = x.TimesPerDay,
                AmountPerTime = x.AmountPerTime,
                Days = x.Days,
                Usage = x.Usage,
                OtherUsage = x.OtherUsage,
                Quantity = x.Quantity,
                MedicineName = medicineNames != null
                    && medicineNames.TryGetValue(x.MedicineEntryId, out var medicine)
                        ? medicine
                        : null
            })
            .ToList(),
        TaxonomyName = taxonomyNames.TryGetValue(entity.TaxonomyId, out var name) ? name : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
