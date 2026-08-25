using System;

namespace BlueDental.Catalogs;

/// <summary>
/// The "% thuế" values the reference offers on a service. Two of them are not
/// numbers at all, which is why this is an enum rather than a decimal column.
/// </summary>
public enum ServiceTaxRate
{
    /// <summary>KCT — không chịu thuế.</summary>
    NotTaxable = 0,

    /// <summary>KKKNT — không kê khai nộp thuế.</summary>
    NotDeclared = 1,

    Zero = 2,
    Five = 3,
    Eight = 4,
    Ten = 5
}

public static class ServiceTaxRates
{
    /// <summary>The percentage to apply. The two non-numeric values charge nothing.</summary>
    public static decimal Percent(this ServiceTaxRate rate) => rate switch
    {
        ServiceTaxRate.Five => 5m,
        ServiceTaxRate.Eight => 8m,
        ServiceTaxRate.Ten => 10m,
        _ => 0m
    };
}

/// <summary>
/// "Sử dụng" on a prescription line. The reference offers these as a
/// <b>multi-select</b> — one line can be both "sau khi ăn" and "trước khi ngủ" —
/// so they are flags rather than a single choice.
/// </summary>
[Flags]
public enum PrescriptionUsage
{
    None = 0,

    /// <summary>Sau khi ăn.</summary>
    AfterMeal = 1,

    /// <summary>Trước khi ăn.</summary>
    BeforeMeal = 2,

    /// <summary>Trong khi ăn.</summary>
    DuringMeal = 4,

    /// <summary>Sau khi thức dậy.</summary>
    AfterWakingUp = 8,

    /// <summary>Trước khi ngủ.</summary>
    BeforeSleep = 16,

    /// <summary>Khác.</summary>
    Other = 32
}

/// <summary>
/// The warranty a service carries, in days. The reference offers a fixed row of
/// choices plus a free "Tuỳ chỉnh … Ngày", so the stored value is simply the
/// number of days and the UI matches it back to a choice.
/// </summary>
public static class ServiceWarranty
{
    public const int None = 0;
    public const int OneMonth = 30;
    public const int ThreeMonths = 90;
    public const int SixMonths = 180;
    public const int NineMonths = 270;
    public const int OneYear = 365;
    public const int TwoYears = 730;

    public static readonly int[] Presets =
        [None, OneMonth, ThreeMonths, SixMonths, NineMonths, OneYear, TwoYears];
}
