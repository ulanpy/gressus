using System;
using System.Globalization;
using System.IO;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using WaveX;
using WaveX.Common.Definitions;
using WaveX.Common.Interfaces;
using WaveX.Interfaces;

namespace WaveXBridge
{
    internal static class Program
    {
        private sealed class Options
        {
            public string TcpHost;
            public int TcpPort;
            public bool MirrorStdout;
            public bool RfStart;
        }

        private sealed class JsonSink : IDisposable
        {
            private readonly string host;
            private readonly int port;
            private readonly bool mirrorStdout;
            private readonly object sync = new object();
            private TcpClient client;
            private StreamWriter writer;
            private DateTime nextReconnectUtc = DateTime.MinValue;
            private DateTime lastWarningUtc = DateTime.MinValue;

            public JsonSink(string host, int port, bool mirrorStdout)
            {
                this.host = host;
                this.port = port;
                this.mirrorStdout = mirrorStdout;
            }

            public bool ConnectUntil(WaitHandle stopEvent)
            {
                if (host == null) return true;

                Console.Error.WriteLine(string.Format(
                    "Connecting to TCP {0}:{1} (Ctrl+C to cancel)...", host, port));
                var attempt = 0;
                while (!stopEvent.WaitOne(0))
                {
                    attempt++;
                    lock (sync)
                    {
                        if (ConnectOnceLocked())
                        {
                            Console.Error.WriteLine(string.Format(
                                "TCP connected to {0}:{1} (after {2} attempt(s)).",
                                host, port, attempt));
                            return true;
                        }
                    }

                    if (attempt == 1 || attempt % 10 == 0)
                        Console.Error.WriteLine(string.Format(
                            "TCP listener {0}:{1} is unavailable; retrying...", host, port));
                    if (stopEvent.WaitOne(5000)) break;
                }
                return false;
            }

            public void Emit(string line)
            {
                if (host != null)
                {
                    lock (sync)
                    {
                        var now = DateTime.UtcNow;
                        if (writer == null && now >= nextReconnectUtc)
                        {
                            if (ConnectOnceLocked())
                            {
                                nextReconnectUtc = DateTime.MinValue;
                                Console.Error.WriteLine(string.Format(
                                    "TCP reconnected to {0}:{1}.", host, port));
                            }
                            else
                            {
                                nextReconnectUtc = now.AddSeconds(5);
                                if ((now - lastWarningUtc).TotalSeconds >= 15)
                                {
                                    lastWarningUtc = now;
                                    Console.Error.WriteLine(
                                        "TCP listener is unavailable; capture continues and reconnect runs in background.");
                                }
                            }
                        }

                        if (writer != null)
                        {
                            try
                            {
                                writer.WriteLine(line);
                                writer.Flush();
                            }
                            catch (Exception ex)
                            {
                                CloseLocked();
                                nextReconnectUtc = now;
                                if ((now - lastWarningUtc).TotalSeconds >= 15)
                                {
                                    lastWarningUtc = now;
                                    Console.Error.WriteLine(
                                        "TCP connection dropped; capture continues. Detail: " + ex.Message);
                                }
                            }
                        }
                    }
                }

                if (host == null || mirrorStdout) Console.WriteLine(line);
            }

            private bool ConnectOnceLocked()
            {
                CloseLocked();
                try
                {
                    client = new TcpClient();
                    client.Connect(host, port);
                    writer = new StreamWriter(client.GetStream(), new UTF8Encoding(false));
                    writer.NewLine = "\n";
                    return true;
                }
                catch
                {
                    CloseLocked();
                    return false;
                }
            }

            private void CloseLocked()
            {
                if (writer != null)
                {
                    try { writer.Dispose(); } catch { }
                    writer = null;
                }
                if (client != null)
                {
                    try { client.Close(); } catch { }
                    client = null;
                }
            }

            public void Dispose()
            {
                lock (sync) CloseLocked();
            }
        }

        private static void PrintUsage()
        {
            Console.Error.WriteLine(
                "Usage: wavex-bridge.exe [--rf-start] [--tcp HOST PORT | --tcp HOST:PORT] [--mirror-stdout]");
            Console.Error.WriteLine(
                "Read-only relay: uses the configuration already loaded on the WaveX receiver/sensors.");
        }

