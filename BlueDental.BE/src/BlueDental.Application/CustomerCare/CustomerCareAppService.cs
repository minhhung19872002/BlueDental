using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Exporting;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.CustomerCare;

[Authorize(BlueDentalPermissions.CustomerCare.Default)]
public class CustomerCareAppService : ApplicationService, ICustomerCareAppService
{
    private readonly IRepository<CareRecord, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public CustomerCareAppService(
        IRepository<CareRecord, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();

        query = query.Where(r => r.BranchId == branchId);
        if (input.PatientId.HasValue)
            query = query.Where(r => r.PatientId == input.PatientId.Value);
        if (input.Status.HasValue)
            query = query.Where(r => r.Status == input.Status.Value);
        if (input.Type.HasValue)
            query = query.Where(r => r.Type == input.Type.Value);
        if (input.CareStaffId.HasValue)
            query = query.Where(r => r.CareStaffId == input.CareStaffId.Value);
        if (input.AssignedStaffId.HasValue)
            query = query.Where(r => r.AssignedStaffId == input.AssignedStaffId.Value);

        var totalCount = query.Count();
        var items = query
            .OrderByDescending(r => r.CreationTime)
            .Skip(input.SkipCount)
            .Take(input.MaxResultCount)
            .ToList();

        return new PagedResultDto<CareRecordDto>(
            totalCount,
            ObjectMapper.Map<List<CareRecord>, List<CareRecordDto>>(items));
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<CareStatsDto> GetStatsAsync(GetCareRecordListInput input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var query = await _repository.GetQueryableAsync();
        query = query.Where(r => r.BranchId == branchId);

        if (input.PatientId.HasValue)
            query = query.Where(r => r.PatientId == input.PatientId.Value);
        if (input.Type.HasValue)
            query = query.Where(r => r.Type == input.Type.Value);

        var records = query.ToList();

        return new CareStatsDto
        {
            TotalPatients = records.Select(r => r.PatientId).Distinct().Count(),
            Succeeded = records.Count(r => r.Status == CareStatus.Succeeded),
            Failed = records.Count(r => r.Status == CareStatus.Failed),
            NotCaredYet = records.Count(r => r.Status == CareStatus.New),
            ZaloSent = records.Count(r => r.ZaloSentAt.HasValue),
            Good = records.Count(r => r.Outcome == CareOutcome.Good),
            Fair = records.Count(r => r.Outcome == CareOutcome.Fair),
            Normal = records.Count(r => r.Outcome == CareOutcome.Normal),
            Complaint = records.Count(r => r.Outcome == CareOutcome.Complaint),
        };
    }

    [Authorize(BlueDentalPermissions.CustomerCare.View)]
    public async Task<CareRecordDto> GetAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Create)]
    public async Task<CareRecordDto> CreateAsync(CreateCareRecordDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
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
        await _repository.InsertAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> UpdateAsync(Guid id, UpdateCareRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        record.UpdateContent(input.Subject, input.Description);

        if (input.CareStaffId.HasValue)
            record.AssignCareStaff(input.CareStaffId.Value);

        if (input.ScheduledStart.HasValue && input.ScheduledEnd.HasValue)
            record.Schedule(input.ScheduledStart.Value, input.ScheduledEnd.Value);

        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> MarkContactedAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        record.MarkContacted();
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> SucceedAsync(Guid id, SucceedCareRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        record.Succeed(input.Outcome, input.Resolution);
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> FailAsync(Guid id, FailCareRecordDto input)
    {
        var record = await _repository.GetAsync(id);
        record.Fail(input.Reason);
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task<CareRecordDto> MarkZaloSentAsync(Guid id)
    {
        var record = await _repository.GetAsync(id);
        record.MarkZaloSent();
        await _repository.UpdateAsync(record, autoSave: true);
        return ObjectMapper.Map<CareRecord, CareRecordDto>(record);
    }

    [Authorize(BlueDentalPermissions.CustomerCare.Manage)]
    public async Task CancelAsync(Guid id, string reason)
    {
        var record = await _repository.GetAsync(id);
        record.Cancel(reason);
        await _repository.UpdateAsync(record, autoSave: true);
    }
    [Authorize]
    public async Task<byte[]> ExportAsync(GetCareRecordListInput input)
    {
        // Reusing GetListAsync keeps the export behind the same ability and the
        // same branch scope as the list it mirrors.
        var page = await GetListAsync(new GetCareRecordListInput
        {
            BranchId = input.BranchId,
            PatientId = input.PatientId,
            Type = input.Type,
            Status = input.Status,
            MaxResultCount = 1000
        });

        return ExcelSheet.Build(
            "CSKH",
            "Chăm sóc khách hàng",
            new List<ExcelColumn<CareRecordDto>>
            {
                new("Ngày chăm sóc", row => row.DueAt?.DateTime, 16),
                new("Khách hàng", row => row.PatientName, 26),
                new("Điện thoại", row => row.PatientPhone, 16),
                new("Nội dung", row => row.Subject, 40),
                new("Trạng thái", row => row.Status.ToString(), 16),
                new("Kết quả", row => row.Outcome.ToString(), 16),
                new("Nhân viên chăm sóc", row => row.CareStaffName, 22)
            },
            page.Items);
    }

}
