using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using BlueDental.Appointments;
using BlueDental.Billing;
using BlueDental.Catalogs;
using BlueDental.Catalogs.Import;
using BlueDental.PatientManagement;
using BlueDental.PatientManagement.Roster;
using BlueDental.TreatmentManagement.Values;
using BlueDental.Values;
using ClosedXML.Excel;
using Microsoft.Extensions.Localization;
using static BlueDental.DataMigration.DataMigrationLayout;

namespace BlueDental.DataMigration;

internal sealed record GuardianDraft(string FullName, string Phone, string NationalId, GuardianRelation Relation);

internal sealed record PatientDraft(
    string Code,
    string FirstName,
    string LastName,
    DateOnly? DateOfBirth,
    Gender Gender,
    string? Phone,
    string? Email,
    string? Address,
    string? OldAddress,
    string? NationalId,
    string? InsuranceNumber,
    Guid? SourceId,
    Guid? ChannelId,
    Guid? OccupationId,
    string? OccupationOther,
    List<Guid> DiseaseHistoryIds,
    List<Guid> TagIds,
    string? ExaminationReason,
    string? Note,
    string? EmergencyName,
    string? EmergencyPhone,
    DateOnly? RegisteredOn,
    GuardianDraft? Guardian,
    string? LegacyId = null,
    string? ProvinceCode = null,
    string? WardCode = null);

/// <summary>
/// How strict a Khách hàng row is. The migration file (F-61) keys rows by a
/// required Mã KH; the patient roster (F-69) lets a new row leave it blank for
/// the app to number, requires the phone instead, and carries a guardian
/// relation of "Khác" back when the record already had one.
/// </summary>
internal sealed record PatientReadOptions(bool CodeRequired, bool PhoneRequired, bool AllowOtherRelation)
{
    public static readonly PatientReadOptions Migration = new(CodeRequired: true, PhoneRequired: false, AllowOtherRelation: false);
    public static readonly PatientReadOptions Roster = new(CodeRequired: false, PhoneRequired: true, AllowOtherRelation: true);
}

internal sealed record TreatmentDraft(
    string Code,
    DateOnly TreatedOn,
    string? SlipCode,
    LookupItem Service,
    string StageName,
    List<int> Teeth,
    string? Content,
    Guid DentistId,
    Guid? AssistingDoctorId,
    Guid? AssistantId,
    bool Completed,
    string? PlanKey = null,
    int? Quantity = null,
    decimal? OriginalPrice = null,
    decimal? Price = null,
    decimal? Amount = null)
{
    /// <summary>A row with a unit price opens a service line of its own; one without is a visit on an earlier line.</summary>
    public bool IsPriced => Price > 0m;
}

/// <summary>One Thanh toán row: money the old system took against a slip or a Kế hoạch of the patient.</summary>
internal sealed record PaymentDraft(
    string Code,
    DateOnly PaidOn,
    string? SlipCode,
    string? PlanKey,
    decimal Amount,
    PaymentMethodKind Method,
    Guid? AccountId,
    Guid? CashierId,
    string? Note);

/// <summary>
/// One Lịch hẹn row. <see cref="At"/> is the clinic's wall-clock time; the
/// status is left null when the cell is blank, for the plan to pick by whether
/// the booking is past or still to come.
/// </summary>
internal sealed record AppointmentDraft(
    string Code,
    DateTime At,
    int Minutes,
    Guid DentistId,
    AppointmentStatus? Status,
    string? Note,
    string? CancelNote);

/// <summary>
/// Reads one row of a data sheet into a draft, collecting every problem
/// with it rather than stopping at the first. Limits are the column lengths of
/// the tables the row lands in; the domain's own guards (name characters,
/// CCCD, teeth...) run again when the entities are built.
/// </summary>
internal sealed class MigrationRowReader
{
    private const int CodeMax = 50;
    private const int NamePartMax = 100;
    private const int PhoneMax = 50;
    private const int EmailMax = 256;
    private const int AddressMax = 500;
    private const int InsuranceMax = 30;
    private const int OccupationOtherMax = 200;
    private const int NoteMax = 1000;
    private const int EmergencyNameMax = 200;
    private const int SlipCodeMax = 50;
    private const int StageNameMax = 300;
    private const int StageNoteMax = 2000;
    private const int PlanKeyMax = 200;
    private const int QuantityMax = 1_000;
    private const int BookingNoteMax = 2000;
    private const int CancelNoteMax = 500;
    private const int DefaultMinutes = 30;
    private const int MaxMinutes = 480;

    /// <summary>A booking with no time of day (or midnight, how a bare date reads) starts when the clinic opens.</summary>
    private static readonly TimeOnly OpeningTime = new(9, 0);

    private static readonly string[] DateTimeFormats =
        ["dd/MM/yyyy HH:mm", "d/M/yyyy H:mm", "dd/MM/yyyy H:mm", "dd/MM/yyyy HH:mm:ss", "d/M/yyyy H:mm:ss",
         "dd-MM-yyyy HH:mm", "d-M-yyyy H:mm", "yyyy-MM-dd HH:mm", "yyyy-MM-dd HH:mm:ss", "yyyy-MM-ddTHH:mm:ss"];

