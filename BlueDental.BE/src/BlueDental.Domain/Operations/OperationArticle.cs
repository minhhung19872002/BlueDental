using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Operations;

public class OperationArticle : FullAuditedAggregateRoot<Guid>
{
    /// <summary>Every row here is one branch's, as everywhere else.</summary>
    public Guid ClinicBranchId { get; private set; }

    public string Title { get; private set; } = default!;
    public string? Content { get; private set; }
    public Guid CategoryId { get; private set; }
    public string Department { get; private set; } = default!;
    public string SubTab { get; private set; } = default!;

    protected OperationArticle() { }

    public OperationArticle(
        Guid id,
        Guid clinicBranchId,
        string title,
        Guid categoryId,
        string department,
        string subTab,
        string? content = null)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Title = title;
        CategoryId = categoryId;
        Department = department;
        SubTab = subTab;
        Content = content;
    }

    public OperationArticle Update(string title, string? content)
    {
        Title = title;
        Content = content;
        return this;
    }
}
