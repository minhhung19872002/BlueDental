using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.Imaging;

/// <summary>
/// Finds the record an X-ray picture belongs to (F-95), only ever inside the
/// branch of the PC that sent it. A code is a match — Mã khách hàng in any of
/// its spellings, else the old system's ID hệ thống — because the clinic types
/// it into EzDent-i's Biểu đồ số. A name and birth year are only a suggestion
/// for a person to confirm (owner, 2026-11-11): two patients share a name far
/// too often to put a film on a record by it.
/// </summary>
public class XrayPatientMatcher(
    IRepository<Patient, Guid> patients,
    IAsyncQueryableExecuter executer) : ITransientDependency
{
    public const int MaxSuggestions = 5;

    public async Task<Patient?> FindByCodeAsync(Guid clinicBranchId, string? code)
    {
        var trimmed = code?.Trim();
        if (string.IsNullOrEmpty(trimmed))
            return null;

        var spellings = PatientCodeNumbering.StoredSpellings(PatientCodeNumbering.Normalize(trimmed))
            .Append(trimmed)
            .Append(trimmed.ToUpperInvariant())
            .Distinct()
            .ToList();

        var query = (await patients.GetQueryableAsync()).Where(p => p.BranchId == clinicBranchId);

        var byCode = await executer.FirstOrDefaultAsync(query.Where(p => spellings.Contains(p.PatientCode)));
        return byCode
            ?? await executer.FirstOrDefaultAsync(query.Where(p => p.LegacyId != null && p.LegacyId == trimmed));
    }

    public async Task<List<XrayPatientSuggestionDto>> SuggestAsync(XrayInboxItem item)
    {
        var found = new List<XrayPatientSuggestionDto>();

        if (await FindByCodeAsync(item.ClinicBranchId, item.HintCode) is { } byCode)
            found.Add(ToSuggestion(byCode, XraySuggestionReason.Code));

        var name = NameTerm(item.HintName);
        if (name != null)
        {
            var query = (await patients.GetQueryableAsync())
                .Where(p => p.BranchId == item.ClinicBranchId)
                .Where(p => DbText.Unaccent((p.LastName + " " + p.FirstName).ToLower()).Contains(DbText.Unaccent(name)));

            if (item.HintBirthYear is { } year)
            {
                var from = new DateOnly(year, 1, 1);
                var to = from.AddYears(1);
                // Another birth year is another person; only an unknown one stays a maybe.
                query = query.Where(p => p.DateOfBirth == null || (p.DateOfBirth >= from && p.DateOfBirth < to));
            }

            var rows = await executer.ToListAsync(query
                .OrderBy(p => p.DateOfBirth == null)
                .ThenByDescending(p => p.CreationTime)
                .Take(MaxSuggestions + 1));

            found.AddRange(rows.Select(p => ToSuggestion(p,
                item.HintBirthYear.HasValue && p.DateOfBirth.HasValue
                    ? XraySuggestionReason.NameAndBirthYear
                    : XraySuggestionReason.Name)));
        }

        return found
            .GroupBy(s => s.PatientId)
            .Select(g => g.First())
            .Take(MaxSuggestions)
            .ToList();
    }

    /// <summary>
    /// The name read off a file, as one lower-case term: "NGUYEN_VAN_A" and
    /// "Nguyễn  Văn A" both search "nguyen van a"; too short to mean anything → null.
    /// </summary>
    public static string? NameTerm(string? hintName)
    {
        if (string.IsNullOrWhiteSpace(hintName))
            return null;

        var spaced = Regex.Replace(hintName.Replace('_', ' ').Replace('-', ' ').Replace('.', ' '), @"\s+", " ")
            .Trim()
            .ToLowerInvariant();
        return spaced.Length >= 2 ? spaced : null;
    }

    private static XrayPatientSuggestionDto ToSuggestion(Patient patient, XraySuggestionReason reason) => new()
    {
        PatientId = patient.Id,
        PatientCode = patient.PatientCode,
        FullName = patient.FullName,
        BirthYear = patient.DateOfBirth?.Year,
        Reason = reason,
    };
}
