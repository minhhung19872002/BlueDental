using System.Text;
using System.Xml.Linq;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent.Tests;

public sealed class EzdentBridgeTests : IDisposable
{
    private readonly TempFolder _temp = new();
    private readonly FakeStation _station = new();
    private readonly FakeLauncher _launcher = new();
    private readonly RecordingLog _log = new();
    private readonly AgentSettings _settings;

    public EzdentBridgeTests()
    {
        var bin = Path.Combine(_temp.Path, "Bin");
        _temp.Write(Path.Combine("Bin", AgentSettings.DefaultLoaderName), [0x4D, 0x5A]);
        _settings = new AgentSettings { EzdentBinFolder = bin };
        _station.PatientAnswer = StationResult<StationPatient>.Ok(
            new StationPatient("DH260052", "Trần", "Bình", new DateOnly(1990, 3, 7), PatientGender.Male));
    }

    public void Dispose() => _temp.Dispose();

    private EzdentBridge Bridge() => new(_settings, _station, _launcher, _log, Path.Combine(_temp.Path, "data"));

    [Fact]
    public async Task Writes_the_linkage_without_bom_and_starts_the_loader()
    {
        var bridge = Bridge();

        var outcome = await bridge.OpenAsync("DH260052", CancellationToken.None);

        outcome.ShouldBe(BridgeOutcome.Opened);
        var bytes = await File.ReadAllBytesAsync(bridge.LinkagePath);
        bytes.Take(3).ShouldNotBe(new byte[] { 0xEF, 0xBB, 0xBF });
        var patient = XDocument.Parse(Encoding.UTF8.GetString(bytes)).Root!.Element("Patient")!;
        patient.Element("ChartNumber")!.Value.ShouldBe("DH260052");
        patient.Element("LastName")!.Value.ShouldBe("Tran");

        var call = _launcher.Calls.Single();
        call.FileName.ShouldBe(bridge.LoaderPath);
        call.Arguments.ShouldBe($"\"{bridge.LinkagePath}\"");
        call.WorkingDirectory.ShouldBe(_settings.EzdentBinFolder);
        _log.Lines.ShouldAllBe(line => !line.Contains("Tran") && !line.Contains("Trần"));
    }

    [Fact]
    public async Task Linkage_goes_to_the_configured_folder()
    {
        _settings.LinkageFolder = Path.Combine(_temp.Path, "link");

        await Bridge().OpenAsync("DH260052", CancellationToken.None);

        File.Exists(Path.Combine(_temp.Path, "link", "linkage.xml")).ShouldBeTrue();
    }

    [Fact]
    public async Task Uses_an_own_template_when_set()
    {
        _settings.LinkageTemplatePath = _temp.Write("tpl.xml", "<P id=\"{ChartNumber}\" b=\"{BirthdayIso}\"/>"u8.ToArray());
        var bridge = Bridge();

        await bridge.OpenAsync("DH260052", CancellationToken.None);

        (await File.ReadAllTextAsync(bridge.LinkagePath)).ShouldBe("<P id=\"DH260052\" b=\"1990-03-07\"/>");
    }

    [Fact]
    public async Task Missing_loader_stops_before_asking_the_server()
    {
        _settings.LoaderName = "VTEzBridge.exe";

        (await Bridge().OpenAsync("DH260052", CancellationToken.None)).ShouldBe(BridgeOutcome.LoaderMissing);

        _station.LookedUp.ShouldBeEmpty();
        _launcher.Calls.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(StationFailure.NotFound, BridgeOutcome.PatientNotFound)]
    [InlineData(StationFailure.Unauthorized, BridgeOutcome.Unauthorized)]
    [InlineData(StationFailure.Unavailable, BridgeOutcome.ServerUnavailable)]
    public async Task Server_failures_never_launch(StationFailure failure, BridgeOutcome expected)
    {
        _station.PatientAnswer = new StationResult<StationPatient>(null, failure, "x");

        (await Bridge().OpenAsync("DH260052", CancellationToken.None)).ShouldBe(expected);

        _launcher.Calls.ShouldBeEmpty();
    }

    [Theory]
    [InlineData("..\\cmd.exe")]
    [InlineData("C:\\Windows\\System32\\cmd.exe")]
    [InlineData("loader.bat")]
    [InlineData("")]
    public void Loader_name_must_be_a_bare_exe(string name)
    {
        EzdentBridge.IsValidLoaderName(name).ShouldBeFalse();
    }

    [Fact]
    public async Task A_bad_code_is_refused_without_a_call()
    {
        (await Bridge().OpenAsync("DH1\" --x", CancellationToken.None)).ShouldBe(BridgeOutcome.PatientNotFound);

        _station.LookedUp.ShouldBeEmpty();
    }

    private sealed class FakeLauncher : IProcessLauncher
    {
        public List<(string FileName, string Arguments, string WorkingDirectory)> Calls { get; } = [];

        public void Start(string fileName, string arguments, string workingDirectory) =>
            Calls.Add((fileName, arguments, workingDirectory));
    }
}
