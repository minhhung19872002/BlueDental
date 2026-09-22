using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddTreatmentServiceReplacedId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ReplacedId",
                table: "bd_treatment_services",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_treatment_services_ReplacedId",
                table: "bd_treatment_services",
                column: "ReplacedId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_treatment_services_ReplacedId",
                table: "bd_treatment_services");

            migrationBuilder.DropColumn(
                name: "ReplacedId",
                table: "bd_treatment_services");
        }
    }
}
