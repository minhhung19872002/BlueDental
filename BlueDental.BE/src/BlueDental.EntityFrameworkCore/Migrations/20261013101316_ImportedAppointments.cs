using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// F-61 extension: bookings moved in from the clinic's old system carry
    /// IsImported (no change-log backfill, no CSKH task); slot_start is indexed
    /// because such a clinic holds years of bookings and every screen reads a window.
    /// </summary>
    public partial class ImportedAppointments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsImported",
                table: "bd_appointments",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_bd_appointments_slot_start",
                table: "bd_appointments",
                column: "slot_start");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_appointments_slot_start",
                table: "bd_appointments");

            migrationBuilder.DropColumn(
                name: "IsImported",
                table: "bd_appointments");
        }
    }
}
