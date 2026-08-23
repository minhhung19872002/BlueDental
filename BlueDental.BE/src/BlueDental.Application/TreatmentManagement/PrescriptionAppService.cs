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
/// Đơn thuốc. Medicines come from the "Loại thuốc" catalog, and the name is
/// snapshotted onto the line so a later catalog edit cannot rewrite history.
/// </summary>
[Authorize]
public class PrescriptionAppService : ApplicationService, IPrescriptionAppService
{
    private readonly IRepository<Prescription, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public PrescriptionAppService(
        IRepository<Prescription, Guid> repository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.ClinicBranchId);
        var query = await _repository.WithDetailsAsync(x => x.Items);

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.IssuedAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PrescriptionDto>(totalCount, await MapManyAsync(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Read)]
    public async Task<PrescriptionDto> GetAsync(Guid id)
    {
        var prescription = await LoadAsync(id);
        return (await MapManyAsync([prescription])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Create)]
    public async Task<PrescriptionDto> CreateAsync(CreatePrescriptionDto input)
    {
        await _branchAccess.CheckAsync(input.ClinicBranchId);

        var prescription = Prescription.Issue(
            GuidGenerator.Create(),
            input.PatientId,
            input.ClinicBranchId,
            await GenerateCodeAsync(input.ClinicBranchId),
            input.StaffId,
            await BuildItemsAsync(input.Items),
            input.PatientDiagnosisId,
            input.DiagnosisText,
            input.FollowUpDate,
            input.Note,
            Clock.Now);

        await _repository.InsertAsync(prescription, autoSave: true);
        return (await MapManyAsync([prescription])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Update)]
    public async Task<PrescriptionDto> UpdateAsync(Guid id, UpdatePrescriptionDto input)
    {
        var prescription = await LoadAsync(id);

        prescription.UpdateDetails(
            input.StaffId,
            input.DiagnosisText,
            input.FollowUpDate,
            input.Note,
            await BuildItemsAsync(input.Items));

        await _repository.UpdateAsync(prescription, autoSave: true);
        return (await MapManyAsync([prescription])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Update)]
    public async Task<PrescriptionDto> DispenseAsync(Guid id)
    {
        var prescription = await LoadAsync(id);
        prescription.Dispense();
        await _repository.UpdateAsync(prescription, autoSave: true);
        return (await MapManyAsync([prescription])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Update)]
    public async Task<PrescriptionDto> CancelAsync(Guid id)
    {
        var prescription = await LoadAsync(id);
        prescription.Cancel();
        await _repository.UpdateAsync(prescription, autoSave: true);
        return (await MapManyAsync([prescription])).Single();
    }

    [Authorize(BlueDentalAbilityPermissions.Prescription.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        await LoadAsync(id);
        await _repository.DeleteAsync(id, autoSave: true);
    }

    private async Task<Prescription> LoadAsync(Guid id)
    {
        var query = await _repository.WithDetailsAsync(x => x.Items);
        var prescription = query.FirstOrDefault(x => x.Id == id)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.TreatmentManagement.PrescriptionNotFound,
                "Prescription not found.");

        await _branchAccess.CheckAsync(prescription.ClinicBranchId);
        return prescription;
    }

    /// <summary>Resolves each medicine and snapshots its name onto the line.</summary>
    private async Task<List<PrescriptionItem>> BuildItemsAsync(
        IReadOnlyCollection<CreatePrescriptionItemDto> items)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var medicationIds = items.Select(i => i.MedicationId).Distinct().ToList();
        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var names = catalogQuery
            .Where(c => medicationIds.Contains(c.Id))
            .ToDictionary(c => c.Id, c => c.Name);

        return items.Select(item => new PrescriptionItem(
            GuidGenerator.Create(),
            item.MedicationId,
            names.TryGetValue(item.MedicationId, out var name) ? name : "Thuốc",
            item.Dosage,
            item.Frequency,
            item.DurationDays,
            item.Quantity,
            item.Instructions)).ToList();
    }

    /// <summary>Per-branch, per-year sequence — e.g. DT26-0007.</summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId)
    {
        var year = Clock.Now.Year;
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x =>
            x.ClinicBranchId == clinicBranchId && x.CreationTime.Year == year) + 1;

        return $"DT{year % 100:D2}-{sequence:D4}";
    }

    private async Task<List<PrescriptionDto>> MapManyAsync(IReadOnlyCollection<Prescription> items)
    {
        if (items.Count == 0)
        {
            return [];
        }

        var staffIds = items.Select(x => x.StaffId).Distinct().ToList();
        var users = await _userRepository.GetListByIdsAsync(staffIds);
        var staffNames = users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        return items.Select(x => new PrescriptionDto
        {
            Id = x.Id,
            PatientId = x.PatientId,
            ClinicBranchId = x.ClinicBranchId,
            Code = x.Code,
            StaffId = x.StaffId,
            PatientDiagnosisId = x.PatientDiagnosisId,
            DiagnosisText = x.DiagnosisText,
            FollowUpDate = x.FollowUpDate,
            Note = x.Note,
            Status = x.Status,
            IssuedAt = x.IssuedAt,
            StaffName = staffNames.TryGetValue(x.StaffId, out var staff) ? staff : null,
            Items = x.Items.Select(item => new PrescriptionItemDto
            {
                Id = item.Id,
                MedicationId = item.MedicationId,
                MedicationName = item.MedicationName,
                Dosage = item.Dosage,
                Frequency = item.Frequency,
                DurationDays = item.DurationDays,
                Quantity = item.Quantity,
                Instructions = item.Instructions
            }).ToList(),
            CreationTime = x.CreationTime,
            CreatorId = x.CreatorId,
            LastModificationTime = x.LastModificationTime,
            LastModifierId = x.LastModifierId
        }).ToList();
    }
}
