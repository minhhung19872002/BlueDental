using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddTimekeepingModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_time_keeping_records",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    StaffId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    WorkDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Registration = table.Column<short>(type: "smallint", nullable: false),
                    Status = table.Column<short>(type: "smallint", nullable: false),
                    MorningKind = table.Column<short>(type: "smallint", nullable: false),
                    MorningPlannedStart = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    MorningPlannedEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    MorningCheckedInAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    MorningCheckedOutAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AfternoonKind = table.Column<short>(type: "smallint", nullable: false),
                    AfternoonPlannedStart = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    AfternoonPlannedEnd = table.Column<TimeOnly>(type: "time without time zone", nullable: false),
                    AfternoonCheckedInAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    AfternoonCheckedOutAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    OvertimeMinutes = table.Column<int>(type: "integer", nullable: false),
                    LeaveReason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    RecordedByStaffId = table.Column<Guid>(type: "uuid", nullable: true),
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
                    table.PrimaryKey("PK_bd_time_keeping_records", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_time_keeping_records_ClinicBranchId_WorkDate_StaffId",
                table: "bd_time_keeping_records",
                columns: new[] { "ClinicBranchId", "WorkDate", "StaffId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_time_keeping_records_ClinicBranchId_WorkDate_Status",
                table: "bd_time_keeping_records",
                columns: new[] { "ClinicBranchId", "WorkDate", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_time_keeping_records");
        }
    }
}
