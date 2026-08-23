using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public interface IInsurancePlanAppService : IApplicationService
{
    Task<PagedResultDto<InsurancePlanDto>> GetListAsync(GetInsurancePlanListInput input);
    Task<InsurancePlanDto> GetAsync(Guid id);
    Task<InsurancePlanDto> CreateAsync(CreateInsurancePlanDto input);
    Task<InsurancePlanDto> UpdateAsync(Guid id, UpdateInsurancePlanDto input);
    Task DeleteAsync(Guid id);
}