    /// <summary>Trạng thái of a booking, as the drop-down offers it and as old systems write it.</summary>
    private static readonly Dictionary<string, AppointmentStatus> BookingStatuses = new()
    {
        ["đã hẹn"] = AppointmentStatus.Requested, ["da hen"] = AppointmentStatus.Requested,
        ["đặt lịch"] = AppointmentStatus.Requested, ["đã đặt lịch"] = AppointmentStatus.Requested,
        ["đã đến"] = AppointmentStatus.Completed, ["da den"] = AppointmentStatus.Completed,
        ["đã khám"] = AppointmentStatus.Completed, ["da kham"] = AppointmentStatus.Completed,
        ["hoàn thành"] = AppointmentStatus.Completed, ["hoan thanh"] = AppointmentStatus.Completed,
        ["có"] = AppointmentStatus.Completed,
        ["trễ hẹn"] = AppointmentStatus.NoShow, ["tre hen"] = AppointmentStatus.NoShow,
        ["không đến"] = AppointmentStatus.NoShow, ["khong den"] = AppointmentStatus.NoShow,
        ["vắng mặt"] = AppointmentStatus.NoShow, ["vang mat"] = AppointmentStatus.NoShow,
        ["hủy hẹn"] = AppointmentStatus.Cancelled, ["huỷ hẹn"] = AppointmentStatus.Cancelled,
        ["huy hen"] = AppointmentStatus.Cancelled, ["đã hủy"] = AppointmentStatus.Cancelled,
        ["đã huỷ"] = AppointmentStatus.Cancelled, ["hủy"] = AppointmentStatus.Cancelled,
        ["huỷ"] = AppointmentStatus.Cancelled
    };

    /// <summary>A trillion đồng: anything above is a typo (a date or a phone pasted into a money cell).</summary>
    private const decimal MoneyMax = 1_000_000_000_000m;

    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");

    /// <summary>Hình thức, as the drop-down offers it and as people type it; blank is cash.</summary>
    private static readonly Dictionary<string, PaymentMethodKind> Methods = new()
    {
        ["tiền mặt"] = PaymentMethodKind.Cash, ["tien mat"] = PaymentMethodKind.Cash, ["cash"] = PaymentMethodKind.Cash,
        ["chuyển khoản"] = PaymentMethodKind.Banking, ["chuyen khoan"] = PaymentMethodKind.Banking,
        ["ngân hàng"] = PaymentMethodKind.Banking, ["ngan hang"] = PaymentMethodKind.Banking,
        ["banking"] = PaymentMethodKind.Banking, ["ck"] = PaymentMethodKind.Banking,
        ["thẻ"] = PaymentMethodKind.Card, ["the"] = PaymentMethodKind.Card, ["quẹt thẻ"] = PaymentMethodKind.Card,
        ["card"] = PaymentMethodKind.Card, ["pos"] = PaymentMethodKind.Card,
        ["ví điện tử"] = PaymentMethodKind.EWallet, ["vi dien tu"] = PaymentMethodKind.EWallet,
        ["ví momo"] = PaymentMethodKind.EWallet, ["momo"] = PaymentMethodKind.EWallet,
        ["e-wallet"] = PaymentMethodKind.EWallet
    };

    /// <summary>
    /// Excel date serials for 01/01/1910 and 31/12/2100: a whole number in this
    /// range in a date column is a date that lost its format. Starting at 1910
    /// keeps a bare birth year ("1985") out — read as a serial it would be 1905.
    /// </summary>
    private const double MinDateSerial = 3654;
    private const double MaxDateSerial = 73415;

    private static readonly string[] DateFormats =
        ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd.MM.yyyy", "yyyy-MM-dd", "d/M/yy"];

    private static readonly Dictionary<string, Gender> Genders = new()
    {
        ["nam"] = Gender.Male, ["male"] = Gender.Male, ["m"] = Gender.Male,
        ["nữ"] = Gender.Female, ["nu"] = Gender.Female, ["female"] = Gender.Female, ["f"] = Gender.Female,
        ["khác"] = Gender.Other, ["khac"] = Gender.Other, ["other"] = Gender.Other
    };

    /// <summary>"Khác" is left out on purpose: it needs a written relation and a proof document the sheet cannot carry.</summary>
    private static readonly Dictionary<string, GuardianRelation> Relations = new()
    {
        ["bố"] = GuardianRelation.Father, ["cha"] = GuardianRelation.Father,
        ["mẹ"] = GuardianRelation.Mother, ["má"] = GuardianRelation.Mother,
        ["ông"] = GuardianRelation.Grandfather,
        ["bà"] = GuardianRelation.Grandmother,
        ["anh / chị ruột"] = GuardianRelation.Sibling, ["anh chị ruột"] = GuardianRelation.Sibling,
        ["anh chị em"] = GuardianRelation.Sibling, ["anh"] = GuardianRelation.Sibling, ["chị"] = GuardianRelation.Sibling,
        ["cô / dì / chú / bác"] = GuardianRelation.AuntUncle, ["cô dì chú bác"] = GuardianRelation.AuntUncle,
        ["cô"] = GuardianRelation.AuntUncle, ["dì"] = GuardianRelation.AuntUncle,
        ["chú"] = GuardianRelation.AuntUncle, ["bác"] = GuardianRelation.AuntUncle,
        ["người giám hộ hợp pháp"] = GuardianRelation.LegalGuardian
    };

