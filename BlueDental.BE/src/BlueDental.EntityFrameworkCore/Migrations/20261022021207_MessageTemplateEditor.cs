using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class MessageTemplateEditor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "bd_message_templates",
                type: "character varying(10000)",
                maxLength: 10000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(2000)",
                oldMaxLength: 2000);

            migrationBuilder.AddColumn<string>(
                name: "ExternalTemplateId",
                table: "bd_message_templates",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ParamMapJson",
                table: "bd_message_templates",
                type: "text",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<short>(
                name: "Purpose",
                table: "bd_message_templates",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "RemoveDiacritics",
                table: "bd_message_templates",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<short>(
                name: "Status",
                table: "bd_message_templates",
                type: "smallint",
                nullable: false,
                defaultValue: (short)0);

            migrationBuilder.AddColumn<string>(
                name: "Subject",
                table: "bd_message_templates",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            // Templates written before the editor existed were all usable: Sẵn sàng.
            migrationBuilder.Sql("UPDATE bd_message_templates SET \"Status\" = 1;");

            migrationBuilder.CreateIndex(
                name: "IX_bd_message_templates_ClinicBranchId_Channel_Status",
                table: "bd_message_templates",
                columns: new[] { "ClinicBranchId", "Channel", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_message_templates_ClinicBranchId_Channel_Status",
                table: "bd_message_templates");

            migrationBuilder.DropColumn(
                name: "ExternalTemplateId",
                table: "bd_message_templates");

            migrationBuilder.DropColumn(
                name: "ParamMapJson",
                table: "bd_message_templates");

            migrationBuilder.DropColumn(
                name: "Purpose",
                table: "bd_message_templates");

            migrationBuilder.DropColumn(
                name: "RemoveDiacritics",
                table: "bd_message_templates");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "bd_message_templates");

            migrationBuilder.DropColumn(
                name: "Subject",
                table: "bd_message_templates");

            migrationBuilder.AlterColumn<string>(
                name: "Content",
                table: "bd_message_templates",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(10000)",
                oldMaxLength: 10000);
        }
    }
}
