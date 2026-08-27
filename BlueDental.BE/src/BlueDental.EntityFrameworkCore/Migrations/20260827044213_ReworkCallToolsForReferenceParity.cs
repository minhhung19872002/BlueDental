using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ReworkCallToolsForReferenceParity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Scaffolding bundled unrelated snapshot drift into this migration.
            // Those operations were cut: departments' SortOrder belongs to
            // 20260827090000_AddDepartmentSortOrder and the material-allocation
            // rework (with its data carry-over) to
            // 20260827100000_AllocationCarriesManyMaterials, both of which run
            // after this one. Only the call-tools rework remains here.
            migrationBuilder.DropIndex(
                name: "IX_bd_call_logs_CreationTime",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "DurationSeconds",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "PatientId",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "PatientName",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "CalledAt",
                table: "bd_call_assignments");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "bd_call_assignments");

            migrationBuilder.DropColumn(
                name: "PatientName",
                table: "bd_call_assignments");

            migrationBuilder.DropColumn(
                name: "PhoneNumber",
                table: "bd_call_assignments");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "bd_call_assignments");

            migrationBuilder.RenameColumn(
                name: "Direction",
                table: "bd_call_logs",
                newName: "Provider");

            migrationBuilder.RenameColumn(
                name: "PatientId",
                table: "bd_call_assignments",
                newName: "CallConfigurationId");

            migrationBuilder.RenameIndex(
                name: "IX_bd_call_assignments_PatientId",
                table: "bd_call_assignments",
                newName: "IX_bd_call_assignments_CallConfigurationId");

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                table: "bd_call_logs",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AddColumn<string>(
                name: "CallCode",
                table: "bd_call_logs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CalledAt",
                table: "bd_call_logs",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "ExtensionCode",
                table: "bd_call_logs",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "bd_call_assignments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Sip",
                table: "bd_call_assignments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "bd_call_configurations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Provider = table.Column<short>(type: "smallint", nullable: false),
                    ApiKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    SecretKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
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
                    table.PrimaryKey("PK_bd_call_configurations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_call_logs_ClinicBranchId_CalledAt",
                table: "bd_call_logs",
                columns: new[] { "ClinicBranchId", "CalledAt" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_call_assignments_ClinicBranchId_Sip",
                table: "bd_call_assignments",
                columns: new[] { "ClinicBranchId", "Sip" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_call_configurations_ClinicBranchId",
                table: "bd_call_configurations",
                column: "ClinicBranchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_call_configurations");

            migrationBuilder.DropIndex(
                name: "IX_bd_call_logs_ClinicBranchId_CalledAt",
                table: "bd_call_logs");

            migrationBuilder.DropIndex(
                name: "IX_bd_call_assignments_ClinicBranchId_Sip",
                table: "bd_call_assignments");

            migrationBuilder.DropColumn(
                name: "CallCode",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "CalledAt",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "ExtensionCode",
                table: "bd_call_logs");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "bd_call_assignments");

            migrationBuilder.DropColumn(
                name: "Sip",
                table: "bd_call_assignments");

            migrationBuilder.RenameColumn(
                name: "Provider",
                table: "bd_call_logs",
                newName: "Direction");

            migrationBuilder.RenameColumn(
                name: "CallConfigurationId",
                table: "bd_call_assignments",
                newName: "PatientId");

            migrationBuilder.RenameIndex(
                name: "IX_bd_call_assignments_CallConfigurationId",
                table: "bd_call_assignments",
                newName: "IX_bd_call_assignments_PatientId");

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                table: "bd_call_logs",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AddColumn<int>(
                name: "DurationSeconds",
                table: "bd_call_logs",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "bd_call_logs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "PatientId",
                table: "bd_call_logs",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PatientName",
                table: "bd_call_logs",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CalledAt",
                table: "bd_call_assignments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "bd_call_assignments",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PatientName",
                table: "bd_call_assignments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PhoneNumber",
                table: "bd_call_assignments",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<short>(
                name: "Status",
                table: "bd_call_assignments",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.CreateIndex(
                name: "IX_bd_call_logs_CreationTime",
                table: "bd_call_logs",
                column: "CreationTime");
        }
    }
}