    /// <summary>"Khác": read only where the record already says so (roster), never for a new guardian.</summary>
    private static readonly HashSet<string> OtherRelation = ["khác", "khac"];

    private static readonly int[] UpperJaw = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    private static readonly int[] LowerJaw = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    /// <summary>
    /// The picker's jaw tabs, written out: the app saves "Hàm trên" as its 16
    /// permanent teeth (32 for "Nguyên hàm") and folds them back on display.
    /// </summary>
    private static readonly Dictionary<string, int[]> Jaws = new()
    {
        ["hàm trên"] = UpperJaw, ["ham tren"] = UpperJaw,
        ["hàm dưới"] = LowerJaw, ["ham duoi"] = LowerJaw,
        ["nguyên hàm"] = [.. UpperJaw, .. LowerJaw], ["nguyen ham"] = [.. UpperJaw, .. LowerJaw]
    };

    /// <summary>
    /// One entry of the Răng cell: words without digits stay together, so a
    /// jaw phrase ("Hàm trên") or a wrong one ("Hàm giữa") reads as one part;
    /// anything else runs up to the next comma, semicolon or space.
    /// </summary>
    private static readonly Regex ToothPart = new(
        @"[^,;\s\d]+(?:\s+[^,;\s\d]+)*(?=[,;\s]|$)|[^,;\s]+",
        RegexOptions.CultureInvariant);

    private readonly IStringLocalizer _l;
    private readonly ImportSheetLayout _layout;
    private readonly IReadOnlyDictionary<string, int> _columns;
    private readonly IXLRow _row;
    private readonly DataMigrationLookups _lookups;
    private readonly DateOnly _today;
    private readonly PatientReadOptions _options;
    private readonly List<string> _errors = [];

    private MigrationRowReader(
        IStringLocalizer l,
        ImportSheetLayout layout,
        IReadOnlyDictionary<string, int> columns,
        IXLRow row,
        DataMigrationLookups lookups,
        DateOnly today,
        PatientReadOptions? options = null)
    {
        _l = l;
        _layout = layout;
        _columns = columns;
        _row = row;
        _lookups = lookups;
        _today = today;
        _options = options ?? PatientReadOptions.Migration;
    }

    /// <summary>The Mã KH cell of a row, before anything else is read — rows are grouped by it.</summary>
    public static string? CodeOf(IReadOnlyDictionary<string, int> columns, IXLRow row) =>
        columns.TryGetValue(Col.Code, out var index) ? Normalized(ExcelCells.Text(row.Cell(index))) : null;

    public static (PatientDraft? Draft, List<string> Errors) ReadPatient(
        IStringLocalizer l, IReadOnlyDictionary<string, int> columns, IXLRow row, DataMigrationLookups lookups,
        DateOnly today) =>
        ReadPatient(l, Patients, columns, row, lookups, today, PatientReadOptions.Migration);

    /// <summary>A patient row of any sheet that uses the Khách hàng column keys.</summary>
    public static (PatientDraft? Draft, List<string> Errors) ReadPatient(
        IStringLocalizer l, ImportSheetLayout layout, IReadOnlyDictionary<string, int> columns, IXLRow row,
        DataMigrationLookups lookups, DateOnly today, PatientReadOptions options)
    {
        var reader = new MigrationRowReader(l, layout, columns, row, lookups, today, options);
        var draft = reader.ReadPatient();
        return (reader._errors.Count == 0 ? draft : null, reader._errors);
    }

    public static (TreatmentDraft? Draft, List<string> Errors) ReadTreatment(
        IStringLocalizer l, IReadOnlyDictionary<string, int> columns, IXLRow row, DataMigrationLookups lookups,
        DateOnly today)
    {
        var reader = new MigrationRowReader(l, Treatments, columns, row, lookups, today);
        var draft = reader.ReadTreatment();
        return (reader._errors.Count == 0 ? draft : null, reader._errors);
    }

    public static (PaymentDraft? Draft, List<string> Errors) ReadPayment(
        IStringLocalizer l, IReadOnlyDictionary<string, int> columns, IXLRow row, DataMigrationLookups lookups,
        DateOnly today)
    {
        var reader = new MigrationRowReader(l, Payments, columns, row, lookups, today);
        var draft = reader.ReadPayment();
        return (reader._errors.Count == 0 ? draft : null, reader._errors);
    }

    public static (AppointmentDraft? Draft, List<string> Errors) ReadAppointment(
        IStringLocalizer l, IReadOnlyDictionary<string, int> columns, IXLRow row, DataMigrationLookups lookups,
        DateOnly today)
    {
        var reader = new MigrationRowReader(l, Bookings, columns, row, lookups, today);
        var draft = reader.ReadAppointment();
        return (reader._errors.Count == 0 ? draft : null, reader._errors);
    }

    /// <summary>"1.500.000": how the error messages write an amount.</summary>
    public static string FormatMoney(decimal amount) => amount.ToString("#,0", Vietnamese);

    // ---------------------------------------------------------------- patients

