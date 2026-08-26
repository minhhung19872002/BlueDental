using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Operations;

public class OperationCategoryDto : EntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string Department { get; set; } = default!;
    public string SubTab { get; set; } = default!;
    public int SortOrder { get; set; }
    public DateTimeOffset CreationTime { get; set; }
}

public class UpdateOperationCategoryDto
{
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
}

public class CreateOperationCategoryDto
{
    /// <summary>Empty lands the row in the caller's own branch.</summary>
    public Guid ClinicBranchId { get; set; }

    public string Name { get; set; } = default!;
    public string Department { get; set; } = default!;
    public string SubTab { get; set; } = default!;
    public int SortOrder { get; set; }
}

public class OperationArticleDto : EntityDto<Guid>
{
    public string Title { get; set; } = default!;
    public string? Content { get; set; }
    public Guid CategoryId { get; set; }
    public string Department { get; set; } = default!;
    public string SubTab { get; set; } = default!;
    public DateTimeOffset CreationTime { get; set; }
    public DateTimeOffset? LastModificationTime { get; set; }
}

public class CreateOperationArticleDto
{
    /// <summary>Empty lands the row in the caller's own branch.</summary>
    public Guid ClinicBranchId { get; set; }

    public string Title { get; set; } = default!;
    public string? Content { get; set; }
    public Guid CategoryId { get; set; }
    public string Department { get; set; } = default!;
    public string SubTab { get; set; } = default!;
}

public class UpdateOperationArticleDto
{
    public string Title { get; set; } = default!;
    public string? Content { get; set; }
}

public class GetOperationListInput : PagedAndSortedResultRequestDto
{
    /// <summary>Null means "every branch this account may see".</summary>
    public Guid? ClinicBranchId { get; set; }

    public string? Department { get; set; }
    public string? SubTab { get; set; }
    public Guid? CategoryId { get; set; }
    public string? Filter { get; set; }
}
