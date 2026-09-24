using System.Collections.Generic;
using ClosedXML.Excel;
using Microsoft.Extensions.Localization;
using static BlueDental.Catalogs.Import.ImportLayout;

namespace BlueDental.Catalogs.Import;

/// <summary>
/// Reads one data row into a draft, collecting every problem with it instead
/// of stopping at the first. The limits are the column lengths of the tables
/// the row will land in, so nothing that passes here can fail on save.
/// </summary>
internal sealed class ImportRowReader
{
    private const int NameMax = 300;
    private const int GroupNameMax = 200;
    private const int CodeMax = 64;
    private const int DescriptionMax = 2000;
    private const int DetailNameMax = 400;
    private const int NoteMax = 2000;
    private const int UnitMax = 50;
    private const int ActiveIngredientMax = 400;
    private const int UsageMax = 1000;
    private const int UsageNoteMax = 1000;
    private const int PrescriptionCodeMax = 100;

    private readonly IStringLocalizer _l;
    private readonly ImportSheetLayout _layout;
    private readonly IReadOnlyDictionary<string, int> _columns;
    private readonly IXLRow _row;
    private readonly List<string> _errors = [];

    private ImportRowReader(
        IStringLocalizer l,
        ImportSheetLayout layout,
        IReadOnlyDictionary<string, int> columns,
        IXLRow row)
    {
        _l = l;
        _layout = layout;
        _columns = columns;
        _row = row;
    }

    public static (EntryDraft Draft, List<string> Errors) ReadEntry(
        IStringLocalizer l, ImportLayout layout, IReadOnlyDictionary<string, int> columns, IXLRow row)
    {
        var reader = new ImportRowReader(l, layout.Entries, columns, row);
        var draft = reader.ReadEntry(layout.Group) with { Given = reader.GivenColumns() };
        return (draft, reader._errors);
    }

    public static (LineDraft Draft, List<string> Errors) ReadLine(
        IStringLocalizer l, ImportSheetLayout layout, IReadOnlyDictionary<string, int> columns, IXLRow row)
    {
        var reader = new ImportRowReader(l, layout, columns, row);
        return (reader.ReadLine(), reader._errors);
    }

    /// <summary>Display text of each template column, in template order, for the preview table.</summary>
    public static List<string?> Values(
        ImportSheetLayout layout, IReadOnlyDictionary<string, int> columns, IXLRow row)
    {
        var values = new List<string?>(layout.Columns.Count);
        foreach (var column in layout.Columns)
        {
            values.Add(columns.TryGetValue(column.Key, out var index)
                ? ExcelCells.Text(row.Cell(index))
                : null);
        }

        return values;
    }

    private EntryDraft ReadEntry(string group)
    {
        var name = Required(Col.Name, NameMax);
        var groupName = _layout.Has(Col.Group) ? Required(Col.Group, GroupNameMax) : null;
        var priority = OptionalInteger(Col.Priority, allowZero: true);

        return group switch
        {
            TaxonomyGroups.CareService => new EntryDraft
            {
                GroupName = groupName,
                Name = name,
                SortOrder = priority,
                DetailName = Optional(Col.DetailName, DetailNameMax),
                Description = Optional(Col.Description, DescriptionMax),
                Code = Optional(Col.Code, CodeMax),
                Price = Money(Col.Price),
                Unit = Optional(Col.Unit, UnitMax),
                ServiceConfig = ReadServiceConfig(),
                Stages = ReadStages()
            },
            TaxonomyGroups.MedicationType => new EntryDraft
            {
                GroupName = groupName,
                Name = name,
                SortOrder = priority,
                Price = Money(Col.Price),
                Unit = Optional(Col.Unit, UnitMax),
                Medicine = new MedicineDto
                {
                    ActiveIngredient = Optional(Col.ActiveIngredient, ActiveIngredientMax),
                    Usage = Optional(Col.Usage, UsageMax),
                    PurchasePrice = Money(Col.PurchasePrice) ?? 0m,
                    PrescriptionCode = Optional(Col.PrescriptionCode, PrescriptionCodeMax),
                    UsageNote = Optional(Col.UsageNote, UsageNoteMax)
                }
            },
            TaxonomyGroups.Diagnosis or TaxonomyGroups.ConsultingData => new EntryDraft
            {
                GroupName = groupName,
                Name = name,
                SortOrder = priority,
                Content = ExcelCells.Html(Cell(Col.Content)),
                Note = Optional(Col.Note, NoteMax)
            },
            TaxonomyGroups.PrescriptionTemplate => new EntryDraft
            {
                Name = name,
                SortOrder = priority,
                Description = Optional(Col.Advice, DescriptionMax)
            },
            _ => new EntryDraft { GroupName = groupName, Name = name, SortOrder = priority }
        };
    }

    private LineDraft ReadLine()
    {
        var usageOk = ExcelCells.TryUsage(Text(Col.Usage), out var usage, out var unknownWord);
        if (!usageOk)
        {
            _errors.Add(_l["Taxonomy:Import:Err:BadUsage", Header(Col.Usage), unknownWord ?? string.Empty]);
        }

        var otherUsage = Optional(Col.OtherUsage, UsageMax);
        if (otherUsage != null)
        {
            // Writing the usage out is the same as ticking "Khác".
            usage |= PrescriptionUsage.Other;
        }
        else if (usage.HasFlag(PrescriptionUsage.Other))
        {
            _errors.Add(_l["Taxonomy:Import:Err:OtherUsageRequired", Header(Col.OtherUsage)]);
        }

        return new LineDraft
        {
            TemplateName = Required(Col.Template, NameMax),
            MedicineName = Required(Col.Medicine, NameMax),
            TimesPerDay = PositiveInteger(Col.TimesPerDay),
            AmountPerTime = PositiveMoney(Col.AmountPerTime),
            Days = PositiveInteger(Col.Days),
            Usage = usage,
            OtherUsage = otherUsage
        };
    }

