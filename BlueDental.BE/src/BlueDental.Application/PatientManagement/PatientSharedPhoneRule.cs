using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Linq;

namespace BlueDental.PatientManagement;

/// <summary>What a save on a shared number writes: the new record is <see cref="Relation"/> of <see cref="AnchorId"/>.</summary>
public sealed record SharedPhoneLink(Guid AnchorId, PatientRelationType Relation);

/// <summary>The "Con của Hùng" chip of one holder.</summary>
public sealed record SharedPhoneLabel(PatientRelationType Type, string RelatedToName);

/// <summary>
/// Several hồ sơ on one phone (BA P2710_02, F-82), replacing "one phone, one
/// hồ sơ per branch" (bug 29). A record saved on a number another hồ sơ of
/// the branch holds must say who it is to one of them — "Là … của …" — and
/// that link is kept in the relations table (4.8), so the Mối quan hệ tab
/// shows it too.
///
/// Holders are hồ sơ only: a guardian without a hồ sơ who answers on the
/// number is offered by the dialog but never makes the link required.
/// </summary>
public class PatientSharedPhoneRule(
    IRepository<Patient, Guid> patientRepository,
    IRepository<PatientRelationship, Guid> relationshipRepository,
    PatientPhoneMasker phoneMasker,
    IAsyncQueryableExecuter asyncExecuter,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    /// <summary>"của …" lists people older than this — the BA's "tuổi &gt; 18", as năm hiện tại − năm sinh.</summary>
    public const int AdultAge = 18;

    /// <summary>
    /// The branch's hồ sơ on <paramref name="phone"/>, other than
    /// <paramref name="excludeId"/>, oldest first: the first is the Chủ số.
    /// </summary>
    public async Task<List<Patient>> HoldersAsync(Guid branchId, string? phone, Guid? excludeId)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return [];
        }

        var spellings = PatientPhoneFormat.Spellings(phone);
        var query = await patientRepository.WithDetailsAsync(p => p.Guardians);
        return await asyncExecuter.ToListAsync(query
            .Where(p => p.BranchId == branchId && spellings.Contains(p.Contact.PhoneNumber))
            .Where(p => !excludeId.HasValue || p.Id != excludeId.Value)
            .OrderBy(p => p.CreationTime)
            .ThenBy(p => p.PatientCode));
    }

    /// <summary>Over 18, or no birth date on file ("chưa rõ tuổi").</summary>
    public static bool IsAdult(DateOnly? dateOfBirth, DateOnly today) =>
        dateOfBirth is null || today.Year - dateOfBirth.Value.Year > AdultAge;

    /// <summary>
    /// Who "của …" offers for <paramref name="relation"/>: adults, except that
    /// Bố/Mẹ, Ông/Bà and Người giám hộ khác answer for a child. When nobody
    /// qualifies the whole list is offered, so a save is never stuck.
    /// </summary>
    public static List<Patient> EligibleAnchors(
        IReadOnlyList<Patient> holders, PatientRelationType relation, DateOnly today)
    {
        if (PatientRelationTypes.MayLinkToMinor(relation))
        {
            return holders.ToList();
        }

        var adults = holders.Where(h => IsAdult(h.DateOfBirth, today)).ToList();
        return adults.Count > 0 ? adults : holders.ToList();
    }

    /// <summary>
    /// Checks a record about to be saved on <paramref name="phone"/>. Null when
    /// nobody else holds the number; otherwise the link to write once saved.
    /// </summary>
    public async Task<SharedPhoneLink?> CheckAsync(
        Guid branchId, Guid? patientId, string? phone, string fullName, SharedPhoneLinkInput? input, DateOnly today)
    {
        var holders = await HoldersAsync(branchId, phone, patientId);
        if (holders.Count == 0)
        {
            return null;
        }

        // A masked account (Cụm 11 mục 9) is never shown who holds a number,
        // so it cannot say who it shares one with: the old refusal stands.
        if (await phoneMasker.ShouldMaskAsync())
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.DuplicatePhone);
        }

        if (input is null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.SharedPhoneLinkRequired);
        }

        if (!PatientRelationTypes.SharedPhoneChoices.Contains(input.Relation))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
        }

        if (EligibleAnchors(holders, input.Relation, today).All(h => h.Id != input.AnchorPatientId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.SharedPhoneAnchorInvalid);
        }

        EnsureNameIsFree(holders, fullName);
        return new SharedPhoneLink(input.AnchorPatientId, input.Relation);
    }

    /// <summary>A renamed record must not take the name of someone on its own number.</summary>
    public async Task EnsureNameIsFreeAsync(Guid branchId, Guid patientId, string? phone, string fullName) =>
        EnsureNameIsFree(await HoldersAsync(branchId, phone, patientId), fullName);

    /// <summary>
    /// Writes the link once the record is saved. The pair keeps one row: a
    /// relation already declared between them is rewritten, and a guardian
    /// declaration that already says the same thing is not doubled.
    /// </summary>
    public async Task LinkAsync(Guid branchId, Patient patient, SharedPhoneLink link)
    {
        var patients = await patientRepository.WithDetailsAsync(p => p.Guardians);
        var anchor = await asyncExecuter.FirstAsync(patients.Where(p => p.Id == link.AnchorId));
        if (GuardianIs(anchor, patient.Id) == link.Relation
            || (GuardianIs(patient, anchor.Id) is { } anchorIs && PatientRelationTypes.Inverse(anchorIs) == link.Relation))
        {
            return;
        }

        var existing = await relationshipRepository.FirstOrDefaultAsync(r =>
            (r.PatientId == link.AnchorId && r.RelatedPatientId == patient.Id)
            || (r.PatientId == patient.Id && r.RelatedPatientId == link.AnchorId));

        if (existing is null)
        {
            await relationshipRepository.InsertAsync(
                new PatientRelationship(guidGenerator.Create(), branchId, link.AnchorId, patient.Id, link.Relation, null),
                autoSave: true);
            return;
        }

        existing.Change(link.AnchorId, link.Relation, existing.Note);
        await relationshipRepository.UpdateAsync(existing, autoSave: true);
    }

    /// <summary>
    /// The chip of each holder: what it is to the Chủ số, or failing that to
    /// another holder — from declared relations and guardian declarations alike.
    /// </summary>
    public async Task<Dictionary<Guid, SharedPhoneLabel>> LabelsAsync(IReadOnlyList<Patient> holders)
    {
        var labels = new Dictionary<Guid, SharedPhoneLabel>();
        if (holders.Count < 2)
        {
            return labels;
        }

        var ids = holders.Select(h => h.Id).ToList();
        var byId = holders.ToDictionary(h => h.Id);
        var relations = await relationshipRepository.GetListAsync(r =>
            ids.Contains(r.PatientId) && ids.Contains(r.RelatedPatientId));

        // (holder, other, what holder is to other), Chủ số pairs first.
        var pairs = new List<(Guid Holder, Guid Other, PatientRelationType Type)>();
        foreach (var r in relations)
        {
            pairs.Add((r.RelatedPatientId, r.PatientId, r.Type));
            pairs.Add((r.PatientId, r.RelatedPatientId, PatientRelationTypes.Inverse(r.Type)));
        }

        foreach (var ward in holders)
        {
            foreach (var g in ward.Guardians.Where(g => g.LinkedPatientId is { } id && byId.ContainsKey(id)))
            {
                var guardianIs = PatientFamilyResolver.FromGuardian(g.Relation);
                pairs.Add((g.LinkedPatientId!.Value, ward.Id, guardianIs));
                pairs.Add((ward.Id, g.LinkedPatientId!.Value, PatientRelationTypes.Inverse(guardianIs)));
            }
        }

        var owner = holders[0].Id;
        foreach (var holder in holders.Skip(1))
        {
            var own = pairs.Where(p => p.Holder == holder.Id).OrderBy(p => p.Other == owner ? 0 : 1).ToList();
            if (own.Count > 0)
            {
                labels[holder.Id] = new SharedPhoneLabel(own[0].Type, byId[own[0].Other].FullName);
            }
        }

        return labels;
    }

    /// <summary>
    /// A guardian given a hồ sơ from the phone dropdown: every declaration of
    /// the person in the branch (same CCCD) not yet linked points at it now.
    /// </summary>
    public async Task LinkGuardianAsync(Guid branchId, Guid sourceGuardianId, Patient patient)
    {
        var query = await patientRepository.WithDetailsAsync(p => p.Guardians);
        var source = await asyncExecuter.FirstOrDefaultAsync(query
            .Where(p => p.BranchId == branchId)
            .SelectMany(p => p.Guardians)
            .Where(g => g.Id == sourceGuardianId));
        if (source is null)
        {
            return;
        }

        var nationalId = source.NationalId;
        var wards = await asyncExecuter.ToListAsync(query
            .Where(p => p.BranchId == branchId && p.Id != patient.Id)
            .Where(p => p.Guardians.Any(g => g.LinkedPatientId == null && g.NationalId == nationalId)));

        foreach (var ward in wards)
        {
            foreach (var guardian in ward.Guardians.Where(g => g.LinkedPatientId is null && g.NationalId == nationalId).ToList())
            {
                ward.LinkGuardianTo(guardian.Id, patient.Id);
            }

            await patientRepository.UpdateAsync(ward, autoSave: true);
        }
    }

    /// <summary>
    /// Guardians without a hồ sơ who answer on <paramref name="phone"/>,
    /// folded by CCCD and newest declaration first. A guardian whose CCCD a
    /// hồ sơ of the branch already carries is still offered: picking them is
    /// refused at Lưu (Patient:0012), as P2710_02 asks.
    /// </summary>
    public async Task<List<PhoneGuardianDto>> GuardiansOnPhoneAsync(Guid branchId, string phone)
    {
        var spellings = PatientPhoneFormat.Spellings(phone);
        var query = await patientRepository.WithDetailsAsync(p => p.Guardians);
        var wards = await asyncExecuter.ToListAsync(query
            .Where(p => p.BranchId == branchId)
            .Where(p => p.Guardians.Any(g => g.LinkedPatientId == null && spellings.Contains(g.Phone)))
            .OrderByDescending(p => p.CreationTime)
            .Take(50));

        var declarations = wards
            .SelectMany(w => w.Guardians
                .Where(g => g.LinkedPatientId == null && spellings.Contains(g.Phone))
                .Select(g => (Ward: w, Guardian: g)))
            .ToList();
        if (declarations.Count == 0)
        {
            return [];
        }

        return declarations
            .GroupBy(d => IdentityKey(d.Guardian.NationalId))
            .Select(person =>
            {
                var (ward, g) = person.First();
                return new PhoneGuardianDto
                {
                    GuardianId = g.Id,
                    Relation = g.Relation,
                    FullName = g.FullName,
                    NationalId = g.NationalId,
                    DateOfBirth = g.DateOfBirth,
                    Gender = g.Gender,
                    Email = g.Email,
                    OccupationEntryId = g.OccupationEntryId,
                    Address = g.SameAddressAsPatient ? ward.Contact.Address : g.Address,
                    ProvinceCode = g.SameAddressAsPatient ? ward.ProvinceCode : null,
                    WardCode = g.SameAddressAsPatient ? ward.WardCode : null,
                    Wards = person
                        .DistinctBy(d => d.Ward.Id)
                        .Select(d => new GuardianWardDto
                        {
                            PatientId = d.Ward.Id,
                            PatientCode = d.Ward.PatientCode,
                            FullName = d.Ward.FullName
                        })
                        .ToList()
                };
            })
            .ToList();
    }

    private static void EnsureNameIsFree(IEnumerable<Patient> holders, string fullName)
    {
        var name = NameKey(fullName);
        if (holders.Any(h => NameKey(h.FullName) == name))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.PatientManagement.DuplicateNameOnPhone);
        }
    }

    /// <summary>What <paramref name="guardianId"/> is to <paramref name="ward"/> by a guardian declaration, if one links them.</summary>
    private static PatientRelationType? GuardianIs(Patient ward, Guid guardianId) =>
        ward.Guardians.FirstOrDefault(g => g.LinkedPatientId == guardianId) is { } g
            ? PatientFamilyResolver.FromGuardian(g.Relation)
            : null;

    /// <summary>
    /// A name as the duplicate check compares it: letter case and spacing do
    /// not count, accents do — "Hà My" and "Ha My" are two people (owner 2026-10-28).
    /// </summary>
    private static string NameKey(string name) =>
        string.Join(' ', name.Normalize(NormalizationForm.FormC)
                .Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries))
            .ToLowerInvariant();

    /// <summary>A CCCD as a person's identity: spacing and letter case are not part of it.</summary>
    private static string IdentityKey(string nationalId) =>
        new string(nationalId.Where(c => !char.IsWhiteSpace(c)).ToArray()).ToUpperInvariant();
}
