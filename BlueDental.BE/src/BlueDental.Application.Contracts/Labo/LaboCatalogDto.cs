using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

public class LaboBiteTypeDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateLaboBiteTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class UpdateLaboBiteTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class GetLaboBiteTypeListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
}

public interface ILaboBiteTypeAppService : IApplicationService
{
    Task<PagedResultDto<LaboBiteTypeDto>> GetListAsync(GetLaboBiteTypeListInput input);
    Task<LaboBiteTypeDto> CreateAsync(CreateLaboBiteTypeDto input);
    Task<LaboBiteTypeDto> UpdateAsync(Guid id, UpdateLaboBiteTypeDto input);
    Task DeleteAsync(Guid id);
}

public class LaboFinishLineDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateLaboFinishLineDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class UpdateLaboFinishLineDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class GetLaboFinishLineListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
}

public interface ILaboFinishLineAppService : IApplicationService
{
    Task<PagedResultDto<LaboFinishLineDto>> GetListAsync(GetLaboFinishLineListInput input);
    Task<LaboFinishLineDto> CreateAsync(CreateLaboFinishLineDto input);
    Task<LaboFinishLineDto> UpdateAsync(Guid id, UpdateLaboFinishLineDto input);
    Task DeleteAsync(Guid id);
}

public class LaboRhythmTypeDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateLaboRhythmTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class UpdateLaboRhythmTypeDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
}

public class GetLaboRhythmTypeListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
}

public interface ILaboRhythmTypeAppService : IApplicationService
{
    Task<PagedResultDto<LaboRhythmTypeDto>> GetListAsync(GetLaboRhythmTypeListInput input);
    Task<LaboRhythmTypeDto> CreateAsync(CreateLaboRhythmTypeDto input);
    Task<LaboRhythmTypeDto> UpdateAsync(Guid id, UpdateLaboRhythmTypeDto input);
    Task DeleteAsync(Guid id);
}