        private static bool TryParseOptions(string[] args, out Options options)
        {
            options = new Options();
            for (var i = 0; i < args.Length; i++)
            {
                var arg = args[i];
                if (string.Equals(arg, "--help", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(arg, "-h", StringComparison.OrdinalIgnoreCase))
                {
                    PrintUsage();
                    return false;
                }
                if (string.Equals(arg, "--mirror-stdout", StringComparison.OrdinalIgnoreCase))
                {
                    options.MirrorStdout = true;
                    continue;
                }
                if (string.Equals(arg, "--rf-start", StringComparison.OrdinalIgnoreCase))
                {
                    options.RfStart = true;
                    continue;
                }
                if (string.Equals(arg, "--tcp", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 >= args.Length)
                    {
                        Console.Error.WriteLine("Missing value for --tcp.");
                        return false;
                    }

                    var value = args[++i].Trim();
                    var separator = value.LastIndexOf(':');
                    if (separator >= 0)
                    {
                        options.TcpHost = value.Substring(0, separator).Trim();
                        if (!TryParsePort(value.Substring(separator + 1), out options.TcpPort))
                        {
                            Console.Error.WriteLine("Invalid TCP port.");
                            return false;
                        }
                    }
                    else
                    {
                        if (i + 1 >= args.Length)
                        {
                            Console.Error.WriteLine("Expected --tcp HOST PORT or --tcp HOST:PORT.");
                            return false;
                        }
                        options.TcpHost = value;
                        if (!TryParsePort(args[++i], out options.TcpPort))
                        {
                            Console.Error.WriteLine("Invalid TCP port.");
                            return false;
                        }
                    }
                    if (options.TcpHost.Length == 0)
                    {
                        Console.Error.WriteLine("TCP host must not be empty.");
                        return false;
                    }
                    continue;
                }

                Console.Error.WriteLine(
                    "Unsupported option: " + arg +
                    ". Configuration/bootstrap options were removed to protect the loaded sensor configuration.");
                return false;
            }
            return true;
        }

        private static bool TryParsePort(string value, out int port)
        {
            return int.TryParse(value.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out port) &&
                   port > 0 && port <= 65535;
        }

        private static string BuildJson(DataAvailableEventArgs e, long sequence, DateTime now, double dtMs)
        {
            var sb = new StringBuilder(32768);
            sb.Append("{\"seq\":").Append(sequence.ToString(CultureInfo.InvariantCulture));
            sb.Append(",\"ts\":\"").Append(now.ToString("O", CultureInfo.InvariantCulture)).Append('"');
            sb.Append(",\"dtMs\":").Append(dtMs.ToString("0", CultureInfo.InvariantCulture));
            sb.Append(",\"rate\":").Append(e.DataTransferRate);
            sb.Append(",\"insoleScans\":").Append(e.InsoleScanNumber);
            sb.Append(",\"insoleImuScans\":").Append(e.InsoleImuScanNumber);

            sb.Append(",\"insoleAccMax\":[");
            if (e.InsoleAccelerometerSamples != null)
            {
                var insoleCount = e.InsoleAccelerometerSamples.GetLength(0);
                var axisCount = e.InsoleAccelerometerSamples.GetLength(1);
                var scanCount = e.InsoleAccelerometerSamples.GetLength(2);
                for (var insole = 0; insole < insoleCount; insole++)
                {
                    if (insole > 0) sb.Append(',');
                    var maximum = 0.0f;
                    for (var axis = 0; axis < axisCount; axis++)
                        for (var scan = 0; scan < scanCount; scan++)
                            maximum = Math.Max(
                                maximum,
                                Math.Abs(e.InsoleAccelerometerSamples[insole, axis, scan]));
                    sb.Append(maximum.ToString("R", CultureInfo.InvariantCulture));
                }
            }
            sb.Append(']');

            // InsoleStates is a battery/status word. Bit 4 is BLAF (battery-low
            // alarm), not an "online" flag. Treat an insole as online only when
            // this event actually contains pressure scans for its array slot.
            var sampleInsoles = e.InsoleSamples == null ? 0 : e.InsoleSamples.GetLength(0);
            var leftOnline = e.InsoleScanNumber > 0 && sampleInsoles > 0;
            var rightOnline = e.InsoleScanNumber > 0 && sampleInsoles > 1;
            sb.Append(",\"insoleStates\":[");
            if (e.InsoleStates != null)
            {
                for (var i = 0; i < e.InsoleStates.Length; i++)
                {
                    if (i > 0) sb.Append(',');
                    sb.Append(e.InsoleStates[i]);
                }
            }
            sb.Append(']');
            sb.Append(",\"L_online\":").Append(leftOnline ? "true" : "false");
            sb.Append(",\"R_online\":").Append(rightOnline ? "true" : "false");

            if (e.InsoleSamples == null || e.InsoleScanNumber <= 0)
            {
                sb.Append(",\"L\":null,\"R\":null}");
                return sb.ToString();
            }

            var insoles = e.InsoleSamples.GetLength(0);
            var channels = e.InsoleSamples.GetLength(1);
            var scans = e.InsoleSamples.GetLength(2);
            AppendInsoleSamples(sb, "L", e.InsoleSamples, insoles > 0 ? 0 : -1, channels, scans);
            AppendInsoleSamples(sb, "R", e.InsoleSamples, insoles > 1 ? 1 : -1, channels, scans);
            sb.Append('}');
            return sb.ToString();
        }

        private static void AppendInsoleSamples(
            StringBuilder sb, string name, float[,,] samples,
            int insole, int channels, int scans)
        {
            sb.Append(",\"").Append(name).Append("\":[");
            if (insole >= 0)
            {
                for (var scan = 0; scan < scans; scan++)
                {
                    if (scan > 0) sb.Append(',');
                    sb.Append('[');
                    for (var channel = 0; channel < channels; channel++)
                    {
                        if (channel > 0) sb.Append(',');
                        sb.Append(samples[insole, channel, scan].ToString("R", CultureInfo.InvariantCulture));
                    }
                    sb.Append(']');
                }
            }
            sb.Append(']');
        }

        private static IDaqSystem CreateDaqSystem()
        {
            // A Windows PnP arrival is the readiness signal. Retrying or waiting
            // inside an old WaveX process makes USB replug recovery slower and can
            // leave more than one SDK session fighting for the receiver. If this
            // construction fails, the supervisor owns the next clean attempt.
            return new DaqSystem(EmgHwGain.g_1000);
        }

        private static void WaitForState(
            IDaqSystem daq, DeviceState expected, int timeoutMilliseconds, string operation)
        {
            if (daq.State == expected) return;

            using (var stateReached = new ManualResetEvent(false))
            {
                EventHandler<DeviceStateChangedEventArgs> handler = delegate(object sender, DeviceStateChangedEventArgs e)
                {
                    if (e.State == expected) stateReached.Set();
                };
                daq.StateChanged += handler;
                try
                {
                    // Subscribe before the second state check so a transition
                    // between the initial check and registration cannot be lost.
                    if (daq.State != expected && !stateReached.WaitOne(timeoutMilliseconds))
                        throw new InvalidOperationException(string.Format(
                            "Timed out waiting for {0} after {1}; current state={2}.",
                            expected, operation, daq.State));
                }
                finally
                {
                    daq.StateChanged -= handler;
                }
            }
        }

        private static void PrintDeviceTopology(IDaqSystem daq)
        {
            var sb = new StringBuilder();
            sb.Append("Device topology: primary=[");
            for (var i = 0; i < daq.Type.Count; i++)
            {
                if (i > 0) sb.Append(", ");
                sb.Append(daq.Type[i]).Append(':');
                sb.Append(i < daq.DeviceInstalledSensors.Count
                    ? daq.DeviceInstalledSensors[i].ToString(CultureInfo.InvariantCulture)
                    : "?");
            }
            sb.Append("], extended=[");
            for (var i = 0; i < daq.ExtendedType.Count; i++)
            {
                if (i > 0) sb.Append(", ");
                sb.Append(daq.ExtendedType[i]).Append(':');
                sb.Append(i < daq.ExtendedDeviceInstalledSensors.Count
                    ? daq.ExtendedDeviceInstalledSensors[i].ToString(CultureInfo.InvariantCulture)
                    : "?");
            }
            sb.Append(']');
            Console.Error.WriteLine(sb.ToString());
        }

        private static void StartRfInsoles(
            IDaqSystem daq, ICaptureConfiguration configuration, WaitHandle stopEvent)
        {
            if (configuration.EnabledInsole == null || configuration.EnabledInsole.Length < 2)
                throw new InvalidOperationException("WaveX returned an invalid EnabledInsole array.");

            configuration.EnabledInsole[0] = true;
            configuration.EnabledInsole[1] = true;
            // The topology has no extended InsoleBT device; these RF insoles
            // therefore have to use the proprietary link of the primary WaveX.
            configuration.Insole_RfProtocol = InsoleRfProtocol.PROPRIETARY_PROTOCOL;
            // One RF channel per insole.  The RawAccGyro mode consumes two
            // channels per insole, which makes a two-insole setup appear as
            // four INS L/R tiles on the receiver and is not needed for FSR.
            configuration.Insole_RfAcqType = InsoleRfAcqType.Insole_100Hz;

            // This is the exact capture-configuration path used by the vendor
            // example: configure both enabled insoles, then apply the display.
            // Do not synthesize the earlier local OFF/ON command sequence.
            daq.ConfigureCapture(configuration);
            daq.UpdateDisplay();
            Console.Error.WriteLine(
                "RF start: ConfigureCapture + UpdateDisplay completed " +
                "for PROPRIETARY_PROTOCOL / Insole_100Hz.");

            var applied = daq.CaptureConfiguration();
            if (applied == null || applied.EnabledInsole == null ||
                applied.EnabledInsole.Length < 2 ||
                !applied.EnabledInsole[0] || !applied.EnabledInsole[1] ||
                applied.Insole_RfProtocol != InsoleRfProtocol.PROPRIETARY_PROTOCOL ||
                applied.Insole_RfAcqType != InsoleRfAcqType.Insole_100Hz)
                throw new InvalidOperationException(
                    "WaveX did not accept the requested RF insole capture configuration.");
            Console.Error.WriteLine(
                "RF start: configuration read-back confirmed (L=enabled, R=enabled, " +
                "PROPRIETARY_PROTOCOL, Insole_100Hz).");

            // For this receiver/sole firmware combination, a short Remote
            // Recording is the RF wake-up handshake. It is deliberately kept,
            // but state transitions are event-driven rather than sleep-polling.
            // The 1.5s hold is the required recording window, not a USB retry.
            var stopRequested = false;
            try
            {
                daq.StartSensorMemoryRecording();
                WaitForState(daq, DeviceState.RemoteRecording, 10000, "RF remote-recording start");
                if (stopEvent.WaitOne(1500)) return;
                daq.StopSensorMemoryRecording();
                stopRequested = true;
                WaitForState(daq, DeviceState.Idle, 10000, "RF remote-recording stop");
                Console.Error.WriteLine("RF start: wake-up memory recording completed; receiver is Idle.");
            }
            finally
            {
                // Ctrl+C is the only normal way this console process should end.
                // Do not leave the receiver in RemoteRecording on that path.
                if (!stopRequested && daq.State == DeviceState.RemoteRecording)
                {
                    try { daq.StopSensorMemoryRecording(); } catch { }
                }
            }

            // Mirrors the WaveX sensor-memory status query used by the working
            // EMG & Motion Tools workflow and completes RF slot discovery.
            daq.WX_GetSensorMemoryStatus(false);
            WaitForState(daq, DeviceState.Idle, 15000, "WaveX sensor-memory status probe");
            Console.Error.WriteLine("RF start: WaveX sensor-memory status probe completed.");
            Console.Error.WriteLine(
                "RF start: receiver memory handshake completed; continuing to live capture.");
        }

        [STAThread]
        private static int Main(string[] args)
        {
            CultureInfo.DefaultThreadCurrentCulture = CultureInfo.InvariantCulture;
            CultureInfo.DefaultThreadCurrentUICulture = CultureInfo.InvariantCulture;

            if (args.Length == 1 &&
                (string.Equals(args[0], "--help", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(args[0], "-h", StringComparison.OrdinalIgnoreCase)))
            {
                PrintUsage();
                return 0;
            }

            Options options;
            if (!TryParseOptions(args, out options)) return 1;

            Console.Error.WriteLine(options.RfStart
                ? "wavex-bridge RF-start relay starting..."
                : "wavex-bridge read-only relay starting...");
            Console.Error.WriteLine(options.RfStart
                ? "RF start will enable both insoles, select the vendor RF insole transport, and run the required RF wake-up memory recording."
                : "Configuration protection: no Configure*, Enable/Disable*, WX_*, UpdateDisplay or flash calls will be made.");
            Console.Error.WriteLine("Close EMG & Motion Tools and WaveX.Example before running the relay.");

            var stopEvent = new ManualResetEvent(false);
            Console.CancelKeyPress += delegate(object sender, ConsoleCancelEventArgs e)
            {
                e.Cancel = true;
                stopEvent.Set();
            };

            IDaqSystem daq = null;
            JsonSink sink = null;
            EventHandler<DataAvailableEventArgs> handler = null;
            EventHandler<DeviceStateChangedEventArgs> deviceStateHandler = null;
            var sequence = 0L;
            var lastPacketUtc = DateTime.MinValue;
            var packetLock = new object();

            try
            {
                daq = CreateDaqSystem();
                Console.Error.WriteLine("Initial state: " + daq.State);
                Console.Error.WriteLine("Initial error: " + daq.InitialError);

                if (stopEvent.WaitOne(0)) return 0;
                if (daq.State != DeviceState.Idle)
                {
                    Console.Error.WriteLine(
                        "Receiver is not Idle (state=" + daq.State + "). Exiting; the supervisor will make the next clean attempt.");
                    return 3;
                }

                Console.Error.WriteLine("Installed sensors: " + daq.InstalledSensors);
                PrintDeviceTopology(daq);
                var captureConfiguration = daq.CaptureConfiguration();
                if (captureConfiguration == null)
                {
                    Console.Error.WriteLine("Capture configuration: unavailable.");
                }
                else
                {
                    var leftEnabled = captureConfiguration.EnabledInsole != null &&
                                      captureConfiguration.EnabledInsole.Length > 0 &&
                                      captureConfiguration.EnabledInsole[0];
                    var rightEnabled = captureConfiguration.EnabledInsole != null &&
                                       captureConfiguration.EnabledInsole.Length > 1 &&
                                       captureConfiguration.EnabledInsole[1];
                    Console.Error.WriteLine(string.Format(
                        "Saved insole capture: L={0}, R={1}, RF protocol={2}, acquisition={3}.",
                        leftEnabled ? "enabled" : "disabled",
                        rightEnabled ? "enabled" : "disabled",
                        captureConfiguration.Insole_RfProtocol,
                        captureConfiguration.Insole_RfAcqType));
                    if (!leftEnabled && !rightEnabled)
                    {
                        Console.Error.WriteLine(
                            "WARNING: both insoles are disabled in CaptureConfiguration; " +
                            "WaveX will emit InsoleScanNumber=0 until they are enabled in EMG & Motion Tools.");
                    }
                }
                if (options.RfStart)
                {
                    if (captureConfiguration == null)
                        throw new InvalidOperationException(
                            "Cannot start RF insoles because CaptureConfiguration is unavailable.");
                    StartRfInsoles(daq, captureConfiguration, stopEvent);
                }
                sink = new JsonSink(options.TcpHost, options.TcpPort, options.MirrorStdout);
                if (!sink.ConnectUntil(stopEvent)) return 0;

                handler = delegate(object sender, DataAvailableEventArgs e)
                {
                    try
                    {
                        var now = DateTime.UtcNow;
                        double dtMs;
                        long currentSequence;
                        lock (packetLock)
                        {
                            dtMs = lastPacketUtc == DateTime.MinValue
                                ? -1
                                : (now - lastPacketUtc).TotalMilliseconds;
                            lastPacketUtc = now;
                            currentSequence = ++sequence;
                        }
                        sink.Emit(BuildJson(e, currentSequence, now, dtMs));
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine("DataAvailable processing error: " + ex.Message);
                    }
                };
                daq.DataAvailable += handler;

                // The official WaveX example starts acquisition this way. No capture or
                // sensor configuration is built, applied, or saved by this relay.
                daq.StartCapturing(DataAvailableEventPeriod.ms_10);
                if (options.RfStart)
                {
                    // EMG & Motion Tools keeps the DAQ in Capturing state and its
                    // Record button explicitly generates the internal start trigger.
                    // Without it DataAvailable events may contain no acquired scans.
                    daq.GenerateInternalStartTrigger();
                    Console.Error.WriteLine(
                        "RF start: internal start trigger generated (equivalent to Record).");
                }
                Console.Error.WriteLine(
                    "Capturing started from the existing receiver configuration. JSONL: raw FSR batches.");

                // A live USB detach/reattach creates a new WaveX device while
                // this process still owns the old DaqSystem handle.  Do not
                // keep that stale process alive: the Windows supervisor will
                // create a fresh bridge (and therefore run --rf-start again)
                // when 01aa returns.
                deviceStateHandler = delegate(object sender, DeviceStateChangedEventArgs e)
                {
                    if (e.State == DeviceState.NotConnected ||
                        e.State == DeviceState.InitializingError)
                    {
                        Console.Error.WriteLine(
                            "WaveX runtime device lost (state=" + e.State +
                            "); exiting so the supervisor can recreate the bridge.");
                        stopEvent.Set();
                    }
                };
                daq.StateChanged += deviceStateHandler;

                stopEvent.WaitOne();
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("Bridge failed:");
                Console.Error.WriteLine(ex.ToString());
                return 4;
            }
            finally
            {
                if (daq != null && handler != null)
                {
                    try { daq.DataAvailable -= handler; } catch { }
                }
                if (daq != null && deviceStateHandler != null)
                {
                    try { daq.StateChanged -= deviceStateHandler; } catch { }
                }
                if (daq != null)
                {
                    try
                    {
                        if (daq.State == DeviceState.Capturing) daq.StopCapturing();
                    }
                    catch { }
                }
                if (sink != null) sink.Dispose();
                if (daq is IDisposable) ((IDisposable)daq).Dispose();
                stopEvent.Dispose();
                Console.Error.WriteLine("Stopped.");
            }
        }
    }
}
