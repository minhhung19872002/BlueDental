using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public interface IDentalProcedureAppService : IApplicationService
{
    Task<PagedResultDto<DentalProcedureDto>> GetListAsync(GetDentalProcedureListInput input);
    Task<DentalProcedureDto> GetAsync(Guid id);
    Task<DentalProcedureDto> CreateAsync(CreateDentalProcedureDto input);
    Task<DentalProcedureDto> UpdateAsync(Guid id, UpdateDentalProcedureDto input);
    Task DeleteAsync(Guid id);
}
