using System;
using System.Collections.Generic;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Labo;

/// <summary>
/// Mẫu phiếu bổ sung (F-93, the hybrid of labo.md §11.1): a branch's own list
/// of extra fields that the Phiếu yêu cầu can take on top of its fixed core.
/// Not tied to a supplier (owner, 2026-11-11). An order copies the fields it
/// was filled with (<see cref="LaboExtraForm"/>), so editing, switching off
/// or deleting a template never changes an order already written.
/// </summary>
public class LaboFormTemplate : FullAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 200;
    public const int MaxDescriptionLength = 500;
    public const int MaxFields = 30;

    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }

    /// <summary>Đang dùng / Ngừng: a Ngừng template is not offered on a new slip.</summary>
    public bool IsActive { get; private set; }

    /// <summary>Starts at 1 and goes up on every save; an order records the one it copied.</summary>
    public int Version { get; private set; }

    private readonly List<LaboFormField> _fields = [];
    public IReadOnlyList<LaboFormField> Fields => _fields.AsReadOnly();

    // Null or empty on a row saved before F-94: such a template reads as the default layout.
    private List<LaboFormBlock>? _blocks = [];

    /// <summary>
    /// The slip's layout (F-94): the system blocks and the template's own
    /// sections in order. A template saved before layouts reads as
    /// <see cref="LaboFormLayout.Default"/> with its fields in one section.
    /// </summary>
    public IReadOnlyList<LaboFormBlock> Blocks =>
        HasLayout ? _blocks!.AsReadOnly() : LaboFormLayout.Default(withCustom: true);

    /// <summary>The section a field sits in, reading a field saved before layouts as the default one.</summary>
    public string BlockKeyOf(LaboFormField field) =>
        HasLayout ? field.BlockKey ?? LaboFormLayout.DefaultCustomKey : LaboFormLayout.DefaultCustomKey;

    private bool HasLayout => _blocks is { Count: > 0 };

    protected LaboFormTemplate() { }

    public static LaboFormTemplate Create(
        Guid id, Guid clinicBranchId, string? name, string? description, IReadOnlyList<LaboFormField> fields,
        IReadOnlyList<LaboFormBlock>? blocks = null)
    {
        var template = new LaboFormTemplate
        {
            Id = id,
            ClinicBranchId = clinicBranchId,
            IsActive = true,
        };
        return template.Update(name, description, fields, blocks);
    }

    /// <summary>
    /// The builder saves the name, the description, the layout and the whole
    /// field list together. No layout sent (the F-93 call) gives the default
    /// one, which needs at least one field; a layout of its own may hold none.
    /// </summary>
    public LaboFormTemplate Update(
        string? name, string? description, IReadOnlyList<LaboFormField> fields,
        IReadOnlyList<LaboFormBlock>? blocks = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormTemplateNameRequired);
        if (fields.Count > MaxFields)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormTemplateFieldCount)
                .WithData("max", MaxFields);

        var labels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var keys = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < fields.Count; i++)
        {
            var field = fields[i];
            if (string.IsNullOrWhiteSpace(field.Label))
                throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormFieldLabelRequired)
                    .WithData("index", i + 1);
            if (!labels.Add(field.Label))
                throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormFieldLabelDuplicate)
                    .WithData("field", field.Label);
            if (!keys.Add(field.Key))
                keys.Add(field.TakeNewKey());
        }

        var layout = LaboFormLayout.Arrange(blocks, fields);
        Name = name.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        _fields.Clear();
        _fields.AddRange(fields);
        _blocks = layout;
        Version++;
        return this;
    }

    public LaboFormTemplate SetActive(bool active)
    {
        IsActive = active;
        return this;
    }
}
