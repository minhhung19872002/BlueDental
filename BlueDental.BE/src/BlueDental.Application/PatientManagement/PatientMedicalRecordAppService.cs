using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// Bệnh án — the sheets a patient's record is made of.
///
/// The reference reads them per patient
/// (<c>GET /patient-medical-record/files/{patientId}</c>) and the index adds one
/// at a time, so this is an ordinary branch-scoped collection: list, add,
/// save, remove. The sheet's printed layout lives on the client; only the
/// cells the clinic filled in are stored.
/// </summary>
[Authorize]
public class PatientMedicalRecordAppService : ApplicationService, IPatientMedicalRecordAppService
{
    private readonly IRepository<PatientMedicalRecord, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly BranchAccessChecker _branchAccess;

    public PatientMedicalRecordAppService(
        IRepository<PatientMedicalRecord, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<PagedResultDto<PatientMedicalRecordDto>> GetListAsync(
        GetPatientMedicalRecordListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(null);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
        {
            query = query.Where(x => branchFilter.Contains(x.ClinicBranchId));
        }

        if (input.PatientId.HasValue)
        {
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        }

        if (input.Form.HasValue)
        {
            query = query.Where(x => x.Form == input.Form.Value);
        }

        var totalCount = await AsyncExecuter.CountAsync(query);

        // The index is an ordered stack, so the order is part of the record —
        // CreationTime only breaks a tie between two sheets added together.
        var items = await AsyncExecuter.ToListAsync(
            query
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.CreationTime)
                .Skip(input.SkipCount)
                .Take(input.MaxResultCount));

        return new PagedResultDto<PatientMedicalRecordDto>(totalCount, items.Select(MapToDto).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Read)]
    public async Task<PatientMedicalRecordDto> GetAsync(Guid id)
    {
        var entity = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(entity);
        return MapToDto(entity);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Create)]
    public async Task<PatientMedicalRecordDto> CreateAsync(CreatePatientMedicalRecordDto input)
    {
        // A sheet belongs to the branch its patient does — the clinic never
        // picks one, so there is nothing here to spoof.
        var patient = await _patientRepository.GetAsync(input.PatientId);
        await _branchAccess.CheckAsync(patient.BranchId);

        var query = await _repository.GetQueryableAsync();
        var nextOrder = await AsyncExecuter.CountAsync(
            query.Where(x => x.PatientId == input.PatientId));

        var record = PatientMedicalRecord.Add(
            GuidGenerator.Create(),
            input.PatientId,
            patient.BranchId,
            input.Form,
            input.Title,
            nextOrder);

        await _repository.InsertAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Update)]
    public async Task<PatientMedicalRecordDto> UpdateAsync(Guid id, UpdatePatientMedicalRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);

        if (!string.IsNullOrWhiteSpace(input.Title))
        {
            record.Rename(input.Title);
        }

        // Only when the caller actually sent content. A rename carries just the
        // title, so filling unconditionally would erase everything on the sheet;
        // clearing it is done by sending an empty document, not by omission.
        if (input.Content is not null)
        {
            record.Fill(input.Content);
        }

        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record);
    }

    [Authorize(BlueDentalAbilityPermissions.PatientMedicalRecord.Delete)]
    public async Task DeleteAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        await _repository.DeleteAsync(record, autoSave: true);
    }

    /// <summary>
    /// A sheet the caller's branch may not see is reported as missing rather
    /// than forbidden, so the API never confirms that someone else's record
    /// exists.
    /// </summary>
    private async Task GuardBranchAccessAsync(PatientMedicalRecord record)
    {
        if (!await _branchAccess.IsAllowedAsync(record.ClinicBranchId))
        {
            throw new EntityNotFoundException(typeof(PatientMedicalRecord), record.Id);
        }
    }

    private static PatientMedicalRecordDto MapToDto(PatientMedicalRecord entity) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        ClinicBranchId = entity.ClinicBranchId,
        Form = entity.Form,
        Title = entity.Title,
        SortOrder = entity.SortOrder,
        Content = entity.Content,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId,
    };
}