    private PatientDraft? ReadPatient()
    {
        var code = _options.CodeRequired ? Required(Col.Code, CodeMax) : Optional(Col.Code, CodeMax) ?? string.Empty;
        var legacyId = Optional(Col.LegacyId, Patient.MaxLegacyIdLength);
        var fullName = Required(Col.FullName, NamePartMax * 2);
        var (firstName, lastName) = SplitName(fullName);
        if (fullName != null && (lastName.Length > NamePartMax || firstName.Length > NamePartMax))
        {
            Error("Taxonomy:Import:Err:TooLong", Header(Col.FullName), NamePartMax);
        }

        var dateOfBirth = OptionalDate(Col.DateOfBirth);
        var gender = ReadGender();
        if (_options.PhoneRequired && Cell(Col.Phone) == null)
        {
            Error("Taxonomy:Import:Err:Required", Header(Col.Phone));
        }

        var phone = FormPhone(Col.Phone);
        var email = Optional(Col.Email, EmailMax);
        if (!_options.PhoneRequired && phone == null && email == null)
        {
            // ContactInfo refuses a patient with neither; say which columns instead of its generic message.
            Error("DataMigration:Err:NoContact", Header(Col.Phone), Header(Col.Email));
        }

        var address = Optional(Col.Address, AddressMax);
        var (provinceCode, wardCode) = ReadResidence();
        var oldAddress = Optional(Col.OldAddress, AddressMax);
        var nationalId = NationalId(Col.NationalId);
        var insurance = Optional(Col.InsuranceNumber, InsuranceMax);
        var (sourceId, channelId) = ReadSource();
        var (occupationId, occupationOther) = ReadOccupation();
        var diseases = Many(Col.DiseaseHistory, _lookups.DiseaseHistory);
        var tags = Many(Col.Tags, _lookups.Tags);
        var reason = Optional(Col.ExaminationReason, PatientExaminationReasonConsts.MaxContentLength);
        var note = Optional(Col.Note, NoteMax);
        var emergencyName = Optional(Col.EmergencyName, EmergencyNameMax);
        var emergencyPhone = Phone(Col.EmergencyPhone);
        var registeredOn = OptionalDate(Col.RegisteredOn);
        var guardian = ReadGuardian();

        if (code == null || fullName == null)
        {
            return null;
        }

        return new PatientDraft(code, firstName, lastName, dateOfBirth, gender, phone, email, address, oldAddress,
            nationalId, insurance, sourceId, channelId, occupationId, occupationOther,
            diseases, tags, reason, note, emergencyName, emergencyPhone, registeredOn, guardian,
            legacyId, provinceCode, wardCode);
    }

    /// <summary>
    /// Tỉnh/TP and Phường/Xã by name, as the hồ sơ dialog lists them after the
    /// 2025 merger ("Hà Nội" and "Thành phố Hà Nội" alike). A name the list
    /// does not hold is refused rather than dropped.
    /// </summary>
    private (string? Province, string? Ward) ReadResidence()
    {
        var provinceText = Optional(Col.Province, int.MaxValue);
        var wardText = Optional(Col.Ward, int.MaxValue);
        if (provinceText == null)
        {
            if (wardText != null)
            {
                Error("PatientRoster:Err:WardWithoutProvince", Header(Col.Ward), Header(Col.Province));
            }

            return (null, null);
        }

        var locations = VietnamLocations.Instance;
        var province = locations.FindProvince(provinceText);
        if (province == null)
        {
            Error("PatientRoster:Err:BadProvince", Header(Col.Province), provinceText);
            return (null, null);
        }

        if (wardText == null)
        {
            return (province, null);
        }

        var ward = locations.FindWard(province, wardText);
        if (ward == null)
        {
            Error("PatientRoster:Err:BadWard", wardText, locations.ProvinceName(province)!);
        }

        return (province, ward);
    }

    /// <summary>The hồ sơ dialog's split: the last word is the given name, the rest the family name; one word is all family name.</summary>
    private static (string FirstName, string LastName) SplitName(string? fullName)
    {
        var words = (fullName ?? string.Empty).Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return words.Length switch
        {
            0 => (string.Empty, string.Empty),
            1 => (string.Empty, words[0]),
            _ => (words[^1], string.Join(" ", words[..^1]))
        };
    }

    private Gender ReadGender()
    {
        var text = Optional(Col.Gender, int.MaxValue);
        if (text == null)
        {
            return Gender.PreferNotToSay;
        }

        if (Genders.TryGetValue(ExcelCells.Key(text), out var gender))
        {
            return gender;
        }

        Error("DataMigration:Err:BadGender", Header(Col.Gender));
        return Gender.PreferNotToSay;
    }

    private (Guid? SourceId, Guid? ChannelId) ReadSource()
    {
        var sourceText = Optional(Col.Source, int.MaxValue);
        var channelText = Optional(Col.Channel, int.MaxValue);
        if (sourceText == null)
        {
            if (channelText != null)
            {
                Error("DataMigration:Err:ChannelWithoutSource", Header(Col.Channel), Header(Col.Source));
            }

            return (null, null);
        }

        var source = DataMigrationLookups.FindByName(_lookups.Sources, sourceText);
        if (source == null)
        {
            Error("DataMigration:Err:NotInCatalog", Header(Col.Source), sourceText);
            return (null, null);
        }

        if (channelText == null)
        {
            return (source.Id, null);
        }

        var channels = _lookups.Channels.GetValueOrDefault(source.Id) ?? [];
        var channel = DataMigrationLookups.FindByName(channels, channelText);
        if (channel == null)
        {
            Error("DataMigration:Err:ChannelNotInSource", channelText, source.Name);
        }

        return (source.Id, channel?.Id);
    }

