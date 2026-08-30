using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddTemporaryAppointmentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsTemporary",
                table: "bd_appointments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PatientName",
                table: "bd_appointments",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PatientPhone",
                table: "bd_appointments",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceEntryId",
                table: "bd_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceTaxonomyId",
                table: "bd_appointments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointments_BranchId_IsTemporary",
                table: "bd_appointments",
                columns: new[] { "BranchId", "IsTemporary" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_appointments_BranchId_IsTemporary",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "IsTemporary",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "PatientName",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "PatientPhone",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "SourceEntryId",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "SourceTaxonomyId",
                table: "bd_appointments");
        }
    }
}
