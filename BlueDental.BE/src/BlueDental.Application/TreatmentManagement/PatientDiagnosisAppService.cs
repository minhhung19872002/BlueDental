using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.TreatmentManagement.Values;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Chẩn đoán của bệnh nhân (Diagnosis recorded per patient and tooth).
/// </summary>
[Authorize(BlueDentalPermissions.TreatmentManagement.Default)]
public class PatientDiagnosisAppService : ApplicationService, IPatientDiagnosisAppService
{
    private readonly IRepository<PatientDiagnosis, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientDiagnosisAppService(
        IRepository<PatientDiagnosis, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
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

        return new PagedResultDto<PatientDiagnosisDto>(totalCount, items.Select(MapToDto).ToList());
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
