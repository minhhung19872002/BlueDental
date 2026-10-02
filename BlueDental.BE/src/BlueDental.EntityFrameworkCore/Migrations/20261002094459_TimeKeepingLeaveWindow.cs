using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class TimeKeepingLeaveWindow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "LeaveEnd",
                table: "bd_time_keeping_records",
                type: "time without time zone",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "LeaveShift",
                table: "bd_time_keeping_records",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "LeaveStart",
                table: "bd_time_keeping_records",
                type: "time without time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LeaveEnd",
                table: "bd_time_keeping_records");

            migrationBuilder.DropColumn(
                name: "LeaveShift",
                table: "bd_time_keeping_records");

            migrationBuilder.DropColumn(
                name: "LeaveStart",
                table: "bd_time_keeping_records");
        }
    }
}
