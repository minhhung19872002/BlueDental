using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ExpandCustomerCare : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CareServiceId",
                table: "bd_care_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CareStaffId",
                table: "bd_care_records",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Outcome",
                table: "bd_care_records",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ScheduledEnd",
                table: "bd_care_records",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ScheduledStart",
                table: "bd_care_records",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid[]>(
                name: "StageIds",
                table: "bd_care_records",
                type: "uuid[]",
                nullable: false,
                defaultValue: new Guid[0]);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ZaloSentAt",
                table: "bd_care_records",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_care_records_BranchId_Type_DueAt",
                table: "bd_care_records",
                columns: new[] { "BranchId", "Type", "DueAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_care_records_BranchId_Type_DueAt",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "CareServiceId",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "CareStaffId",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "Outcome",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "ScheduledEnd",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "ScheduledStart",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "StageIds",
                table: "bd_care_records");

            migrationBuilder.DropColumn(
                name: "ZaloSentAt",
                table: "bd_care_records");
        }
    }
}
