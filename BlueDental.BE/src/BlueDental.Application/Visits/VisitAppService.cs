using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Visits;

[Authorize(BlueDentalPermissions.Visits.Default)]
public class VisitAppService : ApplicationService, IVisitAppService
{
    private readonly IRepository<Visit, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly BranchAccessChecker _branchAccess;

    public VisitAppService(
        IRepository<Visit, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IIdentityUserRepository userRepository,
        ICurrentClinicBranchResolver branchResolver,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _userRepository = userRepository;
        _branchResolver = branchResolver;
        _branchAccess = branchAccess;
    }

    /// <summary>
    /// A visit stores ids, and the board shows names. Nothing filled these in,
    /// so every row read "Bệnh nhân" and "Bác sĩ" however full the table was.
    /// </summary>
    private async Task FillNamesAsync(
        IReadOnlyList<Visit> entities,
        IReadOnlyList<VisitDto> dtos)
    {
        if (entities.Count == 0)
        {
            return;
        }

        var patientIds = entities.Select(v => v.PatientId).Distinct().ToList();
        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patientList = await AsyncExecuter.ToListAsync(
            patientQuery.Where(p => patientIds.Contains(p.Id)));
        var patients = patientList.ToDictionary(p => p.Id);

        var dentistIds = entities
            .Where(v => v.DentistId.HasValue)
            .Select(v => v.DentistId!.Value)
            .Distinct()
            .ToList();

        var dentists = dentistIds.Count == 0
            ? []
            : (await _userRepository.GetListByIdsAsync(dentistIds))
                .ToDictionary(u => u.Id, u => u.Name ?? u.UserName);

        for (var i = 0; i < entities.Count; i++)
        {
            var patient = patients.GetValueOrDefault(entities[i].PatientId);
            dtos[i].PatientName = patient != null
                ? (patient.LastName + " " + patient.FirstName).Trim()
                : null;
            dtos[i].PatientPhone = patient?.Contact?.PhoneNumber;
            dtos[i].PatientYearOfBirth = patient?.DateOfBirth?.Year;
            dtos[i].DentistName = entities[i].DentistId.HasValue
                ? dentists.GetValueOrDefault(entities[i].DentistId!.Value)
                : null;
        }
    }

    [Authorize(BlueDentalPermissions.Visits.View)]
    public async Task<PagedResultDto<VisitDto>> GetListAsync(GetVisitListInput input)
    {
        var query = await FilteredQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(v => v.ScheduledAt)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var dtos = ObjectMapper.Map<List<Visit>, List<VisitDto>>(items);
        await FillNamesAsync(items, dtos);

        return new PagedResultDto<VisitDto>(totalCount, dtos);
    }

    [Authorize(BlueDentalAbilityPermissions.Reception.Read)]
    public async Task<VisitStatsDto> GetStatsAsync(GetVisitListInput input)
    {
        // The counters describe the whole filtered set, so they ignore paging.
        var items = (await FilteredQueryAsync(input)).ToList();

        return new VisitStatsDto
        {
            Total = items.Count,
            Scheduled = items.Count(v => v.Status == VisitStatus.Scheduled),
            CheckedIn = items.Count(v => v.Status == VisitStatus.CheckedIn),
            InProgress = items.Count(v => v.Status == VisitStatus.InProgress),
            Completed = items.Count(v => v.Status == VisitStatus.Completed),
            Cancelled = items.Count(v => v.Status == VisitStatus.Cancelled),
            NoShow = items.Count(v => v.Status == VisitStatus.NoShow)
        };
    }

