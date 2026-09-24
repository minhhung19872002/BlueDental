using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Catalogs.Import;

/// <summary>
/// One column of an import sheet. The header is the file contract — the same
/// Vietnamese text whatever language the screen runs in — so a template made
/// on one account opens on any other. The hint is what the "Hướng dẫn" sheet
/// says about the column, and that one is localized.
/// </summary>
/// <param name="Key">Stable name used by the parser.</param>
/// <param name="Header">Header text, matched case- and whitespace-insensitively.</param>
/// <param name="Required">Missing column rejects the file; blank cell rejects the row.</param>
/// <param name="HintKey">Localization key of the guide text.</param>
/// <param name="Width">Column width in the template.</param>
public sealed record ImportColumn(
    string Key,
    string Header,
    bool Required,
    string HintKey,
    double Width = 22);

public sealed class ImportSheetLayout
{
    public ImportSheetLayout(string name, IReadOnlyList<ImportColumn> columns)
    {
        Name = name;
        Columns = columns;
    }

    public string Name { get; }
    public IReadOnlyList<ImportColumn> Columns { get; }

    public ImportColumn this[string key] => Columns.First(x => x.Key == key);
    public bool Has(string key) => Columns.Any(x => x.Key == key);
}

/// <summary>The sheets one catalog's file carries: the entries, and for đơn thuốc mẫu their medicine lines.</summary>
public sealed class ImportLayout
{
    private ImportLayout(string group, ImportSheetLayout entries, ImportSheetLayout? lines)
    {
        Group = group;
        Entries = entries;
        Lines = lines;
    }

    public string Group { get; }
    public ImportSheetLayout Entries { get; }
    public ImportSheetLayout? Lines { get; }

    public static class Col
    {
        public const string Group = "group";
        public const string Name = "name";
        public const string Priority = "priority";
        public const string Content = "content";
        public const string Note = "note";
        public const string ActiveIngredient = "activeIngredient";
        public const string Usage = "usage";
        public const string PurchasePrice = "purchasePrice";
        public const string Price = "price";
        public const string PrescriptionCode = "prescriptionCode";
        public const string UsageNote = "usageNote";
        public const string Unit = "unit";
        public const string DetailName = "detailName";
        public const string Description = "description";
        public const string Code = "code";
        public const string TaxRate = "taxRate";
        public const string PriceIncludesTax = "priceIncludesTax";
        public const string DiscountIsPercent = "discountIsPercent";
        public const string DiscountValue = "discountValue";
        public const string RequireImage = "requireImage";
        public const string DeductDoctorOnWarranty = "deductDoctorOnWarranty";
        public const string SeparateRevenue = "separateRevenue";
        public const string ShowToothOnInvoice = "showToothOnInvoice";
        public const string RevenueByStage = "revenueByStage";
        public const string RequireStageSequence = "requireStageSequence";
        public const string WarrantyDays = "warrantyDays";
        public const string Stages = "stages";
        public const string Advice = "advice";
        public const string Template = "template";
        public const string Medicine = "medicine";
        public const string TimesPerDay = "timesPerDay";
        public const string AmountPerTime = "amountPerTime";
        public const string Days = "days";
        public const string OtherUsage = "otherUsage";
    }

    private static readonly ImportColumn GroupColumn =
        new(Col.Group, "Nhóm phân loại", true, "Taxonomy:Import:Hint:Group", 26);

    private static readonly ImportColumn PriorityColumn =
        new(Col.Priority, "Mức độ ưu tiên", false, "Taxonomy:Import:Hint:Priority", 16);

    private static ImportColumn NameColumn(string header) =>
        new(Col.Name, header, true, "Taxonomy:Import:Hint:Name", 36);

    private static ImportColumn Flag(string key, string header) =>
        new(key, header, false, "Taxonomy:Import:Hint:Bool", 24);

    private static ImportSheetLayout Simple(string sheet, string nameHeader) =>
        new(sheet, [GroupColumn, NameColumn(nameHeader), PriorityColumn]);

    private static ImportSheetLayout Rich(string sheet, string nameHeader) =>
        new(sheet,
        [
            GroupColumn,
            NameColumn(nameHeader),
            new(Col.Content, "Nội dung", false, "Taxonomy:Import:Hint:Content", 60),
            new(Col.Note, "Ghi chú", false, "Taxonomy:Import:Hint:Text2000", 40),
            PriorityColumn
        ]);

    private static readonly ImportSheetLayout MedicineSheet = new("Loại thuốc",
    [
        GroupColumn,
        NameColumn("Tên thuốc"),
        new(Col.ActiveIngredient, "Hoạt chất", false, "Taxonomy:Import:Hint:Text400", 30),
        new(Col.Usage, "Cách dùng", false, "Taxonomy:Import:Hint:Text1000", 30),
        new(Col.PurchasePrice, "Giá mua", false, "Taxonomy:Import:Hint:Money", 16),
        new(Col.Price, "Giá bán", false, "Taxonomy:Import:Hint:Money", 16),
        new(Col.PrescriptionCode, "Mã toa thuốc", false, "Taxonomy:Import:Hint:Text100", 18),
        new(Col.UsageNote, "Lưu ý sử dụng", false, "Taxonomy:Import:Hint:Text1000", 30),
        new(Col.Unit, "Đơn vị tính", false, "Taxonomy:Import:Hint:Unit", 14),
        PriorityColumn
    ]);

