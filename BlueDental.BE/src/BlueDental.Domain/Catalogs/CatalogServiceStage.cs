using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Catalogs;

/// <summary>
/// One "công đoạn" of a service — a step of the treatment the doctor is paid
/// against. Reference: the table inside the service dialog's "Công đoạn" tab.
/// </summary>
public class CatalogServiceStage : Entity<Guid>
{
    public Guid CatalogEntryId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// The reference labels this column "Giá trị" with no unit next to it.
    /// BlueDental stores the number as typed and leaves the meaning to the
    /// treatment module — see docs/clone/unknowns.md.
    /// </summary>
    public decimal Value { get; private set; }

    public int SortOrder { get; private set; }

    protected CatalogServiceStage() { }

    public CatalogServiceStage(Guid id, Guid catalogEntryId, string name, decimal value, int sortOrder)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (value < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidStageValue,
                "A stage value cannot be negative.");
        }

        CatalogEntryId = catalogEntryId;
        Name = name;
        Value = value;
        SortOrder = sortOrder;
    }
}
