using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ChatApp.Migrations
{
    /// <inheritdoc />
    public partial class newmigrations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterDatabase()
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "role",
                columns: table => new
                {
                    role_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    role_name = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role", x => x.role_id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "user",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    username = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    email = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    password_hash = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    roleId = table.Column<int>(type: "int", nullable: false),
                    created = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    AppRolesRoleId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_user", x => x.user_id);
                    table.ForeignKey(
                        name: "FK_user_role_AppRolesRoleId",
                        column: x => x.AppRolesRoleId,
                        principalTable: "role",
                        principalColumn: "role_id");
                    table.ForeignKey(
                        name: "FK_user_role_roleId",
                        column: x => x.roleId,
                        principalTable: "role",
                        principalColumn: "role_id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "message",
                columns: table => new
                {
                    message_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    sender_id = table.Column<int>(type: "int", nullable: false),
                    receiver_id = table.Column<int>(type: "int", nullable: false),
                    content = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    created = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_message", x => x.message_id);
                    table.ForeignKey(
                        name: "FK_message_user_receiver_id",
                        column: x => x.receiver_id,
                        principalTable: "user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_message_user_sender_id",
                        column: x => x.sender_id,
                        principalTable: "user",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.InsertData(
                table: "role",
                columns: new[] { "role_id", "role_name" },
                values: new object[,]
                {
                    { 1, "Admin" },
                    { 2, "User" }
                });

            migrationBuilder.InsertData(
                table: "user",
                columns: new[] { "user_id", "AppRolesRoleId", "created", "email", "password_hash", "roleId", "username" },
                values: new object[,]
                {
                    { 1, null, new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(6177), "admin@gmail.com", "admin123", 1, "admin" },
                    { 2, null, new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(6182), "receiver@gmail.com", "receiver123", 2, "receiver" },
                    { 3, null, new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(6184), "sender@gmail.com", "sender123", 2, "sender" }
                });

            migrationBuilder.InsertData(
                table: "message",
                columns: new[] { "message_id", "content", "created", "receiver_id", "sender_id" },
                values: new object[,]
                {
                    { 1, "Hello, how are you?", new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(7750), 2, 3 },
                    { 2, "I am fine. Thank you.", new DateTime(2025, 5, 23, 7, 34, 5, 255, DateTimeKind.Utc).AddTicks(7752), 2, 3 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_message_receiver_id",
                table: "message",
                column: "receiver_id");

            migrationBuilder.CreateIndex(
                name: "IX_message_sender_id",
                table: "message",
                column: "sender_id");

            migrationBuilder.CreateIndex(
                name: "IX_user_AppRolesRoleId",
                table: "user",
                column: "AppRolesRoleId");

            migrationBuilder.CreateIndex(
                name: "IX_user_roleId",
                table: "user",
                column: "roleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "message");

            migrationBuilder.DropTable(
                name: "user");

            migrationBuilder.DropTable(
                name: "role");
        }
    }
}
