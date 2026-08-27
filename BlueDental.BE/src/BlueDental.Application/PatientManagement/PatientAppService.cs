using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement.Values;
using BlueDental.Exporting;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

[Authorize]
public class PatientAppService : ApplicationService, IPatientAppService
{
    [Authorize]
    public async Task<byte[]> ExportAsync(GetPatientListInput input)
    {
        var page = await GetListAsync(new GetPatientListInput
        {
            Filter = input.Filter,
            Status = input.Status,
            MaxResultCount = 1000
        });

        return ExcelSheet.Build(
            "Benh nhan",
            "Danh sách bệnh nhân",
            new List<ExcelColumn<PatientDto>>
            {
                new("Mã bệnh nhân", row => row.PatientCode, 18),
                new("Họ và tên", row => $"{row.LastName} {row.FirstName}".Trim(), 26),
                new("Ngày sinh", row => row.DateOfBirth.ToDateTime(TimeOnly.MinValue), 14),
                new("Giới tính", row => row.Gender.ToString(), 12),
                new("Điện thoại", row => row.PhoneNumber, 16),
                new("Email", row => row.Email, 26),
                new("Trạng thái", row => row.Status.ToString(), 14)
            },
            page.Items);
    }

    private readonly IRepository<Patient, Guid> _repository;
    private readonly IRepository<PatientTag, Guid> _tagRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientAppService(
        IRepository<Patient, Guid> repository,
        IRepository<PatientTag, Guid> tagRepository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _tagRepository = tagRepository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<PagedResultDto<PatientDto>> GetListAsync(GetPatientListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(p => p.BranchId == branchId);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            // The UI shows and searches one full name ("họ tên"), so the concatenation
            // has to match too — matching the halves alone never finds a typed full name.
            var filter = input.Filter.Trim();

            query = query.Where(p =>
                p.FirstName.Contains(filter)
                || p.LastName.Contains(filter)
                || (p.LastName + " " + p.FirstName).Contains(filter)
                || p.PatientCode.Contains(filter)
                || (p.Contact.PhoneNumber != null && p.Contact.PhoneNumber.Contains(filter)));
        }

        if (input.Status.HasValue) query = query.Where(p => p.Status == input.Status.Value);
        if (input.TagId.HasValue) query = query.Where(p => p.TagIds.Contains(input.TagId.Value));

        var totalCount = query.Count();

        // Newest first: a receptionist looks for the record they just created.
        var items = query
            .OrderByDescending(p => p.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<PatientDto>(
            totalCount,
            ObjectMapper.Map<System.Collections.Generic.List<Patient>, System.Collections.Generic.List<PatientDto>>(items));
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<PatientDto> GetAsync(Guid id)
    {
        var patient = await _repository.GetAsync(id);
        GuardBranchAccess(patient);
        return ObjectMapper.Map<Patient, PatientDto>(patient);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Create)]
    public async Task<PatientDto> RegisterAsync(RegisterPatientDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var contact = new ContactInfo(input.PhoneNumber, input.Email, null);
        var patientCode = await GeneratePatientCodeAsync(branchId);

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

        if (input.TagIds is { Count: > 0 })
        {
            patient.SetTags(await OwnBranchTagsAsync(branchId, input.TagIds));
        }

        await _repository.InsertAsync(patient, autoSave: true);
        return ObjectMapper.Map<Patient, PatientDto>(patient);
    }

    /// <summary>
    /// Human-readable patient code, per branch and year — the reference uses the
    /// same shape (e.g. <c>DH26010</c>).
    ///
    /// The previous scheme took six characters of a sequential GUID, which are
    /// the high-order timestamp bits and barely move: two registrations seconds
    /// apart produced the same code and hit the unique index.
    /// </summary>
    private async Task<string> GeneratePatientCodeAsync(Guid branchId)
    {
        var year = Clock.Now.Year;
        var query = await _repository.GetQueryableAsync();

        var sequence = query.Count(p => p.BranchId == branchId && p.CreationTime.Year == year) + 1;
        var code = FormatPatientCode(year, sequence);

        // Deleted or imported records can leave gaps and duplicates in the count,
        // so walk forward until the code is genuinely free.
        while (query.Any(p => p.PatientCode == code))
        {
            sequence++;
            code = FormatPatientCode(year, sequence);
        }

        return code;
    }

    private static string FormatPatientCode(int year, int sequence) =>
        $"BD{year % 100:D2}{sequence:D4}";

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task<PatientDto> UpdateAsync(Guid id, UpdatePatientDto input)
    {
        var patient = await _repository.GetAsync(id);
        GuardBranchAccess(patient);
        patient.UpdateDemographics(input.FirstName, input.LastName, input.DateOfBirth, input.Gender);
        var contact = new ContactInfo(input.PhoneNumber, input.Email, null);
        patient.UpdateContact(contact);

        if (input.TagIds is not null)
        {
            patient.SetTags(await OwnBranchTagsAsync(patient.BranchId, input.TagIds));
        }

        await _repository.UpdateAsync(patient, autoSave: true);
        return ObjectMapper.Map<Patient, PatientDto>(patient);
    }

    /// <summary>
    /// Keeps only ids that exist in this branch's Thẻ hồ sơ catalog, so a
    /// client cannot pin another branch's tag (or a random id) on a patient.
    /// </summary>
    private async Task<List<Guid>> OwnBranchTagsAsync(Guid branchId, List<Guid> tagIds)
    {
        if (tagIds.Count == 0)
        {
            return tagIds;
        }

        var tagQuery = await _tagRepository.GetQueryableAsync();
        return tagQuery
            .Where(t => t.ClinicBranchId == branchId && tagIds.Contains(t.Id))
            .Select(t => t.Id)
            .ToList();
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task DeactivateAsync(Guid id)
    {
        var patient = await _repository.GetAsync(id);
        GuardBranchAccess(patient);
        patient.Deactivate();
        await _repository.UpdateAsync(patient, autoSave: true);
    }

    private void GuardBranchAccess(Patient entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Patient), entity.Id);
    }
}
