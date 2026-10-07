using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Organizations;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp.Domain.Repositories;

namespace BlueDental.PatientManagement;

/// <summary>
/// The guardian popup's search box (BA 2026-10-07): a phone may belong to no
/// hồ sơ yet still be on file, because that person already answers for another
/// patient. Both lists are searched so one phone stays one person.
///
/// Hồ sơ come first and win: a guardian row that is the same person as a hồ sơ
/// in the answer (linked to it, or carrying its CCCD) is not offered twice.
/// Guardian rows are folded by CCCD — the same mother declared for two
/// children is one match listing both. Branch-scoped like the patient list.
/// </summary>
[Authorize]
public class GuardianCandidateAppService : BlueDentalAppService, IGuardianCandidateAppService
{
    /// <summary>Matches offered per source; the box shows them all.</summary>
    private const int MaxPerSource = 5;

    /// <summary>Guardian rows read before folding — one person can sit on several patients.</summary>
    private const int GuardianRowScan = 50;

    private readonly IRepository<Patient, Guid> _repository;
    private readonly ICurrentClinicBranchResolver _branchResolver;

    public GuardianCandidateAppService(
        IRepository<Patient, Guid> repository,
        ICurrentClinicBranchResolver branchResolver)
    {
        _repository = repository;
        _branchResolver = branchResolver;
    }

    [Authorize(BlueDentalAbilityPermissions.Patient.Read)]
    public async Task<List<GuardianCandidateDto>> GetListAsync(GetGuardianCandidatesInput input)
    {
        var terms = SearchTerms.From(input.Filter);
        if (terms.Count == 0)
        {
            return [];
        }

        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var patients = await FindPatientsAsync(branchId, terms, input.ExcludePatientId);
        var guardians = await FindGuardiansAsync(branchId, terms, input.ExcludePatientId);

        var patientIds = patients.Select(p => p.PatientId).ToHashSet();
        var patientNationalIds = patients
            .Where(p => !string.IsNullOrWhiteSpace(p.NationalId))
            .Select(p => IdentityKey(p.NationalId!))
            .ToHashSet();

        var others = guardians
            .Where(g => !(g.PatientId.HasValue && patientIds.Contains(g.PatientId)))
            .Where(g => !patientNationalIds.Contains(IdentityKey(g.NationalId!)))
            .Take(MaxPerSource);

        return [.. patients, .. others];
    }

    private async Task<List<GuardianCandidateDto>> FindPatientsAsync(
        Guid branchId,
        IReadOnlyList<string> terms,
        Guid? excludeId)
    {
        // "Ẩn số điện thoại" (Cụm 11 mục 9): a masked account finds a record
        // by its whole number only, so typing digit after digit cannot spell
        // out the part it is not shown.
        var wholePhone = await LazyServiceProvider.LazyGetRequiredService<PatientPhoneMasker>().ShouldMaskAsync();

        var query = (await _repository.GetQueryableAsync())
            .Where(p => p.BranchId == branchId)
            .Where(p => !excludeId.HasValue || p.Id != excludeId.Value);

        foreach (var term in terms)
        {
            query = query.Where(p =>
                (p.LastName + " " + p.FirstName).ToLower().Contains(term)
                || p.PatientCode.ToLower().Contains(term)
                || (p.Contact.PhoneNumber != null
                    && (wholePhone ? p.Contact.PhoneNumber == term : p.Contact.PhoneNumber.Contains(term)))
                || (p.NationalId != null && p.NationalId.ToLower().Contains(term)));
        }

        var rows = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(p => p.CreationTime)
            .Take(MaxPerSource));

        return rows.Select(p => new GuardianCandidateDto
        {
            Source = GuardianCandidateSource.Patient,
            PatientId = p.Id,
            PatientCode = p.PatientCode,
            FullName = p.FullName,
            Phone = p.Contact.PhoneNumber,
            NationalId = p.NationalId,
            DateOfBirth = p.DateOfBirth,
            Gender = p.Gender,
            Email = p.Contact.Email,
            OccupationEntryId = p.OccupationEntryId
        }).ToList();
    }

    private async Task<List<GuardianCandidateDto>> FindGuardiansAsync(
        Guid branchId,
        IReadOnlyList<string> terms,
        Guid? excludeId)
    {
        // "Ẩn số điện thoại" (Cụm 11 mục 9): a masked account finds a record
        // by its whole number only, so typing digit after digit cannot spell
        // out the part it is not shown.
        var wholePhone = await LazyServiceProvider.LazyGetRequiredService<PatientPhoneMasker>().ShouldMaskAsync();

        var query = (await _repository.GetQueryableAsync())
            .Where(p => p.BranchId == branchId)
            .Where(p => !excludeId.HasValue || p.Id != excludeId.Value)
            .SelectMany(p => p.Guardians, (p, g) => new
            {
                WardId = p.Id,
                WardCode = p.PatientCode,
                WardName = p.LastName + " " + p.FirstName,
                WardCreatedAt = p.CreationTime,
                Guardian = g
            });

        foreach (var term in terms)
        {
            query = query.Where(x =>
                x.Guardian.FullName.ToLower().Contains(term)
                || (wholePhone ? x.Guardian.Phone == term : x.Guardian.Phone.Contains(term))
                || x.Guardian.NationalId.ToLower().Contains(term));
        }

        var rows = await AsyncExecuter.ToListAsync(query
            .OrderByDescending(x => x.WardCreatedAt)
            .Take(GuardianRowScan));

        return rows
            .GroupBy(x => IdentityKey(x.Guardian.NationalId))
            .Select(person =>
            {
                // The newest declaration speaks for the person.
                var g = person.First().Guardian;
                return new GuardianCandidateDto
                {
                    Source = GuardianCandidateSource.Guardian,
                    PatientId = person.Select(x => x.Guardian.LinkedPatientId).FirstOrDefault(id => id.HasValue),
                    FullName = g.FullName,
                    Phone = g.Phone,
                    NationalId = g.NationalId,
                    DateOfBirth = g.DateOfBirth,
                    IdIssuedOn = g.IdIssuedOn,
                    IdIssuedPlace = g.IdIssuedPlace,
                    Gender = g.Gender,
                    Email = g.Email,
                    OccupationEntryId = g.OccupationEntryId,
                    Wards = person
                        .DistinctBy(x => x.WardId)
                        .Select(x => new GuardianWardDto
                        {
                            PatientId = x.WardId,
                            PatientCode = x.WardCode,
                            FullName = x.WardName.Trim()
                        })
                        .ToList()
                };
            })
            .ToList();
    }

    /// <summary>A CCCD as a person's identity: spacing and letter case are not part of it.</summary>
    private static string IdentityKey(string nationalId) =>
        new string(nationalId.Where(c => !char.IsWhiteSpace(c)).ToArray()).ToUpperInvariant();
}
