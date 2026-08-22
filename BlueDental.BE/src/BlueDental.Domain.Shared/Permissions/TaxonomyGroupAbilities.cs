using System.Collections.Generic;
using BlueDental.Catalogs;

namespace BlueDental.Permissions;

/// <summary>
/// The reference gives every catalog its own ability subject
/// (<c>catalogService</c>, <c>catalogDiagnosis</c>, ...), while BlueDental serves
/// all of them from one taxonomy module. This maps a taxonomy group slug onto
/// the subject that guards it, so a single endpoint still enforces per-catalog
/// permissions.
/// </summary>
public static class TaxonomyGroupAbilities
{
    private static readonly Dictionary<string, string> SubjectByGroup = new()
    {
        [TaxonomyGroups.CareService] = BlueDentalAbilities.Subjects.CatalogService,
        [TaxonomyGroups.Diagnosis] = BlueDentalAbilities.Subjects.CatalogDiagnosis,
        [TaxonomyGroups.MedicationType] = BlueDentalAbilities.Subjects.CatalogMedicine,
        [TaxonomyGroups.ConsultingData] = BlueDentalAbilities.Subjects.CatalogConsultation,
        [TaxonomyGroups.Source] = BlueDentalAbilities.Subjects.CatalogSource,
        [TaxonomyGroups.DiseaseHistory] = BlueDentalAbilities.Subjects.CatalogHistory,
        [TaxonomyGroups.PrescriptionTemplate] = BlueDentalAbilities.Subjects.CatalogPrescription,
        [TaxonomyGroups.MedicalRecordTemplate] = BlueDentalAbilities.Subjects.CatalogTemplate,
        [TaxonomyGroups.Occupation] = BlueDentalAbilities.Subjects.CatalogOccupation,
        // Vật tư lives on its own screen and has its own subject.
        [TaxonomyGroups.Supplies] = BlueDentalAbilities.Subjects.Materials
    };

    /// <summary>
    /// Ability subject guarding the given taxonomy group. Falls back to
    /// <c>catalogService</c> for an unrecognised group so access is never
    /// silently ungated.
    /// </summary>
    public static string SubjectFor(string group) =>
        SubjectByGroup.TryGetValue(group, out var subject)
            ? subject
            : BlueDentalAbilities.Subjects.CatalogService;

    /// <summary>Permission name for an action on the given taxonomy group.</summary>
    public static string PermissionFor(string group, string action) =>
        BlueDentalAbilities.Permission(SubjectFor(group), action);
}
