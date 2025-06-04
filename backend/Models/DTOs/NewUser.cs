using ChatApp.Models.Entities;

namespace ChatApp.Models.DTOs
{
    public class NewUser
    {

        public string UserName { get; set; }
        public string Email { get; set; }
        public string Token { get; set; }

        public int Id { get; set; }

        public AppRoles Approle { get; set; }
    }
}
