using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.PatientManagement.Values;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.PatientManagement;

[Authorize]
public class PatientAppService : ApplicationService, IPatientAppService
{
    /// <summary>What "Xuất file" pulls — the reference exports the whole filtered list.</summary>
    private const int ExportRowCap = 5000;

    private readonly IRepository<Patient, Guid> _repository;
    private readonly IRepository<PatientTag, Guid> _tagRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<ClinicBranch, Guid> _branchRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly PatientListRollupCalculator _rollup;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public PatientAppService(
        IRepository<Patient, Guid> repository,
        IRepository<PatientTag, Guid> tagRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<PatientPayment, Guid> paymentRepository,
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<ClinicBranch, Guid> branchRepository,
        IIdentityUserRepository userRepository,
        PatientListRollupCalculator rollup,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _tagRepository = tagRepository;
        _catalogRepository = catalogRepository;
        _planRepository = planRepository;
        _paymentRepository = paymentRepository;
        _appointmentRepository = appointmentRepository;
        _branchRepository = branchRepository;
        _userRepository = userRepository;
        _rollup = rollup;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<PagedResultDto<PatientListItemDto>> GetListAsync(GetPatientListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var page = await ReadPageAsync(input, branchId, input.SkipCount, input.MaxResultCount);
        return new PagedResultDto<PatientListItemDto>(page.TotalCount, page.Items);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<PatientDto> GetAsync(Guid id)
    {
        var patient = await _repository.GetAsync(id);
        GuardBranchAccess(patient);
        return MapToDto(patient);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<PatientCodeEstimateDto> GetCodeEstimateAsync()
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var year = Clock.Now.Year;
        var sequence = await NextFreeSequenceAsync(branchId, year);

        return new PatientCodeEstimateDto
        {
            Prefix = CodePrefix(year),
            Sequence = FormatSequence(sequence),
            Code = FormatPatientCode(year, sequence)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<PhoneAvailabilityDto> CheckPhoneAsync(string phone, Guid? excludeId = null)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();

        if (string.IsNullOrWhiteSpace(phone))
        {
            return new PhoneAvailabilityDto { Exists = false };
        }

        var trimmed = phone.Trim();
        var query = await _repository.GetQueryableAsync();

        var owner = query
            .Where(p => p.BranchId == branchId && p.Contact.PhoneNumber == trimmed)
            .Where(p => !excludeId.HasValue || p.Id != excludeId.Value)
            .Select(p => new { p.LastName, p.FirstName, p.PatientCode })
            .FirstOrDefault();

        return owner is null
            ? new PhoneAvailabilityDto { Exists = false }
            : new PhoneAvailabilityDto
            {
                Exists = true,
                PatientName = $"{owner.LastName} {owner.FirstName}".Trim(),
                PatientCode = owner.PatientCode
            };
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Create)]
    public async Task<PatientDto> RegisterAsync(RegisterPatientDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var contact = new ContactInfo(input.PhoneNumber, input.Email, input.Address);

        var patient = Patient.Register(
            GuidGenerator.Create(),
            await ResolveCodeAsync(branchId, input.PatientCode),
            input.FirstName,
            input.LastName,
            input.DateOfBirth,
            input.Gender,
            contact,
            branchId,
            input.NationalId);

        await ApplyProfileAsync(
            patient,
            branchId,
            input.SourceTaxonomyId,
            input.SourceEntryId,
            input.OccupationEntryId,
            input.OccupationOther,
            input.InsuranceNumber,
            input.ProvinceCode,
            input.WardCode,
            input.ExaminationReason,
            input.Note,
            input.TagIds,
            input.DiseaseHistoryEntryIds);

        await _repository.InsertAsync(patient, autoSave: true);
        return MapToDto(patient);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task<PatientDto> UpdateAsync(Guid id, UpdatePatientDto input)
    {
        var patient = await _repository.GetAsync(id);
        GuardBranchAccess(patient);

        patient.UpdateDemographics(input.FirstName, input.LastName, input.DateOfBirth, input.Gender);
        patient.UpdateContact(new ContactInfo(input.PhoneNumber, input.Email, input.Address));

        if (!string.IsNullOrWhiteSpace(input.PatientCode) && input.PatientCode.Trim() != patient.PatientCode)
        {
            patient.SetPatientCode(await EnsureCodeIsFreeAsync(input.PatientCode.Trim(), patient.Id));
        }

        await ApplyProfileAsync(
            patient,
            patient.BranchId,
            input.SourceTaxonomyId,
            input.SourceEntryId,
            input.OccupationEntryId,
            input.OccupationOther,
            input.InsuranceNumber,
            input.ProvinceCode,
            input.WardCode,
            input.ExaminationReason,
            input.Note,
            input.TagIds,
            input.DiseaseHistoryEntryIds);

        await _repository.UpdateAsync(patient, autoSave: true);
        return MapToDto(patient);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Update)]
    public async Task DeactivateAsync(Guid id)
    {
        var patient = await _repository.GetAsync(id);
        GuardBranchAccess(patient);
        patient.Deactivate();
        await _repository.UpdateAsync(patient, autoSave: true);
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<byte[]> ExportAsync(GetPatientListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var branchName = (await _branchRepository.FindAsync(branchId))?.Name ?? string.Empty;
        var page = await ReadPageAsync(input, branchId, skipCount: 0, maxResultCount: ExportRowCap);

        // Same twelve columns, in the same order, as the reference's export.
        return ExcelSheet.Build(
            "Benh nhan",
            L["Danh sách bệnh nhân"],
            new List<ExcelColumn<PatientListItemDto>>
            {
                new(L["Ngày tạo hồ sơ"], row => row.CreationTime, 18),
                new(L["Họ và tên"], row => row.FullName, 24),
                new(L["Số điện thoại"], row => row.PhoneNumber, 18),
                new(L["Mã khách hàng"], row => row.PatientCode, 16),
                new(L["Chi nhánh"], _ => branchName, 28),
                new(L["Trạng thái điều trị"], row => TreatmentStatusLabel(row.TreatmentStatus), 18),
                new(L["Dịch vụ"], row => string.Join(", ", row.ServiceNames), 28),
                new(L["Bác sĩ"], row => string.Join(", ", row.StaffNames), 28),
                new(L["Số tiền"], row => row.TotalAmount, 20),
                new(L["Thực thu"], row => row.TotalRevenue, 18),
                new(L["Công nợ"], row => row.TotalDebt, 18),
                new(L["Lần khám cuối"], row => row.LastVisitAt?.DateTime, 20)
            },
            page.Items);
    }

    // ── Reading one page ─────────────────────────────────────────────────────

    /// <summary>
    /// Filters, pages, then rolls up.
    ///
    /// The rollup normally covers the requested page only — pulling every slip
    /// in the branch to render twenty rows does not scale. Trạng thái is the one
    /// filter that cannot work that way: it is derived from the slips, so when a
    /// tab other than "Tất cả" is chosen every match has to be rolled up before
    /// the page can be cut. That path is bounded by <see cref="ExportRowCap"/>.
    /// </summary>
    private async Task<PagedResultDto<PatientListItemDto>> ReadPageAsync(
        GetPatientListInput input,
        Guid branchId,
        int skipCount,
        int maxResultCount)
    {
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
        if (input.FromDate.HasValue) query = query.Where(p => p.CreationTime >= input.FromDate.Value.UtcDateTime);
        if (input.ToDate.HasValue) query = query.Where(p => p.CreationTime <= input.ToDate.Value.UtcDateTime);

        // Bác sĩ and Phân loại dịch vụ are facts about the slips, not the record,
        // so they narrow the patient set before paging rather than after.
        var slipScope = await SlipScopedPatientIdsAsync(branchId, input.StaffId, input.ServiceTaxonomyId);
        if (slipScope is not null) query = query.Where(p => slipScope.Contains(p.Id));

        // Newest first: a receptionist looks for the record they just created.
        var ordered = query.OrderByDescending(p => p.CreationTime);

        if (!input.TreatmentStatus.HasValue)
        {
            var totalCount = ordered.Count();
            var pageOfPatients = ordered.Skip(skipCount).Take(maxResultCount).ToList();
            return new PagedResultDto<PatientListItemDto>(
                totalCount,
                await BuildRowsAsync(pageOfPatients, branchId));
        }

        var rows = await BuildRowsAsync(ordered.Take(ExportRowCap).ToList(), branchId);
        var matching = rows.Where(r => Matches(r.TreatmentStatus, input.TreatmentStatus.Value)).ToList();

        return new PagedResultDto<PatientListItemDto>(
            matching.Count,
            matching.Skip(skipCount).Take(maxResultCount).ToList());
    }

    private static bool Matches(PatientTreatmentStatus status, PatientTreatmentFilter filter) => filter switch
    {
        PatientTreatmentFilter.Pending =>
            status is PatientTreatmentStatus.None or PatientTreatmentStatus.Created,
        PatientTreatmentFilter.InTreatment => status == PatientTreatmentStatus.InProgress,
        PatientTreatmentFilter.Completed => status == PatientTreatmentStatus.Done,
        _ => true
    };

    /// <summary>
    /// The patients whose slips match the Bác sĩ / Phân loại dịch vụ pickers, or
    /// null when neither is set and every patient still qualifies.
    /// </summary>
    private async Task<HashSet<Guid>?> SlipScopedPatientIdsAsync(
        Guid branchId,
        Guid? staffId,
        Guid? serviceTaxonomyId)
    {
        if (!staffId.HasValue && !serviceTaxonomyId.HasValue)
        {
            return null;
        }

        var plans = await _planRepository.GetQueryableAsync();
        var scoped = plans.Where(p => p.BranchId == branchId && p.Status != TreatmentPlanStatus.Cancelled);

        if (staffId.HasValue)
        {
            scoped = scoped.Where(p => p.DentistId == staffId.Value);
        }

        if (serviceTaxonomyId.HasValue)
        {
            var catalog = await _catalogRepository.GetQueryableAsync();
            var serviceIds = catalog
                .Where(c => c.TaxonomyId == serviceTaxonomyId.Value)
                .Select(c => c.Id)
                .ToHashSet();

            scoped = scoped.Where(p => p.Services.Any(s => serviceIds.Contains(s.ServiceId)));
        }

        return scoped.Select(p => p.PatientId).ToHashSet();
    }

    /// <summary>Folds the loaded aggregates into rows, naming ids as it goes.</summary>
    private async Task<List<PatientListItemDto>> BuildRowsAsync(List<Patient> patients, Guid branchId)
    {
        if (patients.Count == 0)
        {
            return new List<PatientListItemDto>();
        }

        var patientIds = patients.Select(p => p.Id).ToHashSet();

        var planQuery = await _planRepository.GetQueryableAsync();
        var plansByPatient = planQuery
            .Where(p => p.BranchId == branchId && patientIds.Contains(p.PatientId))
            .ToList()
            .GroupBy(p => p.PatientId)
            .ToDictionary(g => g.Key, g => (IReadOnlyCollection<TreatmentPlan>)g.ToList());

        var paymentQuery = await _paymentRepository.GetQueryableAsync();
        var paymentsByPatient = paymentQuery
            .Where(p => p.ClinicBranchId == branchId && patientIds.Contains(p.PatientId))
            .ToList()
            .GroupBy(p => p.PatientId)
            .ToDictionary(g => g.Key, g => (IReadOnlyCollection<PatientPayment>)g.ToList());

        var appointmentQuery = await _appointmentRepository.GetQueryableAsync();
        var appointmentsByPatient = appointmentQuery
            .Where(a => a.BranchId == branchId && patientIds.Contains(a.PatientId))
            .ToList()
            .GroupBy(a => a.PatientId)
            .ToDictionary(g => g.Key, g => (IReadOnlyCollection<Appointment>)g.ToList());

        var empty = Array.Empty<TreatmentPlan>();
        var noPayments = Array.Empty<PatientPayment>();
        var noAppointments = Array.Empty<Appointment>();
        var now = Clock.Now;

        var rollups = patients.ToDictionary(
            patient => patient.Id,
            patient => _rollup.For(
                patient,
                plansByPatient.GetValueOrDefault(patient.Id, empty),
                paymentsByPatient.GetValueOrDefault(patient.Id, noPayments),
                appointmentsByPatient.GetValueOrDefault(patient.Id, noAppointments),
                now));

        var serviceNames = await NamesOfServicesAsync(
            rollups.Values.SelectMany(r => r.ServiceCatalogIds).ToHashSet());
        var staffNames = await NamesOfStaffAsync(
            rollups.Values.SelectMany(r => r.DentistIds).ToHashSet());

        return patients.Select(patient =>
        {
            var rollup = rollups[patient.Id];

            return new PatientListItemDto
            {
                Id = patient.Id,
                PatientCode = patient.PatientCode,
                FullName = patient.FullName,
                DateOfBirth = patient.DateOfBirth,
                PhoneNumber = patient.Contact.PhoneNumber,
                TreatmentStatus = rollup.TreatmentStatus,
                ServiceNames = Named(rollup.ServiceCatalogIds, serviceNames),
                StaffNames = Named(rollup.DentistIds, staffNames),
                TotalAmount = rollup.TotalAmount,
                TotalRevenue = rollup.TotalRevenue,
                TotalDebt = rollup.TotalDebt,
                NextAppointmentAt = rollup.NextAppointmentAt,
                LastVisitAt = rollup.LastVisitAt,
                CreationTime = patient.CreationTime
            };
        }).ToList();
    }

    private static List<string> Named(IReadOnlyList<Guid> ids, IReadOnlyDictionary<Guid, string> names) =>
        ids.Select(id => names.GetValueOrDefault(id)).Where(name => name is not null).Select(name => name!).ToList();

    private async Task<Dictionary<Guid, string>> NamesOfServicesAsync(HashSet<Guid> ids)
    {
        if (ids.Count == 0) return new Dictionary<Guid, string>();

        var query = await _catalogRepository.GetQueryableAsync();
        return query
            .Where(c => ids.Contains(c.Id))
            .Select(c => new { c.Id, c.Name })
            .ToList()
            .ToDictionary(c => c.Id, c => c.Name);
    }

    private async Task<Dictionary<Guid, string>> NamesOfStaffAsync(HashSet<Guid> ids)
    {
        if (ids.Count == 0) return new Dictionary<Guid, string>();

        var users = await _userRepository.GetListByIdsAsync(ids.ToList());
        return users.ToDictionary(
            u => u.Id,
            u => string.Join(" ", new[] { u.Surname, u.Name }.Where(part => !string.IsNullOrWhiteSpace(part))).Trim() is { Length: > 0 } full
                ? full
                : u.UserName);
    }

    private string TreatmentStatusLabel(PatientTreatmentStatus status) => status switch
    {
        PatientTreatmentStatus.InProgress => L["Đang điều trị"],
        PatientTreatmentStatus.Done => L["Hoàn tất"],
        _ => L["Chưa phát sinh"]
    };

    // ── Writing ──────────────────────────────────────────────────────────────

    /// <summary>
    /// The parts of the hồ sơ dialog that are the same on create and edit. Each
    /// list is optional: null keeps what is stored, a list replaces it whole.
    /// </summary>
    private async Task ApplyProfileAsync(
        Patient patient,
        Guid branchId,
        Guid? sourceTaxonomyId,
        Guid? sourceEntryId,
        Guid? occupationEntryId,
        string? occupationOther,
        string? insuranceNumber,
        string? provinceCode,
        string? wardCode,
        string? examinationReason,
        string? note,
        List<Guid>? tagIds,
        List<Guid>? diseaseHistoryEntryIds)
    {
        patient.SetSource(sourceTaxonomyId, sourceEntryId);
        patient.SetOccupation(occupationEntryId, occupationOther);
        patient.SetInsuranceNumber(insuranceNumber);
        patient.SetResidence(provinceCode, wardCode);
        patient.SetNotes(examinationReason, note);

        if (tagIds is not null)
        {
            patient.SetTags(await OwnBranchTagsAsync(branchId, tagIds));
        }

        if (diseaseHistoryEntryIds is not null)
        {
            patient.SetDiseaseHistory(await OwnBranchCatalogEntriesAsync(branchId, diseaseHistoryEntryIds));
        }
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

    /// <summary>The same guard for catalog entries — Tiểu sử bệnh boxes here.</summary>
    private async Task<List<Guid>> OwnBranchCatalogEntriesAsync(Guid branchId, List<Guid> entryIds)
    {
        if (entryIds.Count == 0)
        {
            return entryIds;
        }

        var query = await _catalogRepository.GetQueryableAsync();
        return query
            .Where(c => c.ClinicBranchId == branchId && entryIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToList();
    }

    /// <summary>
    /// Human-readable patient code, per branch and year — the reference uses the
    /// same shape (e.g. <c>DH26010</c>) and lets the front desk overwrite the
    /// numeric half, so a supplied code wins as long as it is free.
    /// </summary>
    private async Task<string> ResolveCodeAsync(Guid branchId, string? supplied)
    {
        if (!string.IsNullOrWhiteSpace(supplied))
        {
            return await EnsureCodeIsFreeAsync(supplied.Trim(), excludeId: null);
        }

        var year = Clock.Now.Year;
        return FormatPatientCode(year, await NextFreeSequenceAsync(branchId, year));
    }

    private async Task<string> EnsureCodeIsFreeAsync(string code, Guid? excludeId)
    {
        var query = await _repository.GetQueryableAsync();
        var taken = query.Any(p => p.PatientCode == code && (!excludeId.HasValue || p.Id != excludeId.Value));

        if (taken)
        {
            throw new Volo.Abp.BusinessException(
                BlueDentalDomainErrorCodes.PatientManagement.DuplicatePatientCode,
                $"Patient code '{code}' is already in use.");
        }

        return code;
    }

    /// <summary>
    /// The next sequence free in this branch and year.
    ///
    /// A counting scheme alone is not enough — deleted or imported records leave
    /// gaps and duplicates — so it walks forward until the code is genuinely free.
    /// </summary>
    private async Task<int> NextFreeSequenceAsync(Guid branchId, int year)
    {
        var query = await _repository.GetQueryableAsync();
        var sequence = query.Count(p => p.BranchId == branchId && p.CreationTime.Year == year) + 1;

        while (query.Any(p => p.PatientCode == FormatPatientCode(year, sequence)))
        {
            sequence++;
        }

        return sequence;
    }

    private static string CodePrefix(int year) => $"BD{year % 100:D2}";

    private static string FormatSequence(int sequence) => $"{sequence:D4}";

    private static string FormatPatientCode(int year, int sequence) =>
        CodePrefix(year) + FormatSequence(sequence);

    private static PatientDto MapToDto(Patient patient) => new()
    {
        Id = patient.Id,
        PatientCode = patient.PatientCode,
        FirstName = patient.FirstName,
        LastName = patient.LastName,
        FullName = patient.FullName,
        DateOfBirth = patient.DateOfBirth,
        Gender = patient.Gender,
        PhoneNumber = patient.Contact.PhoneNumber,
        Email = patient.Contact.Email,
        NationalId = patient.NationalId,
        Status = patient.Status,
        BranchId = patient.BranchId,
        SourceTaxonomyId = patient.SourceTaxonomyId,
        SourceEntryId = patient.SourceEntryId,
        OccupationEntryId = patient.OccupationEntryId,
        OccupationOther = patient.OccupationOther,
        InsuranceNumber = patient.InsuranceNumber,
        Address = patient.Contact.Address,
        ProvinceCode = patient.ProvinceCode,
        WardCode = patient.WardCode,
        ExaminationReason = patient.ExaminationReason,
        Note = patient.Note,
        TagIds = patient.TagIds.ToList(),
        DiseaseHistoryEntryIds = patient.DiseaseHistoryEntryIds.ToList(),
        CreationTime = patient.CreationTime,
        CreatorId = patient.CreatorId,
        LastModificationTime = patient.LastModificationTime,
        LastModifierId = patient.LastModifierId,
        IsDeleted = patient.IsDeleted,
        DeleterId = patient.DeleterId,
        DeletionTime = patient.DeletionTime
    };

    private void GuardBranchAccess(Patient entity)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        if (entity.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Patient), entity.Id);
    }
}
