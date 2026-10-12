using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Owner, 2026-10-12: Người giám hộ, Mối quan hệ and Hồ sơ nhóm tell one
    /// story. From now on a guardian picked from a patient record with a
    /// kinship pill writes the pair's Mối quan hệ when the hồ sơ is saved
    /// (PatientFamilyResolver.SyncGuardiansAsync); this writes it for the
    /// guardians already on file. Pills map as PatientRelationTypes.KinshipOf:
    /// Bố / Mẹ (1, 2) → Parent (2), Ông / Bà (3, 4) → Grandparent (5),
    /// Anh/Chị ruột (5) → Sibling (4), Cô/Dì/Chú/Bác (6) → Relative (7).
    /// "Người giám hộ hợp pháp" / "Khác" say nothing about kinship and are left.
    /// A pair already related either way is left as it is; the next save of the
    /// ward's hồ sơ brings it in line with the card.
    ///
    /// Data only: the model is unchanged, so the snapshot is left as it is.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20261012140000_GuardianRelationships")]
    public partial class GuardianRelationships : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                INSERT INTO bd_patient_relationships
                    ("Id", "ClinicBranchId", "PatientId", "RelatedPatientId", "Type", "Note",
                     "ExtraProperties", "ConcurrencyStamp", "CreationTime", "IsDeleted")
                SELECT DISTINCT ON (g."PatientId", g."LinkedPatientId")
                    gen_random_uuid(), p."BranchId", g."PatientId", g."LinkedPatientId",
                    CASE g."Relation" WHEN 1 THEN 2 WHEN 2 THEN 2 WHEN 3 THEN 5 WHEN 4 THEN 5 WHEN 5 THEN 4 ELSE 7 END,
                    NULL, '{}', replace(gen_random_uuid()::text, '-', ''), now(), false
                FROM bd_patient_guardians g
                JOIN bd_patients p ON p."Id" = g."PatientId" AND p."IsDeleted" = false
                JOIN bd_patients o ON o."Id" = g."LinkedPatientId" AND o."IsDeleted" = false AND o."BranchId" = p."BranchId"
                WHERE g."LinkedPatientId" IS NOT NULL
                  AND g."LinkedPatientId" <> g."PatientId"
                  AND g."Relation" BETWEEN 1 AND 6
                  AND NOT EXISTS (
                      SELECT 1 FROM bd_patient_relationships r
                      WHERE r."IsDeleted" = false
                        AND ((r."PatientId" = g."PatientId" AND r."RelatedPatientId" = g."LinkedPatientId")
                          OR (r."PatientId" = g."LinkedPatientId" AND r."RelatedPatientId" = g."PatientId")))
                  -- Two records guarding each other: one row for the pair, from the lower id's card.
                  AND NOT EXISTS (
                      SELECT 1 FROM bd_patient_guardians back
                      WHERE back."PatientId" = g."LinkedPatientId" AND back."LinkedPatientId" = g."PatientId"
                        AND back."Relation" BETWEEN 1 AND 6 AND back."PatientId" < g."PatientId")
                ORDER BY g."PatientId", g."LinkedPatientId", g."SortOrder";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Which relations were written here is not kept; they are true either way.
        }
    }
}
