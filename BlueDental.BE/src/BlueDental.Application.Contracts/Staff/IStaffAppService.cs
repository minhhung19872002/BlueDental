using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Staff;

public interface IStaffAppService : IApplicationService
{
    Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffListInput input);
    Task<StaffDto> GetAsync(Guid id);
    Task<StaffDto> CreateAsync(CreateStaffDto input);
    Task<StaffDto> UpdateAsync(Guid id, UpdateStaffDto input);
    Task DeleteAsync(Guid id);
    Task<List<string>> GetRoleNamesAsync();
}
