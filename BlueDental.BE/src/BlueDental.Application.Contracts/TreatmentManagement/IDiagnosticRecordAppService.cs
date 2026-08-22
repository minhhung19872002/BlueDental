using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.TreatmentManagement;

public interface IDiagnosticRecordAppService : IApplicationService
{
    Task<PagedResultDto<DiagnosticRecordDto>> GetListAsync(GetDiagnosticRecordListInput input);
    Task<DiagnosticRecordDto> CreateAsync(CreateDiagnosticRecordDto input);
    Task DeleteAsync(Guid id);
}
