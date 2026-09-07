using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// The inline "new row" on the slip's Chi tiết tab (Thêm dịch vụ mới).
    ///
    /// The reference lets a line be written straight onto the slip with its own
    /// Chẩn đoán, Bác sĩ điều trị, Ghi chú, two diagnosing doctors and two
    /// consultants — columns a line pulled from a consulting line never needed.
    ///
    /// Hand-written for the reason given in AddAppointmentChangeLog — the model
    /// snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260907090000_AddTreatmentServiceDetails")]
    public partial class AddTreatmentServiceDetails : Migration
    {
        private static readonly string[] GuidColumns =
        [
            "DiagnosisId",
            "DentistId",
            "DiagnoserStaffId",
            "SecondDiagnoserStaffId",
            "ConsultantStaffId",
            "SecondConsultantStaffId"
        ];

        protected override void Up(MigrationBuilder migrationBuilder)
        {
            foreach (var column in GuidColumns)
            {
                migrationBuilder.AddColumn<Guid>(
                    name: column,
                    table: "bd_treatment_services",
                    type: "uuid",
                    nullable: true);
            }

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "bd_treatment_services",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            foreach (var column in GuidColumns)
            {
                migrationBuilder.DropColumn(name: column, table: "bd_treatment_services");
            }

            migrationBuilder.DropColumn(name: "Note", table: "bd_treatment_services");
        }
    }
}
