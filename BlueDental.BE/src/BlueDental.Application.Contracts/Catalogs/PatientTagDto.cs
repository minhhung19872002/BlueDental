using System;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class PatientTagDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public string Color { get; set; } = default!;
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreatePatientTagDto
{
    public Guid ClinicBranchId { get; set; }

    [Required]
    [StringLength(200)]
    public string Name { get; set; } = default!;

    [Required]
    [StringLength(20)]
    public string Color { get; set; } = default!;

    [StringLength(1000)]
    public string? Description { get; set; }
}

public class UpdatePatientTagDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = default!;

    [Required]
    [StringLength(20)]
    public string Color { get; set; } = default!;

    [StringLength(1000)]
    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;
}

public class GetPatientTagListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Matches the reference: one box searches the name and the colour.</summary>
    public string? Filter { get; set; }

    public bool? IsActive { get; set; }
}

public interface IPatientTagAppService : IApplicationService
{
    Task<PagedResultDto<PatientTagDto>> GetListAsync(GetPatientTagListInput input);
    Task<PatientTagDto> GetAsync(Guid id);
    Task<PatientTagDto> CreateAsync(CreatePatientTagDto input);
    Task<PatientTagDto> UpdateAsync(Guid id, UpdatePatientTagDto input);
    Task DeleteAsync(Guid id);
}
