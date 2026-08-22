using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Staff;

public interface IStaffAppService : IApplicationService
{
    Task<PagedResultDto<StaffDto>> GetListAsync(GetStaffListInput input);
    Task<StaffDto> GetAsync(Guid id);
}
