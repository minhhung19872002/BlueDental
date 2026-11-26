using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddMedicalRecordServiceIdsR1326 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<List<Guid>>(
                name: "ServiceIds",
                table: "bd_patient_medical_records",
                type: "uuid[]",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServiceIds",
                table: "bd_patient_medical_records");
        }
    }
}
