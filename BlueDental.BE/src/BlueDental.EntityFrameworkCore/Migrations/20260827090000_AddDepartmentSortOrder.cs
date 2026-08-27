using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Departments get a position of their own.
    ///
    /// The reference orders its department list by "order"
    /// (<c>GET /api/v1/departments/list?orderBy=order</c>) and its dialog
    /// collects it as "Số thứ tự". BlueDental had nowhere to put that, so the
    /// number was being written into the description column — where it could
    /// not sort and would have surfaced as a description.
    ///
    /// Existing rows start at zero and therefore keep falling back to the name,
    /// which is the order they were listed in before this.
    ///
    /// Hand-written for the reason given in ScopeTagsAndPaymentAccountsToBranch:
    /// the model snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260827090000_AddDepartmentSortOrder")]
    public partial class AddDepartmentSortOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SortOrder",
                table: "bd_departments",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_bd_departments_BranchId_SortOrder",
                table: "bd_departments",
                columns: ["BranchId", "SortOrder"]);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_departments_BranchId_SortOrder",
                table: "bd_departments");

            migrationBuilder.DropColumn(
                name: "SortOrder",
                table: "bd_departments");
        }
    }
}
