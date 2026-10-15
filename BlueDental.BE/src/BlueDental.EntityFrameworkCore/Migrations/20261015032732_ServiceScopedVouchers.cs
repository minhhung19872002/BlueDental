using BlueDental.Promotions;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ServiceScopedVouchers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ServiceVoucherAmount",
                table: "bd_treatment_services",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "Position",
                table: "bd_treatment_plan_vouchers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<short>(
                name: "ScopeTarget",
                table: "bd_treatment_plan_vouchers",
                type: "smallint",
                nullable: false,
                // Every voucher redeemed before R-949 was a whole-slip one.
                defaultValue: (short)VoucherScopeTarget.Treatment);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServiceVoucherAmount",
                table: "bd_treatment_services");

            migrationBuilder.DropColumn(
                name: "Position",
                table: "bd_treatment_plan_vouchers");

            migrationBuilder.DropColumn(
                name: "ScopeTarget",
                table: "bd_treatment_plan_vouchers");
        }
    }
}
