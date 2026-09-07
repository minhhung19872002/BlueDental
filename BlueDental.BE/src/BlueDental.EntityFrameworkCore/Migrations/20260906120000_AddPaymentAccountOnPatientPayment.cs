using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Tài khoản nhận tiền on a patient payment.
    ///
    /// The reference's "Tạo phiếu thanh toán" validates
    /// <c>paymentAccountId: required when paymentMethod is "bank" or "momo"</c>
    /// and picks it from the clinic's Phương thức thanh toán catalog — the same
    /// list BlueDental keeps as <c>bd_payment_accounts</c>. Nullable, because
    /// cash, card and Dư nợ collect into no account at all.
    ///
    /// No foreign key: an account may be retired from the catalog long after the
    /// receipts that name it, and those receipts must survive.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260906120000_AddPaymentAccountOnPatientPayment")]
    public partial class AddPaymentAccountOnPatientPayment : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "PaymentAccountId",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payments_PaymentAccountId",
                table: "bd_patient_payments",
                column: "PaymentAccountId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_payments_PaymentAccountId",
                table: "bd_patient_payments");

            migrationBuilder.DropColumn(
                name: "PaymentAccountId",
                table: "bd_patient_payments");
        }
    }
}
