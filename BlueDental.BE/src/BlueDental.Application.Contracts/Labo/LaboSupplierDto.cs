using System;
using System.ComponentModel.DataAnnotations;
using System.IO;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.Labo;

public class LaboSupplierDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? ContactPerson { get; set; }
    public string? TaxCode { get; set; }
    public string? Address { get; set; }
    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }
    public string? LogoFileId { get; set; }
    public string? LogoPath { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>What the dialog collects. The reference saves the whole form at once.</summary>
public class LaboSupplierInputDto
{
    [Required]
    [MinLength(2)]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    /// <summary>Required by the reference, which disables its save without one.</summary>
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = default!;

    [MaxLength(50)]
    public string? Phone { get; set; }

    [MaxLength(200)]
    public string? ContactPerson { get; set; }

    [MaxLength(100)]
    public string? TaxCode { get; set; }

    [MaxLength(20)]
    public string? ProvinceCode { get; set; }

    [MaxLength(20)]
    public string? WardCode { get; set; }

    [MaxLength(500)]
    public string? Address { get; set; }

    /// <summary>Ignored on update — a supplier does not move between branches.</summary>
    public Guid? ClinicBranchId { get; set; }
}

public class CreateLaboSupplierDto : LaboSupplierInputDto;

public class UpdateLaboSupplierDto : LaboSupplierInputDto;

public class GetLaboSupplierListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>Where the saved logo can be read back from.</summary>
public class LaboSupplierLogoDto
{
    public string Url { get; set; } = default!;
}

public interface ILaboSupplierAppService : IApplicationService
{
    Task<PagedResultDto<LaboSupplierDto>> GetListAsync(GetLaboSupplierListInput input);
    Task<LaboSupplierDto> GetAsync(Guid id);
    Task<LaboSupplierDto> CreateAsync(CreateLaboSupplierDto input);
    Task<LaboSupplierDto> UpdateAsync(Guid id, UpdateLaboSupplierDto input);
    Task DeleteAsync(Guid id);

    Task<LaboSupplierLogoDto> UploadLogoAsync(Guid id, IRemoteStreamContent file);
    Task DeleteLogoAsync(Guid id);
    Task<Stream> GetLogoContentAsync(Guid id);
}
