using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ServiceCombo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "Kind",
                table: "bd_catalog_service_configs",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.CreateTable(
                name: "bd_catalog_combo_items",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    CatalogEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    ComponentEntryId = table.Column<Guid>(type: "uuid", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_catalog_combo_items", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_catalog_combo_items_bd_catalog_entries_CatalogEntryId",
                        column: x => x.CatalogEntryId,
                        principalTable: "bd_catalog_entries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_catalog_combo_items_CatalogEntryId_SortOrder",
                table: "bd_catalog_combo_items",
                columns: new[] { "CatalogEntryId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_catalog_combo_items_ComponentEntryId",
                table: "bd_catalog_combo_items",
                column: "ComponentEntryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_catalog_combo_items");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "bd_catalog_service_configs");
        }
    }
}
