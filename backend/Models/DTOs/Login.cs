using System.ComponentModel.DataAnnotations;

namespace ChatApp.Models.DTOs
{
    public class Login
    {
        
        [Required]
        public string Username { get; set; }
        [Required]
        public string Password { get; set; }
    }
}

