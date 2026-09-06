using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Đơn thuốc of one patient — the list on the "Đơn thuốc" tab and the
/// "Thêm đơn thuốc" dialog (create, edit, delete).
/// </summary>
[Authorize]
public class PrescriptionAppService : ApplicationService, IPrescriptionAppService
{
    /// <summary>Name of the group a template lands in when the branch has none yet.</summary>
    private const string DefaultTemplateGroupName = "Đơn thuốc mẫu";

    private readonly IRepository<Prescription, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public PrescriptionAppService(
        IRepository<Prescription, Guid> repository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _catalogRepository = catalogRepository;
        _taxonomyRepository = taxonomyRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input)
    {
        var branchIds = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);

        var query = await _repository.WithDetailsAsync(x => x.Items);

        // An empty filter means the caller is clinic-wide and named no branch.
        if (branchIds.Count > 0)
            query = query.Where(x => branchIds.Contains(x.ClinicBranchId));

        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);

        var total = await AsyncExecuter.CountAsync(query);
        var items = await AsyncExecuter.ToListAsync(
            query.OrderByDescending(x => x.IssuedAt)
                .ThenByDescending(x => x.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        return new PagedResultDto<PrescriptionDto>(total, await MapManyAsync(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<PrescriptionDto> GetAsync(Guid id)
    {
        return await MapAsync(await LoadAsync(id));
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Create)]
    public async Task<PrescriptionDto> CreateAsync(CreatePrescriptionDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);
        GuardTemplateName(input.SaveAsTemplate, input.TemplateName);

        var items = await BuildItemsAsync(input.ClinicBranchId, input.Items);

        var prescription = Prescription.Issue(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            await GenerateCodeAsync(input.ClinicBranchId),
            input.StaffId,
            items,
            input.DiagnosisText,
            input.Note,
            input.TreatmentType,
            input.FollowUpDate,
            Clock.Now);

        await _repository.InsertAsync(prescription, autoSave: true);

        if (input.SaveAsTemplate)
            await SaveTemplateAsync(prescription, input.TemplateName!);

        return await MapAsync(prescription);
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Update)]
    public async Task<PrescriptionDto> UpdateAsync(Guid id, UpdatePrescriptionDto input)
    {
        var prescription = await LoadAsync(id);
        GuardTemplateName(input.SaveAsTemplate, input.TemplateName);

        var items = await BuildItemsAsync(prescription.ClinicBranchId, input.Items);

        prescription.UpdateDetails(
            input.StaffId,
            input.DiagnosisText,
            input.Note,
            input.TreatmentType,
            input.FollowUpDate,
            items);

        await _repository.UpdateAsync(prescription, autoSave: true);

        if (input.SaveAsTemplate)
            await SaveTemplateAsync(prescription, input.TemplateName!);

        return await MapAsync(prescription);
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var prescription = await LoadAsync(id);
        await _repository.DeleteAsync(prescription, autoSave: true);
    }

    private async Task<Prescription> LoadAsync(Guid id)
    {
        var prescription = await AsyncExecuter.FirstOrDefaultAsync(
            (await _repository.WithDetailsAsync(x => x.Items)).Where(x => x.Id == id));

        if (prescription == null || !await _branchAccess.IsAllowedAsync(prescription.ClinicBranchId))
        {
            // Another branch's slip reads as "not found" rather than "forbidden",
            // so a caller cannot probe which ids exist elsewhere.
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                $"Prescription {id} was not found.");
        }

        return prescription;
    }

    /// <summary>
    /// Turns the posted lines into entities, snapshotting each medicine's name
    /// from the branch's "Loại thuốc" catalog. A medicine outside that catalog
    /// (another branch's, deleted, or not a medicine) is refused.
    /// </summary>
    private async Task<List<PrescriptionItem>> BuildItemsAsync(
        Guid clinicBranchId,
        IReadOnlyList<CreatePrescriptionItemDto> lines)
    {
        var medicationIds = lines.Select(l => l.MedicationId).Distinct().ToList();

        var medicines = await _catalogRepository.GetListAsync(c =>
            medicationIds.Contains(c.Id)
            && c.ClinicBranchId == clinicBranchId
            && c.Group == TaxonomyGroups.MedicationType);

        var names = medicines.ToDictionary(c => c.Id, c => c.Name);

        var missing = medicationIds.FirstOrDefault(id => !names.ContainsKey(id));
        if (missing != Guid.Empty)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.CatalogEntryNotFound,
                $"Medicine {missing} is not in this branch's catalog.");
        }

        return lines.Select((line, index) => new PrescriptionItem(
            GuidGenerator.Create(),
            line.MedicationId,
            names[line.MedicationId],
            line.TimesPerDay,
            line.AmountPerTime,
            line.Days,
            line.Usage,
            line.OtherUsage,
            index)).ToList();
    }

    private static void GuardTemplateName(bool saveAsTemplate, string? templateName)
    {
        if (saveAsTemplate && string.IsNullOrWhiteSpace(templateName))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionTemplateNameRequired);
        }
    }

    /// <summary>
    /// "Lưu đơn thuốc mẫu": stores the slip's lines and lời dặn as a new entry
    /// of the "Đơn thuốc mẫu" catalog, exactly as the Danh mục screen would
    /// (the lời dặn lives in <c>Description</c> there).
    /// </summary>
    private async Task SaveTemplateAsync(Prescription prescription, string templateName)
    {
        var taxonomy = await AsyncExecuter.FirstOrDefaultAsync(
            (await _taxonomyRepository.GetQueryableAsync())
                .Where(t => t.ClinicBranchId == prescription.ClinicBranchId
                            && t.Group == TaxonomyGroups.PrescriptionTemplate)
                .OrderBy(t => t.SortOrder)
                .ThenBy(t => t.CreationTime));

        if (taxonomy == null)
        {
            taxonomy = Taxonomy.Create(
                GuidGenerator.Create(),
                prescription.ClinicBranchId,
                TaxonomyGroups.PrescriptionTemplate,
                DefaultTemplateGroupName);
            await _taxonomyRepository.InsertAsync(taxonomy, autoSave: true);
        }

        var template = CatalogEntry.Create(
            GuidGenerator.Create(),
            prescription.ClinicBranchId,
            taxonomy.Id,
            TaxonomyGroups.PrescriptionTemplate,
            templateName.Trim(),
            description: prescription.Note);

        template.ReplacePrescriptionLines(prescription.Items.Select(item =>
            new PrescriptionTemplateLine(
                GuidGenerator.Create(),
                template.Id,
                item.MedicationId,
                item.TimesPerDay,
                item.AmountPerTime,
                item.Days,
                item.Usage,
                item.OtherUsage,
                item.SortOrder)));

        await _catalogRepository.InsertAsync(template, autoSave: true);
    }

    /// <summary>
    /// "DT26-0001": two-digit year and a per-branch, per-year sequence. Two
    /// slips saved in the same instant can share a number; the index on Code is
    /// not unique, so nothing breaks — the number is a label, not a key.
    /// </summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId)
    {
        var year = Clock.Now.Year;
        var count = await _repository.CountAsync(x =>
            x.ClinicBranchId == clinicBranchId && x.CreationTime.Year == year);

        return $"DT{year % 100:D2}-{count + 1:D4}";
    }

    private async Task<PrescriptionDto> MapAsync(Prescription prescription)
    {
        return (await MapManyAsync([prescription]))[0];
    }

    private async Task<List<PrescriptionDto>> MapManyAsync(IReadOnlyList<Prescription> prescriptions)
    {
        var staffIds = prescriptions.Select(p => p.StaffId).Distinct().ToList();
        var staffNames = staffIds.Count == 0
            ? new Dictionary<Guid, string>()
            : (await _userRepository.GetListByIdsAsync(staffIds))
                .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return prescriptions.Select(p => new PrescriptionDto
        {
            Id = p.Id,
            PatientId = p.PatientId,
            ClinicBranchId = p.ClinicBranchId,
            Code = p.Code,
            StaffId = p.StaffId,
            StaffName = staffNames.GetValueOrDefault(p.StaffId),
            DiagnosisText = p.DiagnosisText,
            Note = p.Note,
            TreatmentType = p.TreatmentType,
            FollowUpDate = p.FollowUpDate,
            IssuedAt = p.IssuedAt,
            CreationTime = p.CreationTime,
            CreatorId = p.CreatorId,
            LastModificationTime = p.LastModificationTime,
            LastModifierId = p.LastModifierId,
            IsDeleted = p.IsDeleted,
            DeletionTime = p.DeletionTime,
            DeleterId = p.DeleterId,
            Items = p.Items
                .OrderBy(i => i.SortOrder)
                .Select(i => new PrescriptionItemDto
                {
                    Id = i.Id,
                    MedicationId = i.MedicationId,
                    MedicationName = i.MedicationName,
                    TimesPerDay = i.TimesPerDay,
                    AmountPerTime = i.AmountPerTime,
                    Days = i.Days,
                    Quantity = i.Quantity,
                    Usage = i.Usage,
                    OtherUsage = i.OtherUsage,
                    SortOrder = i.SortOrder
                })
                .ToList()
        }).ToList();
    }
}
