using System;
using System.Windows.Forms;
using WaveX.Common.Definitions;
using WaveX.Common.Interfaces;
using WaveX.Interfaces;

namespace WaveX.Example;

public partial class CaptureAndSensorsConfigurationForm : Form
{
    private readonly IDaqSystem _daqSystem;

    public CaptureAndSensorsConfigurationForm(IDaqSystem daqSystem)
    {
        _daqSystem = daqSystem;
        InitializeComponent();

        // Set Acq Type Combobox
        EmgAcqTypeComboBox.Items.AddRange(Enum.GetNames(typeof(EmgAcqXType)));
        ImuAcqTypeComboBox.Items.AddRange(Enum.GetNames(typeof(ImuAcqXType)));
        ImuEmgAcqTypeComboBox.Items.AddRange(Enum.GetNames(typeof(EmgImuAcqXType)));
        InsolesAcqTypeComboBox.Items.AddRange(Enum.GetNames(typeof(InsoleRfAcqType)));


        //Set the transmission protocol for the Insoles BT InsoleX... RF InsoleX...
        InsoleProtocolComboBox.Items.AddRange(Enum.GetNames(typeof(InsoleRfProtocol)));

        SensorModeComboBox.Items.AddRange(Enum.GetNames(typeof(SensorMode)));
        AccFullScaleComboBox.Items.AddRange(Enum.GetNames(typeof(AccelerometerFullScale)));
        GyroFullScaleComboBox.Items.AddRange(Enum.GetNames(typeof(GyroscopeFullScale)));
        InsolesAccFullScaleComboBox.Items.AddRange(Enum.GetNames(typeof(AccelerometerFullScale)));
        InsolesGyroFullScaleComboBox.Items.AddRange(Enum.GetNames(typeof(GyroscopeFullScale)));

        InsoleProtocolComboBox.SelectedIndex = InsoleProtocolComboBox.FindStringExact(InsoleRfProtocol.PROPRIETARY_PROTOCOL.ToString());
        SensorModeComboBox.SelectedIndex = SensorModeComboBox.FindStringExact(SensorMode.EMG_INERTIAL_SENSOR.ToString());
        AccFullScaleComboBox.SelectedIndex = AccFullScaleComboBox.FindStringExact(AccelerometerFullScale.g_8.ToString());
        GyroFullScaleComboBox.SelectedIndex = GyroFullScaleComboBox.FindStringExact(GyroscopeFullScale.dps_1000.ToString());
        InsolesAccFullScaleComboBox.SelectedIndex = AccFullScaleComboBox.FindStringExact(AccelerometerFullScale.g_8.ToString());
        InsolesGyroFullScaleComboBox.SelectedIndex = GyroFullScaleComboBox.FindStringExact(GyroscopeFullScale.dps_1000.ToString());


        if ((_daqSystem.State == DeviceState.Idle) )
        {
            // Get installed sensor number and capture/sensors configuration 
            GetCaptureConfiguration();
            GetInstalledSensorNumber();
        }
    }

    public void Device_StateChanged(DeviceState state)
    {
        if (state == DeviceState.NotConnected)
        {
            Close();
        }
    }

