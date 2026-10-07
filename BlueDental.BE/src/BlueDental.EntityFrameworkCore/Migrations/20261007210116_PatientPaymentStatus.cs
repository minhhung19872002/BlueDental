using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PatientPaymentStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Every receipt written before this column existed was collected
            // money, so it lands as Hoàn tất (2), not Chưa thanh toán (1).
            migrationBuilder.AddColumn<short>(
                name: "Status",
                table: "bd_patient_payments",
                type: "smallint",
                nullable: false,
                defaultValue: (short)2);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "bd_patient_payments");
        }
    }
}
