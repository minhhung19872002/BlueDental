using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// "Màu lịch hẹn" — the four swatches the reference's booking dialog offers.
    ///
    /// The colour tints the card on the calendar and carries no workflow meaning;
    /// see docs/clone/pages/patient-detail.md §Tạo lịch hẹn. Existing rows take
    /// <c>AppointmentColor.Default</c> (1), which is what the dialog preselects.
    ///
    /// Hand-written for the reason given in AddDepartmentSortOrder: the model
    /// snapshot has drifted for unrelated entities, so a scaffolded migration
    /// would sweep up changes that belong to other work.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260828090000_AddAppointmentColor")]
    public partial class AddAppointmentColor : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "Color",
                table: "bd_appointments",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Color",
                table: "bd_appointments");
        }
    }
}
