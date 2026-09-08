using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// "Làm tiếp công đoạn" and "Bảo hành" on the patient's Labo tab raise a new
    /// order under an existing one.
    ///
    /// OBSERVED on staging 2026-09-08: the POST carries <c>sourceLabOrderId</c>
    /// and the parent's <c>code</c> unchanged, so a child shares its parent's
    /// code. The unique index on the code therefore covers only the orders
    /// without a parent. Hand-written and the model snapshot patched by hand —
    /// see AddAppointmentChangeLog for why this project writes them that way.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260908090000_AddLaboOrderParent")]
    public partial class AddLaboOrderParent : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ParentOrderId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.DropIndex(
                name: "IX_bd_labo_orders_OrderCode",
                table: "bd_labo_orders");

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_orders_OrderCode",
                table: "bd_labo_orders",
                column: "OrderCode",
                unique: true,
                filter: "\"ParentOrderId\" IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_orders_ParentOrderId",
                table: "bd_labo_orders",
                column: "ParentOrderId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_labo_orders_ParentOrderId",
                table: "bd_labo_orders");

            migrationBuilder.DropIndex(
                name: "IX_bd_labo_orders_OrderCode",
                table: "bd_labo_orders");

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_orders_OrderCode",
                table: "bd_labo_orders",
                column: "OrderCode",
                unique: true);

            migrationBuilder.DropColumn(
                name: "ParentOrderId",
                table: "bd_labo_orders");
        }
    }
}
