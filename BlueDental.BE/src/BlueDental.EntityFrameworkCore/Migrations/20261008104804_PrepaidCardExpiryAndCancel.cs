using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class PrepaidCardExpiryAndCancel : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CancelReason",
                table: "bd_prepaid_cards",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "ExpiresOn",
                table: "bd_prepaid_cards",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ValidityMonths",
                table: "bd_prepaid_card_types",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelReason",
                table: "bd_prepaid_cards");

            migrationBuilder.DropColumn(
                name: "ExpiresOn",
                table: "bd_prepaid_cards");

            migrationBuilder.DropColumn(
                name: "ValidityMonths",
                table: "bd_prepaid_card_types");
        }
    }
}
