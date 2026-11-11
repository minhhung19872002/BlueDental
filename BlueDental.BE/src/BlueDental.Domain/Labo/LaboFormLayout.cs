using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;

namespace BlueDental.Labo;

/// <summary>
/// The rules of a Mẫu phiếu's layout (F-94): every system block exactly once,
/// custom sections titled and holding at least one field, every field inside a
/// custom section. A template saved without a layout (the F-93 call) takes
/// <see cref="Default"/> — the slip's blocks with one "Thông tin bổ sung"
/// section holding all the fields, before Yêu cầu.
/// </summary>
public static class LaboFormLayout
{
    public const int MaxCustomBlocks = 10;

    /// <summary>The key of the one section a layout-less template keeps its fields in.</summary>
    public const string DefaultCustomKey = "extra";

    private static readonly LaboFormBlockKind[] SystemKinds =
    [
        LaboFormBlockKind.Info,
        LaboFormBlockKind.Restoration,
        LaboFormBlockKind.Shade,
        LaboFormBlockKind.Teeth,
        LaboFormBlockKind.FinishLine,
        LaboFormBlockKind.Notes,
        LaboFormBlockKind.AllCeramic,
        LaboFormBlockKind.Alloy,
        LaboFormBlockKind.OtherOnImplant,
    ];

    /// <summary>
    /// The fixed slip's look (R-1202): Thông tin phiếu and Loại phục hình's
    /// heading across, then three columns read left to right and placed under
    /// the block above in the same column — Toàn sứ, Phục hình khác, Chỉ định;
    /// Hợp kim, Màu răng, Đường hoàn tất — then the fields and Yêu cầu.
    /// </summary>
    public static List<LaboFormBlock> Default(bool withCustom) =>
    [
        LaboFormBlock.Create(null, LaboFormBlockKind.Info, null, true, 3),
        LaboFormBlock.Create(null, LaboFormBlockKind.Restoration, null, true, 3),
        LaboFormBlock.Create(null, LaboFormBlockKind.AllCeramic, null, true, 1),
        LaboFormBlock.Create(null, LaboFormBlockKind.OtherOnImplant, null, true, 1),
        LaboFormBlock.Create(null, LaboFormBlockKind.Teeth, null, true, 1),
        LaboFormBlock.Create(null, LaboFormBlockKind.Alloy, null, true, 1),
        LaboFormBlock.Create(null, LaboFormBlockKind.Shade, null, true, 1),
        LaboFormBlock.Create(null, LaboFormBlockKind.FinishLine, null, true, 1),
        .. withCustom ? [LaboFormBlock.Create(DefaultCustomKey, LaboFormBlockKind.Custom, null, true, 3)] : Array.Empty<LaboFormBlock>(),
        LaboFormBlock.Create(null, LaboFormBlockKind.Notes, null, true, 3),
    ];

    /// <summary>
    /// Checks the layout sent with the fields and puts each field in its
    /// section: one naming no known section goes to the first. No layout
    /// sent keeps the F-93 rule of at least one field.
    /// </summary>
    public static List<LaboFormBlock> Arrange(IReadOnlyList<LaboFormBlock>? blocks, IReadOnlyList<LaboFormField> fields)
    {
        var layout = blocks is { Count: > 0 } ? Check(blocks) : DefaultFor(fields);
        var custom = layout.Where(b => b.IsCustom).ToList();
        if (fields.Count > 0 && custom.Count == 0)
            throw Invalid();

        foreach (var field in fields)
        {
            if (!custom.Any(b => b.Key == field.BlockKey))
                field.MoveTo(custom[0].Key);
        }

        var empty = custom.FirstOrDefault(b => fields.All(f => f.BlockKey != b.Key));
        if (empty is not null)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormBlockEmpty)
                .WithData("block", empty.Title ?? string.Empty);
        return layout;
    }

    private static List<LaboFormBlock> DefaultFor(IReadOnlyList<LaboFormField> fields)
    {
        if (fields.Count == 0)
            throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormTemplateFieldCount)
                .WithData("max", LaboFormTemplate.MaxFields);
        return Default(withCustom: true);
    }

    /// <summary>
    /// A layout saved before Loại phục hình was split (R-1202) has its one block
    /// and no cards: the three cards go right after it, shown as it was.
    /// </summary>
    private static IReadOnlyList<LaboFormBlock> WithCards(IReadOnlyList<LaboFormBlock> blocks)
    {
        LaboFormBlockKind[] cards = [LaboFormBlockKind.AllCeramic, LaboFormBlockKind.Alloy, LaboFormBlockKind.OtherOnImplant];
        var heading = blocks.Where(b => b.Kind == LaboFormBlockKind.Restoration).ToList();
        if (heading.Count != 1 || blocks.Any(b => cards.Contains(b.Kind)))
            return blocks;
        var at = blocks.ToList().IndexOf(heading[0]) + 1;
        var upgraded = blocks.ToList();
        upgraded.InsertRange(at, cards.Select(kind => LaboFormBlock.Create(null, kind, null, heading[0].Visible, 1)));
        return upgraded;
    }

    private static List<LaboFormBlock> Check(IReadOnlyList<LaboFormBlock> sent)
    {
        var blocks = WithCards(sent);
        if (blocks.Any(b => !Enum.IsDefined(b.Kind))
            || SystemKinds.Any(kind => blocks.Count(b => b.Kind == kind) != 1))
            throw Invalid();

        var custom = blocks.Where(b => b.IsCustom).ToList();
        if (custom.Count > MaxCustomBlocks || custom.Select(b => b.Key).Distinct(StringComparer.Ordinal).Count() != custom.Count)
            throw Invalid();

        for (var i = 0; i < blocks.Count; i++)
        {
            if (blocks[i].IsCustom && blocks[i].Title is null)
                throw new BusinessException(BlueDentalDomainErrorCodes.Labo.FormBlockTitleRequired)
                    .WithData("index", i + 1);
        }

        return blocks.ToList();
    }

    private static BusinessException Invalid() => new(BlueDentalDomainErrorCodes.Labo.FormLayoutInvalid);
}
