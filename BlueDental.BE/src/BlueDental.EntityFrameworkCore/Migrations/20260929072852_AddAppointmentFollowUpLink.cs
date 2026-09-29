using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddAppointmentFollowUpLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The model snapshot had lost bd_electronic_invoices, which
            // 20260928085453_AddElectronicInvoices already creates; this
            // migration's snapshot restores it without creating it twice.
            migrationBuilder.AddColumn<Guid>(
                name: "FollowUpAppointmentId",
                table: "bd_appointments",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FollowUpAppointmentId",
                table: "bd_appointments");
        }
    }
}
