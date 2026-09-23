using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Queue;

public interface IQueueTicketAppService : IApplicationService
{
    Task<QueueTicketDto> CreateAsync(CreateQueueTicketDto input);
    Task<PagedResultDto<QueueTicketDto>> GetListAsync(GetQueueTicketListInput input);
    Task<QueueTicketDto> GetAsync(Guid id);
    Task<QueueTicketDto> CallAsync(Guid id, CallTicketInput input);
    Task<QueueTicketDto> CallNextAsync(CallTicketInput input);
    Task<QueueTicketDto> ServeAsync(Guid id);
    Task<QueueTicketDto> CompleteAsync(Guid id);
    Task<QueueTicketDto> SkipAsync(Guid id);
    Task<QueueTicketDto> RecallAsync(Guid id, CallTicketInput input);
    Task<QueueStatsDto> GetStatsAsync(DateOnly? date = null, Guid? counterId = null);
    Task<List<QueueDisplayDto>> GetDisplayAsync(Guid branchId, Guid? counterId = null);

    // Service Counter management
    Task<List<ServiceCounterDto>> GetCountersAsync();
    Task<ServiceCounterDto> CreateCounterAsync(CreateServiceCounterDto input);
    Task<ServiceCounterDto> UpdateCounterAsync(Guid id, UpdateServiceCounterDto input);
    Task<ServiceCounterDto> ToggleCounterAsync(Guid id);
    Task DeleteCounterAsync(Guid id);
}
