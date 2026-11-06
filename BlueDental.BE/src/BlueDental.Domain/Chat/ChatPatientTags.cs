using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Volo.Abp;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Domain.Services;

namespace BlueDental.Chat;

/// <summary>A patient a message tags with # (R-1161): who, and the name its chip shows.</summary>
public sealed record ChatTaggedPatient(Guid Id, string Name);

/// <summary>
/// How a # tag sits inside a message's text (R-1161): <c>#[Tên](patient:{id})</c>.
/// The reader sees <c>#Tên</c>; the id lets the editor rebuild the chip
/// exactly. Only the name is kept — the card under the message is built when
/// it is read, never copied into the text.
/// </summary>
public static partial class ChatPatientTokens
{
    private const int MaxNameLength = 100;

    [GeneratedRegex(@"#\[(?<name>[^\[\]\r\n]{1,100})\]\(patient:(?<id>[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)")]
    private static partial Regex Token();

    /// <summary>
    /// Every tag of a patient the message really tags is rewritten with that
    /// patient's own name; a tag of anyone else becomes plain <c>#text</c>.
    /// </summary>
    public static string? Normalize(string? text, IReadOnlyList<ChatTaggedPatient> patients)
    {
        if (string.IsNullOrEmpty(text))
        {
            return text;
        }

        var names = patients.ToDictionary(p => p.Id, p => p.Name);
        return Token().Replace(text, match =>
            Guid.TryParse(match.Groups["id"].Value, out var id) && names.TryGetValue(id, out var name)
                ? Format(id, name)
                : "#" + match.Groups["name"].Value);
    }

    /// <summary>The text as the reader sees it: each tag as <c>#Tên</c>.</summary>
    public static string? ToDisplay(string? text) =>
        string.IsNullOrEmpty(text) ? text : Token().Replace(text, match => "#" + match.Groups["name"].Value);

    public static string Format(Guid id, string name) => $"#[{SafeName(name)}](patient:{id:D})";

    /// <summary>A name the token can hold: no brackets, no line breaks, not empty.</summary>
    public static string SafeName(string name)
    {
        var cleaned = Regex.Replace(name, @"[\[\]\r\n]+", " ").Trim();
        if (cleaned.Length > MaxNameLength)
        {
            cleaned = cleaned[..MaxNameLength].TrimEnd();
        }

        return cleaned.Length == 0 ? "?" : cleaned;
    }
}

/// <summary>
/// Checks the patients a message tags (R-1161): at most
/// <see cref="ChatConsts.MaxPatientsPerMessage"/>, each one existing and
/// belonging to the conversation's branch. Unknown, deleted and other-branch
/// patients get the same answer.
/// </summary>
public class ChatPatientTagger(IRepository<Patient, Guid> patients) : DomainService
{
    public async Task<IReadOnlyList<ChatTaggedPatient>> ResolveAsync(Guid branchId, IEnumerable<Guid>? patientIds)
    {
        var ids = (patientIds ?? []).Distinct().ToList();
        if (ids.Count > ChatConsts.MaxPatientsPerMessage)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.TooManyPatients)
                .WithData("max", ChatConsts.MaxPatientsPerMessage);
        }

        if (ids.Count == 0)
        {
            return [];
        }

        var query = await patients.GetQueryableAsync();
        var found = (await AsyncExecuter.ToListAsync(query
                .Where(p => ids.Contains(p.Id) && p.BranchId == branchId)
                .Select(p => new { p.Id, p.LastName, p.FirstName, p.PatientCode })))
            .ToDictionary(p => p.Id);
        if (found.Count != ids.Count)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Chat.PatientUnavailable);
        }

        return ids.Select(id =>
        {
            var patient = found[id];
            var name = $"{patient.LastName} {patient.FirstName}".Trim();
            return new ChatTaggedPatient(id, name.Length > 0 ? name : patient.PatientCode);
        }).ToList();
    }
}
