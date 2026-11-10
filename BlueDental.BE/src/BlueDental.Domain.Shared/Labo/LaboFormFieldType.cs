namespace BlueDental.Labo;

/// <summary>
/// The kind of a field on a Mẫu phiếu bổ sung (F-93). It decides the input
/// the Phiếu yêu cầu shows and how the answer is checked; every answer is
/// stored as text.
/// </summary>
public enum LaboFormFieldType : short
{
    /// <summary>One line of text, at most 500 characters.</summary>
    Text = 1,

    /// <summary>A paragraph, at most 4000 characters.</summary>
    LongText = 2,

    /// <summary>A number, stored in invariant form ("12.5").</summary>
    Number = 3,

    /// <summary>A day, stored as yyyy-MM-dd.</summary>
    Date = 4,

    /// <summary>One of the field's options.</summary>
    Select = 5,

    /// <summary>Any of the field's options, stored in the options' order.</summary>
    MultiSelect = 6,

    /// <summary>Có / Không, stored as "true" / "false".</summary>
    YesNo = 7
}
