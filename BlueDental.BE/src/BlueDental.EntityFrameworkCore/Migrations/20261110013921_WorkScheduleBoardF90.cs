using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class WorkScheduleBoardF90 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "ScheduledShift",
                table: "bd_time_keeping_records",
                type: "smallint",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_work_schedule_change_logs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkDate = table.Column<DateOnly>(type: "date", nullable: false),
                    FromShift = table.Column<short>(type: "smallint", nullable: false),
                    ToShift = table.Column<short>(type: "smallint", nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_work_schedule_change_logs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_work_schedule_change_logs_ClinicBranchId_WorkDate_StaffId",
                table: "bd_work_schedule_change_logs",
                columns: new[] { "ClinicBranchId", "WorkDate", "StaffId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_work_schedule_change_logs");

            migrationBuilder.DropColumn(
                name: "ScheduledShift",
                table: "bd_time_keeping_records");
        }
    }
}
