using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using BlueDental.Catalogs.Import;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// The 34 provinces and their wards after the 2025 merger — the same list the
/// hồ sơ dialog picks from (new-vn-provinces 3.0.4, embedded as
/// vn-locations.json). The record stores codes; the roster file writes names,
/// so this turns one into the other.
/// </summary>
internal sealed class VietnamLocations
{
    private const string ResourceName = "BlueDental.PatientManagement.Roster.vn-locations.json";

    private static readonly Lazy<VietnamLocations> Shared = new(Load);

    /// <summary>Administrative words a clinic writes or leaves out ("TP. Hà Nội", "Hà Nội").</summary>
    private static readonly string[] ProvincePrefixes = ["thành phố ", "tỉnh ", "tp. ", "tp.", "tp "];
    private static readonly string[] WardPrefixes = ["phường ", "xã ", "đặc khu ", "thị trấn ", "p. ", "p.", "x. ", "x."];

    /// <summary>Short names clinics use for the two big cities.</summary>
    private static readonly Dictionary<string, string> ProvinceAliases = new()
    {
        ["hcm"] = "79", ["tphcm"] = "79", ["tp.hcm"] = "79", ["sài gòn"] = "79",
        ["hn"] = "01"
    };

    /// <summary>Old and new tone placement ("Thanh Hoá" / "Thanh Hóa") are the same name.</summary>
    private static readonly (string Old, string New)[] ToneSpellings =
    [
        ("oà", "òa"), ("oá", "óa"), ("oả", "ỏa"), ("oã", "õa"), ("oạ", "ọa"),
        ("oè", "òe"), ("oé", "óe"), ("oẻ", "ỏe"), ("oẽ", "õe"), ("oẹ", "ọe"),
        ("uỳ", "ùy"), ("uý", "úy"), ("uỷ", "ủy"), ("uỹ", "ũy"), ("uỵ", "ụy")
    ];

    private readonly Dictionary<string, Province?> _provinceIndex;
    private readonly Dictionary<string, Province> _provinceByCode;

    private VietnamLocations(List<Province> provinces)
    {
        _provinceByCode = provinces.ToDictionary(p => p.Code);
        _provinceIndex = Index(provinces, p => p.Name, ProvincePrefixes);
        foreach (var (alias, code) in ProvinceAliases)
        {
            _provinceIndex[alias] = _provinceByCode.GetValueOrDefault(code);
        }
    }

    public static VietnamLocations Instance => Shared.Value;

    public string? ProvinceName(string? code) =>
        code != null && _provinceByCode.TryGetValue(code, out var province) ? province.Name : null;

    public string? WardName(string? provinceCode, string? wardCode) =>
        provinceCode != null && wardCode != null && _provinceByCode.TryGetValue(provinceCode, out var province)
            ? province.Wards.FirstOrDefault(w => w.Code == wardCode)?.Name
            : null;

    /// <summary>
    /// A province by its full name, its name without "Tỉnh" / "Thành phố", or
    /// its code. Null when nothing — or more than one — answers to the text.
    /// </summary>
    public string? FindProvince(string text)
    {
        if (_provinceByCode.ContainsKey(text.Trim()))
        {
            return text.Trim();
        }

        return Find(_provinceIndex, text, ProvincePrefixes)?.Code;
    }

    /// <summary>A ward of the province, by full name or without "Phường" / "Xã"; null when unknown or ambiguous.</summary>
    public string? FindWard(string provinceCode, string text)
    {
        if (!_provinceByCode.TryGetValue(provinceCode, out var province))
        {
            return null;
        }

        if (province.Wards.Any(w => w.Code == text.Trim()))
        {
            return text.Trim();
        }

        province.Index ??= Index(province.Wards, w => w.Name, WardPrefixes);
        return Find(province.Index, text, WardPrefixes)?.Code;
    }

    private static Dictionary<string, T?> Index<T>(IEnumerable<T> items, Func<T, string> name, string[] prefixes)
        where T : class
    {
        var index = new Dictionary<string, T?>();
        foreach (var item in items)
        {
            var full = Key(name(item));
            foreach (var key in new[] { full, Strip(full, prefixes) }.Distinct())
            {
                // Two places answering to one short name map to null: the
                // reader then says "not found" rather than guess.
                index[key] = index.TryGetValue(key, out var existing) && existing != item ? null : item;
            }
        }

        return index;
    }

    private static T? Find<T>(Dictionary<string, T?> index, string text, string[] prefixes) where T : class
    {
        var key = Key(text);
        if (index.TryGetValue(key, out var exact))
        {
            return exact;
        }

        return index.GetValueOrDefault(Strip(key, prefixes));
    }

    private static string Key(string text)
    {
        var key = ExcelCells.Key(text.Normalize(NormalizationForm.FormC));
        foreach (var (old, @new) in ToneSpellings)
        {
            key = key.Replace(old, @new, StringComparison.Ordinal);
        }

        return key;
    }

    private static string Strip(string key, string[] prefixes)
    {
        var prefix = prefixes.FirstOrDefault(p => key.StartsWith(p, StringComparison.Ordinal));
        return prefix == null ? key : key[prefix.Length..].Trim();
    }

    private static VietnamLocations Load()
    {
        using var stream = typeof(VietnamLocations).Assembly.GetManifestResourceStream(ResourceName)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} is missing.");
        var provinces = JsonSerializer.Deserialize<List<Province>>(stream)
            ?? throw new InvalidOperationException($"Embedded resource {ResourceName} is empty.");
        return new VietnamLocations(provinces);
    }

    private sealed class Province
    {
        [JsonPropertyName("c")] public string Code { get; init; } = string.Empty;
        [JsonPropertyName("n")] public string Name { get; init; } = string.Empty;
        [JsonPropertyName("w")] public List<Ward> Wards { get; init; } = [];

        [JsonIgnore] public Dictionary<string, Ward?>? Index { get; set; }
    }

    private sealed class Ward
    {
        [JsonPropertyName("c")] public string Code { get; init; } = string.Empty;
        [JsonPropertyName("n")] public string Name { get; init; } = string.Empty;
    }
}
