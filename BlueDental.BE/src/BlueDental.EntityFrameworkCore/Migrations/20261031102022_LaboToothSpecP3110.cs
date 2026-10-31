using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class LaboToothSpecP3110 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_LaboOrderId_LaboRoundNo",
                table: "bd_patient_images");

            migrationBuilder.AddColumn<int>(
                name: "LaboToothNumber",
                table: "bd_patient_images",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SharedSpec",
                table: "bd_labo_orders",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "BiteId",
                table: "bd_labo_order_teeth",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinishLineId",
                table: "bd_labo_order_teeth",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LabNote",
                table: "bd_labo_order_teeth",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "RhythmId",
                table: "bd_labo_order_teeth",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Shade",
                table: "bd_labo_order_teeth",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_LaboOrderId_LaboRoundNo_LaboToothNumber",
                table: "bd_patient_images",
                columns: new[] { "LaboOrderId", "LaboRoundNo", "LaboToothNumber" });

            // P3110 G8: an order made before the per-tooth table gives every
            // tooth the order's one Màu răng / Đường hoàn tất / Kiểu nhịp / Khớp cắn.
            migrationBuilder.Sql("""
                UPDATE bd_labo_order_teeth t
                SET "Shade" = o."ToothShade",
                    "FinishLineId" = o."FinishLineId",
                    "RhythmId" = o."RhythmId",
                    "BiteId" = o."BiteId"
                FROM bd_labo_orders o
                WHERE t."LaboOrderId" = o."Id";
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_LaboOrderId_LaboRoundNo_LaboToothNumber",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "LaboToothNumber",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "SharedSpec",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(
                name: "BiteId",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "FinishLineId",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "LabNote",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "RhythmId",
                table: "bd_labo_order_teeth");

            migrationBuilder.DropColumn(
                name: "Shade",
                table: "bd_labo_order_teeth");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_LaboOrderId_LaboRoundNo",
                table: "bd_patient_images",
                columns: new[] { "LaboOrderId", "LaboRoundNo" });
        }
    }
}
