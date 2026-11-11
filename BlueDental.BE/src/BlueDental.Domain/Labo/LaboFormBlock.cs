using System;

namespace BlueDental.Labo;

/// <summary>
/// One block of a Mẫu phiếu's layout (F-94), kept as JSON on the template and
/// copied onto every order that picks it. <see cref="Span"/> is the width on
/// the slip's three-column grid; the print stacks the blocks in the same order.
/// </summary>
public class LaboFormBlock
{
    public const int MaxTitleLength = 200;
    public const int MaxSpan = 3;

    public string Key { get; private set; } = default!;
    public LaboFormBlockKind Kind { get; private set; }

    /// <summary>The heading shown and printed; null keeps a system block's own name.</summary>
    public string? Title { get; private set; }

    public bool Visible { get; private set; }
    public int Span { get; private set; }

    protected LaboFormBlock() { }

    public bool IsCustom => Kind == LaboFormBlockKind.Custom;

    /// <summary>Thông tin phiếu and Chỉ định hold what every order needs, so they always show.</summary>
    public bool IsLocked => Kind is LaboFormBlockKind.Info or LaboFormBlockKind.Teeth;

    /// <summary>
    /// A block as the builder sends it. A system block's key is its kind's
    /// name; a custom one keeps a well-formed key or gets a new one. The width
    /// is held to 1–3 and a locked block is shown whatever was sent.
    /// </summary>
    public static LaboFormBlock Create(string? key, LaboFormBlockKind kind, string? title, bool visible, int span)
    {
        var trimmed = string.IsNullOrWhiteSpace(title) ? null : title.Trim();
        var block = new LaboFormBlock
        {
            Kind = kind,
            Title = trimmed,
            Span = Math.Clamp(span, 1, MaxSpan),
        };
        block.Key = block.IsCustom
            ? LaboFormField.IsValidKey(key) ? key!.Trim() : Guid.NewGuid().ToString("N")
            : SystemKey(kind);
        block.Visible = visible || block.IsLocked;
        return block;
    }

    public static string SystemKey(LaboFormBlockKind kind) => kind.ToString().ToLowerInvariant();

    /// <summary>A copy for an order, so the order's layout never follows a later template edit.</summary>
    internal LaboFormBlock Copy() => new()
    {
        Key = Key,
        Kind = Kind,
        Title = Title,
        Visible = Visible,
        Span = Span,
    };
}
