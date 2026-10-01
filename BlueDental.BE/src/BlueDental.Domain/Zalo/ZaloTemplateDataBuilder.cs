using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Zalo;

/// <summary>
/// What a patient record can say for itself, keyed the way clinics name ZNS
/// parameters. The dialog "Gửi ZBS qua Zalo" has no fields — the reference
/// fills the template from the customer — so parameter names are matched
/// here, case-insensitively, against the values known for the customer. A
/// caller may still hand explicit values, which win.
/// </summary>
public static class ZaloTemplateDataBuilder
{
    public const string CustomerName = "customer_name";
    public const string Phone = "phone";
    public const string CustomerCode = "customer_code";
    public const string ClinicName = "clinic_name";
    public const string ClinicPhone = "clinic_phone";
    public const string ClinicAddress = "clinic_address";
    public const string Date = "date";
    public const string Time = "time";
    public const string DateAndTime = "date_time";
    public const string DoctorName = "doctor_name";
    public const string ServiceName = "service_name";
    public const string Note = "note";

    private static readonly Dictionary<string, string[]> Aliases = new(StringComparer.OrdinalIgnoreCase)
    {
        [CustomerName] = ["name", "ten", "ten_khach_hang", "khach_hang", "full_name", "fullname", "patient_name", "ho_ten"],
        [Phone] = ["phone_number", "sdt", "so_dien_thoai", "dien_thoai"],
        [CustomerCode] = ["code", "ma_khach_hang", "ma_kh", "patient_code", "ma_benh_nhan", "order_code", "ma_ho_so"],
        [ClinicName] = ["clinic", "branch", "branch_name", "chi_nhanh", "phong_kham", "ten_phong_kham", "oa_name"],
        [ClinicPhone] = ["hotline", "branch_phone", "sdt_phong_kham"],
        [ClinicAddress] = ["address", "dia_chi", "branch_address"],
        [Date] = ["ngay", "appointment_date", "ngay_hen", "ngay_kham", "booking_date"],
        [Time] = ["gio", "appointment_time", "gio_hen", "gio_kham", "booking_time"],
        [DateAndTime] = ["datetime", "thoi_gian", "thoi_gian_hen", "appointment_datetime", "schedule_time", "lich_hen"],
        [DoctorName] = ["doctor", "bac_si", "ten_bac_si", "dentist"],
        [ServiceName] = ["service", "dich_vu", "ten_dich_vu"],
        [Note] = ["ghi_chu", "content", "noi_dung", "message"],
    };

    /// <summary>
    /// One value per template parameter. Missing required parameters are
    /// reported rather than sent as blanks, which Zalo rejects less clearly.
    /// </summary>
    public static ZaloTemplateData Build(
        IReadOnlyList<ZaloTemplateParam> parameters,
        IReadOnlyDictionary<string, string?> known,
        IReadOnlyDictionary<string, string>? overrides)
    {
        var data = new Dictionary<string, string>(StringComparer.Ordinal);
        var missing = new List<string>();

        foreach (var parameter in parameters)
        {
            var value = Resolve(parameter.Name, known, overrides);

            if (string.IsNullOrWhiteSpace(value))
            {
                if (parameter.Required && !parameter.AcceptNull)
                {
                    missing.Add(parameter.Name);
                }

                continue;
            }

            if (parameter.MaxLength is > 0 && value.Length > parameter.MaxLength)
            {
                value = value[..parameter.MaxLength.Value];
            }

            data[parameter.Name] = value;
        }

        return new ZaloTemplateData(data, missing);
    }

    private static string? Resolve(
        string parameterName,
        IReadOnlyDictionary<string, string?> known,
        IReadOnlyDictionary<string, string>? overrides)
    {
        var explicitValue = Lookup(overrides, parameterName);
        if (!string.IsNullOrWhiteSpace(explicitValue))
        {
            return explicitValue;
        }

        var direct = Lookup(known, parameterName);
        if (!string.IsNullOrWhiteSpace(direct))
        {
            return direct;
        }

        foreach (var (canonical, names) in Aliases)
        {
            if (names.Contains(parameterName, StringComparer.OrdinalIgnoreCase))
            {
                var aliased = Lookup(known, canonical);
                if (!string.IsNullOrWhiteSpace(aliased))
                {
                    return aliased;
                }
            }
        }

        return null;
    }

    private static string? Lookup<TValue>(IReadOnlyDictionary<string, TValue>? source, string key)
        where TValue : class?
    {
        if (source == null)
        {
            return null;
        }

        foreach (var pair in source)
        {
            if (string.Equals(pair.Key, key, StringComparison.OrdinalIgnoreCase))
            {
                return pair.Value as string;
            }
        }

        return null;
    }
}

public sealed record ZaloTemplateData(
    IReadOnlyDictionary<string, string> Values,
    IReadOnlyList<string> MissingRequired);
