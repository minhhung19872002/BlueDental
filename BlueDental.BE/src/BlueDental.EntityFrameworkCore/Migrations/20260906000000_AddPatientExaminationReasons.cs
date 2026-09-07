using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Lý do đến khám — a dated list, not one note.
    ///
    /// The reference returns <c>examinationReason</c> as an array of
    /// <c>{ id, isRoot, createdAt, content, note }</c> and prints one line per
    /// entry on the profile card, each stamped with the day it was written. The
    /// single <c>bd_patients.ExaminationReason</c> column could only ever hold
    /// the last one, so it moves into its own table; the value already on a
    /// record becomes that record's root line, which is what the "Chỉnh sửa hồ
    /// sơ" dialog keeps editing. See docs/clone/pages/patient-detail.md.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260906000000_AddPatientExaminationReasons")]
    public partial class AddPatientExaminationReasons : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_patient_examination_reasons",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Content = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    IsRoot = table.Column<bool>(type: "boolean", nullable: false),
                    RecordedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_patient_examination_reasons", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_patient_examination_reasons_bd_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "bd_patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_examination_reasons_PatientId_RecordedAt",
                table: "bd_patient_examination_reasons",
                columns: new[] { "PatientId", "RecordedAt" });

            // Carry every reason already on a record across as its root line,
            // dated from the record itself — the column never kept a date.
            migrationBuilder.Sql(
                """
                INSERT INTO bd_patient_examination_reasons
                    ("Id", "PatientId", "Content", "Note", "IsRoot", "RecordedAt")
                SELECT
                    gen_random_uuid(),
                    p."Id",
                    left(btrim(p."ExaminationReason"), 1000),
                    NULL,
                    TRUE,
                    p."CreationTime"
                FROM bd_patients p
                WHERE p."ExaminationReason" IS NOT NULL
                  AND btrim(p."ExaminationReason") <> '';
                """);

            migrationBuilder.DropColumn(
                name: "ExaminationReason",
                table: "bd_patients");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExaminationReason",
                table: "bd_patients",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.Sql(
                """
                UPDATE bd_patients p
                SET "ExaminationReason" = r."Content"
                FROM bd_patient_examination_reasons r
                WHERE r."PatientId" = p."Id" AND r."IsRoot";
                """);

            migrationBuilder.DropTable(
                name: "bd_patient_examination_reasons");
        }
    }
}
