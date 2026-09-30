using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddAppointmentCancelledAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CancelledAt",
                table: "bd_appointments",
                type: "timestamp with time zone",
                nullable: true);

            // Appointments cancelled before the column existed: the last change
            // into Cancelled (6) in their history, else their last edit.
            migrationBuilder.Sql("""
                UPDATE bd_appointments a
                SET "CancelledAt" = COALESCE(
                    (SELECT max(l."OccurredAt") FROM bd_appointment_change_logs l
                     WHERE l."AppointmentId" = a."Id" AND l."StatusAfter" = 6),
                    a."LastModificationTime",
                    a."CreationTime")
                WHERE a."Status" = 6;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "bd_appointments");
        }
    }
}
