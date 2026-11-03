using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PaymentRounds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CashierDiscountTotal",
                table: "bd_patient_payments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VoucherAmount",
                table: "bd_patient_payments",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "VoucherCode",
                table: "bd_patient_payments",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "VoucherId",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CashierDiscount",
                table: "bd_patient_payment_lines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "CashierDiscountReason",
                table: "bd_patient_payment_lines",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReceiptName",
                table: "bd_patient_payment_lines",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TaxAmount",
                table: "bd_patient_payment_lines",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VoucherShare",
                table: "bd_patient_payment_lines",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payments_VoucherId",
                table: "bd_patient_payments",
                column: "VoucherId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_payments_VoucherId",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "CashierDiscountTotal",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "VoucherAmount",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "VoucherCode",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "VoucherId",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "CashierDiscount",
                table: "bd_patient_payment_lines");

            migrationBuilder.DropColumn(
                name: "CashierDiscountReason",
                table: "bd_patient_payment_lines");

            migrationBuilder.DropColumn(
                name: "ReceiptName",
                table: "bd_patient_payment_lines");

            migrationBuilder.DropColumn(
                name: "TaxAmount",
                table: "bd_patient_payment_lines");

            migrationBuilder.DropColumn(
                name: "VoucherShare",
                table: "bd_patient_payment_lines");
        }
    }
}
