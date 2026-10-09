using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ReExaminationTreatmentDate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "TreatmentDate",
                table: "bd_patient_re_examinations",
                type: "date",
                nullable: false,
                defaultValue: new DateOnly(1, 1, 1));

            // Follow-ups written before Ngày điều trị existed happened the day
            // they were written: their clinic-local (UTC+7) CreationTime day.
            migrationBuilder.Sql(
                """
                UPDATE bd_patient_re_examinations
                SET "TreatmentDate" = ("CreationTime" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TreatmentDate",
                table: "bd_patient_re_examinations");
        }
    }
}
