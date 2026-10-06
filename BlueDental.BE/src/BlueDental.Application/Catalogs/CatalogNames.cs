using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using BlueDental.Catalogs.Import;

namespace BlueDental.Catalogs;

/// <summary>
/// When two Danh mục names are the same name: case and stray whitespace aside —
/// the rule the Excel import already matches rows by (<see cref="ExcelCells.Key"/>),
/// so a name the dialog refuses is the name the import would have merged.
/// </summary>
internal static class CatalogNames
{
    public static bool Same(string? a, string? b) => ExcelCells.Key(a) == ExcelCells.Key(b);

    /// <summary>Refuses <paramref name="name"/> when one of <paramref name="taken"/> is the same name.</summary>
    public static void EnsureFree(string name, IEnumerable<string> taken, string errorCode)
    {
        if (taken.Any(existing => Same(existing, name)))
        {
            throw new BusinessException(errorCode).WithData("name", name.Trim());
        }
    }
}