    private void buttonConfigureCapture_Click(object sender, EventArgs e)
    {
        bool[] enabledInsoles = new bool[WaveXConstant.MAX_INSOLES_NUM];
        enabledInsoles[0] = LeftInsoleEnabledCheckBox.Checked;
        enabledInsoles[1] = RightInsoleEnabledCheckBox.Checked;

        try
        {
            // Configure capture
            ICaptureConfiguration configuration = new CaptureConfiguration
            {

                // Trigger
                ExternalTriggerEnabled = checkBoxTriggerEnabled.Checked,
                ExternalTriggerActiveLevel = (int)numericUpDownCapturingEnabledTriggerLevel.Value,

                //Configure Acquisition Type
                EMG_AcqXType = ((EmgAcqXType)Enum.Parse(typeof(EmgAcqXType), EmgAcqTypeComboBox.SelectedIndex.ToString())),
                IMU_AcqXType = ((ImuAcqXType)Enum.Parse(typeof(ImuAcqXType), ImuAcqTypeComboBox.SelectedIndex.ToString())),
                EMG_IMU_AcqXType = ((EmgImuAcqXType)Enum.Parse(typeof(EmgImuAcqXType), ImuEmgAcqTypeComboBox.SelectedIndex.ToString())),

                //Configure Insoles Transmission Protocol
                Insole_RfProtocol = (InsoleRfProtocol)Enum.Parse(typeof(InsoleRfProtocol), InsoleProtocolComboBox.SelectedIndex.ToString()),

                //Insoles Acquisition Type
                Insole_RfAcqType = (InsoleRfAcqType)Enum.Parse(typeof(InsoleRfAcqType), InsolesAcqTypeComboBox.SelectedIndex.ToString()),
                Insole_AccelerometerFullScale = (AccelerometerFullScale)Enum.Parse(typeof(AccelerometerFullScale), InsolesAccFullScaleComboBox.SelectedIndex.ToString()),
                Insole_GyroscopeFullScale = (GyroscopeFullScale)Enum.Parse(typeof(GyroscopeFullScale), InsolesGyroFullScaleComboBox.SelectedIndex.ToString()),

                EnabledInsole = enabledInsoles,

                //Variables concerning analog input usb devices from National Instruments
                Analog_AcqType = AnalogAcqType.Analog_2kHz,
                Analog_TriggerMode = AnalogTriggerMode.NoTrigger,
                Analog_VoltageFullScale = VoltageFullScale.volt_10,
                Analog_ChannelDelay_ms = 0, //Speifies the delay between the start of the acquisition from when the hardware trigger was recieved by the device in ms
            };

            // Configure Daq system
            _daqSystem.ConfigureCapture(configuration);
            _daqSystem.UpdateDisplay();
        }
        catch (Exception exception)
        {
            // Show exception message
            MessageBox.Show(exception.Message);
        }
    }


    private void GetCaptureConfiguration()
    {
        try
        {
            // Get capture configuration
            var configuration = _daqSystem.CaptureConfiguration();
            if (configuration != null)
            {
                // Trigger
                checkBoxTriggerEnabled.Checked = configuration.ExternalTriggerEnabled;
                numericUpDownCapturingEnabledTriggerLevel.Value = configuration.ExternalTriggerActiveLevel;

                // Acquisition type
                EmgAcqTypeComboBox.SelectedIndex = EmgAcqTypeComboBox.FindStringExact(configuration.EMG_AcqXType.ToString());
                ImuAcqTypeComboBox.SelectedIndex = ImuAcqTypeComboBox.FindStringExact(configuration.IMU_AcqXType.ToString());
                ImuEmgAcqTypeComboBox.SelectedIndex = ImuEmgAcqTypeComboBox.FindStringExact(configuration.EMG_IMU_AcqXType.ToString());
                InsolesAcqTypeComboBox.SelectedIndex = InsolesAcqTypeComboBox.FindStringExact(configuration.Insole_RfAcqType.ToString());

            }
        }
        catch (Exception exception)
        {
            // Show exception message
            MessageBox.Show(exception.Message);
        }
    }

    private void GetInstalledSensorNumber()
    {
        try
        {
            // Get installed sensors number
            numericUpDownSensorSelection.Maximum = _daqSystem.InstalledSensors;
        }
        catch (Exception exception)
        {
            // Show exception message
            MessageBox.Show(exception.Message);
        }
    }

    private void SensorConfigButton_Click(object sender, EventArgs e)
    {
        var sensorNum = (int) numericUpDownSensorSelection.Value;
        _daqSystem.EnableSensor(sensorNum);
        var sensorConfig = new SensorConfiguration()
        {
            SensorModel = SensorModel.Mini_EmgImu,
            SensorMode = ((SensorMode)Enum.Parse(typeof(SensorMode), SensorModeComboBox.SelectedIndex.ToString())),
            AccelerometerFullScale = ((AccelerometerFullScale)Enum.Parse(typeof(AccelerometerFullScale),
                AccFullScaleComboBox.SelectedIndex.ToString())),
            GyroscopeFullScale = ((GyroscopeFullScale)Enum.Parse(typeof(GyroscopeFullScale),
                GyroFullScaleComboBox.SelectedIndex.ToString())),
        };

        //Configure Sensor with selected configuration (sensorConfig), int = 0 configure all sensors
        _daqSystem.ConfigureSensor(sensorConfig, sensorNum);
        _daqSystem.UpdateDisplay();
    }

    private void LeftInsoleEnabledCheckBox_CheckedChanged(object sender, EventArgs e)
    {

    }

    private void RightInsoleEnabledCheckBox_CheckedChanged(object sender, EventArgs e)
    {

    }
}