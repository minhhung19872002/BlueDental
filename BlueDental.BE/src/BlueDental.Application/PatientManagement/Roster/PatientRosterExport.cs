using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using static BlueDental.DataMigration.DataMigrationLayout;

namespace BlueDental.PatientManagement.Roster;

/// <summary>
/// One patient as a roster row, written the way the import reads it back, so a
/// row exported and marked E without edits changes nothing on the record.
/// </summary>
internal static class PatientRosterExport
{
    private static readonly Dictionary<Gender, string> GenderLabels = new()
    {
        [Gender.Male] = "Nam",
        [Gender.Female] = "Nữ",
        [Gender.Other] = "Khác"
    };

    /// <summary>The guardian dialog's labels; the row reader accepts each of them.</summary>
    private static readonly Dictionary<GuardianRelation, string> RelationLabels = new()
    {
        [GuardianRelation.Father] = "Bố",
        [GuardianRelation.Mother] = "Mẹ",
        [GuardianRelation.Grandfather] = "Ông",
        [GuardianRelation.Grandmother] = "Bà",
        [GuardianRelation.Sibling] = "Anh / chị ruột",
        [GuardianRelation.AuntUncle] = "Cô / dì / chú / bác",
        [GuardianRelation.LegalGuardian] = "Người giám hộ hợp pháp",
        [GuardianRelation.Other] = "Khác"
    };

    public static Dictionary<string, string?> Values(Patient patient, string? branchName, PatientRosterCatalogs catalogs)
    {
        var locations = VietnamLocations.Instance;
        // The sheet has room for one guardian: the one the clinic calls first.
        var guardian = patient.Guardians.FirstOrDefault(g => g.IsPrimaryContact) ?? patient.Guardians.FirstOrDefault();

        return new Dictionary<string, string?>
        {
            [Col.FullName] = patient.FullName,
            [Col.Phone] = patient.Contact.PhoneNumber,
            [Col.Code] = patient.PatientCode,
            [Col.Branch] = branchName,
            [Col.LegacyId] = patient.LegacyId,
            [Col.Gender] = GenderLabels.GetValueOrDefault(patient.Gender),
            [Col.DateOfBirth] = Date(patient.DateOfBirth),
            [Col.NationalId] = patient.NationalId,
            [Col.Email] = patient.Contact.Email,
            [Col.Note] = patient.Note,
            [Col.Occupation] = catalogs.Name(patient.OccupationEntryId) ?? patient.OccupationOther,
            [Col.InsuranceNumber] = patient.InsuranceNumber,
            [Col.Address] = patient.Contact.Address,
            [Col.Province] = locations.ProvinceName(patient.ProvinceCode),
            [Col.Ward] = locations.WardName(patient.ProvinceCode, patient.WardCode),
            [Col.OldAddress] = patient.OldAddress,
            [Col.Source] = catalogs.Name(patient.SourceTaxonomyId),
            [Col.Channel] = catalogs.Name(patient.SourceEntryId),
            [Col.RegisteredOn] = Date(ClinicCalendar.DateOf(patient.RegisteredAt)),
            [Col.ExaminationReason] = patient.ExaminationReason,
            [Col.Tags] = Names(patient.TagIds, catalogs),
            [Col.DiseaseHistory] = Names(patient.DiseaseHistoryEntryIds, catalogs),
            [Col.EmergencyName] = patient.Contact.EmergencyContactName,
            [Col.EmergencyPhone] = patient.Contact.EmergencyContactPhone,
            [Col.GuardianName] = guardian?.FullName,
            [Col.GuardianPhone] = guardian?.Phone,
            [Col.GuardianNationalId] = guardian?.NationalId,
            [Col.GuardianRelation] = guardian == null ? null : RelationLabels.GetValueOrDefault(guardian.Relation)
        };
    }

    private static string? Date(DateOnly? day) =>
        day?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static string? Names(IEnumerable<Guid> ids, PatientRosterCatalogs catalogs)
    {
        var names = ids.Select(id => catalogs.Name(id)).OfType<string>().ToList();
        return names.Count == 0 ? null : string.Join("; ", names);
    }
}
