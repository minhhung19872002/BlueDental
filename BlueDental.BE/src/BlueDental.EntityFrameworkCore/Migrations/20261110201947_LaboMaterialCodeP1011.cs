using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class LaboMaterialCodeP1011 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Code",
                table: "bd_labo_materials",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_materials_ClinicBranchId_Code",
                table: "bd_labo_materials",
                columns: new[] { "ClinicBranchId", "Code" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_labo_materials_ClinicBranchId_Code",
                table: "bd_labo_materials");

            migrationBuilder.DropColumn(
                name: "Code",
                table: "bd_labo_materials");
        }
    }
}