    /// <summary>An occupation the catalog does not list goes in as free text, as the dialog's "Khác" box would take it.</summary>
    private (Guid? Id, string? Other) ReadOccupation()
    {
        var text = Optional(Col.Occupation, OccupationOtherMax);
        if (text == null)
        {
            return (null, null);
        }

        var entry = DataMigrationLookups.FindByName(_lookups.Occupations, text);
        return entry != null ? (entry.Id, null) : (null, text);
    }

    private List<Guid> Many(string key, IReadOnlyList<LookupItem> catalog)
    {
        var ids = new List<Guid>();
        foreach (var name in Names(Optional(key, int.MaxValue), catalog))
        {
            var item = DataMigrationLookups.FindByName(catalog, name);
            if (item == null)
            {
                Error("DataMigration:Err:NotInCatalog", Header(key), name);
            }
            else if (!ids.Contains(item.Id))
            {
                ids.Add(item.Id);
            }
        }

        return ids;
    }

    /// <summary>
    /// The names of a list cell. ";" always separates; "," only where the
    /// piece is not itself a catalog name, so "Tim mạch, huyết áp" written by
    /// the roster export reads back as the one entry it is.
    /// </summary>
    private static IEnumerable<string> Names(string? text, IReadOnlyList<LookupItem> catalog)
    {
        foreach (var piece in Split(text, ';'))
        {
            if (DataMigrationLookups.FindByName(catalog, piece) != null)
            {
                yield return piece;
                continue;
            }

            foreach (var name in Split(piece, ','))
            {
                yield return name;
            }
        }
    }

    private GuardianDraft? ReadGuardian()
    {
        var name = Optional(Col.GuardianName, PatientGuardianConsts.MaxFullNameLength);
        var phone = FormPhone(Col.GuardianPhone, PatientGuardianConsts.MaxPhoneLength);
        var nationalId = Optional(Col.GuardianNationalId, PatientGuardianConsts.MaxNationalIdLength, padDigits: 12);
        var relationText = Optional(Col.GuardianRelation, int.MaxValue);

        if (name == null && phone == null && nationalId == null && relationText == null)
        {
            return null;
        }

        if (name == null || phone == null || nationalId == null || relationText == null)
        {
            Error("DataMigration:Err:GuardianIncomplete",
                string.Join(", ", new[] { Col.GuardianName, Col.GuardianPhone, Col.GuardianNationalId, Col.GuardianRelation }
                    .Select(Header)));
            return null;
        }

        if (!Relations.TryGetValue(ExcelCells.Key(relationText), out var relation)
            && !(_options.AllowOtherRelation && OtherRelation.Contains(ExcelCells.Key(relationText))))
        {
            Error("DataMigration:Err:BadRelation", Header(Col.GuardianRelation), relationText);
            return null;
        }

        return new GuardianDraft(name, phone, nationalId,
            OtherRelation.Contains(ExcelCells.Key(relationText)) ? GuardianRelation.Other : relation);
    }

    // -------------------------------------------------------------- treatments

    private TreatmentDraft? ReadTreatment()
    {
        var code = Required(Col.Code, CodeMax);
        var treatedOn = RequiredDate(Col.TreatedOn);
        var slipCode = Optional(Col.SlipCode, SlipCodeMax);
        var service = Service();
        var stageName = Optional(Col.StageName, StageNameMax);
        var teeth = Teeth();
        var content = Optional(Col.Content, StageNoteMax);
        var dentist = Staff(Col.Dentist, required: true);
        var assistingDoctor = Staff(Col.AssistingDoctor, required: false);
        var assistant = Staff(Col.Assistant, required: false);
        var completed = ReadStatus();
        var planKey = Optional(Col.PlanKey, PlanKeyMax);
        var quantity = Quantity();
        var originalPrice = Money(Col.OriginalPrice);
        var price = Money(Col.Price);
        var amount = Money(Col.Amount);
        CheckAmount(price, quantity ?? Math.Max(1, teeth.Count), amount);

        if (code == null || treatedOn == null || service == null || dentist == null)
        {
            return null;
        }

        var name = stageName ?? service.Name;
        if (name.Length > StageNameMax)
        {
            name = name[..StageNameMax];
        }

        return new TreatmentDraft(code, treatedOn.Value, slipCode, service, name, teeth, content,
            dentist.Value, assistingDoctor, assistant, completed,
            planKey, quantity, originalPrice, price, amount);
    }

