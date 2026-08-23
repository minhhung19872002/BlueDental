using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement.Values;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

[Authorize(BlueDentalPermissions.PatientManagement.Default)]
public class PatientAppService : ApplicationService, IPatientAppService
{
    private readonly IRepository<Patient, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientAppService(
        IRepository<Patient, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.PatientManagement.Patients.View)]
    public async Task<PagedResultDto<PatientDto>> GetListAsync(GetPatientListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(p => p.BranchId == branchId);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            query = query.Where(p =>
                p.FirstName.Contains(input.Filter)
                || p.LastName.Contains(input.Filter)
                || p.PatientCode.Contains(input.Filter));
        }

        if (input.Status.HasValue) query = query.Where(p => p.Status == input.Status.Value);

        var totalCount = query.Count();
        var items = query.Skip(input.SkipCount).Take(input.MaxResultCount).ToList();

        return new PagedResultDto<PatientDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Patient>, System.Collections.Generic.List<PatientDto>>(items));
    }

    [Authorize(BlueDentalPermissions.PatientManagement.Patients.View)]
    public async Task<PatientDto> GetAsync(Guid id)
    {
        var patient = await _repository.GetAsync(id);
        return ObjectMapper.Map<Patient, PatientDto>(patient);
    }

    [Authorize(BlueDentalPermissions.PatientManagement.Patients.Create)]
    public async Task<PatientDto> RegisterAsync(RegisterPatientDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var contact = new ContactInfo(input.PhoneNumber, input.Email, null);
        var patientCode = $"P{Clock.Now:yyyyMMdd}{GuidGenerator.Create().ToString("N")[..6].ToUpper()}";

        var patient = Patient.Register(
            GuidGenerator.Create(),
            patientCode,
            input.FirstName,
            input.LastName,
            input.DateOfBirth,
            input.Gender,
            contact,
            branchId,
            input.NationalId);

        await _repository.InsertAsync(patient, autoSave: true);
        return ObjectMapper.Map<Patient, PatientDto>(patient);
    }

    [Authorize(BlueDentalPermissions.PatientManagement.Patients.Edit)]
    public async Task<PatientDto> UpdateAsync(Guid id, UpdatePatientDto input)
    {
        var patient = await _repository.GetAsync(id);
        patient.UpdateDemographics(input.FirstName, input.LastName, input.DateOfBirth, input.Gender);
        var contact = new ContactInfo(input.PhoneNumber, input.Email, null);
        patient.UpdateContact(contact);
        await _repository.UpdateAsync(patient, autoSave: true);
        return ObjectMapper.Map<Patient, PatientDto>(patient);
    }

    [Authorize(BlueDentalPermissions.PatientManagement.Patients.Delete)]
    public async Task DeactivateAsync(Guid id)
    {
        var patient = await _repository.GetAsync(id);
        patient.Deactivate();
        await _repository.UpdateAsync(patient, autoSave: true);
    }
}
