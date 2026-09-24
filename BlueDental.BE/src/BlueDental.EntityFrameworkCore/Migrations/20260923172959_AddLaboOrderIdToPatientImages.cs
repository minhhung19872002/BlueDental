using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddLaboOrderIdToPatientImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "LaboOrderId",
                table: "bd_patient_images",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_LaboOrderId",
                table: "bd_patient_images",
                column: "LaboOrderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_LaboOrderId",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "LaboOrderId",
                table: "bd_patient_images");
        }
    }
}
