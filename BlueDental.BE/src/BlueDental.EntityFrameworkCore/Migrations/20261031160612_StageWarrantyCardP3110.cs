using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class StageWarrantyCardP3110 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "WarrantyKind",
                table: "bd_treatment_stages",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "WarrantyLaboOrderId",
                table: "bd_treatment_stages",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WarrantyKind",
                table: "bd_treatment_stages");

            migrationBuilder.DropColumn(
                name: "WarrantyLaboOrderId",
                table: "bd_treatment_stages");
        }
    }
}