    /// <summary>
    /// Thành tiền is what the line charged after its discount: it needs a unit
    /// price to be a charge of, and cannot come to more than quantity × price.
    /// </summary>
    private void CheckAmount(decimal? price, int quantity, decimal? amount)
    {
        if (amount > 0m && !(price > 0m))
        {
            Error("DataMigration:Err:AmountWithoutPrice", Header(Col.Amount), Header(Col.Price));
        }
        else if (price > 0m && amount > price * quantity)
        {
            Error("DataMigration:Err:AmountAboveTotal", Header(Col.Amount), FormatMoney(amount.Value),
                FormatMoney(price.Value * quantity));
        }
    }

    /// <summary>Số lượng: a whole number of at least 1; blank lets the teeth count it.</summary>
    private int? Quantity()
    {
        var text = Cell(Col.Quantity);
        if (text == null)
        {
            return null;
        }

        if (!ExcelCells.TryInteger(text, out var quantity) || quantity < 1 || quantity > QuantityMax)
        {
            Error("DataMigration:Err:BadQuantity", Header(Col.Quantity), QuantityMax);
            return null;
        }

        return quantity;
    }

    // ---------------------------------------------------------------- payments

    private PaymentDraft? ReadPayment()
    {
        var code = Required(Col.Code, CodeMax);
        var slipCode = Optional(Col.PaidSlip, SlipCodeMax);
        var planKey = Optional(Col.PaidPlan, PlanKeyMax);
        if (slipCode == null && planKey == null)
        {
            Error("DataMigration:Err:PaymentTarget", Header(Col.PaidSlip), Header(Col.PaidPlan));
        }

        var paidOn = RequiredDate(Col.PaidOn);
        var amount = RequiredMoney(Col.PaidAmount);
        var method = ReadMethod();
        var accountId = ReadAccount(method);
        var cashierId = Staff(Col.Cashier, required: false);
        var note = Optional(Col.PaymentNote, NoteMax);

        if (code == null || paidOn == null || amount == null)
        {
            return null;
        }

        return new PaymentDraft(code, paidOn.Value, slipCode, planKey, amount.Value, method, accountId, cashierId, note);
    }

    // ------------------------------------------------------------ appointments

    private AppointmentDraft? ReadAppointment()
    {
        var code = Required(Col.Code, CodeMax);
        var at = RequiredDateTime(Col.BookedAt);
        var minutes = Minutes();
        var dentistId = Staff(Col.BookedDentist, required: true);
        var status = BookingStatus();
        var note = Optional(Col.BookedNote, BookingNoteMax);
        var cancelNote = Optional(Col.CancelNote, CancelNoteMax);

        if (code == null || at == null || dentistId == null)
        {
            return null;
        }

        return new AppointmentDraft(code, at.Value, minutes, dentistId.Value, status, note, cancelNote);
    }

    /// <summary>Thời lượng (phút): blank is half an hour, the calendar's default slot.</summary>
    private int Minutes()
    {
        var text = Cell(Col.BookedMinutes);
        if (text == null)
        {
            return DefaultMinutes;
        }

        if (!ExcelCells.TryInteger(text, out var minutes) || minutes < 1 || minutes > MaxMinutes)
        {
            Error("DataMigration:Err:BadMinutes", Header(Col.BookedMinutes), MaxMinutes);
            return DefaultMinutes;
        }

        return minutes;
    }

    private AppointmentStatus? BookingStatus()
    {
        var text = Optional(Col.BookedStatus, int.MaxValue);
        if (text == null)
        {
            return null;
        }

        if (BookingStatuses.TryGetValue(ExcelCells.Key(text), out var status))
        {
            return status;
        }

        Error("DataMigration:Err:BadBookingStatus", Header(Col.BookedStatus), text);
        return null;
    }

    /// <summary>
    /// Ngày giờ hẹn: a real Excel date-time, a serial with its time as the
    /// fraction, or text written day first. Unlike the history dates it may lie
    /// in the future — those are the bookings still to come.
    /// </summary>
    private DateTime? RequiredDateTime(string key)
    {
        if (Cell(key) == null)
        {
            Error("Taxonomy:Import:Err:Required", Header(key));
            return null;
        }

        var cell = _row.Cell(_columns[key]);
        DateTime? value = null;
        if (cell.DataType == XLDataType.DateTime)
        {
            value = cell.GetDateTime();
        }
        else if (cell.DataType == XLDataType.Number
                 && cell.GetDouble() is var serial and >= MinDateSerial and <= MaxDateSerial + 1)
        {
            value = DateTime.FromOADate(serial);
        }
        else if (Cell(key) is { } text
                 && (DateTime.TryParseExact(text, DateTimeFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed)
                     || DateTime.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out parsed)))
        {
            value = parsed;
        }

        if (value is not { } at || at.Year < 1910)
        {
            Error("DataMigration:Err:BadDateTime", Header(key), Cell(key) ?? string.Empty);
            return null;
        }

