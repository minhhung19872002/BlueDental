using System.IO.Pipes;
using System.Security.Principal;

namespace BlueDental.XrayAgent;

/// <summary>
/// One agent per Windows user. A second start (the browser opening a
/// <c>bluedental-xray:</c> link) hands its link to the running one over a
/// named pipe only the same user can open, then exits.
/// </summary>
internal sealed class SingleInstance : IDisposable
{
    private const int MaxMessageChars = 1024;
    private static readonly string Name =
        "BlueDental.XrayAgent." + (WindowsIdentity.GetCurrent().User?.Value ?? Environment.UserName);

    private readonly Mutex _mutex;

    private SingleInstance(Mutex mutex, bool isFirst)
    {
        _mutex = mutex;
        IsFirst = isFirst;
    }

    public bool IsFirst { get; }

    public static SingleInstance Acquire()
    {
        var mutex = new Mutex(initiallyOwned: true, @"Local\" + Name, out var createdNew);
        return new SingleInstance(mutex, createdNew);
    }

    public static bool Forward(string message)
    {
        try
        {
            using var client = new NamedPipeClientStream(".", Name, PipeDirection.Out, PipeOptions.CurrentUserOnly);
            client.Connect(3000);
            using var writer = new StreamWriter(client);
            writer.Write(message.Length > MaxMessageChars ? message[..MaxMessageChars] : message);
            return true;
        }
        catch (Exception e) when (e is TimeoutException or IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    public async Task ListenAsync(Action<string> onMessage, CancellationToken ct)
    {
        var buffer = new char[MaxMessageChars];
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var server = new NamedPipeServerStream(
                    Name, PipeDirection.In, 1, PipeTransmissionMode.Byte,
                    PipeOptions.Asynchronous | PipeOptions.CurrentUserOnly);
                await server.WaitForConnectionAsync(ct);
                using var reader = new StreamReader(server);
                var read = await reader.ReadBlockAsync(buffer.AsMemory(), ct);
                onMessage(new string(buffer, 0, read));
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (IOException)
            {
                // A client that hung up half-way; wait for the next one.
            }
        }
    }

    public void Dispose()
    {
        if (IsFirst)
            _mutex.ReleaseMutex();
        _mutex.Dispose();
    }
}
