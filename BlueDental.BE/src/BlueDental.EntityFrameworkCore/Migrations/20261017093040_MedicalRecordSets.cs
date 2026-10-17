using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MedicalRecordSets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "bd_patient_medical_records",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "bd_patient_medical_records",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CancelledById",
                table: "bd_patient_medical_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RecordSetId",
                table: "bd_patient_medical_records",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.CreateTable(
                name: "bd_medical_record_sets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    HiddenFormMask = table.Column<int>(type: "integer", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CancelledById = table.Column<Guid>(type: "uuid", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_medical_record_sets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_medical_record_set_plans",
                columns: table => new
                {
                    MedicalRecordSetId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentPlanId = table.Column<Guid>(type: "uuid", nullable: false),
                    DentistId = table.Column<Guid>(type: "uuid", nullable: false),
                    AttachedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Released = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_medical_record_set_plans", x => new { x.MedicalRecordSetId, x.TreatmentPlanId });
                    table.ForeignKey(
                        name: "FK_bd_medical_record_set_plans_bd_medical_record_sets_MedicalR~",
                        column: x => x.MedicalRecordSetId,
                        principalTable: "bd_medical_record_sets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bd_medical_record_set_plans_bd_treatment_plans_TreatmentPla~",
                        column: x => x.TreatmentPlanId,
                        principalTable: "bd_treatment_plans",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_medical_records_RecordSetId",
                table: "bd_patient_medical_records",
                column: "RecordSetId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_medical_record_set_plans_TreatmentPlanId",
                table: "bd_medical_record_set_plans",
                column: "TreatmentPlanId",
                unique: true,
                filter: "\"Released\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_medical_record_sets_ClinicBranchId",
                table: "bd_medical_record_sets",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_medical_record_sets_Code",
                table: "bd_medical_record_sets",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_medical_record_sets_PatientId",
                table: "bd_medical_record_sets",
                column: "PatientId");

            // Sheets made before sets existed: each patient's go into one set of
            // their own, numbered for the day the first of them was made and
            // holding no treatment slip — the clinic can attach slips later.
            // Soft-deleted sheets are included, so the foreign key holds for every row.
            migrationBuilder.Sql("""
                WITH owners AS (
                    SELECT r."PatientId",
                           (array_agg(r."ClinicBranchId" ORDER BY r."CreationTime"))[1] AS "ClinicBranchId",
                           MIN(r."CreationTime") AS "FirstAt"
                    FROM bd_patient_medical_records r
                    WHERE r."RecordSetId" = '00000000-0000-0000-0000-000000000000'
                    GROUP BY r."PatientId"
                ), numbered AS (
                    SELECT o.*,
                           'HS' || COALESCE(p."PatientCode", upper(left(o."PatientId"::text, 8))) || '-' ||
                               to_char(o."FirstAt" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DDMMYYYY') || '-' AS "Prefix"
                    FROM owners o
                    LEFT JOIN bd_patients p ON p."Id" = o."PatientId"
                ), coded AS (
                    SELECT n.*,
                           n."Prefix" || lpad(row_number() OVER (PARTITION BY n."Prefix" ORDER BY n."PatientId")::text, 2, '0') AS "Code"
                    FROM numbered n
                )
                INSERT INTO bd_medical_record_sets
                    ("Id", "PatientId", "ClinicBranchId", "Code", "Status", "HiddenFormMask",
                     "ExtraProperties", "ConcurrencyStamp", "CreationTime", "IsDeleted")
                SELECT gen_random_uuid(), c."PatientId", c."ClinicBranchId", c."Code", 1, 0,
                       '{}', replace(gen_random_uuid()::text, '-', ''), c."FirstAt", false
                FROM coded c;

                UPDATE bd_patient_medical_records r
                SET "RecordSetId" = s."Id"
                FROM bd_medical_record_sets s
                WHERE s."PatientId" = r."PatientId"
                  AND r."RecordSetId" = '00000000-0000-0000-0000-000000000000';
                """);

            migrationBuilder.AddForeignKey(
                name: "FK_bd_patient_medical_records_bd_medical_record_sets_RecordSet~",
                table: "bd_patient_medical_records",
                column: "RecordSetId",
                principalTable: "bd_medical_record_sets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bd_patient_medical_records_bd_medical_record_sets_RecordSet~",
                table: "bd_patient_medical_records");

            migrationBuilder.DropTable(
                name: "bd_medical_record_set_plans");

            migrationBuilder.DropTable(
                name: "bd_medical_record_sets");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_medical_records_RecordSetId",
                table: "bd_patient_medical_records");

            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "bd_patient_medical_records");

            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "bd_patient_medical_records");

            migrationBuilder.DropColumn(
                name: "CancelledById",
                table: "bd_patient_medical_records");

            migrationBuilder.DropColumn(
                name: "RecordSetId",
                table: "bd_patient_medical_records");
        }
    }
}