    private static readonly ImportSheetLayout ServiceSheet = new("Dịch vụ",
    [
        GroupColumn,
        NameColumn("Tên dịch vụ"),
        new(Col.DetailName, "Tên chi tiết", false, "Taxonomy:Import:Hint:Text400", 30),
        new(Col.Description, "Mô tả", false, "Taxonomy:Import:Hint:Text2000", 30),
        new(Col.Code, "Mã dịch vụ", false, "Taxonomy:Import:Hint:Text64", 16),
        new(Col.TaxRate, "% thuế", false, "Taxonomy:Import:Hint:TaxRate", 12),
        Flag(Col.PriceIncludesTax, "Giá đã gồm thuế"),
        new(Col.Price, "Giá", false, "Taxonomy:Import:Hint:Money", 16),
        Flag(Col.DiscountIsPercent, "Giảm giá theo %"),
        new(Col.DiscountValue, "Giảm giá", false, "Taxonomy:Import:Hint:DiscountValue", 14),
        new(Col.Unit, "Đơn vị", false, "Taxonomy:Import:Hint:Unit", 12),
        Flag(Col.RequireImage, "Yêu cầu hình ảnh khi điều trị"),
        Flag(Col.DeductDoctorOnWarranty, "Yêu cầu trừ tiền bác sĩ khi bảo hành"),
        Flag(Col.SeparateRevenue, "Tính doanh số riêng"),
        Flag(Col.ShowToothOnInvoice, "Hiển thị răng ở hóa đơn"),
        Flag(Col.RevenueByStage, "Tính doanh số trên công đoạn"),
        Flag(Col.RequireStageSequence, "Yêu cầu tuần tự công đoạn"),
        new(Col.WarrantyDays, "Bảo hành (ngày)", false, "Taxonomy:Import:Hint:WarrantyDays", 16),
        new(Col.Stages, "Công đoạn", false, "Taxonomy:Import:Hint:Stages", 40),
        PriorityColumn
    ]);

    private static readonly ImportSheetLayout PrescriptionSheet = new("Đơn thuốc mẫu",
    [
        NameColumn("Tên đơn thuốc mẫu"),
        new(Col.Advice, "Lời dặn", false, "Taxonomy:Import:Hint:Text2000", 50),
        PriorityColumn
    ]);

    private static readonly ImportSheetLayout PrescriptionLinesSheet = new("Thuốc",
    [
        new(Col.Template, "Tên đơn thuốc mẫu", true, "Taxonomy:Import:Hint:RxTemplate", 36),
        new(Col.Medicine, "Tên thuốc", true, "Taxonomy:Import:Hint:Medicine", 36),
        new(Col.TimesPerDay, "Số lần/ngày", true, "Taxonomy:Import:Hint:PositiveInt", 14),
        new(Col.AmountPerTime, "Liều/lần", true, "Taxonomy:Import:Hint:PositiveNumber", 14),
        new(Col.Days, "Số ngày", true, "Taxonomy:Import:Hint:PositiveInt", 12),
        new(Col.Usage, "Cách dùng", false, "Taxonomy:Import:Hint:RxUsage", 40),
        new(Col.OtherUsage, "Cách dùng khác", false, "Taxonomy:Import:Hint:OtherUsage", 30)
    ]);

    private static readonly Dictionary<string, ImportLayout> Layouts = new()
    {
        [TaxonomyGroups.CareService] = new(TaxonomyGroups.CareService, ServiceSheet, null),
        [TaxonomyGroups.Diagnosis] = new(TaxonomyGroups.Diagnosis, Rich("Chẩn đoán", "Tên chẩn đoán"), null),
        [TaxonomyGroups.MedicationType] = new(TaxonomyGroups.MedicationType, MedicineSheet, null),
        [TaxonomyGroups.ConsultingData] =
            new(TaxonomyGroups.ConsultingData, Rich("Dữ liệu tư vấn", "Tên dữ liệu tư vấn"), null),
        [TaxonomyGroups.Source] = new(TaxonomyGroups.Source, Simple("Nguồn đến", "Tên nguồn đến"), null),
        [TaxonomyGroups.DiseaseHistory] =
            new(TaxonomyGroups.DiseaseHistory, Simple("Lịch sử bệnh", "Tên lịch sử bệnh"), null),
        [TaxonomyGroups.Occupation] =
            new(TaxonomyGroups.Occupation, Simple("Nghề nghiệp", "Tên nghề nghiệp"), null),
        [TaxonomyGroups.PrescriptionTemplate] =
            new(TaxonomyGroups.PrescriptionTemplate, PrescriptionSheet, PrescriptionLinesSheet)
    };

    /// <summary>Null for the catalogs the owner left out (bệnh án mẫu, thẻ hồ sơ, phương thức thanh toán).</summary>
    public static ImportLayout? For(string group) =>
        Layouts.TryGetValue(group, out var layout) ? layout : null;

    public static IReadOnlyCollection<string> SupportedGroups => Layouts.Keys;
}
