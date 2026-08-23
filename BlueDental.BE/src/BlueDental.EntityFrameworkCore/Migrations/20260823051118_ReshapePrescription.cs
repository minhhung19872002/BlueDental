using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ReshapePrescription : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Dosage",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "DurationDays",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "Frequency",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "MedicationId",
                table: "bd_prescriptions");

            migrationBuilder.RenameColumn(
                name: "TreatmentRecordId",
                table: "bd_prescriptions",
                newName: "StaffId");

            migrationBuilder.RenameColumn(
                name: "PrescribedBy",
                table: "bd_prescriptions",
                newName: "ClinicBranchId");

            migrationBuilder.RenameColumn(
                name: "Instructions",
                table: "bd_prescriptions",
                newName: "Note");

            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "bd_prescriptions",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DiagnosisText",
                table: "bd_prescriptions",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "FollowUpDate",
                table: "bd_prescriptions",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PatientDiagnosisId",
                table: "bd_prescriptions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_prescription_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PrescriptionId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    MedicationName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    Dosage = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Frequency = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    DurationDays = table.Column<int>(type: "integer", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    Instructions = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_prescription_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_prescription_items_bd_prescriptions_PrescriptionId",
                        column: x => x.PrescriptionId,
                        principalTable: "bd_prescriptions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescriptions_ClinicBranchId_Status",
                table: "bd_prescriptions",
                columns: new[] { "ClinicBranchId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescriptions_Code",
                table: "bd_prescriptions",
                column: "Code");

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescriptions_PatientId_IssuedAt",
                table: "bd_prescriptions",
                columns: new[] { "PatientId", "IssuedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_prescription_items_PrescriptionId",
                table: "bd_prescription_items",
                column: "PrescriptionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_prescription_items");

            migrationBuilder.DropIndex(
                name: "IX_bd_prescriptions_ClinicBranchId_Status",
                table: "bd_prescriptions");

            migrationBuilder.DropIndex(
                name: "IX_bd_prescriptions_Code",
                table: "bd_prescriptions");

            migrationBuilder.DropIndex(
                name: "IX_bd_prescriptions_PatientId_IssuedAt",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "DiagnosisText",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "FollowUpDate",
                table: "bd_prescriptions");

            migrationBuilder.DropColumn(
                name: "PatientDiagnosisId",
                table: "bd_prescriptions");

            migrationBuilder.RenameColumn(
                name: "StaffId",
                table: "bd_prescriptions",
                newName: "TreatmentRecordId");

            migrationBuilder.RenameColumn(
                name: "Note",
                table: "bd_prescriptions",
                newName: "Instructions");

            migrationBuilder.RenameColumn(
                name: "ClinicBranchId",
                table: "bd_prescriptions",
                newName: "PrescribedBy");

            migrationBuilder.AddColumn<string>(
                name: "Dosage",
                table: "bd_prescriptions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "DurationDays",
                table: "bd_prescriptions",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAt",
                table: "bd_prescriptions",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "Frequency",
                table: "bd_prescriptions",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "MedicationId",
                table: "bd_prescriptions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));
        }
    }
}
