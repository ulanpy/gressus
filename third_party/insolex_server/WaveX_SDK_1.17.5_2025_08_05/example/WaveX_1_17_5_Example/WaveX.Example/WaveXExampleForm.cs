using System;
using System.Drawing;
using System.Windows.Forms;
using SimpleViewer;
using WaveX.Common.Definitions;
using WaveX.Interfaces;

namespace WaveX.Example;

public partial class WaveXExampleForm : Form
{
    internal readonly IDaqSystem _daqSystem;
    private readonly SimpleTChart _emgTChart;
    private readonly SimpleTChart _accTChart;
    private readonly SimpleTChart _gyroTChart;
    private readonly SimpleTChart _magTChart;

    private int _installedSensors;

    private int _emgSensor;
    private int _imuSensor;

    private bool _isFirstIdleState = true;
    private Label[] _sensorNumber;
    private ProgressBar[] _sensorBatteryLevel;

    private CaptureAndSensorsConfigurationForm _captureAndSensorsConfigurationForm;

    public WaveXExampleForm()
    {
        InitializeComponent();
        InitializeUserControls();
        // Create the viewers
        _emgTChart = new SimpleTChart(EmgTChartPanel);
        _accTChart = new SimpleTChart(AccTChartPanel);
        _gyroTChart = new SimpleTChart(GyroTChartPanel);
        _magTChart = new SimpleTChart(MagTChartPanel);
        _emgSensor = 0;
        _imuSensor = 0;

        try
        {
            // Create the DaqSystem device
            _daqSystem = new DaqSystem();
            _daqSystem.StateChanged += Device_StateChanged;
            _daqSystem.DataAvailable += Capture_DataAvailable;

            // Enable sensor 1 
            //_daqSystem.DisableSensor(1);
            _daqSystem.EnableSensor(1);

            _installedSensors = _daqSystem.InstalledSensors;
                
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
        finally
        {
            DisplayDeviceState(_daqSystem.State);
            DisplayErrorOccurred(_daqSystem.InitialError);
        }
    }

    private void InitializeUserControls()
    {
        try
        {
            const int startY = 22;
            const int deltaY = 20;
            // Create sensor status controls
            _sensorNumber = new Label[WaveXConstant.MAX_DEVICE_SENSORS_NUM];
            _sensorBatteryLevel = new ProgressBar[WaveXConstant.MAX_DEVICE_SENSORS_NUM];
            for (var i = 0; i < WaveXConstant.MAX_DEVICE_SENSORS_NUM; i++)
            {
                _sensorNumber[i] = new Label
                {
                    Parent = SensorStateGroupBox,
                    Visible = false,
                    AutoSize = false,
                    Size = new Size(19, 13),
                    Location = new Point(6, startY + i * deltaY),
                    Text = (i + 1).ToString(),
                    Enabled = true
                };

                _sensorBatteryLevel[i] = new ProgressBar
                {
                    Parent = SensorStateGroupBox,
                    Visible = false,
                    AutoSize = false,
                    Size = new Size(34, 10),
                    Location = new Point(31, startY + 2 + i * deltaY),
                    Text = (i + 1).ToString(),
                    Maximum = 15,
                    Minimum = 0,
                    Step = 1,
                    ForeColor = Color.LimeGreen,
                    Value = 0,
                    Enabled = true
                };
            }
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void ShowUserControls()
    {
        try
        {
            for (var i = 0; i < WaveXConstant.MAX_DEVICE_SENSORS_NUM; i++)
            {
                _sensorNumber[i].Visible = true;
                _sensorBatteryLevel[i].Visible = true;
            }
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void ResetUserControls()
    {
        Fw2VersionTextBox.Text = "";
        Hw2VersionTextBox.Text = "";
        DataTransferRateTextBox.Text = "";
        DeviceErrorTextBox.Text = "";

        try
        {
            for (var i = 0; i < _installedSensors; i++)
            {
                _sensorNumber[i].Visible = false;
                _sensorBatteryLevel[i].Visible = false;
            }
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    void Device_StateChanged(object sender, DeviceStateChangedEventArgs e)
    {
        if (InvokeRequired)
        {
            MethodInvoker invoke = () => Device_StateChanged(sender, e);
            Invoke(invoke);
            return;
        }
        DisplayDeviceState(e.State);

        if(_captureAndSensorsConfigurationForm != null)
            _captureAndSensorsConfigurationForm.Device_StateChanged(e.State);
    }

    protected string DisplayDeviceState(DeviceState newState)
    {
        try
        {
            switch (newState)
            {
                case DeviceState.Idle:
                    //Capture controls
                    StartCaptureButton.Enabled = true;
                    StopCaptureButton.Enabled = false;
                    CaptureGroupBox.Enabled = true;
                    //Capture and Sensors configuration controls
                    TriggerConfigurationGroupBox.Enabled = true;
                    ConfigGroupBox.Enabled = true;
                    //Device1 controls
                    DeviceGroupBox.Enabled = true;
                   
                    if (_isFirstIdleState)
                    {
                        GetInstalledSensors();
                        GetHardwareVersion();
                        GetFirmwareVersion();
                        _isFirstIdleState = false;
                        _installedSensors = _daqSystem.InstalledSensors;
                        ShowUserControls();
                    }

                    break;
                case DeviceState.Capturing:
                    //Capture controls
                    StartCaptureButton.Enabled = false;
                    StopCaptureButton.Enabled = true;
                    CaptureGroupBox.Enabled = true;
                    //Capture configuration controls
                    TriggerConfigurationGroupBox.Enabled = false;
                    ConfigGroupBox.Enabled = false;
                    //Device1 controls
                    DeviceGroupBox.Enabled = false;
                  
                    break;
                case DeviceState.NotConnected:
                    //Capture controls
                    CaptureGroupBox.Enabled = false;
                    //Capture configuration controls
                    ConfigGroupBox.Enabled = false;
                    TriggerConfigurationGroupBox.Enabled = false;
                    //Device1 controls
                    DeviceGroupBox.Enabled = false;
                   
                    _isFirstIdleState = true;
                    //Reset the controls
                    ResetUserControls();
                    break;
                case DeviceState.InitializingError:
                    //Capture controls
                    CaptureGroupBox.Enabled = false;
                    //Capture configuration controls
                    TriggerConfigurationGroupBox.Enabled = false;
                    ConfigGroupBox.Enabled = false;
                    //Device1 controls
                    DeviceGroupBox.Enabled = true;
                 
                    //Get hardware and firmware versions
                    GetHardwareVersion();
                    GetFirmwareVersion();
                    break;
                case DeviceState.Initializing:
                    //Capture controls
                    CaptureGroupBox.Enabled = false;
                    //Capture configuration controls
                    TriggerConfigurationGroupBox.Enabled = false;
                    ConfigGroupBox.Enabled = false;
                    //Device1 controls
                    DeviceGroupBox.Enabled = false;
                  
                    break;
                case DeviceState.ReadingSensorMemory:
                    //Capture controls
                    CaptureGroupBox.Enabled = false;
                    //Capture configuration controls
                    TriggerConfigurationGroupBox.Enabled = false;
                    ConfigGroupBox.Enabled = false;
                    //Device1 controls
                    DeviceGroupBox.Enabled = false;
                    break;
                case DeviceState.RemoteRecording:
                    //Capture controls
                    CaptureGroupBox.Enabled = false;
                    //Capture configuration controls
                    TriggerConfigurationGroupBox.Enabled = false;
                    ConfigGroupBox.Enabled = false;
                    //Device1 controls
                    DeviceGroupBox.Enabled = false;
                    break;
            }
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
        return DeviceStatusTextBox.Text = newState.ToString();
    }

    private void DisplayErrorOccurred(DeviceError error)
    {
        // Display the error code
        DeviceErrorTextBox.Text = error.ToString();
    }

    private void GetFirmwareVersion()
    {
        try
        {
            var version = _daqSystem.FirmwareVersion;
            // Clear Fw version controls
            Fw1VersionTextBox.Text = "";
            Fw2VersionTextBox.Text = "";
            // Get device Fw version
            var i = 0;
            foreach (var v in version)
            {
                if (i == 0) Fw1VersionTextBox.Text = v.Major + "." + v.Middle + "." + v.Minor;
                if (i == 1) Fw2VersionTextBox.Text = v.Major + "." + v.Middle + "." + v.Minor;
                i++;
            }
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    void Capture_DataAvailable(object sender, DataAvailableEventArgs e)
    {
        if (InvokeRequired)
        {
            MethodInvoker invoke = () => Capture_DataAvailable(sender, e);
            Invoke(invoke);
            return;
        }
        // If enabled, plot the acquired samples 
        if (PlotEnabledCheckBox.Checked)
        {
            // Create samples buffers
            var emgSamples = new float[e.ScanNumber];
            var accXSamples = new float[e.ScanNumber];
            var accYSamples = new float[e.ScanNumber];
            var accZSamples = new float[e.ScanNumber];
            var gyroXSamples = new float[e.ScanNumber];
            var gyroYSamples = new float[e.ScanNumber];
            var gyroZSamples = new float[e.ScanNumber];
            var magXSamples = new float[e.ScanNumber];
            var magYSamples = new float[e.ScanNumber];
            var magZSamples = new float[e.ScanNumber];

            // Copy and plot the acquired samples
            for (var i = 0; i < e.ScanNumber; i++)
            {
                emgSamples[i] = e.EmgSamples[_emgSensor, i];
                accXSamples[i] = e.AccelerometerSamples[_imuSensor, 0, i];
                accYSamples[i] = e.AccelerometerSamples[_imuSensor, 1, i];
                accZSamples[i] = e.AccelerometerSamples[_imuSensor, 2, i];

                gyroXSamples[i] = e.GyroscopeSamples[_imuSensor, 0, i];
                gyroYSamples[i] = e.GyroscopeSamples[_imuSensor, 1, i];
                gyroZSamples[i] = e.GyroscopeSamples[_imuSensor, 2, i];

                magXSamples[i] = e.MagnetometerSamples[_imuSensor, 0, i];
                magYSamples[i] = e.MagnetometerSamples[_imuSensor, 1, i];
                magZSamples[i] = e.MagnetometerSamples[_imuSensor, 2, i];
            }
            _emgTChart.DrawTChart(e.ScanNumber, emgSamples, null, null);
            _accTChart.DrawTChart(e.ScanNumber, accXSamples, accYSamples, accZSamples);
            _gyroTChart.DrawTChart(e.ScanNumber, gyroXSamples, gyroYSamples, gyroZSamples);
            _magTChart.DrawTChart(e.ScanNumber, magXSamples, magYSamples, magZSamples);
        }

        byte state;
        // Show the sensor states (battery levels)
        for (var c = 0; c < WaveXConstant.MAX_DEVICE_SENSORS_NUM; c++)
        {
            state = (byte)(e.SensorStates[c] & 0x0F);
            _sensorBatteryLevel[c].Value = state;
        }

        // Show data acquisition rate (only for debug)
        DataTransferRateTextBox.Text = e.DataTransferRate.ToString();

        // Show start/stop trigger status
        if (e.StartTriggerDetected)
        {
            StartTriggerDetectedCheckBox.Checked = true;
            StartTriggerScanTextBox.Text = e.StartTriggerScan.ToString();
        }
        if (e.StopTriggerDetected)
        {
            StopTriggerDetectedCheckBox.Checked = true;
            StopTriggerScanTextBox.Text = e.StopTriggerScan.ToString();
        }
    }

    private void GetHardwareVersion()
    {
        try
        {
            var version = _daqSystem.HardwareVersion;
            // Clear Hw version controls
            Hw1VersionTextBox.Text = "";
            Hw2VersionTextBox.Text = "";
            // Get device Hw version
            var i = 0;
            foreach (var v in version)
            {
                if (i == 0) Hw1VersionTextBox.Text = v.Major + "." + v.Middle + "." + v.Minor;
                if (i == 1) Hw2VersionTextBox.Text = v.Major + "." + v.Middle + "." + v.Minor;
                i++;
            }
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void DaqToolForm_FormClosing(object sender, FormClosingEventArgs e)
    {
        _daqSystem.StateChanged -= Device_StateChanged;
        _daqSystem.DataAvailable -= Capture_DataAvailable;
        Application.DoEvents();
        _daqSystem.Dispose();
    }

    private void GetInstalledSensors()
    {
        try
        {
            // Get the installed sensors number
            InstalledSensorsTextBox.Text = _daqSystem.InstalledSensors.ToString();
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void GetInstalledSensorsButton_Click(object sender, EventArgs e)
    {
        GetInstalledSensors();
    }

    private void EmgSensorSelectorNumericUpDown_ValueChanged(object sender, EventArgs e)
    {
        _emgSensor = (int)EmgSensorSelectorNumericUpDown.Value - 1;
    }

    private void ImuSensorSelectorNumericUpDown_ValueChanged(object sender, EventArgs e)
    {
        _imuSensor = (int)ImuSensorSelectorNumericUpDown.Value - 1;
    }

    private void StartCaptureButton_Click(object sender, EventArgs e)
    {
        try
        {
            // Configure capture
            CaptureConfiguration captureConfiguration = new CaptureConfiguration();
            captureConfiguration.EMG_AcqPType = EmgAcqPType.Emg_2kHz_Acc_142Hz;
            captureConfiguration.EMG_AcqXType = EmgAcqXType.Emg_2kHz;
            captureConfiguration.IMU_AcqXType = ImuAcqXType.RawAccGyroMagData_400Hz;
            captureConfiguration.IMU_AcqPType = ImuAcqPType.Mixed6xData_142Hz;
            captureConfiguration.EMG_IMU_AcqXType = EmgImuAcqXType.Emg_2kHz_RawAccGyroMagData_100Hz;
            captureConfiguration.Insole_BtAcqType = InsoleBtAcqType.Insole_100Hz_RawAccGyroData_500Hz;
            captureConfiguration.Insole_RfAcqType = InsoleRfAcqType.Insole_100Hz_RawAccGyroData_500Hz;
#if HDS_EMG_ENABLED
            captureConfiguration.HDsEmg_AcqType = HDsEmgAcqType.HDsEmg_2kHz;
#endif
            captureConfiguration.Analog_AcqType = AnalogAcqType.Analog_2kHz;
            captureConfiguration.ExternalTriggerEnabled = TriggerEnabledCheckBox.Checked;
            captureConfiguration.ExternalTriggerActiveLevel = (int)TriggerActiveLevelNumericUpDown.Value;
            captureConfiguration.ExternalEventActiveLevel = 1;
            captureConfiguration.Insole_RfProtocol = InsoleRfProtocol.PROPRIETARY_PROTOCOL;
            captureConfiguration.Insole_AccelerometerFullScale = AccelerometerFullScale.g_2;
            captureConfiguration.Insole_GyroscopeFullScale = GyroscopeFullScale.dps_1000;
            captureConfiguration.Analog_TriggerMode = AnalogTriggerMode.DigitalTrigger;
            captureConfiguration.Analog_VoltageFullScale = VoltageFullScale.volt_10;
            captureConfiguration.Analog_ChannelDelay_ms = 0;
            for (var i = 0; i < WaveXConstant.MAX_INSOLES_NUM; i++)
                captureConfiguration.EnabledInsole[i] = false;
            for (var i = 0; i < WaveXConstant.MAX_ANALOG_CHANNELS_NUM; i++)
                captureConfiguration.EnabledAnalogChannel[i] = false;
#if HDS_EMG_ENABLED
            for (var i = 0; i < WaveXConstant.MAX_HDsEMGs_NUM; i++)
                captureConfiguration.EnabledHDsEmg[i] = false;
#endif
            // Send configuration to the device
            _daqSystem.ConfigureCapture(captureConfiguration);

            SensorConfiguration sensorConfiguration = new SensorConfiguration();
            // Configure sensors 1
            // Set sensor model
            sensorConfiguration.SensorModel = SensorModel.Undefined;
            // Set sensor mode
            sensorConfiguration.SensorMode = SensorMode.EMG_SENSOR;
            // Set accelerometer full scale
            sensorConfiguration.AccelerometerFullScale = AccelerometerFullScale.g_8;
            // Set gyroscope full scale
            sensorConfiguration.GyroscopeFullScale = GyroscopeFullScale.dps_2000;
            // Send configuration to the sensors
            _daqSystem.ConfigureSensor(sensorConfiguration, 1);

            // Configure sensors 3
            // Set sensor model
            sensorConfiguration.SensorModel = SensorModel.Undefined;
            // Set sensor mode
            sensorConfiguration.SensorMode = SensorMode.EMG_SENSOR;
            // Set accelerometer full scale
            sensorConfiguration.AccelerometerFullScale = AccelerometerFullScale.g_8;
            // Set gyroscope full scale
            sensorConfiguration.GyroscopeFullScale = GyroscopeFullScale.dps_2000;
            // Send configuration to the sensors
            _daqSystem.ConfigureSensor(sensorConfiguration, 3);

            DeviceErrorTextBox.Text = "";
            StartTriggerDetectedCheckBox.Checked = false;
            StartTriggerScanTextBox.Text = "";
            StopTriggerDetectedCheckBox.Checked = false;
            StopTriggerScanTextBox.Text = "";

            // Set the charts full-scale values
            _emgTChart.ConfigureTChart(4000, -4000, "[µV]");
            _accTChart.ConfigureTChart(16, -16, "[g]");
            _gyroTChart.ConfigureTChart(2000, -2000, "[D/s]");
            _magTChart.ConfigureTChart(400, -400, "µT");

            // Get the capture sample rate
            CaptureDataRateTextBox.Text = _daqSystem.CaptureSampleRate.ToString();

            // Start data capturing
            _daqSystem.StartCapturing(DataAvailableEventPeriod.ms_50);
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void StopCaptureButton_Click(object sender, EventArgs e)
    {
        try
        {
            // Stop data capturing
            _daqSystem.StopCapturing();
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void GenerateStartTriggerButton_Click(object sender, EventArgs e)
    {
        try
        {
            // Generate internal start trigger
            _daqSystem.GenerateInternalStartTrigger();
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void GenerateStopTriggerButton_Click(object sender, EventArgs e)
    {
        try
        {
            // Generate internal stop trigger
            _daqSystem.GenerateInternalStopTrigger();
        }
        catch (Exception exception)
        {
            MessageBox.Show(exception.Message);
        }
    }

    private void GetFwVersionButton_Click(object sender, EventArgs e)
    {
        // Get firmware version fron device
        GetFirmwareVersion();
    }

    private void GetHwVersionButton_Click(object sender, EventArgs e)
    {
        // Get hardware version fron device
        GetHardwareVersion();
    }

    private void TriggerEnabledCheckBox_CheckedChanged(object sender, EventArgs e)
    {
        // If the external trigger is enabled the internal trigger must be disabled
        GenerateStartTriggerButton.Enabled = !TriggerEnabledCheckBox.Checked;
        GenerateStopTriggerButton.Enabled = !TriggerEnabledCheckBox.Checked;
    }

    private void ConfigureCaptureButton_Click(object sender, EventArgs e)
    {
        _captureAndSensorsConfigurationForm = new CaptureAndSensorsConfigurationForm(_daqSystem);
        _captureAndSensorsConfigurationForm.Show();
    }

}