using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Staff;

/// <summary>Chế tài nhân viên — Nháp → Đã duyệt / Đã huỷ.</summary>
public interface IStaffPenaltyAppService : IApplicationService
{
    Task<StaffPenaltyListResultDto> GetListAsync(GetStaffPenaltyListInput input);
    Task<StaffPenaltyDto> GetAsync(Guid id);
    Task<StaffPenaltyDto> CreateAsync(CreateStaffPenaltyDto input);
    Task<StaffPenaltyDto> UpdateAsync(Guid id, UpdateStaffPenaltyDto input);
    Task DeleteAsync(Guid id);
    Task<StaffPenaltyDto> ApproveAsync(Guid id);
    Task<StaffPenaltyDto> CancelAsync(Guid id, CancelStaffPenaltyDto input);
}

/// <summary>Loại vi phạm, per branch.</summary>
public interface IStaffViolationTypeAppService : IApplicationService
{
    Task<PagedResultDto<StaffViolationTypeDto>> GetListAsync(GetStaffViolationTypeListInput input);
    Task<StaffViolationTypeDto> CreateAsync(CreateStaffViolationTypeDto input);
    Task<StaffViolationTypeDto> UpdateAsync(Guid id, UpdateStaffViolationTypeDto input);
    Task DeleteAsync(Guid id);
}
