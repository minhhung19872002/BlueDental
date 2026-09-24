using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Catalogs;

/// <summary>
/// One row of a catalog — the right-hand table of every "BE:Perm:Catalogs" sub-route
/// (a service, a diagnosis, a medicine, a source, a template, ...).
///
/// The reference exposes these behind per-catalog endpoints
/// (<c>/care-service/list</c>, <c>/diagnosis/list</c>, <c>/medicine/list</c>, ...)
/// but every one of them has the same shape: an entry that belongs to a
/// <see cref="Taxonomy"/> group, optionally priced, optionally carrying template
/// content. Modelling it once keeps the twelve catalogs from becoming twelve
/// near-identical aggregates.
/// </summary>
public class CatalogEntry : FullAuditedAggregateRoot<Guid>
{
    private readonly List<CatalogServiceStage> _stages = new();
    private readonly List<PrescriptionTemplateLine> _prescriptionLines = new();

    public Guid ClinicBranchId { get; private set; }

    /// <summary>The group this entry belongs to.</summary>
    public Guid TaxonomyId { get; private set; }

    /// <summary>Denormalised group slug so a catalog can be queried without a join.</summary>
    public string Group { get; private set; } = string.Empty;

    public string Name { get; private set; } = string.Empty;

    public string? Code { get; private set; }

    public string? Description { get; private set; }

    /// <summary>Set for priced catalogs (dịch vụ, thuốc, vật tư); null elsewhere.</summary>
    public decimal? Price { get; private set; }

    /// <summary>Set for template catalogs (đơn thuốc mẫu, bệnh án mẫu); null elsewhere.</summary>
    public string? Content { get; private set; }

    public bool IsActive { get; private set; }

    public int SortOrder { get; private set; }

    /// <summary>"BE:Field:DetailName" on a service — a longer name for the same thing.</summary>
    public string? DetailName { get; private set; }

    /// <summary>"BE:Field:Note" on a diagnosis or a piece of consulting data.</summary>
    public string? Note { get; private set; }

    /// <summary>"BE:Field:Unit" on a service, "BE:Field:UnitOfMeasure" on a medicine.</summary>
    public string? Unit { get; private set; }

    /// <summary>Set on services only — price, tax and the three setting tabs.</summary>
    public CatalogServiceConfig? ServiceConfig { get; private set; }

    /// <summary>Set on medicines only.</summary>
    public CatalogMedicine? Medicine { get; private set; }

    /// <summary>The "BE:Common:Stage" table of a service.</summary>
    public IReadOnlyList<CatalogServiceStage> Stages => _stages;

    /// <summary>The medicine lines of a "BE:Common:RxTemplate".</summary>
    public IReadOnlyList<PrescriptionTemplateLine> PrescriptionLines => _prescriptionLines;

    protected CatalogEntry() { }

