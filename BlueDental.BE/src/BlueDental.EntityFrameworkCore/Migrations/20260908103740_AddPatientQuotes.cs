using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// Báo giá — the "BG n" tabs of Chẩn đoán &amp; Tư vấn.
    ///
    /// The lines ride in a single <c>jsonb</c> column: they carry no keys of
    /// their own and are only read and written whole, the same shape
    /// <c>bd_patient_advises</c> keeps its teeth in.
    ///
    /// **Scaffolded, then trimmed by hand.** `dotnet ef migrations add` also
    /// emitted seven `AddColumn`s on <c>bd_treatment_services</c>, three
    /// `AlterColumn`s and a `DropColumn` of <c>ExtraProperties</c> on
    /// <c>bd_appointment_change_logs</c> — drift between the model and a
    /// snapshot that earlier hand-written migrations never fully patched. All
    /// seven of those columns **already exist in the database** (checked
    /// against `information_schema`), so applying them would fail on
    /// "column already exists", and the `DropColumn` would have destroyed a
    /// live column for no reason. Only this table is created here; the drift is
    /// left exactly as it was, which is the state the application already runs
    /// against.
    /// </summary>
    public partial class AddPatientQuotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "bd_patient_quotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordinal = table.Column<int>(type: "integer", nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Lines = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_patient_quotes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_quotes_PatientId_ClinicBranchId",
                table: "bd_patient_quotes",
                columns: new[] { "PatientId", "ClinicBranchId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "bd_patient_quotes");
        }
    }
}
