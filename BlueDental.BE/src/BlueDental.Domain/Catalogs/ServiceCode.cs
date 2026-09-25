using System;
using System.Collections.Generic;
using System.Security.Cryptography;

namespace BlueDental.Catalogs;

/// <summary>
/// The code a new service gets. The reference dropped its "Mã dịch vụ" box and
/// generates the code itself; the codes seen on staging (2026-09-25) are five
/// mixed-case letters and digits (<c>VLE8y</c>, <c>HxHQ4</c>, <c>C5c1h</c>).
/// Its alphabet and uniqueness scope are not observable; BlueDental keeps codes
/// unique within the branch's service catalog, case-insensitively.
/// </summary>
public static class ServiceCode
{
    public const int Length = 5;

    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    /// <summary>
    /// A code not in <paramref name="taken"/>, which it is then added to, so a
    /// batch can draw several in a row. <paramref name="taken"/> must compare
    /// case-insensitively.
    /// </summary>
    public static string Next(ISet<string> taken)
    {
        // 62^5 ≈ 916 million codes; a branch holds hundreds, so a clash is rare
        // and a bounded retry is plenty.
        for (var attempt = 0; attempt < 100; attempt++)
        {
            var code = RandomNumberGenerator.GetString(Alphabet, Length);
            if (taken.Add(code))
            {
                return code;
            }
        }

        throw new InvalidOperationException("Could not find a free service code.");
    }

    public static HashSet<string> NewTakenSet(IEnumerable<string?> existing)
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var code in existing)
        {
            if (!string.IsNullOrWhiteSpace(code))
            {
                set.Add(code.Trim());
            }
        }

        return set;
    }
}
