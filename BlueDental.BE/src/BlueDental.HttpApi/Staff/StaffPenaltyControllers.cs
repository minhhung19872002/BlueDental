using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

/// <summary>Nhân viên → Chế tài.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/staff-penalties")]
public sealed class StaffPenaltyController(IStaffPenaltyAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<StaffPenaltyListResultDto> GetListAsync([FromQuery] GetStaffPenaltyListInput input) =>
        service.GetListAsync(input);

    [HttpGet("{id:guid}")]
    public Task<StaffPenaltyDto> GetAsync(Guid id) => service.GetAsync(id);

    [HttpPost]
    public Task<StaffPenaltyDto> CreateAsync([FromBody] CreateStaffPenaltyDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<StaffPenaltyDto> UpdateAsync(Guid id, [FromBody] UpdateStaffPenaltyDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);

    [HttpPost("{id:guid}/approve")]
    public Task<StaffPenaltyDto> ApproveAsync(Guid id) => service.ApproveAsync(id);

    [HttpPost("{id:guid}/cancel")]
    public Task<StaffPenaltyDto> CancelAsync(Guid id, [FromBody] CancelStaffPenaltyDto input) =>
        service.CancelAsync(id, input);
}

/// <summary>Loại vi phạm of Chế tài.</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/staff-violation-types")]
public sealed class StaffViolationTypeController(IStaffViolationTypeAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<StaffViolationTypeDto>> GetListAsync(
        [FromQuery] GetStaffViolationTypeListInput input) => service.GetListAsync(input);

    [HttpPost]
    public Task<StaffViolationTypeDto> CreateAsync([FromBody] CreateStaffViolationTypeDto input) =>
        service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<StaffViolationTypeDto> UpdateAsync(Guid id, [FromBody] UpdateStaffViolationTypeDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
