using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public interface IConsultationRecordAppService : IApplicationService
{
    Task<PagedResultDto<ConsultationRecordDto>> GetListAsync(GetConsultationRecordListInput input);
    Task<ConsultationRecordDto> CreateAsync(CreateConsultationRecordDto input);
    Task DeleteAsync(Guid id);
}
