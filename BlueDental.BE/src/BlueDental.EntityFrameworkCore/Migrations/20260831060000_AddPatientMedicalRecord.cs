using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Bệnh án — the sheets a patient's record is made of.
    ///
    /// The reference reads them per patient behind
    /// <c>GET /patient-medical-record/files/{patientId}</c>: the clinic picks a
    /// form out of "Mục lục bệnh án", presses "Thêm" and fills the sheet in.
    /// Only the filled cells are stored, as JSON in <c>Content</c> — the printed
    /// layout lives on the client, so changing a form never migrates anyone's
    /// record. See docs/clone/pages/patient-detail.md §Bệnh án.
    ///
    /// Hand-written for the reason given in AddDepartmentSortOrder: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260831060000_AddPatientMedicalRecord")]
    public partial class AddPatientMedicalRecord : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_patient_medical_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Form = table.Column<short>(type: "smallint", nullable: false),
                    Title = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    Content = table.Column<string>(type: "character varying(200000)", maxLength: 200000, nullable: true),
                    ExtraProperties = table.Column<string>(type: "text", nullable: true),
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
                    table.PrimaryKey("PK_bd_patient_medical_records", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_medical_records_ClinicBranchId",
                table: "bd_patient_medical_records",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_medical_records_PatientId_SortOrder",
                table: "bd_patient_medical_records",
                columns: new[] { "PatientId", "SortOrder" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "bd_patient_medical_records");
        }
    }
}
