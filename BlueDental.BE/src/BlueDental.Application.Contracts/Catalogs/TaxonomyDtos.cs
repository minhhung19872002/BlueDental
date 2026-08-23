using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Catalogs;

public class TaxonomyDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Alias { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public string? SubGroup { get; set; }
    public bool IsSystem { get; set; }
    public int SortOrder { get; set; }
    public bool IsPriced { get; set; }
    public bool IsTemplated { get; set; }

    /// <summary>Reference field <c>itemCount</c> — populated when includeCount is set.</summary>
    public int ItemCount { get; set; }
}

public class CreateTaxonomyDto
{
    public Guid ClinicBranchId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Alias { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public string? SubGroup { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateTaxonomyDto
{
    public string Name { get; set; } = string.Empty;
    public string? Alias { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetTaxonomyListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public string? Group { get; set; }
    public string? Filter { get; set; }

    /// <summary>Mirrors the reference <c>includeCount=true</c> query flag.</summary>
    public bool IncludeCount { get; set; }
}

public class CatalogEntryDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid TaxonomyId { get; set; }
    public string Group { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public string? Content { get; set; }
    public bool IsImageRequired { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }

    public string? TaxonomyName { get; set; }
}

public class CreateCatalogEntryDto
{
    public Guid ClinicBranchId { get; set; }
    public Guid TaxonomyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public decimal? Price { get; set; }
    public string? Content { get; set; }
    public string? Description { get; set; }
    public bool IsImageRequired { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateCatalogEntryDto
{
    public Guid TaxonomyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public decimal? Price { get; set; }
    public string? Content { get; set; }
    public string? Description { get; set; }
    public bool IsImageRequired { get; set; }
    public bool IsActive { get; set; }
    public int SortOrder { get; set; }
}

public class GetCatalogEntryListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public Guid? TaxonomyId { get; set; }
    public string? Group { get; set; }
    public bool? IsActive { get; set; }
    public string? Filter { get; set; }
}
