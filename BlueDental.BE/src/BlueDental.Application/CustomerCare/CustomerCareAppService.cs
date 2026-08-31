using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Exporting;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using BlueDental.TreatmentManagement;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.CustomerCare;

[Authorize(BlueDentalPermissions.CustomerCare.Default)]
public class CustomerCareAppService : ApplicationService, ICustomerCareAppService
{
    private const int ExportRowCap = 10_000;

    private readonly IRepository<CareRecord, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<TreatmentPlan, Guid> _planRepository;
    private readonly IRepository<TreatmentStage, Guid> _stageRepository;
    private readonly IRepository<PatientPayment, Guid> _paymentRepository;
    private readonly IRepository<Taxonomy, Guid> _taxonomyRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public CustomerCareAppService(
        IRepository<CareRecord, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<TreatmentPlan, Guid> planRepository,
        IRepository<TreatmentStage, Guid> stageRepository,
        IRepository<PatientPayment, Guid> paymentRepository,
        IRepository<Taxonomy, Guid> taxonomyRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _appointmentRepository = appointmentRepository;
        _planRepository = planRepository;
        _stageRepository = stageRepository;
        _paymentRepository = paymentRepository;
        _taxonomyRepository = taxonomyRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input)
    {
        var query = await FilteredQueryAsync(input, applyStatus: true);
        var totalCount = query.Count();

        var items = SortForBoard(query, input.Type)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = ObjectMapper.Map<List<CareRecord>, List<CareRecordDto>>(items);
        await FillAsync(items, dtos);

        return new PagedResultDto<CareRecordDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<CareStatsDto> GetStatsAsync(GetCareRecordListInput input)
    {
        // The reference's counters never re-fetch when a status counter is
        // clicked, so the stats ignore the status filter but keep the rest.
        var query = await FilteredQueryAsync(input, applyStatus: false);

        var stats = await AsyncExecuter.FirstOrDefaultAsync(
            query.GroupBy(r => 1).Select(g => new CareStatsDto
            {
                TotalPatients = g.Select(r => r.PatientId).Distinct().Count(),
                Succeeded = g.Count(r => r.Status == CareStatus.Succeeded),
                Failed = g.Count(r => r.Status == CareStatus.Failed),
                NotCaredYet = g.Count(r =>
                    r.Status == CareStatus.New || r.Status == CareStatus.Contacted),
                ZaloSent = g.Count(r => r.ZaloSentAt.HasValue),
                Good = g.Count(r => r.Outcome == CareOutcome.Good),
                Fair = g.Count(r => r.Outcome == CareOutcome.Fair),
                Normal = g.Count(r => r.Outcome == CareOutcome.Normal),
                Complaint = g.Count(r => r.Outcome == CareOutcome.Complaint),
            }));

        return stats ?? new CareStatsDto();
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<CareRecordDto> GetAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);

        var dto = ObjectMapper.Map<CareRecord, CareRecordDto>(record);
        await FillAsync([record], [dto]);
        return dto;
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Create)]
    public async Task<CareRecordDto> CreateAsync(CreateCareRecordDto input)
    {
        var ownBranchId = _branchResolver.GetRequiredClinicBranchId();
        var branchId = await _branchAccess.ResolveWriteTargetAsync(input.BranchId, ownBranchId);

        var patient = await _patientRepository.GetAsync(input.PatientId);
        if (patient.BranchId != branchId)
            throw new EntityNotFoundException(typeof(Patient), input.PatientId);

        var record = new CareRecord(
            GuidGenerator.Create(),
            input.PatientId,
            branchId,
            input.Type,
            input.Subject,
            input.AssignedStaffId,
            input.Description,
            input.DueAt,
            input.CareServiceId,
            input.StageIds);

        if (input.CareStaffId.HasValue)
            record.AssignCareStaff(input.CareStaffId.Value);

        if (input.ScheduledStart.HasValue && input.ScheduledEnd.HasValue)
            record.Schedule(input.ScheduledStart.Value, input.ScheduledEnd.Value);

        // A base task from the Phân nhóm tab arrives already-successful with a
        // colour label (reference: status:"success" + colorCode).
        if (input.Status == CareStatus.Succeeded)
            record.Succeed(input.Outcome);

        await _repository.InsertAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> UpdateAsync(Guid id, UpdateCareRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);

        record.ApplyResult(input.Status, input.Description);

        if (input.Subject != null && input.Subject != record.Subject)
            record.UpdateContent(input.Subject, record.Description);

        if (input.AssignedStaffId != record.AssignedStaffId && !record.IsClosed)
            record.AssignTreatingStaff(input.AssignedStaffId);

        if (input.CareStaffId.HasValue && input.CareStaffId != record.CareStaffId)
            record.AssignCareStaff(input.CareStaffId.Value);

        if (input.DueAt.HasValue && input.DueAt != record.DueAt && !record.IsClosed)
            record.SetDue(input.DueAt);

        if (input.ScheduledStart.HasValue && input.ScheduledEnd.HasValue
            && (input.ScheduledStart != record.ScheduledStart || input.ScheduledEnd != record.ScheduledEnd))
        {
            record.Schedule(input.ScheduledStart.Value, input.ScheduledEnd.Value);
        }

        if (input.StageIds != null && !record.IsClosed)
            record.LinkStages(input.StageIds);

        await _repository.UpdateAsync(record, autoSave: true);

        var dto = ObjectMapper.Map<CareRecord, CareRecordDto>(record);
        await FillAsync([record], [dto]);
        return dto;
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> MarkContactedAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        record.MarkContacted();
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> SucceedAsync(Guid id, SucceedCareRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        record.Succeed(input.Outcome, input.Resolution);
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> FailAsync(Guid id, FailCareRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        record.Fail(input.Reason);
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> MarkZaloSentAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        record.MarkZaloSent();
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task CancelAsync(Guid id, string reason)
    {
        var record = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(record);
        record.Cancel(reason);
        await _repository.UpdateAsync(record, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<byte[]> ExportAsync(GetCareRecordListInput input)
    {
        var query = await FilteredQueryAsync(input, applyStatus: true);
        var items = SortForBoard(query, input.Type).Take(ExportRowCap).ToList();

        var dtos = ObjectMapper.Map<List<CareRecord>, List<CareRecordDto>>(items);
        await FillAsync(items, dtos);

        // The staging file is one unstyled sheet, every value a string.
        return ExcelSheet.BuildPlain(
            "Chăm sóc khách hàng",
            CareExportColumns.For(input.Type),
            dtos);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<PagedResultDto<CareGroupingPatientDto>> GetGroupingPatientsAsync(
        GetCareGroupingPatientsInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        var query = (await _patientRepository.GetQueryableAsync());
        if (branchFilter.Count > 0)
            query = query.Where(p => branchFilter.Contains(p.BranchId));

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            query = query.Where(PatientMatches(input.Filter));
        }

        if (input.BirthdayDate.HasValue)
        {
            var month = input.BirthdayDate.Value.Month;
            var day = input.BirthdayDate.Value.Day;
            // A patient registered without a birth date has no birthday to greet.
            query = query.Where(p =>
                p.DateOfBirth.HasValue
                && p.DateOfBirth.Value.Month == month
                && p.DateOfBirth.Value.Day == day);
        }

        if (input.StaffId.HasValue)
        {
            var staffId = input.StaffId.Value;
            var planQuery = await _planRepository.GetQueryableAsync();
            query = branchFilter.Count > 0
                ? query.Where(p => planQuery.Any(t =>
                    branchFilter.Contains(t.BranchId) && t.DentistId == staffId && t.PatientId == p.Id))
                : query.Where(p => planQuery.Any(t =>
                    t.DentistId == staffId && t.PatientId == p.Id));
        }

        if (input.TaxonomyId.HasValue)
        {
            var taxonomyId = input.TaxonomyId.Value;
            var careQuery = await _repository.GetQueryableAsync();
            var planQuery = await _planRepository.GetQueryableAsync();
            var catalogQuery = (await _catalogRepository.GetQueryableAsync())
                .Where(c => c.TaxonomyId == taxonomyId);
            if (branchFilter.Count > 0)
                catalogQuery = catalogQuery.Where(c => branchFilter.Contains(c.ClinicBranchId));
            var groupServiceIds = catalogQuery.Select(c => c.Id);

            if (branchFilter.Count > 0)
            {
                query = query.Where(p =>
                    planQuery.Any(t => branchFilter.Contains(t.BranchId) && t.PatientId == p.Id
                        && t.Services.Any(s => groupServiceIds.Contains(s.ServiceId)))
                    || careQuery.Any(r =>
                        branchFilter.Contains(r.BranchId) && r.CareServiceId == taxonomyId && r.PatientId == p.Id));
            }
            else
            {
                query = query.Where(p =>
                    planQuery.Any(t => t.PatientId == p.Id
                        && t.Services.Any(s => groupServiceIds.Contains(s.ServiceId)))
                    || careQuery.Any(r =>
                        r.CareServiceId == taxonomyId && r.PatientId == p.Id));
            }
        }

        if (input.TagId.HasValue)
        {
            // Thẻ tag — patients carrying that Thẻ hồ sơ on their record.
            var tagId = input.TagId.Value;
            query = query.Where(p => p.TagIds.Contains(tagId));
        }

        // input.ExcludeTreatmentNone: the reference always sends true yet still
        // returns "Chưa phát sinh" rows, so it is accepted but not applied.

        var totalCount = query.Count();
        var patients = query
            .OrderByDescending(p => p.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<CareGroupingPatientDto>(
            totalCount,
            await BuildGroupingRowsAsync(branchFilter, patients));
    }

    /* ------------------------------------------------------------------ */

    private async Task<IQueryable<CareRecord>> FilteredQueryAsync(
        GetCareRecordListInput input, bool applyStatus)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        var query = (await _repository.GetQueryableAsync());
        if (branchFilter.Count > 0)
            query = query.Where(r => branchFilter.Contains(r.BranchId));

        if (input.PatientId.HasValue)
            query = query.Where(r => r.PatientId == input.PatientId.Value);
        if (applyStatus && input.Status.HasValue)
            query = query.Where(r => r.Status == input.Status.Value);
        if (input.Type.HasValue)
            query = query.Where(r => r.Type == input.Type.Value);
        if (input.CareStaffId.HasValue)
            query = query.Where(r => r.CareStaffId == input.CareStaffId.Value);
        if (input.AssignedStaffId.HasValue)
            query = query.Where(r => r.AssignedStaffId == input.AssignedStaffId.Value);

        // The reference windows periodic/special by the care-appointment slot
        // and every other tab by the care date.
        var bySchedule = input.Type is CareType.Periodic or CareType.Special;
        if (input.FromDate.HasValue)
        {
            query = bySchedule
                ? query.Where(r => r.ScheduledStart >= input.FromDate.Value)
                : query.Where(r => r.DueAt >= input.FromDate.Value);
        }

        if (input.ToDate.HasValue)
        {
            query = bySchedule
                ? query.Where(r => r.ScheduledStart <= input.ToDate.Value)
                : query.Where(r => r.DueAt <= input.ToDate.Value);
        }

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var patientQuery = (await _patientRepository.GetQueryableAsync())
                .Where(PatientMatches(input.Filter));
            if (branchFilter.Count > 0)
                patientQuery = patientQuery.Where(p => branchFilter.Contains(p.BranchId));
            var matchedIds = patientQuery.Select(p => p.Id);
            query = query.Where(r => matchedIds.Contains(r.PatientId));
        }

        return query;
    }

    /// <summary>Tìm kiếm — patient code, full name or phone, case-insensitive.</summary>
    private static Expression<Func<Patient, bool>> PatientMatches(string rawFilter)
    {
        var filter = rawFilter.Trim().ToLower();
        return p => p.PatientCode.ToLower().Contains(filter)
            || (p.LastName + " " + p.FirstName).ToLower().Contains(filter)
            || p.Contact.PhoneNumber.Contains(filter);
    }

    private static IOrderedQueryable<CareRecord> SortForBoard(
        IQueryable<CareRecord> query, CareType? type) => type switch
    {
        CareType.AfterTreatment => query.OrderByDescending(r => r.DueAt),
        CareType.Birthday or CareType.AppointmentReminder => query.OrderBy(r => r.DueAt),
        CareType.Periodic or CareType.Special => query.OrderByDescending(r => r.ScheduledStart),
        _ => query.OrderByDescending(r => r.CreationTime),
    };

    /// <summary>
    /// The board shows names, codes and appointment context; the record stores
    /// ids. One batch per lookup keeps the page at a handful of queries.
    /// </summary>
    private async Task FillAsync(IReadOnlyList<CareRecord> entities, IReadOnlyList<CareRecordDto> dtos)
    {
        if (entities.Count == 0)
        {
            return;
        }

        var branchIds = entities.Select(r => r.BranchId).Distinct().ToList();
        var patientIds = entities.Select(r => r.PatientId).Distinct().ToList();

        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = (await AsyncExecuter.ToListAsync(
                patientQuery.Where(p => patientIds.Contains(p.Id))))
            .ToDictionary(p => p.Id);

        var staffIds = entities
            .SelectMany(r => new[] { r.AssignedStaffId, r.CareStaffId })
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();
        var staff = staffIds.Count == 0
            ? []
            : (await _userRepository.GetListByIdsAsync(staffIds))
                .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var careServiceIds = entities
            .Where(r => r.CareServiceId.HasValue)
            .Select(r => r.CareServiceId!.Value)
            .Distinct()
            .ToList();
        var careServices = new Dictionary<Guid, string>();
        if (careServiceIds.Count > 0)
        {
            var taxonomyQuery = await _taxonomyRepository.GetQueryableAsync();
            careServices = taxonomyQuery
                .Where(t => careServiceIds.Contains(t.Id))
                .ToDictionary(t => t.Id, t => t.Name);
        }

        var linkedAppointmentIds = entities
            .Where(r => r.AppointmentId.HasValue)
            .Select(r => r.AppointmentId!.Value)
            .Distinct()
            .ToList();
        var linkedAppointments = new Dictionary<Guid, Appointment>();
        if (linkedAppointmentIds.Count > 0)
        {
            var linkedQuery = await _appointmentRepository.GetQueryableAsync();
            linkedAppointments = linkedQuery
                .Where(a => linkedAppointmentIds.Contains(a.Id))
                .ToList()
                .ToDictionary(a => a.Id);
        }

        // Dịch vụ of the export — the catalog service behind each linked stage.
        var stageIds = entities.SelectMany(r => r.StageIds).Distinct().ToList();
        var stageServices = new Dictionary<Guid, Guid>();
        var stageServiceNames = new Dictionary<Guid, string>();
        if (stageIds.Count > 0)
        {
            var stageQuery = (await _stageRepository.GetQueryableAsync())
                .Where(s => stageIds.Contains(s.Id));
            if (branchIds.Count > 0)
                stageQuery = stageQuery.Where(s => branchIds.Contains(s.ClinicBranchId));
            stageServices = stageQuery
                .Select(s => new { s.Id, s.ServiceId })
                .ToDictionary(s => s.Id, s => s.ServiceId);

            var serviceIds = stageServices.Values.Distinct().ToList();
            if (serviceIds.Count > 0)
            {
                var catalogQuery = await _catalogRepository.GetQueryableAsync();
                stageServiceNames = catalogQuery
                    .Where(c => serviceIds.Contains(c.Id))
                    .ToDictionary(c => c.Id, c => c.Name);
            }
        }

        var nextAppointments = await NextAppointmentsAsync(branchIds, patientIds);

        for (var i = 0; i < entities.Count; i++)
        {
            var record = entities[i];
            var dto = dtos[i];

            if (patients.TryGetValue(record.PatientId, out var patient))
            {
                dto.PatientName = (patient.LastName + " " + patient.FirstName).Trim();
                dto.PatientCode = patient.PatientCode;
                dto.PatientPhone = patient.Contact.PhoneNumber;
                dto.PatientGender = patient.Gender;
                dto.PatientDateOfBirth = patient.DateOfBirth;
            }

            dto.AssignedStaffName = record.AssignedStaffId.HasValue
                ? staff.GetValueOrDefault(record.AssignedStaffId.Value)
                : null;
            dto.CareStaffName = record.CareStaffId.HasValue
                ? staff.GetValueOrDefault(record.CareStaffId.Value)
                : null;
            dto.CareServiceName = record.CareServiceId.HasValue
                ? careServices.GetValueOrDefault(record.CareServiceId.Value)
                : null;
            dto.NextAppointmentAt = nextAppointments.GetValueOrDefault(record.PatientId);
            dto.ServiceNames = record.StageIds
                .Select(id => stageServices.TryGetValue(id, out var serviceId)
                    ? stageServiceNames.GetValueOrDefault(serviceId)
                    : null)
                .Where(name => !string.IsNullOrEmpty(name))
                .Select(name => name!)
                .Distinct()
                .ToList();

            if (record.AppointmentId.HasValue
                && linkedAppointments.TryGetValue(record.AppointmentId.Value, out var appointment))
            {
                dto.AppointmentStatus = appointment.Status;
                dto.AppointmentContent = appointment.ChiefComplaint ?? appointment.Notes;
            }
        }
    }

    private async Task<Dictionary<Guid, DateTimeOffset>> NextAppointmentsAsync(
        IReadOnlyList<Guid> branchIds, IReadOnlyCollection<Guid> patientIds)
    {
        var now = DateTimeOffset.UtcNow;
        var appointmentQuery = (await _appointmentRepository.GetQueryableAsync())
            .Where(a => patientIds.Contains(a.PatientId));
        if (branchIds.Count > 0)
            appointmentQuery = appointmentQuery.Where(a => branchIds.Contains(a.BranchId));
        return appointmentQuery
            .Where(a => a.Slot.Start > now)
            .Where(a => a.Status != AppointmentStatus.Cancelled && a.Status != AppointmentStatus.NoShow)
            .Select(a => new { a.PatientId, a.Slot.Start })
            .ToList()
            .GroupBy(a => a.PatientId)
            .ToDictionary(g => g.Key, g => g.Min(a => a.Start));
    }

    private async Task<List<CareGroupingPatientDto>> BuildGroupingRowsAsync(
        IReadOnlyList<Guid> branchFilter, IReadOnlyList<Patient> patients)
    {
        if (patients.Count == 0)
        {
            return [];
        }

        var patientIds = patients.Select(p => p.Id).ToList();

        var planQuery = await _planRepository.WithDetailsAsync(t => t.Services);
        var filteredPlanQuery = planQuery.Where(t => patientIds.Contains(t.PatientId));
        if (branchFilter.Count > 0)
            filteredPlanQuery = filteredPlanQuery.Where(t => branchFilter.Contains(t.BranchId));
        var plans = (await AsyncExecuter.ToListAsync(filteredPlanQuery))
            .GroupBy(t => t.PatientId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var serviceIds = plans.Values
            .SelectMany(list => list)
            .SelectMany(t => t.Services)
            .Select(s => s.ServiceId)
            .Distinct()
            .ToList();
        var serviceNames = new Dictionary<Guid, string>();
        if (serviceIds.Count > 0)
        {
            var catalogQuery = await _catalogRepository.GetQueryableAsync();
            serviceNames = catalogQuery
                .Where(c => serviceIds.Contains(c.Id))
                .ToDictionary(c => c.Id, c => c.Name);
        }

        var dentistIds = plans.Values
            .SelectMany(list => list)
            .Select(t => t.DentistId)
            .Distinct()
            .ToList();
        var dentistNames = dentistIds.Count == 0
            ? []
            : (await _userRepository.GetListByIdsAsync(dentistIds))
                .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        var paymentQuery = (await _paymentRepository.GetQueryableAsync())
            .Where(p => patientIds.Contains(p.PatientId));
        if (branchFilter.Count > 0)
            paymentQuery = paymentQuery.Where(p => branchFilter.Contains(p.ClinicBranchId));
        var revenue = paymentQuery
            .ToList()
            .GroupBy(p => p.PatientId)
            .ToDictionary(g => g.Key, g => g.Sum(p => p.SignedAmount));

        var nextAppointments = await NextAppointmentsAsync(branchFilter, patientIds);

        return patients.Select(patient =>
        {
            var patientPlans = plans.GetValueOrDefault(patient.Id) ?? [];
            var totalAmount = patientPlans.Sum(t => t.TotalAmount);
            var totalRevenue = revenue.GetValueOrDefault(patient.Id);

            return new CareGroupingPatientDto
            {
                Id = patient.Id,
                Code = patient.PatientCode,
                Name = (patient.LastName + " " + patient.FirstName).Trim(),
                Phone = patient.Contact.PhoneNumber,
                DateOfBirth = patient.DateOfBirth,
                TreatmentStatus = ResolveTreatmentStatus(patientPlans),
                ServiceNames = patientPlans
                    .SelectMany(t => t.Services)
                    .Select(s => serviceNames.GetValueOrDefault(s.ServiceId))
                    .Where(name => !string.IsNullOrEmpty(name))
                    .Select(name => name!)
                    .Distinct()
                    .ToList(),
                StaffNames = patientPlans
                    .Select(t => dentistNames.GetValueOrDefault(t.DentistId))
                    .Where(name => !string.IsNullOrEmpty(name))
                    .Select(name => name!)
                    .Distinct()
                    .ToList(),
                TotalAmount = totalAmount,
                TotalRevenue = totalRevenue,
                TotalDebt = totalAmount - totalRevenue,
                NextAppointmentAt = nextAppointments.TryGetValue(patient.Id, out var next)
                    ? next
                    : null,
                LastVisitAt = patientPlans.Count > 0
                    ? patientPlans.Max(t => t.CreationTime)
                    : patient.CreationTime,
                CreatedAt = patient.CreationTime,
            };
        }).ToList();
    }

    private static CareTreatmentStatus ResolveTreatmentStatus(IReadOnlyList<TreatmentPlan> plans)
    {
        var active = plans.Where(t => t.Status != TreatmentPlanStatus.Cancelled).ToList();
        if (active.Count == 0)
            return CareTreatmentStatus.Created;

        return active.All(t => t.Status == TreatmentPlanStatus.Completed)
            ? CareTreatmentStatus.Done
            : CareTreatmentStatus.InProgress;
    }

    private async Task GuardBranchAccessAsync(CareRecord entity)
    {
        if (!await _branchAccess.IsAllowedAsync(entity.BranchId))
            throw new EntityNotFoundException(typeof(CareRecord), entity.Id);
    }
}
