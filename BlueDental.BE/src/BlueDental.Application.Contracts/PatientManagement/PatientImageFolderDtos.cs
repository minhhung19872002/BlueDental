using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement;

/// <summary>A "Thư mục" of a Hình ảnh stage column (F-98), as its tile draws it.</summary>
public class PatientImageFolderDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public PatientImageType Type { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>How many pictures are filed in it.</summary>
    public int ImageCount { get; set; }

    /// <summary>
    /// The picture that peeks out of the folder — the one its feed opens on —
    /// or null when the folder is empty, which the tile draws plain.
    /// </summary>
    public string? CoverUrl { get; set; }
}

public class GetPatientImageFolderListInput
{
    [Required]
    public Guid PatientId { get; set; }

    public Guid? ClinicBranchId { get; set; }

    /// <summary>One stage column's folders; every column's when null.</summary>
    public PatientImageType? Type { get; set; }
}

public class CreatePatientImageFolderDto
{
    [Required]
    public Guid PatientId { get; set; }

    [Required]
    public Guid ClinicBranchId { get; set; }

    public PatientImageType Type { get; set; } = PatientImageType.Before;

    [Required]
    [StringLength(PatientImageFolderConsts.MaxNameLength)]
    public string Name { get; set; } = string.Empty;
}

public class RenamePatientImageFolderDto
{
    [Required]
    [StringLength(PatientImageFolderConsts.MaxNameLength)]
    public string Name { get; set; } = string.Empty;
}

public static class PatientImageFolderConsts
{
    /// <summary>Mirrors <c>PatientImageFolder.MaxNameLength</c>.</summary>
    public const int MaxNameLength = 100;
}

/// <summary>
/// Thư mục of the Hình ảnh tab (F-98): one level, per stage column. Reads with
/// the tab's read ability; creating, renaming and deleting a folder ride on
/// the picture abilities — create, update, delete — of <c>treatmentImage</c>.
/// </summary>
public interface IPatientImageFolderAppService : IApplicationService
{
    Task<List<PatientImageFolderDto>> GetListAsync(GetPatientImageFolderListInput input);
    Task<PatientImageFolderDto> CreateAsync(CreatePatientImageFolderDto input);
    Task<PatientImageFolderDto> RenameAsync(Guid id, RenamePatientImageFolderDto input);

    /// <summary>Deletes the folder; its pictures go back into the column, none is deleted.</summary>
    Task DeleteAsync(Guid id);
}
