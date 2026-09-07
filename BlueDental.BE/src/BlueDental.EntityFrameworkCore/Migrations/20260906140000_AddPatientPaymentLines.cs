using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// One receipt, several services.
    ///
    /// The reference's "Tạo phiếu thanh toán" posts a single payment naming
    /// every service it covers (<c>treatmentServiceIds[]</c>) and, when the
    /// cashier splits by hand, how much of the total each takes
    /// (<c>items[]</c>). BlueDental had one payment row per service, so the
    /// payment history showed three receipts where the reference shows one.
    ///
    /// The per-service share moves into <c>bd_patient_payment_lines</c> and the
    /// single <c>TreatmentServiceId</c> column goes; every existing row that
    /// named a service becomes a one-line receipt, so nothing is lost. Rows that
    /// named none (money held for the patient, or a payment taken against the
    /// slip as a whole) simply have no lines, which is what they meant.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260906140000_AddPatientPaymentLines")]
    public partial class AddPatientPaymentLines : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "SplitMode",
                table: "bd_patient_payments",
                type: "smallint",
                nullable: false,
                defaultValue: (short)1);

            migrationBuilder.CreateTable(
                name: "bd_patient_payment_lines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientPaymentId = table.Column<Guid>(type: "uuid", nullable: false),
                    TreatmentServiceId = table.Column<Guid>(type: "uuid", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_patient_payment_lines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_bd_patient_payment_lines_bd_patient_payments_PatientPaymentId",
                        column: x => x.PatientPaymentId,
                        principalTable: "bd_patient_payments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payment_lines_PatientPaymentId",
                table: "bd_patient_payment_lines",
                column: "PatientPaymentId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_payment_lines_TreatmentServiceId",
                table: "bd_patient_payment_lines",
                column: "TreatmentServiceId");

            // Every receipt that already named a service becomes a one-line one.
            migrationBuilder.Sql(
                """
                INSERT INTO bd_patient_payment_lines
                    ("Id", "PatientPaymentId", "TreatmentServiceId", "Amount")
                SELECT gen_random_uuid(), p."Id", p."TreatmentServiceId", p."Amount"
                FROM bd_patient_payments p
                WHERE p."TreatmentServiceId" IS NOT NULL;
                """);

            migrationBuilder.DropColumn(
                name: "TreatmentServiceId",
                table: "bd_patient_payments");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "TreatmentServiceId",
                table: "bd_patient_payments",
                type: "uuid",
                nullable: true);

            // A receipt with one line goes back as it came; one that covers
            // several cannot be expressed by the old column and keeps null.
            migrationBuilder.Sql(
                """
                UPDATE bd_patient_payments p
                SET "TreatmentServiceId" = single."TreatmentServiceId"
                FROM (
                    SELECT "PatientPaymentId", MIN("TreatmentServiceId"::text)::uuid AS "TreatmentServiceId"
                    FROM bd_patient_payment_lines
                    GROUP BY "PatientPaymentId"
                    HAVING COUNT(*) = 1
                ) single
                WHERE single."PatientPaymentId" = p."Id";
                """);

            migrationBuilder.DropTable(name: "bd_patient_payment_lines");

            migrationBuilder.DropColumn(
                name: "SplitMode",
                table: "bd_patient_payments");
        }
    }
}