    private ServiceConfigDto ReadServiceConfig()
    {
        if (!ExcelCells.TryTaxRate(Text(Col.TaxRate), out var taxRate))
        {
            _errors.Add(_l["Taxonomy:Import:Err:BadTaxRate", Header(Col.TaxRate)]);
        }

        var discountIsPercent = Flag(Col.DiscountIsPercent);
        var discountValue = Money(Col.DiscountValue) ?? 0m;
        if (discountIsPercent && discountValue > 100m)
        {
            _errors.Add(_l["Taxonomy:Import:Err:DiscountPercent", Header(Col.DiscountValue)]);
        }

        return new ServiceConfigDto
        {
            TaxRate = taxRate,
            PriceIncludesTax = Flag(Col.PriceIncludesTax),
            DiscountIsPercent = discountIsPercent,
            DiscountValue = discountValue,
            RequireImage = Flag(Col.RequireImage),
            DeductDoctorOnWarranty = Flag(Col.DeductDoctorOnWarranty),
            SeparateRevenue = Flag(Col.SeparateRevenue),
            ShowToothOnInvoice = Flag(Col.ShowToothOnInvoice),
            RevenueByStage = Flag(Col.RevenueByStage),
            RequireStageSequence = Flag(Col.RequireStageSequence),
            WarrantyDays = OptionalInteger(Col.WarrantyDays, allowZero: true) ?? 0
        };
    }

    private List<ServiceStageDto> ReadStages()
    {
        var stages = ExcelCells.Stages(Text(Col.Stages));
        if (stages == null)
        {
            _errors.Add(_l["Taxonomy:Import:Err:BadStages", Header(Col.Stages)]);
            return [];
        }

        var list = new List<ServiceStageDto>(stages.Count);
        foreach (var (name, value) in stages)
        {
            list.Add(new ServiceStageDto { Name = name, Value = value });
        }

        return list;
    }

    /// <summary>The template columns this row actually filled in.</summary>
    private HashSet<string> GivenColumns()
    {
        var given = new HashSet<string>();
        foreach (var key in _columns.Keys)
        {
            if (Text(key) != null)
            {
                given.Add(key);
            }
        }

        return given;
    }

    private IXLCell? Cell(string key) =>
        _columns.TryGetValue(key, out var index) ? _row.Cell(index) : null;

    private string? Text(string key) => ExcelCells.Text(Cell(key));

    private string Header(string key) => _layout[key].Header;

    private string Required(string key, int max)
    {
        var text = Text(key);
        if (text == null)
        {
            _errors.Add(_l["Taxonomy:Import:Err:Required", Header(key)]);
            return string.Empty;
        }

        return CheckLength(key, text, max);
    }

    private string? Optional(string key, int max)
    {
        var text = Text(key);
        return text == null ? null : CheckLength(key, text, max);
    }

    private string CheckLength(string key, string text, int max)
    {
        if (text.Length > max)
        {
            _errors.Add(_l["Taxonomy:Import:Err:TooLong", Header(key), max]);
        }

        return text;
    }

    private decimal? Money(string key)
    {
        var text = Text(key);
        if (text == null)
        {
            return null;
        }

        if (!ExcelCells.TryMoney(text, out var value))
        {
            _errors.Add(_l["Taxonomy:Import:Err:NotANumber", Header(key)]);
            return null;
        }

        if (value < 0m)
        {
            _errors.Add(_l["Taxonomy:Import:Err:Negative", Header(key)]);
            return null;
        }

        return value;
    }

    private decimal PositiveMoney(string key)
    {
        var text = Text(key);
        if (text == null)
        {
            _errors.Add(_l["Taxonomy:Import:Err:Required", Header(key)]);
            return 0m;
        }

        if (!ExcelCells.TryMoney(text, out var value))
        {
            _errors.Add(_l["Taxonomy:Import:Err:NotANumber", Header(key)]);
            return 0m;
        }

        if (value <= 0m)
        {
            _errors.Add(_l["Taxonomy:Import:Err:NotPositive", Header(key)]);
        }

        return value;
    }

    private int? OptionalInteger(string key, bool allowZero)
    {
        var text = Text(key);
        if (text == null)
        {
            return null;
        }

        if (!ExcelCells.TryInteger(text, out var value))
        {
            _errors.Add(_l["Taxonomy:Import:Err:NotANumber", Header(key)]);
            return null;
        }

        if (value < 0 || (!allowZero && value == 0))
        {
            _errors.Add(_l[allowZero ? "Taxonomy:Import:Err:Negative" : "Taxonomy:Import:Err:NotPositive", Header(key)]);
            return null;
        }

        return value;
    }

    private int PositiveInteger(string key)
    {
        var text = Text(key);
        if (text == null)
        {
            _errors.Add(_l["Taxonomy:Import:Err:Required", Header(key)]);
            return 0;
        }

        return OptionalInteger(key, allowZero: false) ?? 0;
    }

    private bool Flag(string key)
    {
        if (ExcelCells.TryBool(Text(key), out var value))
        {
            return value;
        }

        _errors.Add(_l["Taxonomy:Import:Err:NotABoolean", Header(key)]);
        return false;
    }
}
