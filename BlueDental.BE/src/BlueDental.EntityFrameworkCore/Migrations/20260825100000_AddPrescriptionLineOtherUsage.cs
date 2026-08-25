using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// "Khác" in the prescription-template usage picker is a choice the user
    /// writes out, so the line needs somewhere to keep what they wrote.
    ///
    /// Hand-written for the reason given in ScopeTagsAndPaymentAccountsToBranch:
    /// the model snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260825100000_AddPrescriptionLineOtherUsage")]
    public partial class AddPrescriptionLineOtherUsage : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "OtherUsage",
                table: "bd_prescription_template_lines",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OtherUsage",
                table: "bd_prescription_template_lines");
        }
    }
}
