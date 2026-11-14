using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class DayOffLimitR1233 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxDayOffDays",
                table: "bd_clinic_branches",
                type: "integer",
                nullable: false,
                defaultValue: 4); // ClinicBranch.DefaultMaxDayOffDays — every branch starts at the BA's 4
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxDayOffDays",
                table: "bd_clinic_branches");
        }
    }
}
