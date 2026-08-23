using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Operations;

/// <summary>
/// A published item on a department's "Trang chủ" or "Quy trình" section
/// (Quản trị vận hành).
///
/// The reference renders both sections as an article list; their ability
/// subjects (<c>operations&lt;Department&gt;Home</c> / <c>...Process</c>) carry full
/// CRUD, which is why they are content rather than a view over another module.
/// The article payload itself was never observed — no sub-tab fired an API call
/// — so the fields here are BlueDental's minimum for an announcement/SOP list.
/// </summary>
public class OperationsArticle : FullAuditedAggregateRoot<Guid>
{
    public Guid ClinicBranchId { get; private set; }
    public OperationsDepartment Department { get; private set; }
    public OperationsSection Section { get; private set; }

    public string Title { get; private set; } = string.Empty;
    public string? Summary { get; private set; }
    public string? Content { get; private set; }

    /// <summary>Display order inside the section.</summary>
    public int SortOrder { get; private set; }

    /// <summary>Drafts are visible to editors only.</summary>
    public bool IsPublished { get; private set; }

    public DateTimeOffset? PublishedAt { get; private set; }

    /// <summary>Pinned articles sort above the rest.</summary>
    public bool IsPinned { get; private set; }

    protected OperationsArticle() { }

    public static OperationsArticle Draft(
        Guid id,
        Guid clinicBranchId,
        OperationsDepartment department,
        OperationsSection section,
        string title,
        string? summary = null,
        string? content = null,
        int sortOrder = 0)
    {
        Check.NotNullOrWhiteSpace(title, nameof(title));

        return new OperationsArticle
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            Department = department,
            Section = section,
            Title = title,
            Summary = summary,
            Content = content,
            SortOrder = sortOrder,
            IsPublished = false,
            IsPinned = false
        };
    }

    public OperationsArticle UpdateContent(string title, string? summary, string? content)
    {
        Check.NotNullOrWhiteSpace(title, nameof(title));

        Title = title;
        Summary = summary;
        Content = content;
        return this;
    }

    public OperationsArticle Publish()
    {
        if (string.IsNullOrWhiteSpace(Content))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Operations.EmptyArticleContent,
                "Không thể đăng bài khi chưa có nội dung.");
        }

        IsPublished = true;
        PublishedAt = DateTimeOffset.UtcNow;
        return this;
    }

    public OperationsArticle Unpublish()
    {
        IsPublished = false;
        return this;
    }

    public OperationsArticle Pin(bool pinned)
    {
        IsPinned = pinned;
        return this;
    }

    public OperationsArticle Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }
}
