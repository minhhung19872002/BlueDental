using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Everything the "Tạo hồ sơ" / "Chỉnh sửa hồ sơ" dialog collects beyond the
    /// demographics the table already had, plus an optional birth date — the
    /// reference does not require one and rows registered at the front desk
    /// regularly have none.
    ///
    /// The scaffolder also re-proposed the material-allocation and department
    /// changes, because the model snapshot had not been refreshed since those
    /// were written by hand. They are already in the database, so only the
    /// patient columns are applied here; the regenerated snapshot beside this
    /// file is what brings the two back into step.
    /// </summary>
    public partial class ExtendPatientProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateOnly>(
                name: "DateOfBirth",
                table: "bd_patients",
                type: "date",
                nullable: true,
                oldClrType: typeof(DateOnly),
                oldType: "date");

            migrationBuilder.AddColumn<Guid[]>(
                name: "DiseaseHistoryEntryIds",
                table: "bd_patients",
                type: "uuid[]",
                nullable: false,
                defaultValue: new Guid[0]);

            migrationBuilder.AddColumn<string>(
                name: "ExaminationReason",
                table: "bd_patients",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InsuranceNumber",
                table: "bd_patients",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Note",
                table: "bd_patients",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "OccupationEntryId",
                table: "bd_patients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OccupationOther",
                table: "bd_patients",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProvinceCode",
                table: "bd_patients",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceEntryId",
                table: "bd_patients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "SourceTaxonomyId",
                table: "bd_patients",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WardCode",
                table: "bd_patients",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "DiseaseHistoryEntryIds", table: "bd_patients");
            migrationBuilder.DropColumn(name: "ExaminationReason", table: "bd_patients");
            migrationBuilder.DropColumn(name: "InsuranceNumber", table: "bd_patients");
            migrationBuilder.DropColumn(name: "Note", table: "bd_patients");
            migrationBuilder.DropColumn(name: "OccupationEntryId", table: "bd_patients");
            migrationBuilder.DropColumn(name: "OccupationOther", table: "bd_patients");
            migrationBuilder.DropColumn(name: "ProvinceCode", table: "bd_patients");
            migrationBuilder.DropColumn(name: "SourceEntryId", table: "bd_patients");
            migrationBuilder.DropColumn(name: "SourceTaxonomyId", table: "bd_patients");
            migrationBuilder.DropColumn(name: "WardCode", table: "bd_patients");

            // Rows registered without one have to be given a value again.
            migrationBuilder.Sql(
                "UPDATE bd_patients SET \"DateOfBirth\" = DATE '0001-01-01' WHERE \"DateOfBirth\" IS NULL;");

            migrationBuilder.AlterColumn<DateOnly>(
                name: "DateOfBirth",
                table: "bd_patients",
                type: "date",
                nullable: false,
                oldClrType: typeof(DateOnly),
                oldType: "date",
                oldNullable: true);
        }
    }
}
