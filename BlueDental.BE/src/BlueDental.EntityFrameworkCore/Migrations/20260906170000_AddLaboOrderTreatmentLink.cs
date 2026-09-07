using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// What "Tạo Labo" on a treatment row needs a labo order to remember.
    ///
    /// The reference raises the order from a công đoạn: its "Đặt mới" opens with
    /// the patient, the slip, the service and the dentist already filled, so the
    /// order has to know which line and which công đoạn it came from. Its form
    /// also collects Màu răng and Số lượng, which had nowhere to go.
    ///
    /// All nullable (Quantity defaulting to one): an order raised from the Labo
    /// screen itself names no treatment at all.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260906170000_AddLaboOrderTreatmentLink")]
    public partial class AddLaboOrderTreatmentLink : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ToothShade",
                table: "bd_labo_orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Quantity",
                table: "bd_labo_orders",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<Guid>(
                name: "TreatmentServiceId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "TreatmentStageId",
                table: "bd_labo_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_labo_orders_TreatmentStageId",
                table: "bd_labo_orders",
                column: "TreatmentStageId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_labo_orders_TreatmentStageId",
                table: "bd_labo_orders");

            migrationBuilder.DropColumn(name: "TreatmentStageId", table: "bd_labo_orders");
            migrationBuilder.DropColumn(name: "TreatmentServiceId", table: "bd_labo_orders");
            migrationBuilder.DropColumn(name: "Quantity", table: "bd_labo_orders");
            migrationBuilder.DropColumn(name: "ToothShade", table: "bd_labo_orders");
        }
    }
}
