using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Report page parity (2026-09-22): the reference's "Thêm danh mục sổ quỹ"
    /// dialog stores a colour swatch per category, and its income / expense
    /// vouchers carry a free-text "Người nộp" / "Người nhận". Both columns are
    /// optional. Hand-written and the model snapshot patched by hand — see
    /// AddAppointmentChangeLog for why this project writes them that way.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260922000000_AddCategoryColorAndPayerName")]
    public partial class AddCategoryColorAndPayerName : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ColorCode",
                table: "bd_cashflow_categories",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PayerName",
                table: "bd_sales_entries",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PayerName",
                table: "bd_sales_entries");

            migrationBuilder.DropColumn(
                name: "ColorCode",
                table: "bd_cashflow_categories");
        }
    }
}
