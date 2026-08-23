using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Catalogs;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.CustomerCare;

/// <summary>
/// Chăm sóc khách hàng (CSKH).
/// </summary>
[Authorize]
public class CustomerCareAppService : ApplicationService, ICustomerCareAppService
{
    private readonly IRepository<CareRecord, Guid> _repository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IRepository<CatalogEntry, Guid> _catalogRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly BranchAccessChecker _branchAccess;

    public CustomerCareAppService(
        IRepository<CareRecord, Guid> repository,
        IRepository<Patient, Guid> patientRepository,
        IRepository<CatalogEntry, Guid> catalogRepository,
        IIdentityUserRepository userRepository,
        BranchAccessChecker branchAccess)
    {
        _repository = repository;
        _patientRepository = patientRepository;
        _catalogRepository = catalogRepository;
        _userRepository = userRepository;
        _branchAccess = branchAccess;
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Read)]
    public async Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input)
    {
        var query = await BuildQueryAsync(input);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(x => x.DueAt ?? x.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        var lookups = await BuildLookupsAsync(items);
        return new PagedResultDto<CareRecordDto>(totalCount, items.Select(x => MapToDto(x, lookups)).ToList());
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Read)]
    public async Task<CareStatsDto> GetStatsAsync(GetCareRecordListInput input)
    {
        var query = await BuildQueryAsync(input);
        var items = query.ToList();

        return new CareStatsDto
        {
            // "Tổng khách" counts patients, not tasks — a patient can have several.
            TotalPatients = items.Select(x => x.PatientId).Distinct().Count(),
            Succeeded = items.Count(x => x.Status == CareStatus.Succeeded),
            Failed = items.Count(x => x.Status == CareStatus.Failed),
            NotCaredYet = items.Count(x => x.Status == CareStatus.New),
            ZaloSent = items.Count(x => x.ZaloSentAt != null),
            Good = items.Count(x => x.Outcome == CareOutcome.Good),
            Fair = items.Count(x => x.Outcome == CareOutcome.Fair),
            Normal = items.Count(x => x.Outcome == CareOutcome.Normal),
            Complaint = items.Count(x => x.Outcome == CareOutcome.Complaint)
        };
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Read)]
    public async Task<CareRecordDto> GetAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(record.BranchId);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Create)]
    public async Task<CareRecordDto> CreateAsync(CreateCareRecordDto input)
    {
        await _branchAccess.CheckAsync(input.BranchId);

        var record = new CareRecord(
            GuidGenerator.Create(),
            input.PatientId,
            input.BranchId,
            input.Type,
            input.Subject,
            input.AssignedStaffId,
            input.Description,
            input.DueAt,
            input.CareServiceId,
            input.StageIds);

        await _repository.InsertAsync(record, autoSave: true);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Update)]
    public async Task<CareRecordDto> UpdateAsync(Guid id, UpdateCareRecordDto input)
    {
        var record = await LoadForWriteAsync(id);

        record.UpdateContent(input.Subject, input.Description);

        if (input.CareStaffId.HasValue)
        {
            record.AssignCareStaff(input.CareStaffId.Value);
        }

        if (input.ScheduledStart.HasValue && input.ScheduledEnd.HasValue)
        {
            record.Schedule(input.ScheduledStart.Value, input.ScheduledEnd.Value);
        }

        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Update)]
    public async Task<CareRecordDto> MarkContactedAsync(Guid id)
    {
        var record = await LoadForWriteAsync(id);
        record.MarkContacted();
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Update)]
    public async Task<CareRecordDto> SucceedAsync(Guid id, SucceedCareRecordDto input)
    {
        var record = await LoadForWriteAsync(id);
        record.Succeed(input.Outcome, input.Resolution);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Update)]
    public async Task<CareRecordDto> FailAsync(Guid id, FailCareRecordDto input)
    {
        var record = await LoadForWriteAsync(id);
        record.Fail(input.Reason);
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Update)]
    public async Task<CareRecordDto> MarkZaloSentAsync(Guid id)
    {
        var record = await LoadForWriteAsync(id);
        record.MarkZaloSent();
        await _repository.UpdateAsync(record, autoSave: true);
        return MapToDto(record, await BuildLookupsAsync([record]));
    }

    [Authorize(BlueDentalAbilityPermissions.CskhCare.Update)]
    public async Task CancelAsync(Guid id, string reason)
    {
        var record = await LoadForWriteAsync(id);
        record.Cancel(reason);
        await _repository.UpdateAsync(record, autoSave: true);
    }

    private async Task<CareRecord> LoadForWriteAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        await _branchAccess.CheckAsync(record.BranchId);
        return record;
    }

    private async Task<IQueryable<CareRecord>> BuildQueryAsync(GetCareRecordListInput input)
    {
        var branchFilter = await _branchAccess.ResolveFilterAsync(input.BranchId);
        var query = await _repository.GetQueryableAsync();

        if (branchFilter.Count > 0)
            query = query.Where(x => branchFilter.Contains(x.BranchId));
        if (input.PatientId.HasValue)
            query = query.Where(x => x.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(x => x.Status == input.Status.Value);
        if (input.Type.HasValue)
            query = query.Where(x => x.Type == input.Type.Value);
        if (input.CareStaffId.HasValue)
            query = query.Where(x => x.CareStaffId == input.CareStaffId.Value);
        if (input.AssignedStaffId.HasValue)
            query = query.Where(x => x.AssignedStaffId == input.AssignedStaffId.Value);
        if (input.FromDate.HasValue)
            query = query.Where(x => x.DueAt >= input.FromDate.Value);
        if (input.ToDate.HasValue)
            query = query.Where(x => x.DueAt <= input.ToDate.Value);
        if (!string.IsNullOrWhiteSpace(input.Filter))
        {
            var filter = input.Filter.Trim();
            query = query.Where(x => x.Subject.Contains(filter));
        }

        return query;
    }

    private sealed record CareLookups(
        IReadOnlyDictionary<Guid, (string Name, string? Phone)> Patients,
        IReadOnlyDictionary<Guid, string> Staff,
        IReadOnlyDictionary<Guid, string> CareServices);

    private async Task<CareLookups> BuildLookupsAsync(IReadOnlyCollection<CareRecord> records)
    {
        var patientIds = records.Select(x => x.PatientId).Distinct().ToList();
        var staffIds = records
            .SelectMany(x => new[] { x.AssignedStaffId, x.CareStaffId })
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .Distinct()
            .ToList();
        var serviceIds = records
            .Where(x => x.CareServiceId.HasValue)
            .Select(x => x.CareServiceId!.Value)
            .Distinct()
            .ToList();

        var patientQuery = await _patientRepository.GetQueryableAsync();
        var patients = patientQuery
            .Where(p => patientIds.Contains(p.Id))
            .ToDictionary(
                p => p.Id,
                p => ($"{p.LastName} {p.FirstName}".Trim(), p.Contact.PhoneNumber));

        var users = staffIds.Count == 0 ? [] : await _userRepository.GetListByIdsAsync(staffIds);

        var catalogQuery = await _catalogRepository.GetQueryableAsync();
        var services = serviceIds.Count == 0
            ? new Dictionary<Guid, string>()
            : catalogQuery.Where(c => serviceIds.Contains(c.Id)).ToDictionary(c => c.Id, c => c.Name);

        return new CareLookups(
            patients,
            users.ToDictionary(u => u.Id, u => u.Name ?? u.UserName),
            services);
    }

    private static CareRecordDto MapToDto(CareRecord entity, CareLookups lookups) => new()
    {
        Id = entity.Id,
        PatientId = entity.PatientId,
        BranchId = entity.BranchId,
        AssignedStaffId = entity.AssignedStaffId,
        CareStaffId = entity.CareStaffId,
        Type = entity.Type,
        Status = entity.Status,
        Outcome = entity.Outcome,
        Subject = entity.Subject,
        Description = entity.Description,
        Resolution = entity.Resolution,
        CareServiceId = entity.CareServiceId,
        DueAt = entity.DueAt,
        ScheduledStart = entity.ScheduledStart,
        ScheduledEnd = entity.ScheduledEnd,
        CompletedAt = entity.CompletedAt,
        ZaloSentAt = entity.ZaloSentAt,
        StageIds = entity.StageIds.ToList(),
        PatientName = lookups.Patients.TryGetValue(entity.PatientId, out var patient) ? patient.Name : null,
        PatientPhone = lookups.Patients.TryGetValue(entity.PatientId, out var contact) ? contact.Phone : null,
        AssignedStaffName = entity.AssignedStaffId.HasValue
            && lookups.Staff.TryGetValue(entity.AssignedStaffId.Value, out var assigned)
                ? assigned
                : null,
        CareStaffName = entity.CareStaffId.HasValue
            && lookups.Staff.TryGetValue(entity.CareStaffId.Value, out var careStaff)
                ? careStaff
                : null,
        CareServiceName = entity.CareServiceId.HasValue
            && lookups.CareServices.TryGetValue(entity.CareServiceId.Value, out var service)
                ? service
                : null,
        CreationTime = entity.CreationTime,
        CreatorId = entity.CreatorId,
        LastModificationTime = entity.LastModificationTime,
        LastModifierId = entity.LastModifierId
    };
}
