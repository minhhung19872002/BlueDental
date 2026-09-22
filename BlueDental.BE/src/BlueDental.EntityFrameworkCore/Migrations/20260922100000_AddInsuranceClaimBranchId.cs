using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// The branch-isolation remediation (72194d7) gave InsuranceClaim a
    /// BranchId and the model snapshot carries it, but no migration ever added
    /// the column, so every query on bd_insurance_claims failed with
    /// 42703 "column b.BranchId does not exist" (R-405). Existing rows, if
    /// any, take the branch of their invoice. Hand-written like the other
    /// 2026-09 migrations; the snapshot already matches.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260922100000_AddInsuranceClaimBranchId")]
    public partial class AddInsuranceClaimBranchId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "BranchId",
                table: "bd_insurance_claims",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.Sql(
                """
                UPDATE bd_insurance_claims c
                SET "BranchId" = i."BranchId"
                FROM bd_invoices i
                WHERE i."Id" = c."InvoiceId";
                """);

            migrationBuilder.CreateIndex(
                name: "IX_bd_insurance_claims_BranchId",
                table: "bd_insurance_claims",
                column: "BranchId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_insurance_claims_BranchId",
                table: "bd_insurance_claims");

            migrationBuilder.DropColumn(
                name: "BranchId",
                table: "bd_insurance_claims");
        }
    }
}
