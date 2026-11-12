using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class LaboRequestSlipF91 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "CaseType",
                table: "bd_labo_orders",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.AddColumn<string>(
                name: "LabSlipNo",
                table: "bd_labo_orders",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Layout",
                table: "bd_labo_orders",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.AddColumn<List<Guid>>(
                name: "FinishLineIds",
                table: "bd_labo_order_teeth",
                type: "uuid[]",
                nullable: false,
                // Every tooth written before F-91 has no Đường hoàn tất list.
                defaultValueSql: "'{}'");

            migrationBuilder.AddColumn<string>(
                name: "Restorations",
                table: "bd_labo_order_teeth",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShadeZones",
                table: "bd_labo_order_teeth",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AllowOnImplant",
                table: "bd_labo_materials",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_orders_BranchId_LabSlipNo",
                table: "bd_labo_orders",
                columns: new[] { "BranchId", "LabSlipNo" },
                unique: true,
                filter: "\"LabSlipNo\" IS NOT NULL AND \"Status\" <> 6 AND \"IsDeleted\" = false");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_labo_orders_BranchId_LabSlipNo",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "CaseType",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "LabSlipNo",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "Layout",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "FinishLineIds",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "Restorations",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "ShadeZones",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "AllowOnImplant",
                table: "bd_labo_materials");
        }
    }
}
