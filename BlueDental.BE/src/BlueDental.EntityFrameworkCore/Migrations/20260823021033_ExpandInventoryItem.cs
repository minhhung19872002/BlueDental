using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ExpandInventoryItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Supplier",
                table: "bd_inventory_items",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExpiryDate",
                table: "bd_inventory_items",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ExpiryWarningDays",
                table: "bd_inventory_items",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Origin",
                table: "bd_inventory_items",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SalePrice",
                table: "bd_inventory_items",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "StockedAt",
                table: "bd_inventory_items",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TaxonomyId",
                table: "bd_inventory_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_inventory_items_BranchId_TaxonomyId",
                table: "bd_inventory_items",
                columns: new[] { "BranchId", "TaxonomyId" });

            migrationBuilder.CreateIndex(
                name: "IX_bd_inventory_items_ExpiryDate",
                table: "bd_inventory_items",
                column: "ExpiryDate");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_inventory_items_BranchId_TaxonomyId",
                table: "bd_inventory_items");

            migrationBuilder.DropIndex(
                name: "IX_bd_inventory_items_ExpiryDate",
                table: "bd_inventory_items");

            migrationBuilder.DropColumn(
                name: "ExpiryDate",
                table: "bd_inventory_items");

            migrationBuilder.DropColumn(
                name: "ExpiryWarningDays",
                table: "bd_inventory_items");

            migrationBuilder.DropColumn(
                name: "Origin",
                table: "bd_inventory_items");

            migrationBuilder.DropColumn(
                name: "SalePrice",
                table: "bd_inventory_items");

            migrationBuilder.DropColumn(
                name: "StockedAt",
                table: "bd_inventory_items");

            migrationBuilder.DropColumn(
                name: "TaxonomyId",
                table: "bd_inventory_items");

            migrationBuilder.AlterColumn<string>(
                name: "Supplier",
                table: "bd_inventory_items",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);
        }
    }
}
