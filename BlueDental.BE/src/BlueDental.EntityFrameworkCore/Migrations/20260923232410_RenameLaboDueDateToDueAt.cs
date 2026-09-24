using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class RenameLaboDueDateToDueAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Ngày nhận dự kiến gains its hour: the day column becomes a stamp
            // in place, so existing orders keep their due day (at midnight).
            migrationBuilder.RenameColumn(
                name: "DueDate",
                table: "bd_labo_orders",
                newName: "DueAt");

            migrationBuilder.AlterColumn<DateTimeOffset>(
                name: "DueAt",
                table: "bd_labo_orders",
                type: "timestamp with time zone",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateOnly>(
                name: "DueAt",
                table: "bd_labo_orders",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateTimeOffset),
                oldType: "timestamp with time zone",
                oldNullable: true);

            migrationBuilder.RenameColumn(
                name: "DueAt",
                table: "bd_labo_orders",
                newName: "DueDate");
        }
    }
}
