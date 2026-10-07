using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PatientGuardians : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_patient_guardians",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    LinkedPatientId = table.Column<Guid>(type: "uuid", nullable: true),
                    Relation = table.Column<short>(type: "smallint", nullable: false),
                    RelationNote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    ProofType = table.Column<short>(type: "smallint", nullable: true),
                    ProofBlobName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ProofFileName = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Phone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    NationalId = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DateOfBirth = table.Column<DateOnly>(type: "date", nullable: true),
                    IdIssuedOn = table.Column<DateOnly>(type: "date", nullable: true),
                    IdIssuedPlace = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Gender = table.Column<short>(type: "smallint", nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    OccupationEntryId = table.Column<Guid>(type: "uuid", nullable: true),
                    SameAddressAsPatient = table.Column<bool>(type: "boolean", nullable: false),
                    Address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsPrimaryContact = table.Column<bool>(type: "boolean", nullable: false),
                    ConsentedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_patient_guardians", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_patient_guardians_bd_patients_LinkedPatientId",
                        column: x => x.LinkedPatientId,
                        principalTable: "bd_patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_bd_patient_guardians_bd_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "bd_patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_guardians_LinkedPatientId",
                table: "bd_patient_guardians",
                column: "LinkedPatientId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_guardians_PatientId_SortOrder",
                table: "bd_patient_guardians",
                columns: new[] { "PatientId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_patient_guardians");
        }
    }
}
