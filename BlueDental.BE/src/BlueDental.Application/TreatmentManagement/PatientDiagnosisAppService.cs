using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.TreatmentManagement.Values;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Chẩn đoán của bệnh nhân (Diagnosis recorded per patient and tooth).
/// </summary>
[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
public class PatientDiagnosisAppService : ApplicationService, IPatientDiagnosisAppService
{
    private readonly IRepository<PatientDiagnosis, Guid> _repository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientDiagnosisAppService(
        IRepository<PatientDiagnosis, Guid> repository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.View)]
    public async Task<PagedResultDto<PatientDiagnosisDto>> GetListAsync(GetPatientDiagnosisListInput input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(x => x.ClinicBranchId == clinicBranchId);
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.StaffId.HasValue)
            query = query.Where(x => x.StaffId == input.StaffId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);
        if (input.HasTreatmentService.HasValue)
            query = query.Where(x => x.HasTreatmentService == input.HasTreatmentService.Value);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = items.Select(MapToDto).ToList();
        await FillNamesAsync(dtos);

        return new PagedResultDto<PatientDiagnosisDto>(totalCount, dtos);
    }

    /// <summary>
    /// A diagnosis row stores ids; the table shows names — the diagnosing
    /// doctor, the second doctor and the diagnosis itself. Resolved in one read
    /// per kind rather than one per row.
    ///
    /// Without this the DTO's three name fields went out null and the reference's
    /// "Bác sĩ chẩn đoán 1", "Chẩn đoán 2" and "Răng" columns all read "—".
    /// </summary>
    private async Task FillNamesAsync(IReadOnlyList<PatientDiagnosisDto> dtos)
    {
        if (dtos.Count == 0)
        {
            return;
        }

        var staffIds = dtos
            .SelectMany(d => new[] { (Guid?)d.StaffId, d.SecondStaffId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var staff = (await _userRepository.GetListByIdsAsync(staffIds))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var diagnosisIds = dtos.Select(d => d.DiagnosisId).Distinct().ToList();
        var diagnosisQuery = await _catalogRepository.GetQueryableAsync();
        var diagnoses = (await AsyncExecuter.ToListAsync(
                diagnosisQuery.Where(c => diagnosisIds.Contains(c.Id))))
            .ToDictionary(c => c.Id, c => c.Name);

        foreach (var dto in dtos)
        {
            dto.StaffName = staff.GetValueOrDefault(dto.StaffId);
            dto.SecondStaffName = dto.SecondStaffId.HasValue
                ? staff.GetValueOrDefault(dto.SecondStaffId.Value)
                : null;
            dto.DiagnosisName = diagnoses.GetValueOrDefault(dto.DiagnosisId);
        }
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.View)]
    public async Task<PatientDiagnosisDto> GetAsync(Guid id)
    {
        return MapToDto(await _repository.GetAsync(id));
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Create)]
    public async Task<PatientDiagnosisDto> CreateAsync(CreatePatientDiagnosisDto input)
    {
        var clinicBranchId = _branchResolver.GetRequiredClinicBranchId();
        var code = await GenerateCodeAsync(clinicBranchId);

        var diagnosis = PatientDiagnosis.Record(
            GuidGenerator.Create(),
            input.PatientId,
            clinicBranchId,
            input.DiagnosisId,
            input.StaffId,
            code,
            ToToothSelections(input.Teeth),
            input.Note,
            input.SecondStaffId);

        await _repository.InsertAsync(diagnosis, autoSave: true);
        return MapToDto(diagnosis);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit)]
    public async Task<PatientDiagnosisDto> UpdateAsync(Guid id, UpdatePatientDiagnosisDto input)
    {
        var diagnosis = await _repository.GetAsync(id);

        diagnosis.ChangeStaff(input.StaffId, input.SecondStaffId);
        diagnosis.UpdateNote(input.Note);
        diagnosis.UpdateTeeth(ToToothSelections(input.Teeth));

        await _repository.UpdateAsync(diagnosis, autoSave: true);
        return MapToDto(diagnosis);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit)]
    public async Task<PatientDiagnosisDto> MarkTreatedAsync(Guid id)
    {
        var diagnosis = await _repository.GetAsync(id);
        diagnosis.MarkTreated();
        await _repository.UpdateAsync(diagnosis, autoSave: true);
        return MapToDto(diagnosis);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit)]
    public async Task<PatientDiagnosisDto> CancelAsync(Guid id)
    {
        var diagnosis = await _repository.GetAsync(id);
        diagnosis.Cancel();
        await _repository.UpdateAsync(diagnosis, autoSave: true);
        return MapToDto(diagnosis);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit)]
    public async Task DeleteAsync(Guid id)
    {
        await _repository.DeleteAsync(id, autoSave: true);
    }

    /// <summary>Sequential per-branch, per-year code — e.g. <c>CD26-0007</c>.</summary>
    private async Task<string> GenerateCodeAsync(Guid clinicBranchId)
    {
        var year = Clock.Now.Year;
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(x => x.ClinicBranchId == clinicBranchId && x.CreationTime.Year == year) + 1;
        return $"CD{year % 100:D2}-{sequence:D4}";
    }

    internal static List<ToothSelection> ToToothSelections(IEnumerable<ToothSelectionDto>? teeth)
    {
        return (teeth ?? Enumerable.Empty<ToothSelectionDto>())
            .Select(t => new ToothSelection(
                t.ToothCode, t.Selected, t.Top, t.Right, t.Bottom, t.Left, t.Center))
            .ToList();
    }

    internal static List<ToothSelectionDto> ToToothDtos(IEnumerable<ToothSelection> teeth)
    {
        return teeth.Select(t => new ToothSelectionDto
        {
            ToothCode = t.ToothCode,
            Selected = t.Selected,
            Top = t.Top,
            Right = t.Right,
            Bottom = t.Bottom,
            Left = t.Left,
            Center = t.Center
        }).ToList();
    }

    private static PatientDiagnosisDto MapToDto(PatientDiagnosis entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        DiagnosisId = entity.DiagnosisId,
        StaffId = entity.StaffId,
        SecondStaffId = entity.SecondStaffId,
        Code = entity.Code,
        Note = entity.Note,
        Status = entity.Status,
        HasTreatmentService = entity.HasTreatmentService,
        Teeth = ToToothDtos(entity.Teeth),
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
