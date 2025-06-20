namespace ChatApp.Models.DTOs
{
    public class MessageDto
    {
        public int SenderID { get; set; }
        public int ReceiverID { get; set; }
        public string Content { get; set; } = string.Empty;
    }

}