        // Whole minutes: Excel keeps a fraction that can land a second off.
        at = new DateTime(at.Year, at.Month, at.Day, at.Hour, at.Minute, 0, DateTimeKind.Unspecified)
            .AddMinutes(at.Second >= 30 ? 1 : 0);
        return at.TimeOfDay == TimeSpan.Zero ? at.Date + OpeningTime.ToTimeSpan() : at;
    }

    private PaymentMethodKind ReadMethod()
    {
        var text = Optional(Col.Method, int.MaxValue);
        if (text == null)
        {
            return PaymentMethodKind.Cash;
        }

        if (Methods.TryGetValue(ExcelCells.Key(text), out var method))
        {
            return method;
        }

        Error("DataMigration:Err:BadMethod", Header(Col.Method), text);
        return PaymentMethodKind.Cash;
    }

    /// <summary>
    /// Chuyển khoản lands in a bank account and Ví điện tử in a MoMo wallet of
    /// /taxonomy/payment-method; cash and card take none, so a filled cell is
    /// let be there.
    /// </summary>
    private Guid? ReadAccount(PaymentMethodKind method)
    {
        if (!PatientPayment.RequiresAccount(method))
        {
            return null;
        }

        var text = Optional(Col.Account, int.MaxValue);
        if (text == null)
        {
            Error("DataMigration:Err:AccountRequired", Header(Col.Account), Header(Col.Method));
            return null;
        }

        var kind = method == PaymentMethodKind.EWallet ? PaymentAccountKind.MoMo : PaymentAccountKind.Bank;
        var account = _lookups.FindAccount(text, kind, out var ambiguous);
        if (ambiguous)
        {
            Error("DataMigration:Err:AmbiguousAccount", Header(Col.Account), text);
        }
        else if (account == null)
        {
            Error("DataMigration:Err:AccountNotFound", Header(Col.Account), text);
        }

        return account?.Id;
    }

    private LookupItem? Service()
    {
        var text = Required(Col.Service, int.MaxValue);
        if (text == null)
        {
            return null;
        }

        var service = _lookups.FindService(text, out var ambiguous);
        if (ambiguous)
        {
            Error("DataMigration:Err:AmbiguousService", text);
        }
        else if (service == null)
        {
            Error("DataMigration:Err:ServiceNotFound", text);
        }

        return service;
    }

    private Guid? Staff(string key, bool required)
    {
        var text = required ? Required(key, int.MaxValue) : Optional(key, int.MaxValue);
        if (text == null)
        {
            return null;
        }

        var staff = _lookups.FindStaff(text, out var ambiguous);
        if (ambiguous)
        {
            Error("DataMigration:Err:AmbiguousStaff", Header(key), text);
        }
        else if (staff == null)
        {
            Error("DataMigration:Err:StaffNotFound", Header(key), text);
        }

        return staff?.Id;
    }

    /// <summary>
    /// FDI numbers and jaw phrases ("Hàm trên", "Hàm dưới", "Nguyên hàm")
    /// separated by commas, semicolons or spaces; each must be a real tooth or
    /// jaw, named when it is not. A tooth given twice is kept once.
    /// </summary>
    private List<int> Teeth()
    {
        var teeth = new List<int>();
        var text = Normalized(Optional(Col.Teeth, int.MaxValue)) ?? string.Empty;
        foreach (Match match in ToothPart.Matches(text))
        {
            var part = match.Value;
            if (Jaws.TryGetValue(ExcelCells.Key(part), out var jaw))
            {
                teeth.AddRange(jaw.Where(tooth => !teeth.Contains(tooth)));
            }
            else if (int.TryParse(part, NumberStyles.None, CultureInfo.InvariantCulture, out var tooth)
                && ToothSelection.IsValidToothCode(tooth))
            {
                if (!teeth.Contains(tooth))
                {
                    teeth.Add(tooth);
                }
            }
            else
            {
                Error("DataMigration:Err:BadTooth", Header(Col.Teeth), part);
            }
        }

        return teeth;
    }

    /// <summary>Blank or "Hoàn thành" is a finished visit; "Đang điều trị" leaves the công đoạn open.</summary>
    private bool ReadStatus()
    {
        var text = Optional(Col.Status, int.MaxValue);
        switch (text == null ? null : ExcelCells.Key(text))
        {
            case null:
            case "hoàn thành":
            case "hoan thanh":
            case "đã hoàn thành":
                return true;
            case "đang điều trị":
            case "dang dieu tri":
            case "đang thực hiện":
                return false;
            default:
                Error("DataMigration:Err:BadStatus", Header(Col.Status));
                return true;
        }
    }

    // ------------------------------------------------------------------ cells

    private string? Cell(string key) =>
        _columns.TryGetValue(key, out var index) ? Normalized(ExcelCells.Text(_row.Cell(index))) : null;

    private string? Required(string key, int max)
    {
        var text = Cell(key);
        if (text == null)
        {
            Error("Taxonomy:Import:Err:Required", Header(key));
            return null;
        }

        return Limited(key, text, max);
    }

    private string? Optional(string key, int max, int padDigits = 0)
    {
        var text = Cell(key);
        if (text == null)
        {
            return null;
        }

        if (padDigits > 0)
        {
            text = PadNumber(key, text, padDigits);
        }

        return Limited(key, text, max);
    }

    private string? Limited(string key, string text, int max)
    {
        if (text.Length > max)
        {
            Error("Taxonomy:Import:Err:TooLong", Header(key), max);
        }

        return text;
    }

    /// <summary>
    /// A phone typed into a number-formatted cell loses its leading 0
    /// ("912345678"); a nine-digit mobile is given it back.
    /// </summary>
    private string? Phone(string key, int max = PhoneMax)
    {
        var text = Cell(key);
        if (text == null)
        {
            return null;
        }

        if (IsNumberCell(key) && text.Length == 9 && text.All(char.IsAsciiDigit))
        {
            text = "0" + text;
        }

        return Limited(key, text, max);
    }

    /// <summary>
    /// A phone the hồ sơ forms check (the patient's and the guardian's): 8–15
    /// digits, as PATIENT_PHONE_PATTERN has it, so the record saves again from
    /// the UI. Spaces, dots and dashes the old system kept are dropped first;
    /// the pattern's "*" is left out, as it only lets a masked number come back.
    /// </summary>
    private string? FormPhone(string key, int max = PhoneMax)
    {
        var text = Phone(key, max);
        if (text == null)
        {
            return null;
        }

        var digits = PhoneSeparators.Replace(text, string.Empty);
        if (!FormPhonePattern.IsMatch(digits))
        {
            Error("DataMigration:Err:BadPhone", Header(key), text);
        }

        return digits;
    }

    private static readonly Regex PhoneSeparators = new(@"[\s.\-]", RegexOptions.Compiled);
    private static readonly Regex FormPhonePattern = new(@"^\d{8,15}$", RegexOptions.Compiled);

    private string? NationalId(string key) => Optional(key, int.MaxValue, padDigits: 12);

    /// <summary>A CCCD in a number cell has lost its leading zeros; they are put back.</summary>
    private string PadNumber(string key, string text, int digits) =>
        IsNumberCell(key) && text.Length < digits && text.All(char.IsAsciiDigit) ? text.PadLeft(digits, '0') : text;

    private bool IsNumberCell(string key) =>
        _columns.TryGetValue(key, out var index) && _row.Cell(index).DataType == XLDataType.Number;

    private decimal? RequiredMoney(string key)
    {
        if (Cell(key) == null)
        {
            Error("Taxonomy:Import:Err:Required", Header(key));
            return null;
        }

        return Money(key);
    }

    /// <summary>
    /// A money cell: a real number, or text in any of the shapes
    /// <see cref="ExcelCells.TryMoney"/> reads. Rounded to whole đồng; blank
    /// is null.
    /// </summary>
    private decimal? Money(string key)
    {
        if (!_columns.TryGetValue(key, out var index))
        {
            return null;
        }

        var cell = _row.Cell(index);
        decimal value;
        if (cell.DataType == XLDataType.Number)
        {
            var number = cell.GetDouble();
            if (!double.IsFinite(number) || Math.Abs(number) > (double)MoneyMax)
            {
                Error("DataMigration:Err:MoneyTooLarge", Header(key), FormatMoney(MoneyMax));
                return null;
            }

            value = (decimal)number;
        }
        else
        {
            var text = Cell(key);
            if (text == null)
            {
                return null;
            }

            if (!ExcelCells.TryMoney(text, out value))
            {
                Error("Taxonomy:Import:Err:NotANumber", Header(key));
                return null;
            }
        }

        if (value < 0m)
        {
            Error("Taxonomy:Import:Err:Negative", Header(key));
            return null;
        }

        if (value > MoneyMax)
        {
            Error("DataMigration:Err:MoneyTooLarge", Header(key), FormatMoney(MoneyMax));
            return null;
        }

        return Vnd.Round(value);
    }

    private DateOnly? RequiredDate(string key)
    {
        if (Cell(key) == null)
        {
            Error("Taxonomy:Import:Err:Required", Header(key));
            return null;
        }

        return OptionalDate(key);
    }

    /// <summary>
    /// A real Excel date, a date serial pasted as a plain number, or text
    /// written day first ("25/12/2019"). Old data cannot be dated after today:
    /// such a date is a typo, usually a two-digit year read into the future.
    /// </summary>
    private DateOnly? OptionalDate(string key)
    {
        var date = ParseDate(key);
        if (date > _today)
        {
            Error("DataMigration:Err:FutureDate", Header(key), date.Value.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture));
            return null;
        }

        return date;
    }

    private DateOnly? ParseDate(string key)
    {
        if (!_columns.TryGetValue(key, out var index))
        {
            return null;
        }

        var cell = _row.Cell(index);
        if (cell.DataType == XLDataType.DateTime)
        {
            return DateOnly.FromDateTime(cell.GetDateTime());
        }

        if (cell.DataType == XLDataType.Number
            && cell.GetDouble() is var serial and >= MinDateSerial and <= MaxDateSerial
            && serial == Math.Floor(serial))
        {
            return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        }

        var text = Cell(key);
        if (text == null)
        {
            return null;
        }

        if (DateTime.TryParseExact(text, DateFormats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return DateOnly.FromDateTime(parsed);
        }

        Error("DataMigration:Err:BadDate", Header(key), text);
        return null;
    }

    private static IEnumerable<string> Split(string? text, params char[] separators) =>
        (text ?? string.Empty)
            .Split(separators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(part => part.Length > 0);

    /// <summary>Text copied out of old systems is often decomposed (NFD); names are compared composed.</summary>
    private static string? Normalized(string? text) => text?.Normalize(NormalizationForm.FormC);

    private string Header(string key) => _layout[key].Header;

    private void Error(string key, params object[] args) => _errors.Add(_l[key, args].Value);
}
