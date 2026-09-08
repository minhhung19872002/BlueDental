using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// "I. TƯ VẤN CHẨN ĐOÁN" — the advice body of the printed diagnosis sheet.
    ///
    /// OBSERVED on the reference 2026-09-08: the "In chẩn đoán" dialog reads the
    /// sheet's advice from <c>contentDiagnosis</c> on the diagnosis row, and its
    /// "Cập nhật" button saves that field together with the note.
    ///
    /// A plain <c>text</c> column because the body is formatted HTML. Hand-written
    /// and the snapshot patched by hand — see AddStageServiceItems for why this
    /// project writes migrations that way.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260908000000_AddDiagnosisPrintContent")]
    public partial class AddDiagnosisPrintContent : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ContentDiagnosis",
                table: "bd_patient_diagnoses",
                type: "text",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ContentDiagnosis",
                table: "bd_patient_diagnoses");
        }
    }
}
