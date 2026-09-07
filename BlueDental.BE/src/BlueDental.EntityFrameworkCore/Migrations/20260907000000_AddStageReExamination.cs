using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Tái khám — a follow-up visit raised from a finished công đoạn.
    ///
    /// Corrected 2026-09-07 after reading the reference's patient timeline: a tái
    /// khám is **not** another công đoạn but a row of its own,
    /// <c>type: "re_examination"</c>, carrying code <c>REX001</c>, a pointer back
    /// to the stage it came from, its own chosen teeth and its own images. The
    /// flag on the stage is the reference's <c>hasReExamination</c> — a marker on
    /// the **source** — so the column added earlier is renamed to say so.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260907000000_AddStageReExamination")]
    public partial class AddStageReExamination : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HasReExamination",
                table: "bd_treatment_stages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "bd_patient_re_examinations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    PatientStageId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    ServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    SubStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    SecondStaffId = table.Column<Guid>(type: "uuid", nullable: true),
                    Note = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Teeth = table.Column<string>(type: "jsonb", nullable: true),
                    ImageUrls = table.Column<string[]>(type: "text[]", nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
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
                    table.PrimaryKey("PK_bd_patient_re_examinations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_re_examinations_PatientId_ClinicBranchId",
                table: "bd_patient_re_examinations",
                columns: new[] { "PatientId", "ClinicBranchId" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_re_examinations_PatientStageId",
                table: "bd_patient_re_examinations",
                column: "PatientStageId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_re_examinations_TreatmentServiceId",
                table: "bd_patient_re_examinations",
                column: "TreatmentServiceId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "bd_patient_re_examinations");

            migrationBuilder.DropColumn(
                name: "HasReExamination",
                table: "bd_treatment_stages");
        }
    }
}
