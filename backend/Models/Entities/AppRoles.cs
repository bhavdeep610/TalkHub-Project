using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;

namespace ChatApp.Models.Entities
{
    public class AppRoles 
    {

        public int RoleId { get; set; }

        public string RoleName { get; set; }

        public ICollection<User> Users { get; set; }

    }

}
