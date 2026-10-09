using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PatientRelationsAndGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_patient_groups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Kind = table.Column<short>(type: "smallint", nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    SharedMedicalNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
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
                    table.PrimaryKey("PK_bd_patient_groups", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "bd_patient_relationships",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    RelatedPatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    Note = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
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
                    table.PrimaryKey("PK_bd_patient_relationships", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_patient_relationships_bd_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "bd_patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bd_patient_relationships_bd_patients_RelatedPatientId",
                        column: x => x.RelatedPatientId,
                        principalTable: "bd_patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "bd_patient_group_members",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientGroupId = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<short>(type: "smallint", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_patient_group_members", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_patient_group_members_bd_patient_groups_PatientGroupId",
                        column: x => x.PatientGroupId,
                        principalTable: "bd_patient_groups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_bd_patient_group_members_bd_patients_PatientId",
                        column: x => x.PatientId,
                        principalTable: "bd_patients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_group_members_PatientGroupId_PatientId",
                table: "bd_patient_group_members",
                columns: new[] { "PatientGroupId", "PatientId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_group_members_PatientId",
                table: "bd_patient_group_members",
                column: "PatientId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_groups_ClinicBranchId",
                table: "bd_patient_groups",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_relationships_PatientId_RelatedPatientId",
                table: "bd_patient_relationships",
                columns: new[] { "PatientId", "RelatedPatientId" },
                unique: true,
                filter: "\"IsDeleted\" = false");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_relationships_RelatedPatientId",
                table: "bd_patient_relationships",
                column: "RelatedPatientId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_patient_group_members");

            migrationBuilder.DropTable(
                name: "bd_patient_relationships");

            migrationBuilder.DropTable(
                name: "bd_patient_groups");
        }
    }
}
