using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Operations;

public class OperationArticle : FullAuditedAggregateRoot<Guid>
{
    public string Title { get; private set; } = default!;
    public string? Content { get; private set; }
    public Guid CategoryId { get; private set; }
    public string Department { get; private set; } = default!;
    public string SubTab { get; private set; } = default!;

    protected OperationArticle() { }

    public OperationArticle(Guid id, string title, Guid categoryId, string department, string subTab, string? content = null)
        : base(id)
    {
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
