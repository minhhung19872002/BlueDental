using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftLateMinutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AfternoonLateMinutes",
                table: "bd_time_keeping_records",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MorningLateMinutes",
                table: "bd_time_keeping_records",
                type: "integer",
                nullable: true);

            // Backfill shifts already checked in, the way TimeKeepingRecord.DueStartOf
            // reads the due time (R-931). Uses today's plan, so a shift rescheduled
            // after its check-in (R-912) is measured against the moved plan.
            migrationBuilder.Sql(BackfillSql("Morning", 1));
            migrationBuilder.Sql(BackfillSql("Afternoon", 2));
        }

        private static string BackfillSql(string shift, int leaveShift) => $"""
            UPDATE bd_time_keeping_records
            SET "{shift}LateMinutes" = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (
                "{shift}CheckedInAt" - (("WorkDate" + CASE
                    WHEN "LeaveShift" = {leaveShift}
                         AND "LeaveStart" <= "{shift}PlannedStart"
                         AND "LeaveEnd" > "{shift}PlannedStart"
                    THEN "LeaveEnd"
                    ELSE "{shift}PlannedStart"
                END) AT TIME ZONE 'Asia/Ho_Chi_Minh'))) / 60))::integer
            WHERE "{shift}CheckedInAt" IS NOT NULL;
            """;

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AfternoonLateMinutes",
                table: "bd_time_keeping_records");

            migrationBuilder.DropColumn(
                name: "MorningLateMinutes",
                table: "bd_time_keeping_records");
        }
    }
}
