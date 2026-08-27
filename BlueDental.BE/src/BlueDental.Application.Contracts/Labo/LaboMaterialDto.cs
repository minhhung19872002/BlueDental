using System;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

public class LaboMaterialDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid TaxonomyId { get; set; }
    public string Name { get; set; } = default!;
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }

    /// <summary>"Nhóm phân loại" — filled from the group so the table needs no join of its own.</summary>
    public string? TaxonomyName { get; set; }
}

public class LaboMaterialInputDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    /// <summary>The classification group. The reference's dialog requires one.</summary>
    [Required]
    public Guid TaxonomyId { get; set; }

    public Guid? ClinicBranchId { get; set; }
}

public class CreateLaboMaterialDto : LaboMaterialInputDto;

public class UpdateLaboMaterialDto : LaboMaterialInputDto;

public class GetLaboMaterialListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    /// <summary>Set when a group is selected in the left panel.</summary>
    public Guid? TaxonomyId { get; set; }

    public string? Filter { get; set; }
}

public interface ILaboMaterialAppService : IApplicationService
{
    Task<PagedResultDto<LaboMaterialDto>> GetListAsync(GetLaboMaterialListInput input);
    Task<LaboMaterialDto> CreateAsync(CreateLaboMaterialDto input);
    Task<LaboMaterialDto> UpdateAsync(Guid id, UpdateLaboMaterialDto input);
    Task DeleteAsync(Guid id);
}
