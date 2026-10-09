using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Labo;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Auditing;
using Volo.Abp.Application.Services;
using Volo.Abp.Data;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.Catalogs;

/// <summary>
/// Mục danh mục — the entry table shared by every "BE:Perm:Catalogs" sub-route.
/// </summary>
[Authorize(BlueDentalPermissions.Catalogs.Default)]
public class CatalogEntryAppService : ApplicationService, ICatalogEntryAppService
{
    private readonly IRepository<CatalogEntry, Guid> _repository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly IDataFilter<ISoftDelete> _softDeleteFilter;
    private readonly IRepository<LaboSupplier, Guid> _laboSupplierRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<PatientAdvise, Guid> _adviseRepository;

    public CatalogEntryAppService(
        IRepository<CatalogEntry, Guid> repository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        BranchAccessChecker branchAccess,
        IDataFilter<ISoftDelete> softDeleteFilter,
        IRepository<LaboSupplier, Guid> laboSupplierRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<PatientAdvise, Guid> adviseRepository)
    {
        _repository = repository;
        _taxonomyRepository = taxonomyRepository;
        _branchAccess = branchAccess;
        _softDeleteFilter = softDeleteFilter;
        _laboSupplierRepository = laboSupplierRepository;
        _planRepository = planRepository;
        _adviseRepository = adviseRepository;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<PagedResultDto<CatalogEntryDto>> GetListAsync(GetCatalogEntryListInput input)
    {
        using var _ = ShowDeletedRowsOf(input.Group);

        // WithDetails, not the bare queryable: the dialog behind each row edits
        // the catalog-specific parts, so the list has to carry them.
        var query = await FilterAsync(await _repository.WithDetailsAsync(), input);
        if (input.IsCombo.HasValue)
            query = query.Where(x => x.IsCombo == input.IsCombo.Value);

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
        var components = await GetComboComponentsAsync(items);
        return new PagedResultDto<CatalogEntryDto>(
            totalCount,
            items.Select(x => MapToDto(x, names, medicines, components)).ToList());
    }

    /// <summary>
    /// "Tất cả (8) · Dịch vụ lẻ (5) · Combo (3)" — the list's own filters
    /// (branch, group, search, ...) counted once per kind, so the numbers on
    /// the switch always agree with the rows each choice would show.
    /// </summary>
    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<CatalogEntryKindCountsDto> GetKindCountsAsync(GetCatalogEntryListInput input)
    {
        using var _ = ShowDeletedRowsOf(input.Group);

        var query = await FilterAsync(await _repository.GetQueryableAsync(), input);
        var counts = query
            .GroupBy(x => x.IsCombo)
            .Select(g => new { IsCombo = g.Key, Count = g.Count() })
            .ToList();

        var combo = counts.Where(x => x.IsCombo).Sum(x => x.Count);
        var single = counts.Where(x => !x.IsCombo).Sum(x => x.Count);
        return new CatalogEntryKindCountsDto { Total = combo + single, Single = single, Combo = combo };
    }

    /// <summary>
    /// A soft-deleted row stays in the list for the catalogs whose dialog can
    /// bring it back — it simply loses its delete action. Anywhere else the
    /// flag has no way to be cleared again, so those rows stay hidden.
    /// </summary>
    private IDisposable? ShowDeletedRowsOf(string? group) =>
        TaxonomyGroups.IsSoftDeletable(group ?? string.Empty) ? _softDeleteFilter.Disable() : null;

    /// <summary>
    /// One name per entry within a group — the key the Excel import finds rows by.
    /// A deleted row counts only where the catalog still shows it (and can bring
    /// it back): elsewhere it is gone for good and must not block its own name.
    /// </summary>
    private async Task EnsureNameFreeAsync(Guid taxonomyId, string name, Guid? exceptId)
    {
        var group = (await _taxonomyRepository.GetAsync(taxonomyId)).Group;
        List<string> taken;
        using (TaxonomyGroups.IsSoftDeletable(group) ? _softDeleteFilter.Disable() : _softDeleteFilter.Enable())
        {
            var query = await _repository.GetQueryableAsync();
            taken = await AsyncExecuter.ToListAsync(query
                .Where(e => e.TaxonomyId == taxonomyId && e.Id != exceptId)
                .Select(e => e.Name));
        }

        CatalogNames.EnsureFree(name, taken, group == TaxonomyGroups.CareService
            ? BlueDentalDomainErrorCodes.Catalogs.DuplicateServiceName
            : BlueDentalDomainErrorCodes.Catalogs.DuplicateEntryName);
    }

    /// <summary>Every filter of the list except the kind, which each caller applies its own way.</summary>
    private async Task<IQueryable<CatalogEntry>> FilterAsync(
        IQueryable<CatalogEntry> query, GetCatalogEntryListInput input)
    {
        // The header can switch branches, so the caller names the one it wants;
        // the checker narrows it to what this account may actually see.
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

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
        if (input.IsDeleted.HasValue)
            query = query.Where(x => x.IsDeleted == input.IsDeleted.Value);
        foreach (var term in SearchTerms.From(input.Filter))
        {
            query = query.Where(x =>
                x.Name.ToLower().Contains(term) ||
                (x.Code != null && x.Code.ToLower().Contains(term)) ||
                (x.Description != null && x.Description.ToLower().Contains(term)));
        }

        return query;
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<CatalogEntryDto> GetAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        var names = await GetTaxonomyNamesAsync([entry]);
        return MapToDto(entry, names, await GetMedicineNamesAsync([entry]), await GetComboComponentsAsync([entry]));
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
        await EnsureNameFreeAsync(taxonomy.Id, input.Name, exceptId: null);

        // The service dialog has no code box any more; the server draws one,
        // which is what the partner sync keys on.
        var code = input.Code;
        if (taxonomy.Group == TaxonomyGroups.CareService && string.IsNullOrWhiteSpace(code))
        {
            code = ServiceCode.Next(await GetServiceCodesAsync(taxonomy.ClinicBranchId));
        }

        var entry = CatalogEntry.Create(
            GuidGenerator.Create(),
            taxonomy.ClinicBranchId,
            taxonomy.Id,
            // The group always comes from the taxonomy, never from the client.
            taxonomy.Group,
            input.Name,
            code,
            // A combo is priced by its rows, never by a typed figure.
            input.IsCombo ? null : input.Price,
            input.Content,
            input.Description,
            input.SortOrder,
            input.IsCombo);

        await CheckLaboSuppliersAsync(taxonomy.ClinicBranchId, input.ServiceConfig);
        CatalogEntryParts.Apply(entry, GuidGenerator, input.DetailName, input.Note, input.Unit,
            input.ServiceConfig, input.Medicine, input.Stages, input.PrescriptionLines);
        // A new combo must arrive with its table, so a missing one is an empty one.
        await ApplyComboItemsAsync(entry, entry.IsCombo ? input.ComboItems ?? [] : input.ComboItems);

        await _repository.InsertAsync(entry, autoSave: true);

        return MapToDto(
            entry,
            new Dictionary<Guid, string> { [taxonomy.Id] = taxonomy.Name },
            await GetMedicineNamesAsync([entry]),
            await GetComboComponentsAsync([entry]));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Edit)]
    public async Task<CatalogEntryDto> UpdateAsync(Guid id, UpdateCatalogEntryDto input)
    {
        // The row being edited may itself be soft-deleted — that is how it is
        // brought back — so it has to be reachable here.
        using var _ = _softDeleteFilter.Disable();

        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);

