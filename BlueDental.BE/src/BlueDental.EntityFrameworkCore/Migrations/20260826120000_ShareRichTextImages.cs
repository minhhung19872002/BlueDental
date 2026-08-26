using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using BlueDental.EntityFrameworkCore;

#nullable disable

namespace BlueDental.Migrations
{
    /// <summary>
    /// The image store stops belonging to Vận hành.
    ///
    /// Danh mục's editors were embedding their pictures in the row as base64
    /// while Vận hành kept its in blob storage — two editors that look
    /// identical, storing differently. They share this table now, so it is
    /// named for what it holds rather than for who happened to need it first.
    ///
    /// Only a rename: every row keeps its id, so the links already sitting
    /// inside article bodies still resolve.
    ///
    /// Hand-written for the reason given in ScopeTagsAndPaymentAccountsToBranch:
    /// the model snapshot has drifted for unrelated entities.
    /// </summary>
    [DbContext(typeof(BlueDentalDbContext))]
    [Migration("20260826120000_ShareRichTextImages")]
    public partial class ShareRichTextImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "bd_operation_article_images",
                newName: "bd_rich_text_images");

            migrationBuilder.RenameIndex(
                name: "IX_bd_operation_article_images_ClinicBranchId",
                table: "bd_rich_text_images",
                newName: "IX_bd_rich_text_images_ClinicBranchId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameIndex(
                name: "IX_bd_rich_text_images_ClinicBranchId",
                table: "bd_operation_article_images",
                newName: "IX_bd_operation_article_images_ClinicBranchId");

            migrationBuilder.RenameTable(
                name: "bd_rich_text_images",
                newName: "bd_operation_article_images");
        }
    }
}
