using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Organizations;

public interface IClinicBranchAppService : IApplicationService
{
    Task<PagedResultDto<ClinicBranchDto>> GetListAsync(GetClinicBranchListInput input);
    Task<ClinicBranchDto> GetAsync(Guid id);
    Task<ClinicBranchDto> CreateAsync(CreateClinicBranchDto input);
    Task<ClinicBranchDto> UpdateAsync(Guid id, UpdateClinicBranchDto input);
    Task DeleteAsync(Guid id);
}