        var entryMoved = entry.TaxonomyId != input.TaxonomyId;
        if (entryMoved)
        {
            var target = await _taxonomyRepository.FindAsync(input.TaxonomyId);

            // A group of another branch is answered exactly like a missing one:
            // an entry never leaves its branch, and the answer must not tell the
            // caller what that branch holds.
            if (target is null || target.ClinicBranchId != entry.ClinicBranchId)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.TaxonomyNotFound,
                    $"Taxonomy group {input.TaxonomyId} was not found.");
            }

            if (target.Group != entry.Group)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.UnknownTaxonomyGroup,
                    "An entry can only be moved between groups of the same catalog.");
            }

            entry.MoveTo(target.Id);
        }

        // Checked on a rename or a move only, so a row that already shared its
        // name before the rule existed can still be edited otherwise.
        if (!CatalogNames.Same(entry.Name, input.Name) || entryMoved)
        {
            await EnsureNameFreeAsync(entry.TaxonomyId, input.Name, entry.Id);
        }

        entry.Rename(input.Name);
        entry.ChangePrice(input.Price);
        entry.UpdateContent(input.Content);
        entry.UpdateDescription(input.Description);
        entry.Reorder(input.SortOrder);

        await CheckLaboSuppliersAsync(entry.ClinicBranchId, input.ServiceConfig);
        CatalogEntryParts.Apply(entry, GuidGenerator, input.DetailName, input.Note, input.Unit,
            input.ServiceConfig, input.Medicine, input.Stages, input.PrescriptionLines);
        await ApplyComboItemsAsync(entry, input.ComboItems);

        if (input.IsActive)
        {
            entry.Activate();
        }
        else
        {
            entry.Deactivate();
        }

        // "BE:Status:Active" and "BE:Status:Deleted" are one state, not two flags: whichever
        // the dialog sends decides whether this row is deleted.
        if (TaxonomyGroups.IsSoftDeletable(entry.Group))
        {
            if (input.IsDeleted && !entry.IsDeleted)
            {
                await EnsureServiceNotInUseAsync(entry);
                await RemoveFromCombosAsync(entry);
            }

            entry.SetDeleted(input.IsDeleted);
        }

        await _repository.UpdateAsync(entry, autoSave: true);

        var names = await GetTaxonomyNamesAsync([entry]);
        return MapToDto(entry, names, await GetMedicineNamesAsync([entry]), await GetComboComponentsAsync([entry]));
    }

    [Authorize(BlueDentalPermissions.Catalogs.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);
        await EnsureServiceNotInUseAsync(entry);
        await RemoveFromCombosAsync(entry);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Catalogs.View)]
    public async Task<ListResultDto<CatalogComboHolderDto>> GetComboHoldersAsync(Guid id)
    {
        var entry = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(entry.ClinicBranchId);

        var holders = await GetLiveComboHoldersAsync(entry);
        return new ListResultDto<CatalogComboHolderDto>(holders
            .Select(combo => new CatalogComboHolderDto
            {
                Id = combo.Id,
                Name = combo.Name,
                Code = combo.Code,
                IsLastComponent = combo.ComboItems.Count == 1
            })
            .ToList());
    }

    /// <summary>
    /// A deleted service leaves every live combo that holds it, and each
    /// combo's price drops by the row it lost. Deleted combos are left as they
    /// are — they sell nothing, and emptying one would break the rule that a
    /// combo has a service. The audit log names the combos, next to the
    /// deleter and the time the entry itself carries.
    /// </summary>
    private async Task RemoveFromCombosAsync(CatalogEntry entry)
    {
        var holders = await GetLiveComboHoldersAsync(entry);
        if (holders.Count == 0)
        {
            return;
        }

        // All or nothing: a combo the service would empty refuses the delete
        // before any combo is written.
        foreach (var combo in holders)
        {
            combo.RemoveComboComponent(entry.Id);
        }

        await _repository.UpdateManyAsync(holders, autoSave: true);

        LazyServiceProvider.LazyGetRequiredService<IAuditingManager>().Current?.Log.Comments.Add(
            $"Catalog entry {entry.Id} removed from combos: "
            + string.Join(", ", holders.Select(combo => combo.Id)));
    }

    /// <summary>The live combos of the service's own branch that hold it, rows loaded.</summary>
    private async Task<List<CatalogEntry>> GetLiveComboHoldersAsync(CatalogEntry entry)
    {
        if (entry.Group != TaxonomyGroups.CareService || entry.IsCombo)
        {
            return [];
        }

        using (_softDeleteFilter.Enable())
        {
            var query = await _repository.WithDetailsAsync();
            return await AsyncExecuter.ToListAsync(query
                .Where(x => x.IsCombo
                    && x.ClinicBranchId == entry.ClinicBranchId
                    && x.ComboItems.Any(item => item.ComponentEntryId == entry.Id))
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Name));
        }
    }

    /// <summary>
    /// A service that a treatment plan or a consultation still names cannot be
    /// deleted — the line would point at a service the catalog no longer offers.
    /// Deleted plans and consultations do not count, so the filter is switched
    /// back on even when the caller (the edit dialog) turned it off.
    /// </summary>
    private async Task EnsureServiceNotInUseAsync(CatalogEntry entry)
    {
        if (entry.Group != TaxonomyGroups.CareService)
        {
            return;
        }

        using (_softDeleteFilter.Enable())
        {
            var plans = await _planRepository.GetQueryableAsync();
            var advises = await _adviseRepository.GetQueryableAsync();
            var inUse =
                await AsyncExecuter.AnyAsync(plans.SelectMany(p => p.Services).Where(s => s.ServiceId == entry.Id))
                || await AsyncExecuter.AnyAsync(advises.Where(a => a.ServiceId == entry.Id));

            if (inUse)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.ServiceInUse,
                    "A treatment plan or a consultation still uses this service.");
            }
        }
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

    /// <summary>Every service code of the branch, deleted rows included — a code is never reused.</summary>
    private async Task<HashSet<string>> GetServiceCodesAsync(Guid clinicBranchId)
    {
        using var _ = _softDeleteFilter.Disable();
        var query = await _repository.GetQueryableAsync();
        return ServiceCode.NewTakenSet(query
            .Where(x => x.ClinicBranchId == clinicBranchId && x.Group == TaxonomyGroups.CareService)
            .Select(x => x.Code)
            .ToList());
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

    /// <summary>
    /// Writes a combo's "Thành phần combo" table. Null leaves it as it is.
    ///
    /// Every component has to be a single service of the combo's own branch —
    /// a combo inside a combo would price a price, and another branch's service
    /// would sell what this branch never set up. A service already in the
    /// combo may stay after it was deleted, so an old combo can still be saved;
    /// a deleted one cannot be newly added.
    /// </summary>
    private async Task ApplyComboItemsAsync(CatalogEntry entry, List<CatalogComboItemDto>? rows)
    {
        if (rows == null)
        {
            return;
        }

        if (!entry.IsCombo)
        {
            if (rows.Count > 0)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.ComboNotSupported,
                    "Only a combo has combo components.");
            }

            return;
        }

        var ids = rows.Select(x => x.ComponentEntryId).Distinct().ToList();
        var already = entry.ComboItems.Select(x => x.ComponentEntryId).ToList();

        using (_softDeleteFilter.Disable())
        {
            var query = await _repository.GetQueryableAsync();
            var allowed = query
                .Where(x => ids.Contains(x.Id)
                    && x.Id != entry.Id
                    && x.ClinicBranchId == entry.ClinicBranchId
                    && x.Group == TaxonomyGroups.CareService
                    && !x.IsCombo
                    && (!x.IsDeleted || already.Contains(x.Id)))
                .Count();

            if (allowed != ids.Count)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Catalogs.ComboComponentNotAllowed,
                    "A combo component must be a single service of the combo's own branch.");
            }
        }

        entry.ReplaceComboItems(
            rows.Select(x => new CatalogComboRow(x.ComponentEntryId, x.Quantity, x.UnitPrice)),
            GuidGenerator.Create);
    }

    /// <summary>Name, code and live catalogue price of every component the combos name.</summary>
    private async Task<Dictionary<Guid, ComboComponent>> GetComboComponentsAsync(
        IReadOnlyCollection<CatalogEntry> entries)
    {
        var ids = entries
            .SelectMany(x => x.ComboItems)
            .Select(x => x.ComponentEntryId)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
        {
            return new Dictionary<Guid, ComboComponent>();
        }

        // A component deleted after the combo was built still has to be named.
        using var _ = _softDeleteFilter.Disable();
        var query = await _repository.GetQueryableAsync();
        return query
            .Where(x => ids.Contains(x.Id))
            .Select(x => new ComboComponent(x.Id, x.Name, x.Code, x.Price))
            .ToList()
            .ToDictionary(x => x.Id);
    }

    private sealed record ComboComponent(Guid Id, string Name, string? Code, decimal? Price);

    /// <summary>
    /// The Labo tab's picks must be suppliers of the entry's own branch — a
    /// stranger's id would let a slip in this branch order from a supplier the
    /// branch never set up.
    /// </summary>
    private async Task CheckLaboSuppliersAsync(Guid clinicBranchId, ServiceConfigDto? config)
    {
        var ids = config?.LaboSupplierIds?.Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids == null || ids.Count == 0)
        {
            return;
        }

        var known = await _laboSupplierRepository.CountAsync(
            s => ids.Contains(s.Id) && s.ClinicBranchId == clinicBranchId);
        if (known != ids.Count)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.LaboSupplierNotInBranch,
                "A labo supplier on the service is not a supplier of the service's branch.");
        }
    }

    private static CatalogEntryDto MapToDto(
        CatalogEntry entity,
        IReadOnlyDictionary<Guid, string> taxonomyNames,
        IReadOnlyDictionary<Guid, string>? medicineNames = null,
        IReadOnlyDictionary<Guid, ComboComponent>? components = null) => new()
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
                LaboSupplierIds = entity.ServiceConfig.LaboSupplierIds.ToList(),
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
            .Select(x => new ServiceStageDto
            {
                Id = x.Id,
                Name = x.Name,
                Value = x.Value,
                ValueType = x.ValueType,
                IsMarketingSalary = x.IsMarketingSalary
            })
            .ToList(),
        PrescriptionLines = entity.PrescriptionLines
            .OrderBy(x => x.SortOrder)
            .Select(x => new PrescriptionTemplateLineDto
            {
                Id = x.Id,
                MedicineEntryId = x.MedicineEntryId,
                Morning = x.Morning,
                Noon = x.Noon,
                Afternoon = x.Afternoon,
                Evening = x.Evening,
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
        IsCombo = entity.IsCombo,
        ComboItems = entity.ComboItems
            .OrderBy(x => x.SortOrder)
            .Select(x =>
            {
                var component = components != null && components.TryGetValue(x.ComponentEntryId, out var found)
                    ? found
                    : null;
                return new CatalogComboItemDto
                {
                    Id = x.Id,
                    ComponentEntryId = x.ComponentEntryId,
                    Quantity = x.Quantity,
                    UnitPrice = x.UnitPrice,
                    ComponentName = component?.Name,
                    ComponentCode = component?.Code,
                    ComponentPrice = component?.Price
                };
            })
            .ToList(),
        // "Tổng giá lẻ": what the same rows would cost bought one by one, at
        // today's catalogue prices.
        RetailPrice = entity.IsCombo
            ? entity.ComboItems.Sum(x =>
                (components != null && components.TryGetValue(x.ComponentEntryId, out var part) ? part.Price ?? 0m : 0m)
                * x.Quantity)
            : null,
        TaxonomyName = taxonomyNames.TryGetValue(entity.TaxonomyId, out var name) ? name : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId,
        DeleterId = entity.DeleterId
    };
}
