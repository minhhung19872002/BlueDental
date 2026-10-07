using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class BranchUsageHours : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "UsageEndTime",
                table: "bd_clinic_branches",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "UsageStartTime",
                table: "bd_clinic_branches",
                type: "time without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UsageEndTime",
                table: "bd_clinic_branches");

            migrationBuilder.DropColumn(
                name: "UsageStartTime",
                table: "bd_clinic_branches");
        }
    }
}
