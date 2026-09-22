using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatmentServiceSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "bd_treatment_services",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_services_TreatmentPlanId_SortOrder",
                table: "bd_treatment_services",
                columns: new[] { "TreatmentPlanId", "SortOrder" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_treatment_services_TreatmentPlanId_SortOrder",
                table: "bd_treatment_services");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "bd_treatment_services");
        }
    }
}
