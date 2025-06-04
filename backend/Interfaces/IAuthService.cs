using ChatApp.Models.DTOs;

namespace ChatApp.Interfaces
{
    

        public interface IAuthService
        {
            Task<string> RegisterAsync(Register registerDto);
            Task<string> LoginAsync(Login loginDto);



        }



}


