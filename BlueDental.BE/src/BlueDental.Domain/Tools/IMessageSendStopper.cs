using System;
using System.Threading;
using System.Threading.Tasks;

namespace BlueDental.Tools;

/// <summary>
/// Turns the waiting messages of a stopped or called-off send into
/// <see cref="MessageSendStatus.Stopped"/> (BA P2210, F-79).
///
/// One statement, guarded on <see cref="MessageSendStatus.Pending"/> in the
/// database itself: the send job may be saving one of those messages as sent
/// at that very moment, and a message that went must stay sent.
/// </summary>
public interface IMessageSendStopper
{
    /// <returns>How many messages will now never go.</returns>
    Task<int> StopWaitingAsync(Guid sendBatchId, CancellationToken cancellationToken = default);
}