    public static CatalogEntry Create(
        Guid id,
        Guid clinicBranchId,
        Guid taxonomyId,
        string group,
        string name,
        string? code = null,
        decimal? price = null,
        string? content = null,
        string? description = null,
        int sortOrder = 0)
    {
        Check.NotNullOrWhiteSpace(group, nameof(group));
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (!TaxonomyGroups.IsKnown(group))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.UnknownTaxonomyGroup,
                $"'{group}' is not a taxonomy group observed on the reference application.");
        }

        GuardPrice(group, price);
        GuardContent(group, content);

        return new CatalogEntry
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            TaxonomyId = taxonomyId,
            Group = group,
            Name = name,
            Code = code,
            Price = price,
            Content = content,
            Description = description,
            IsActive = true,
            SortOrder = sortOrder
        };
    }

    public CatalogEntry Rename(string name)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));
        Name = name;
        return this;
    }

    public CatalogEntry ChangePrice(decimal? price)
    {
        GuardPrice(Group, price);
        Price = price;
        return this;
    }

    public CatalogEntry UpdateContent(string? content)
    {
        GuardContent(Group, content);
        Content = content;
        return this;
    }

    public CatalogEntry UpdateDescription(string? description)
    {
        Description = description;
        return this;
    }

    public CatalogEntry UpdateDetails(string? detailName, string? note, string? unit)
    {
        DetailName = detailName;
        Note = note;
        Unit = unit;
        return this;
    }

    /// <summary>
    /// The service half of the entry. Created on first use so the row only
    /// exists for the catalog that has one.
    /// </summary>
    public CatalogServiceConfig EnsureServiceConfig(Guid id)
    {
        ServiceConfig ??= new CatalogServiceConfig(id, Id);
        return ServiceConfig;
    }

    public CatalogMedicine EnsureMedicine(Guid id)
    {
        Medicine ??= new CatalogMedicine(id, Id);
        return Medicine;
    }

    /// <summary>
    /// Replaces the whole stage list. The dialog edits it as one table, so it
    /// arrives whole — reconciling row by row would only invent an order the
    /// user never asked for.
    /// </summary>
    public void ReplaceStages(IEnumerable<CatalogServiceStage> stages)
    {
        _stages.Clear();
        _stages.AddRange(stages);
    }

    /// <summary>
    /// Saves the stage table as the dialog sends it, keeping each step's
    /// identity. A row that carries the id of one of this service's steps
    /// updates that step in place; a row without one (or with a stranger's) is
    /// a new step; a step no row names is gone. The order is the table's.
    ///
    /// <see cref="ReplaceStages"/> gave every row a fresh id on every save,
    /// which cut each công đoạn off from the steps it had ticked — their
    /// names came back empty and the checklists drew blank boxes.
    /// </summary>
    public void SyncStages(IEnumerable<(Guid Id, string Name, decimal Value)> rows, Func<Guid> newId)
    {
        var kept = new List<CatalogServiceStage>();
        var index = 0;
        foreach (var row in rows)
        {
            var existing = row.Id == Guid.Empty
                ? null
                : _stages.FirstOrDefault(stage => stage.Id == row.Id && !kept.Contains(stage));
            if (existing != null)
            {
                existing.Revise(row.Name, row.Value, index);
                kept.Add(existing);
            }
            else
            {
                kept.Add(new CatalogServiceStage(newId(), Id, row.Name, row.Value, index));
            }

            index += 1;
        }

        _stages.RemoveAll(stage => !kept.Contains(stage));
        foreach (var stage in kept.Where(stage => !_stages.Contains(stage)))
        {
            _stages.Add(stage);
        }
    }

    public void ReplacePrescriptionLines(IEnumerable<PrescriptionTemplateLine> lines)
    {
        _prescriptionLines.Clear();
        _prescriptionLines.AddRange(lines);
    }

    /// <summary>Moves the entry into another group of the same catalog.</summary>
    public CatalogEntry MoveTo(Guid taxonomyId)
    {
        TaxonomyId = taxonomyId;
        return this;
    }

    public CatalogEntry Reorder(int sortOrder)
    {
        SortOrder = sortOrder;
        return this;
    }

    public CatalogEntry Activate()
    {
        IsActive = true;
        return this;
    }

    public CatalogEntry Deactivate()
    {
        IsActive = false;
        return this;
    }

    /// <summary>
    /// Marks this entry deleted, or brings it back.
    ///
    /// The reference models "BE:Status:Active" and "BE:Status:Deleted" as one state rather
    /// than two flags, and a delete there can always be taken back — so this is
    /// a plain transition, not a one-way door.
    /// </summary>
    public void SetDeleted(bool deleted)
    {
        if (IsDeleted == deleted)
        {
            return;
        }

        IsDeleted = deleted;
        DeletionTime = deleted ? DateTime.UtcNow : null;

        if (!deleted)
        {
            DeleterId = null;
        }
    }

    private static void GuardPrice(string group, decimal? price)
    {
        if (price is null)
        {
            return;
        }

        if (price < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.InvalidCatalogPrice,
                "A catalog price must not be negative.");
        }

        if (!TaxonomyGroups.Priced.Contains(group))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.PriceNotSupported,
                $"Catalog '{group}' does not carry a price.");
        }
    }

    private static void GuardContent(string group, string? content)
    {
        if (content is null)
        {
            return;
        }

        // Chẩn đoán and Dữ liệu tư vấn carry a rich-text body too, not only the
        // two template catalogs — see TaxonomyGroups.WithContent.
        if (!TaxonomyGroups.WithContent.Contains(group))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Catalogs.ContentNotSupported,
                $"Catalog '{group}' does not carry a content body.");
        }
    }
}
