using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddStageValueTypeAndLaboSuppliers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsMarketingSalary",
                table: "bd_catalog_service_stages",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Every step saved before this column existed was typed as an amount
            // in VND (the seeder's 300 000 / 1 500 000 ... and the dialog's plain
            // number box), so the rows already there become Amount (1). A new row
            // in the dialog starts as a percentage, as it does on the reference.
            migrationBuilder.AddColumn<short>(
                name: "ValueType",
                table: "bd_catalog_service_stages",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.AddColumn<Guid[]>(
                name: "LaboSupplierIds",
                table: "bd_catalog_service_configs",
                type: "uuid[]",
                nullable: false,
                defaultValue: new Guid[0]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsMarketingSalary",
                table: "bd_catalog_service_stages");

            migrationBuilder.DropColumn(
                name: "ValueType",
                table: "bd_catalog_service_stages");

            migrationBuilder.DropColumn(
                name: "LaboSupplierIds",
                table: "bd_catalog_service_configs");
        }
    }
}
