using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Vận hành rows belong to a clinic branch, as every other business row
    /// here does, and an article's body stops being capped.
    ///
    /// The 10,000 character ceiling refused any article carrying an image —
    /// Postgres raised 22001 and the screen showed "Lỗi hệ thống". Rich text has
    /// no sensible ceiling, so the column becomes `text`.
    ///
    /// Existing rows are handed to the seeded main branch: this is demo and
    /// early-adopter data, and leaving them at Guid.Empty would hide them from
    /// every branch at once.
    ///
    /// Hand-written for the reason given in ScopeTagsAndPaymentAccountsToBranch:
    /// the model snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260825110000_ScopeOperationsToBranch")]
    public partial class ScopeOperationsToBranch : Migration
    {
        private const string MainBranchId = "11111111-1111-1111-1111-111111111111";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_operation_categories",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.AddColumn<Guid>(
                name: "ClinicBranchId",
                table: "bd_operation_articles",
                type: "uuid",
                nullable: false,
                defaultValue: Guid.Empty);

            migrationBuilder.Sql(
                $"UPDATE bd_operation_categories SET \"ClinicBranchId\" = '{MainBranchId}' " +
                "WHERE \"ClinicBranchId\" = '00000000-0000-0000-0000-000000000000';");

            migrationBuilder.Sql(
                $"UPDATE bd_operation_articles SET \"ClinicBranchId\" = '{MainBranchId}' " +
                "WHERE \"ClinicBranchId\" = '00000000-0000-0000-0000-000000000000';");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "bd_operation_articles",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(10000)",
                oldMaxLength: 10000,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_operation_categories_ClinicBranchId_Department_SubTab",
                table: "bd_operation_categories",
                columns: ["ClinicBranchId", "Department", "SubTab"]);

            migrationBuilder.CreateIndex(
                name: "IX_bd_operation_articles_ClinicBranchId_Department_SubTab",
                table: "bd_operation_articles",
                columns: ["ClinicBranchId", "Department", "SubTab"]);

        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_operation_articles_ClinicBranchId_Department_SubTab",
                table: "bd_operation_articles");

            migrationBuilder.DropIndex(
                name: "IX_bd_operation_categories_ClinicBranchId_Department_SubTab",
                table: "bd_operation_categories");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "bd_operation_articles",
                type: "character varying(10000)",
                maxLength: 10000,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.DropColumn(name: "ClinicBranchId", table: "bd_operation_articles");
            migrationBuilder.DropColumn(name: "ClinicBranchId", table: "bd_operation_categories");
        }
    }
}
