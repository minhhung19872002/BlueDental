using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientLegacyId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LegacyId",
                table: "bd_patients",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patients_BranchId_LegacyId",
                table: "bd_patients",
                columns: new[] { "BranchId", "LegacyId" },
                unique: true,
                filter: "\"LegacyId\" IS NOT NULL AND \"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patients_BranchId_LegacyId",
                table: "bd_patients");

            migrationBuilder.DropColumn(
                name: "LegacyId",
                table: "bd_patients");
        }
    }
}
