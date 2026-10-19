using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.StaffNotes;

/// <summary>The header's "Thêm ghi chú" dialog (F-74).</summary>
public interface IStaffNoteAppService : IApplicationService
{
    Task<PagedResultDto<StaffNoteDto>> GetListAsync(GetStaffNoteListInput input);

    Task<StaffNoteDto> CreateAsync(CreateStaffNoteDto input);

    Task<StaffNoteDto> UpdateAsync(Guid id, UpdateStaffNoteDto input);

    Task DeleteAsync(Guid id);
}
