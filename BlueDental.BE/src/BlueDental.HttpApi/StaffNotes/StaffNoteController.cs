using System;
using System.Threading.Tasks;
using BlueDental.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp;
using Volo.Abp.Application.Dtos;

namespace BlueDental.StaffNotes;

/// <summary>The header's "Thêm ghi chú" dialog (F-74).</summary>
[RemoteService]
[Authorize]
[Route("api/v1/app/staff-notes")]
public sealed class StaffNoteController(IStaffNoteAppService service) : BlueDentalController
{
    [HttpGet]
    public Task<PagedResultDto<StaffNoteDto>> GetListAsync([FromQuery] GetStaffNoteListInput input) =>
        service.GetListAsync(input);

    [HttpPost]
    public Task<StaffNoteDto> CreateAsync([FromBody] CreateStaffNoteDto input) => service.CreateAsync(input);

    [HttpPut("{id:guid}")]
    public Task<StaffNoteDto> UpdateAsync(Guid id, [FromBody] UpdateStaffNoteDto input) =>
        service.UpdateAsync(id, input);

    [HttpDelete("{id:guid}")]
    public Task DeleteAsync(Guid id) => service.DeleteAsync(id);
}
