using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare;

public interface ICustomerCareAppService : IApplicationService
{
    Task<PagedResultDto<CareRecordDto>> GetListAsync(GetCareRecordListInput input);
    Task<CareRecordDto> GetAsync(Guid id);
    Task<CareRecordDto> CreateAsync(CreateCareRecordDto input);
    Task StartAsync(Guid id);
    Task CompleteAsync(Guid id, string resolution);
    Task CancelAsync(Guid id);
}
