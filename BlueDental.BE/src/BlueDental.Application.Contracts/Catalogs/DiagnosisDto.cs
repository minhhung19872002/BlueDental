using System;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class DiagnosisDto : FullAuditedEntityDto<Guid>
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateDiagnosisDto
{
    public string Code { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateDiagnosisDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetDiagnosisListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>
/// Not exposed over HTTP: the Danh mục screen works through the catalog-entry
/// routes, and no controller serves this contract.
/// </summary>
[RemoteService(IsEnabled = false)]
public interface IDiagnosisAppService : IApplicationService
{
    Task<PagedResultDto<DiagnosisDto>> GetListAsync(GetDiagnosisListInput input);
    Task<DiagnosisDto> GetAsync(Guid id);
    Task<DiagnosisDto> CreateAsync(CreateDiagnosisDto input);
    Task<DiagnosisDto> UpdateAsync(Guid id, UpdateDiagnosisDto input);
    Task DeleteAsync(Guid id);
}
