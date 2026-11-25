using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class AddPatientImageFoldersF98 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FolderId",
                table: "bd_patient_images",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "bd_patient_image_folders",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PatientId = table.Column<Guid>(type: "uuid", nullable: false),
                    ClinicBranchId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<short>(type: "smallint", nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    ExtraProperties = table.Column<string>(type: "text", nullable: false),
                    ConcurrencyStamp = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    CreationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatorId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastModificationTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LastModifierId = table.Column<Guid>(type: "uuid", nullable: true),
                    IsDeleted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    DeleterId = table.Column<Guid>(type: "uuid", nullable: true),
                    DeletionTime = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_bd_patient_image_folders", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_images_FolderId",
                table: "bd_patient_images",
                column: "FolderId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_image_folders_ClinicBranchId",
                table: "bd_patient_image_folders",
                column: "ClinicBranchId");

            migrationBuilder.CreateIndex(
                name: "IX_bd_patient_image_folders_PatientId_Type",
                table: "bd_patient_image_folders",
                columns: new[] { "PatientId", "Type" });

            migrationBuilder.AddForeignKey(
                name: "FK_bd_patient_images_bd_patient_image_folders_FolderId",
                table: "bd_patient_images",
                column: "FolderId",
                principalTable: "bd_patient_image_folders",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_bd_patient_images_bd_patient_image_folders_FolderId",
                table: "bd_patient_images");

            migrationBuilder.DropTable(
                name: "bd_patient_image_folders");

            migrationBuilder.DropIndex(
                name: "IX_bd_patient_images_FolderId",
                table: "bd_patient_images");

            migrationBuilder.DropColumn(
                name: "FolderId",
                table: "bd_patient_images");
        }
    }
}
