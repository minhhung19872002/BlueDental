using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ExpandLaboOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AttachmentUrl",
                table: "bd_labo_orders",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "BiteId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinishLineId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<short>(
                name: "Kind",
                table: "bd_labo_orders",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<Guid>(
                name: "MaterialId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RhythmId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SupplierId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AttachmentUrl",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "BiteId",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "FinishLineId",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "MaterialId",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "RhythmId",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "SupplierId",
                table: "bd_labo_orders");
        }
    }
}
