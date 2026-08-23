using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Billing;

public interface IInsuranceClaimAppService : IApplicationService
{
    Task<PagedResultDto<InsuranceClaimDto>> GetListAsync(GetInsuranceClaimListInput input);
    Task<InsuranceClaimDto> GetAsync(Guid id);
    Task<InsuranceClaimDto> CreateAsync(CreateInsuranceClaimDto input);
    Task<InsuranceClaimDto> SubmitAsync(Guid id);
    Task<InsuranceClaimDto> ApproveAsync(Guid id, ApproveInsuranceClaimDto input);
    Task<InsuranceClaimDto> RejectAsync(Guid id, RejectInsuranceClaimDto input);
    Task<InsuranceClaimDto> SettleAsync(Guid id);
}
