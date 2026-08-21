using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public interface ITreatmentPlanAppService : IApplicationService
{
    Task<PagedResultDto<TreatmentPlanDto>> GetListAsync(GetTreatmentPlanListInput input);
    Task<TreatmentPlanDto> GetAsync(Guid id);
    Task<TreatmentPlanDto> CreateAsync(CreateTreatmentPlanDto input);
    Task<TreatmentPlanDto> UpdateAsync(Guid id, UpdateTreatmentPlanDto input);
    Task<TreatmentPlanDto> SubmitForApprovalAsync(Guid id);
    Task<TreatmentPlanDto> ApproveAsync(Guid id, ApproveTreatmentPlanDto input);
    Task<TreatmentPlanDto> StartAsync(Guid id);
    Task<TreatmentPlanDto> CompleteAsync(Guid id);
    Task<TreatmentPlanDto> CancelAsync(Guid id);
}
