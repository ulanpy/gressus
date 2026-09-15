using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
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
            public string EmgTcpHost;
            public int EmgTcpPort;
            public int[] EmgSensorSlots;
        }

        // EMG is sent independently from the existing JSONL insole stream so
        // the high-rate samples cannot be rounded, coalesced, or blocked by a
        // web client.  Each frame is little-endian:
        //   GEMG | version:u8 | reserved:u8 | channelCount:u16 |
        //   frameSeq:u64 | sampleRateHz:u32 | samplesPerChannel:u32 |
        //   payloadFloats:u32 | sensorSlots[channelCount]:u16 |
        //   samples[channelCount * samplesPerChannel]:float32
        // Samples are channel-major, in the same order as sensorSlots.
        private sealed class EmgSink : IDisposable
        {
            private readonly string host;
            private readonly int port;
            private readonly int[] sensorSlots;
            private readonly BlockingCollection<byte[]> queue = new BlockingCollection<byte[]>(128);
            private readonly object connectionSync = new object();
            private readonly Thread writerThread;
            private TcpClient client;
            private NetworkStream stream;
            private DateTime lastWarningUtc = DateTime.MinValue;
            private bool disposed;

            public EmgSink(string host, int port, int[] sensorSlots)
            {
                this.host = host;
                this.port = port;
                this.sensorSlots = sensorSlots;
                writerThread = new Thread(WriteLoop);
                writerThread.IsBackground = true;
                writerThread.Name = "WaveX EMG TCP writer";
                writerThread.Start();
            }

            public void Enqueue(DataAvailableEventArgs e, ulong frameSequence, uint sampleRateHz)
            {
                if (disposed || e.EmgSamples == null) return;

                var samples = e.EmgSamples;
                var availableSensors = samples.GetLength(0);
                var samplesPerChannel = samples.GetLength(1);
                if (samplesPerChannel <= 0) return;
                for (var i = 0; i < sensorSlots.Length; i++)
                {
                    if (sensorSlots[i] > availableSensors)
                    {
                        Warn("EMG frame skipped: configured sensor slot " + sensorSlots[i] +
                             " is not present in EmgSamples (available slots=" + availableSensors + ").");
                        return;
                    }
                }

                byte[] frame;
                try
                {
                    frame = BuildFrame(samples, frameSequence, sampleRateHz, samplesPerChannel);
                }
                catch (Exception ex)
                {
                    Warn("EMG frame serialization failed: " + ex.Message);
                    return;
                }

                if (!queue.TryAdd(frame))
                {
                    Warn("EMG TCP queue is full; dropping one 50 ms frame. Check the Linux listener/network.");
                }
            }

            private byte[] BuildFrame(float[,] samples, ulong frameSequence, uint sampleRateHz, int samplesPerChannel)
            {
                var payloadFloats = checked(sensorSlots.Length * samplesPerChannel);
                using (var memory = new MemoryStream(28 + sensorSlots.Length * 2 + payloadFloats * 4))
                using (var writer = new BinaryWriter(memory))
                {
                    writer.Write(new byte[] { (byte)'G', (byte)'E', (byte)'M', (byte)'G' });
                    writer.Write((byte)1);
                    writer.Write((byte)0);
                    writer.Write((ushort)sensorSlots.Length);
                    writer.Write(frameSequence);
                    writer.Write(sampleRateHz);
                    writer.Write((uint)samplesPerChannel);
                    writer.Write((uint)payloadFloats);
                    for (var channel = 0; channel < sensorSlots.Length; channel++)
                        writer.Write((ushort)sensorSlots[channel]);
                    for (var channel = 0; channel < sensorSlots.Length; channel++)
                    {
                        var sensorIndex = sensorSlots[channel] - 1;
                        for (var sample = 0; sample < samplesPerChannel; sample++)
                            writer.Write(samples[sensorIndex, sample]);
                    }
                    writer.Flush();
                    return memory.ToArray();
                }
            }

            private void WriteLoop()
            {
                try
                {
                    foreach (var frame in queue.GetConsumingEnumerable())
                    {
                        while (!disposed)
                        {
                            try
                            {
                                EnsureConnected();
                                lock (connectionSync)
                                {
                                    if (stream == null) continue;
                                    stream.Write(frame, 0, frame.Length);
                                    stream.Flush();
                                }
                                break;
                            }
                            catch (Exception ex)
                            {
                                CloseConnection();
                                Warn("EMG TCP connection unavailable; retaining current frame for retry. Detail: " + ex.Message);
                                Thread.Sleep(250);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Warn("EMG TCP writer stopped: " + ex.Message);
                }
            }

            private void EnsureConnected()
            {
                lock (connectionSync)
                {
                    if (stream != null) return;
                    CloseConnectionLocked();
                    client = new TcpClient();
                    client.SendTimeout = 1000;
                    client.Connect(host, port);
                    stream = client.GetStream();
                    Console.Error.WriteLine(string.Format("EMG TCP connected to {0}:{1}.", host, port));
                }
            }

            private void CloseConnection()
            {
                lock (connectionSync) CloseConnectionLocked();
            }

            private void CloseConnectionLocked()
            {
                if (stream != null)
                {
                    try { stream.Dispose(); } catch { }
                    stream = null;
                }
                if (client != null)
                {
                    try { client.Close(); } catch { }
                    client = null;
                }
            }

            private void Warn(string message)
            {
                var now = DateTime.UtcNow;
                if ((now - lastWarningUtc).TotalSeconds < 15) return;
                lastWarningUtc = now;
                Console.Error.WriteLine(message);
            }

            public void Dispose()
            {
                if (disposed) return;
                disposed = true;
                queue.CompleteAdding();
                CloseConnection();
                if (writerThread.IsAlive) writerThread.Join(1000);
                queue.Dispose();
            }
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
                "Usage: wavex-bridge.exe [--rf-start] [--tcp HOST PORT | --tcp HOST:PORT] [--emg-tcp HOST PORT | --emg-tcp HOST:PORT --emg-sensors 1,2,...] [--mirror-stdout]");
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
                    if (!TryParseEndpoint(args, ref i, out options.TcpHost, out options.TcpPort, "--tcp")) return false;
                    continue;
                }
                if (string.Equals(arg, "--emg-tcp", StringComparison.OrdinalIgnoreCase))
                {
                    if (!TryParseEndpoint(args, ref i, out options.EmgTcpHost, out options.EmgTcpPort, "--emg-tcp")) return false;
                    continue;
                }
                if (string.Equals(arg, "--emg-sensors", StringComparison.OrdinalIgnoreCase))
                {
                    if (i + 1 >= args.Length || !TryParseSensorSlots(args[++i], out options.EmgSensorSlots))
                    {
                        Console.Error.WriteLine("Expected --emg-sensors 1,2,... (unique WaveX sensor slots 1..36).");
                        return false;
                    }
                    continue;
                }

                Console.Error.WriteLine(
                    "Unsupported option: " + arg +
                    ". Configuration/bootstrap options were removed to protect the loaded sensor configuration.");
                return false;
            }
            if ((options.EmgTcpHost == null) != (options.EmgSensorSlots == null))
            {
                Console.Error.WriteLine("EMG requires both --emg-tcp and --emg-sensors; it is disabled when both are omitted.");
                return false;
            }
            return true;
        }

        private static bool TryParseEndpoint(string[] args, ref int index, out string host, out int port, string optionName)
        {
            host = null;
            port = 0;
            if (index + 1 >= args.Length)
            {
                Console.Error.WriteLine("Missing value for " + optionName + ".");
                return false;
            }

            var value = args[++index].Trim();
            var separator = value.LastIndexOf(':');
            if (separator >= 0)
            {
                host = value.Substring(0, separator).Trim();
                if (!TryParsePort(value.Substring(separator + 1), out port))
                {
                    Console.Error.WriteLine("Invalid TCP port for " + optionName + ".");
                    return false;
                }
            }
            else
            {
                if (index + 1 >= args.Length)
                {
                    Console.Error.WriteLine("Expected " + optionName + " HOST PORT or " + optionName + " HOST:PORT.");
                    return false;
                }
                host = value;
                if (!TryParsePort(args[++index], out port))
                {
                    Console.Error.WriteLine("Invalid TCP port for " + optionName + ".");
                    return false;
                }
            }
            if (host.Length == 0)
            {
                Console.Error.WriteLine("TCP host must not be empty.");
                return false;
            }
            return true;
        }

        private static bool TryParseSensorSlots(string value, out int[] slots)
        {
            slots = null;
            var values = value.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            if (values.Length == 0 || values.Length > 36) return false;
            var parsed = new List<int>();
            foreach (var raw in values)
            {
                int slot;
                if (!int.TryParse(raw.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out slot) ||
                    slot < 1 || slot > 36 || parsed.Contains(slot)) return false;
                parsed.Add(slot);
            }
            slots = parsed.ToArray();
            return true;
        }

        private static uint GetConfiguredEmgSampleRateHz(ICaptureConfiguration configuration)
        {
            if (configuration == null) return 0;
            var protocol = configuration.EMG_AcqXType.ToString();
            var normalized = protocol.Replace("_", "").Replace(" ", "").ToLowerInvariant();
            if (normalized.Contains("4khz")) return 4000;
            if (normalized.Contains("2khz")) return 2000;
            if (normalized.Contains("1200") || normalized.Contains("1.2khz")) return 1200;
            Console.Error.WriteLine(
                "WARNING: cannot derive EMG sample rate from configured protocol '" + protocol + "'. " +
                "Frames will retain their samples but report sample_rate_hz=0.");
            return 0;
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
            EmgSink emgSink = null;
            EventHandler<DataAvailableEventArgs> handler = null;
            EventHandler<DeviceStateChangedEventArgs> deviceStateHandler = null;
            var sequence = 0L;
            var emgSequence = 0L;
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
                    Console.Error.WriteLine(
                        "Saved EMG acquisition protocol: " + captureConfiguration.EMG_AcqXType + ".");
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
                if (options.EmgTcpHost != null)
                {
                    emgSink = new EmgSink(options.EmgTcpHost, options.EmgTcpPort, options.EmgSensorSlots);
                    Console.Error.WriteLine(string.Format(
                        "EMG relay enabled: slots={0}, TCP={1}:{2}, binary frames preserve every sample.",
                        string.Join(",", options.EmgSensorSlots), options.EmgTcpHost, options.EmgTcpPort));
                }
                var emgSampleRateHz = emgSink == null
                    ? 0
                    : GetConfiguredEmgSampleRateHz(captureConfiguration);

                handler = delegate(object sender, DataAvailableEventArgs e)
                {
                    try
                    {
                        var now = DateTime.UtcNow;
                        double dtMs;
                        long currentSequence;
                        long currentEmgSequence;
                        lock (packetLock)
                        {
                            dtMs = lastPacketUtc == DateTime.MinValue
                                ? -1
                                : (now - lastPacketUtc).TotalMilliseconds;
                            lastPacketUtc = now;
                            currentSequence = ++sequence;
                            currentEmgSequence = ++emgSequence;
                        }
                        sink.Emit(BuildJson(e, currentSequence, now, dtMs));
                        if (emgSink != null)
                            emgSink.Enqueue(e, unchecked((ulong)currentEmgSequence), emgSampleRateHz);
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine("DataAvailable processing error: " + ex.Message);
                    }
                };
                daq.DataAvailable += handler;

                // The official WaveX example starts acquisition this way. No capture or
                // sensor configuration is built, applied, or saved by this relay.
                // Keep the existing 10 ms pressure cadence when EMG is off. EMG
                // requests WaveX's 50 ms delivery period. Preserve the exact
                // number of samples that the SDK actually delivers per frame;
                // do not infer it from host callback timing.
                daq.StartCapturing(emgSink == null
                    ? DataAvailableEventPeriod.ms_10
                    : DataAvailableEventPeriod.ms_50);
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
                    "Capturing started from the existing receiver configuration. JSONL: raw FSR batches." +
                    (emgSink == null ? " EMG relay disabled." : " EMG: binary 50 ms batches."));

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
                if (emgSink != null) emgSink.Dispose();
                if (daq is IDisposable) ((IDisposable)daq).Dispose();
                stopEvent.Dispose();
                Console.Error.WriteLine("Stopped.");
            }
        }
    }
}
