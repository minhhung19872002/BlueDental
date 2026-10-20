using System;

namespace BlueDental;

/// <summary>
/// Text functions a LINQ query may call. Each is mapped onto the PostgreSQL
/// function that does the job (see the DbContext's model), so it runs only
/// inside a query; called directly it throws.
/// </summary>
public static class DbText
{
    /// <summary>
    /// PostgreSQL's <c>unaccent()</c>: "Đường ghi chú" → "Duong ghi chu". Put on
    /// both the column and the typed term, it lets a search match whether either
    /// side carries Vietnamese marks or not — "duc" finds "Đức" and "đức" finds
    /// "duc". Decomposed text (a letter followed by a combining mark) folds the
    /// same as precomposed.
    /// </summary>
    public static string Unaccent(string text) =>
        throw new InvalidOperationException($"{nameof(Unaccent)} runs only inside a database query.");
}
