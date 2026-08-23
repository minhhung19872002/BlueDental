using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.TreatmentManagement;

[Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Default)]
public class DiagnosticRecordAppService(
    IRepository<DiagnosticRecord, Guid> repository,
    IIdentityUserRepository userRepository,
    ICurrentClinicBranchResolver branchResolver) : ApplicationService, IDiagnosticRecordAppService
{
    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.View)]
    public async Task<PagedResultDto<DiagnosticRecordDto>> GetListAsync(GetDiagnosticRecordListInput input)
    {
        var clinicBranchId = branchResolver.GetRequiredClinicBranchId();
        var query = await repository.GetQueryableAsync();

        query = query.Where(d => d.ClinicBranchId == clinicBranchId);

        if (input.PatientId.HasValue)
            query = query.Where(d => d.PatientId == input.PatientId.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
            query = query.Where(d => d.Code.Contains(input.Filter!) || (d.Diagnosis != null && d.Diagnosis.Contains(input.Filter!)));

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(d => d.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dentistIds = items.Select(d => d.DentistId).Distinct().ToList();
        var users = (await userRepository.GetListAsync())
            .Where(u => dentistIds.Contains(u.Id))
            .ToDictionary(u => u.Id, u => u.Name ?? u.UserName ?? "");

        var dtos = items.Select(d =>
        {
            users.TryGetValue(d.DentistId, out var dentistName);
            return new DiagnosticRecordDto
            {
                Id = d.Id,
                Code = d.Code,
                PatientId = d.PatientId,
                ClinicBranchId = d.ClinicBranchId,
                DentistId = d.DentistId,
                DentistName = dentistName,
                AppointmentId = d.AppointmentId,
                TeethNumbers = d.TeethNumbers,
                Diagnosis = d.Diagnosis,
                Notes = d.Notes,
                CreationTime = d.CreationTime,
            };
        }).ToList();

        return new PagedResultDto<DiagnosticRecordDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Create)]
    public async Task<DiagnosticRecordDto> CreateAsync(CreateDiagnosticRecordDto input)
    {
        var clinicBranchId = branchResolver.GetRequiredClinicBranchId();
        var code = $"CD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpper()}";
        var entity = new DiagnosticRecord(
            GuidGenerator.Create(),
            code,
            input.PatientId,
            clinicBranchId,
            input.DentistId,
            input.AppointmentId,
            input.TeethNumbers,
            input.Diagnosis,
            input.Notes);

        await repository.InsertAsync(entity);

        return new DiagnosticRecordDto
        {
            Id = entity.Id,
            Code = entity.Code,
            PatientId = entity.PatientId,
            ClinicBranchId = entity.ClinicBranchId,
            DentistId = entity.DentistId,
            AppointmentId = entity.AppointmentId,
            TeethNumbers = entity.TeethNumbers,
            Diagnosis = entity.Diagnosis,
            Notes = entity.Notes,
            CreationTime = entity.CreationTime,
        };
    }

    [Authorize(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit)]
    public async Task DeleteAsync(Guid id)
    {
        await repository.DeleteAsync(id);
    }
}
