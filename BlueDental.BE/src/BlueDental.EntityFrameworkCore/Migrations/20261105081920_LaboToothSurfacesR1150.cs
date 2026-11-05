using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// R-1150 Labo v2: the SharedSpec tick becomes the three-way SpecMode
    /// (ticked → 1 Chung tất cả, unticked → 3 Riêng từng răng), and each tooth
    /// row gains its picked surfaces (jsonb, old rows = none picked yet).
    /// </summary>
    public partial class LaboToothSurfacesR1150 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "SpecMode",
                table: "bd_labo_orders",
                type: "smallint",
                nullable: false,
                defaultValue: (short)3);

            migrationBuilder.Sql(
                "UPDATE bd_labo_orders SET \"SpecMode\" = CASE WHEN \"SharedSpec\" THEN 1 ELSE 3 END;");

            migrationBuilder.DropColumn(
                name: "SharedSpec",
                table: "bd_labo_orders");

            migrationBuilder.AddColumn<bool>(
                name: "ShadeBySurface",
                table: "bd_labo_order_teeth",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Surfaces",
                table: "bd_labo_order_teeth",
                type: "jsonb",
                nullable: true);

            migrationBuilder.Sql(
                "UPDATE bd_labo_order_teeth SET \"Surfaces\" = '[]'::jsonb WHERE \"Surfaces\" IS NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "SharedSpec",
                table: "bd_labo_orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql(
                "UPDATE bd_labo_orders SET \"SharedSpec\" = \"SpecMode\" <> 3;");

            migrationBuilder.DropColumn(
                name: "SpecMode",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "ShadeBySurface",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "Surfaces",
                table: "bd_labo_order_teeth");
        }
    }
}