    /// <summary>Shared so the list and the counters can never drift apart.</summary>
    private async Task<IQueryable<Visit>> FilteredQueryAsync(GetVisitListInput input)
    {
        var query = await _repository.GetQueryableAsync();

        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        if (branchFilter.Count > 0)
        {
            query = query.Where(v => branchFilter.Contains(v.BranchId));
        }

        if (input.PatientId.HasValue)
            query = query.Where(v => v.PatientId == input.PatientId.Value);
        if (input.DentistId.HasValue)
            query = query.Where(v => v.DentistId == input.DentistId.Value);
        if (input.Status.HasValue)
            query = query.Where(v => v.Status == input.Status.Value);
        if (input.Statuses is { Count: > 0 })
            query = query.Where(v => input.Statuses.Contains(v.Status));

        // Without this the board showed every visit the clinic has ever had,
        // whatever its date picker said.
        if (input.FromDate.HasValue)
            query = query.Where(v => v.ScheduledAt >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(v => v.ScheduledAt < input.ToDate.Value);

        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim().ToLower();
            var patientQuery = await _patientRepository.GetQueryableAsync();
            var matchingPatientIds = patientQuery
                .Where(p =>
                    p.FirstName.ToLower().Contains(filter)
                    || p.LastName.ToLower().Contains(filter)
                    || p.PatientCode.ToLower().Contains(filter)
                    || (p.Contact != null && p.Contact.PhoneNumber != null && p.Contact.PhoneNumber.Contains(filter)))
                .Select(p => p.Id);

            query = query.Where(v =>
                (v.ChiefComplaint != null && v.ChiefComplaint.ToLower().Contains(filter))
                || (v.Notes != null && v.Notes.ToLower().Contains(filter))
                || matchingPatientIds.Contains(v.PatientId));
        }

        return query;
    }

    [Authorize(BlueDentalPermissions.Visits.View)]
    public async Task<VisitDto> GetAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);

        var dto = ObjectMapper.Map<Visit, VisitDto>(visit);
        await FillNamesAsync([visit], [dto]);
        return dto;
    }

    [Authorize(BlueDentalPermissions.Visits.Create)]
    public async Task<VisitDto> CreateAsync(CreateVisitDto input)
    {
        var branchId = await _branchAccess.ResolveWriteTargetAsync(
            input.BranchId, _branchResolver.GetRequiredClinicBranchId());
        var visit = new Visit(
            GuidGenerator.Create(),
            input.PatientId,
            branchId,
            input.ScheduledAt,
            input.DentistId,
            input.ChiefComplaint,
            input.EstimatedDurationMinutes);
        await _repository.InsertAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Edit)]
    public async Task<VisitDto> UpdateAsync(Guid id, UpdateVisitDto input)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.Update(input.DentistId, input.ScheduledAt, input.ChiefComplaint, input.Notes);
        await _repository.UpdateAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CheckInAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.CheckIn();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task StartAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.Start();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CompleteAsync(Guid id, string? notes)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.Complete(notes);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task CancelAsync(Guid id, string reason)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.Cancel(reason);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task MarkNoShowAsync(Guid id)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.MarkNoShow();
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    /// <summary>
    /// Recording how a visit ended is part of running it, not editing its
    /// booking, so it sits behind the workflow permission alongside check-in
    /// and complete rather than behind Edit.
    /// </summary>
    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task<VisitDto> RecordOutcomeAsync(Guid id, RecordVisitOutcomeDto input)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.RecordOutcome(input.Outcome);
        await _repository.UpdateAsync(visit, autoSave: true);
        return ObjectMapper.Map<Visit, VisitDto>(visit);
    }

    [Authorize(BlueDentalPermissions.Visits.Workflow)]
    public async Task ReassignDentistAsync(Guid id, Guid dentistId)
    {
        var visit = await _repository.GetAsync(id);
        await GuardBranchAccessAsync(visit);
        visit.ReassignDentist(dentistId);
        await _repository.UpdateAsync(visit, autoSave: true);
    }

    private async Task GuardBranchAccessAsync(Visit entity)
    {
        if (!await _branchAccess.IsAllowedAsync(entity.BranchId))
            throw new EntityNotFoundException(typeof(Visit), entity.Id);
    }
}
