using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public interface IPrescriptionAppService : IApplicationService
{
    Task<PagedResultDto<PrescriptionDto>> GetListAsync(GetPrescriptionListInput input);
    Task<PrescriptionDto> GetAsync(Guid id);
}
