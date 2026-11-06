using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BlueDental.Migrations
{
    /// <inheritdoc />
    public partial class ChatOwnerR1158 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "OwnerId",
                table: "bd_chat_conversations",
                type: "uuid",
                nullable: true);

            // Groups started before R-1158: the creator owns it while still in
            // it, otherwise whoever has been in it longest (Kind 2 = Group).
            migrationBuilder.Sql("""
                UPDATE bd_chat_conversations c
                SET "OwnerId" = COALESCE(
                    (SELECT m."UserId" FROM bd_chat_members m
                     WHERE m."ConversationId" = c."Id" AND m."UserId" = c."CreatorId"),
                    (SELECT m."UserId" FROM bd_chat_members m
                     WHERE m."ConversationId" = c."Id"
                     ORDER BY m."JoinedAt", m."Id" LIMIT 1))
                WHERE c."Kind" = 2;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_bd_chat_attachments_Unsent_CreationTime",
                table: "bd_chat_attachments",
                column: "CreationTime",
                filter: "\"MessageId\" IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_bd_chat_attachments_Unsent_CreationTime",
                table: "bd_chat_attachments");

            migrationBuilder.DropColumn(
                name: "OwnerId",
                table: "bd_chat_conversations");
        }
    }
}
