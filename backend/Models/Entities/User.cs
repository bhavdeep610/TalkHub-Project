using System.Data;
using ChatApp.Models.Entities;
using Microsoft.AspNetCore.Identity;

public class User
{

    public int Id { get; set; }

    public string UserName { get; set; }
    public string Email { get; set; }
    public string PasswordHash { get; set; }

    public int? RoleId { get; set; }
    public AppRoles Role { get; set; }

    public DateTime Created { get; set; }

    public ICollection<Message> SentMessages { get; set; }
    public ICollection<Message> ReceivedMessages { get; set; }
}
