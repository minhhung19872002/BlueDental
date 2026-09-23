namespace BlueDental.Queue;

public enum QueueTicketStatus : short
{
    Waiting = 1,
    Called = 2,
    Serving = 3,
    Completed = 4,
    Skipped = 5,
    Expired = 6,
}

public enum QueueTicketPriority : short
{
    Normal = 0,
    Urgent = 1,
}
