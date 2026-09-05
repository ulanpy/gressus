namespace WaveX.Example
{
    partial class WaveXExampleForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (_daqSystem != null)) _daqSystem.Dispose();
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(WaveXExampleForm));
            this.DeviceStatusLabel = new System.Windows.Forms.Label();
            this.DeviceStatusTextBox = new System.Windows.Forms.TextBox();
            this.GetFwVersionButton = new System.Windows.Forms.Button();
            this.TriggerConfigurationGroupBox = new System.Windows.Forms.GroupBox();
            this.TriggerActiveLevelNumericUpDown = new System.Windows.Forms.NumericUpDown();
            this.TriggerActiveLevelLabel = new System.Windows.Forms.Label();
            this.TriggerEnabledCheckBox = new System.Windows.Forms.CheckBox();
            this.DataTransferRateLabel = new System.Windows.Forms.Label();
            this.DataTransferRateTextBox = new System.Windows.Forms.TextBox();
            this.ViewerGroupBox = new System.Windows.Forms.GroupBox();
            this.ImuSensorSelectorLabel = new System.Windows.Forms.Label();
            this.ImuSensorSelectorNumericUpDown = new System.Windows.Forms.NumericUpDown();
            this.MagTChartPanel = new System.Windows.Forms.Panel();
            this.GyroTChartPanel = new System.Windows.Forms.Panel();
            this.AccTChartPanel = new System.Windows.Forms.Panel();
            this.EmgTChartPanel = new System.Windows.Forms.Panel();
            this.EmgSensorSelectorLabel = new System.Windows.Forms.Label();
            this.EmgSensorSelectorNumericUpDown = new System.Windows.Forms.NumericUpDown();
            this.PlotEnabledCheckBox = new System.Windows.Forms.CheckBox();
            this.StopCaptureButton = new System.Windows.Forms.Button();
            this.GetHwVersionButton = new System.Windows.Forms.Button();
            this.DeviceGroupBox = new System.Windows.Forms.GroupBox();
            this.GetInstalledsSensorsButton = new System.Windows.Forms.Button();
            this.InstalledSensorsTextBox = new System.Windows.Forms.TextBox();
            this.InstalledSensorsLabel = new System.Windows.Forms.Label();
            this.Hw1VersionTextBox = new System.Windows.Forms.TextBox();
            this.Fw1VersionTextBox = new System.Windows.Forms.TextBox();
            this.DeviceErrorTextBox = new System.Windows.Forms.TextBox();
            this.HwVersionLabel = new System.Windows.Forms.Label();
            this.FwVersionLabel = new System.Windows.Forms.Label();
            this.Fw2VersionTextBox = new System.Windows.Forms.TextBox();
            this.DeviceErrorLabel = new System.Windows.Forms.Label();
            this.Hw2VersionTextBox = new System.Windows.Forms.TextBox();
            this.CaptureGroupBox = new System.Windows.Forms.GroupBox();
            this.CaptureSampleRateLabel = new System.Windows.Forms.Label();
            this.CaptureDataRateTextBox = new System.Windows.Forms.TextBox();
            this.GenerateStopTriggerButton = new System.Windows.Forms.Button();
            this.GenerateStartTriggerButton = new System.Windows.Forms.Button();
            this.StopTriggerScanTextBox = new System.Windows.Forms.TextBox();
            this.StopTriggerScanLabel = new System.Windows.Forms.Label();
            this.StartTriggerScanTextBox = new System.Windows.Forms.TextBox();
            this.StartTriggerScanLabel = new System.Windows.Forms.Label();
            this.StopTriggerDetectedCheckBox = new System.Windows.Forms.CheckBox();
            this.StartTriggerDetectedCheckBox = new System.Windows.Forms.CheckBox();
            this.StartCaptureButton = new System.Windows.Forms.Button();
            this.toolStripButton1 = new System.Windows.Forms.ToolStripButton();
            this.SensorStateGroupBox = new System.Windows.Forms.GroupBox();
            this.ConfigGroupBox = new System.Windows.Forms.GroupBox();
            this.ConfigureCaptureButton = new System.Windows.Forms.Button();
            this.TriggerConfigurationGroupBox.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.TriggerActiveLevelNumericUpDown)).BeginInit();
            this.ViewerGroupBox.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.ImuSensorSelectorNumericUpDown)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.EmgSensorSelectorNumericUpDown)).BeginInit();
            this.DeviceGroupBox.SuspendLayout();
            this.CaptureGroupBox.SuspendLayout();
            this.ConfigGroupBox.SuspendLayout();
            this.SuspendLayout();
            // 
            // DeviceStatusLabel
            // 
            this.DeviceStatusLabel.AutoSize = true;
            this.DeviceStatusLabel.Location = new System.Drawing.Point(5, 147);
            this.DeviceStatusLabel.Name = "DeviceStatusLabel";
            this.DeviceStatusLabel.Size = new System.Drawing.Size(37, 13);
            this.DeviceStatusLabel.TabIndex = 1;
            this.DeviceStatusLabel.Text = "Status";
            this.DeviceStatusLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // DeviceStatusTextBox
            // 
            this.DeviceStatusTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.DeviceStatusTextBox.Location = new System.Drawing.Point(59, 144);
            this.DeviceStatusTextBox.Name = "DeviceStatusTextBox";
            this.DeviceStatusTextBox.ReadOnly = true;
            this.DeviceStatusTextBox.Size = new System.Drawing.Size(140, 20);
            this.DeviceStatusTextBox.TabIndex = 2;
            // 
            // GetFwVersionButton
            // 
            this.GetFwVersionButton.Location = new System.Drawing.Point(147, 30);
            this.GetFwVersionButton.Name = "GetFwVersionButton";
            this.GetFwVersionButton.Size = new System.Drawing.Size(52, 21);
            this.GetFwVersionButton.TabIndex = 4;
            this.GetFwVersionButton.Text = "Get";
            this.GetFwVersionButton.UseVisualStyleBackColor = true;
            this.GetFwVersionButton.Click += new System.EventHandler(this.GetFwVersionButton_Click);
            // 
            // TriggerConfigurationGroupBox
            // 
            this.TriggerConfigurationGroupBox.Controls.Add(this.TriggerActiveLevelNumericUpDown);
            this.TriggerConfigurationGroupBox.Controls.Add(this.TriggerActiveLevelLabel);
            this.TriggerConfigurationGroupBox.Controls.Add(this.TriggerEnabledCheckBox);
            this.TriggerConfigurationGroupBox.Location = new System.Drawing.Point(1144, 282);
            this.TriggerConfigurationGroupBox.Name = "TriggerConfigurationGroupBox";
            this.TriggerConfigurationGroupBox.Size = new System.Drawing.Size(208, 88);
            this.TriggerConfigurationGroupBox.TabIndex = 7;
            this.TriggerConfigurationGroupBox.TabStop = false;
            this.TriggerConfigurationGroupBox.Text = "External Trigger";
            // 
            // TriggerActiveLevelNumericUpDown
            // 
            this.TriggerActiveLevelNumericUpDown.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.TriggerActiveLevelNumericUpDown.Location = new System.Drawing.Point(144, 56);
            this.TriggerActiveLevelNumericUpDown.Maximum = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.TriggerActiveLevelNumericUpDown.Name = "TriggerActiveLevelNumericUpDown";
            this.TriggerActiveLevelNumericUpDown.Size = new System.Drawing.Size(55, 20);
            this.TriggerActiveLevelNumericUpDown.TabIndex = 34;
            // 
            // TriggerActiveLevelLabel
            // 
            this.TriggerActiveLevelLabel.Location = new System.Drawing.Point(9, 58);
            this.TriggerActiveLevelLabel.Name = "TriggerActiveLevelLabel";
            this.TriggerActiveLevelLabel.Size = new System.Drawing.Size(114, 18);
            this.TriggerActiveLevelLabel.TabIndex = 35;
            this.TriggerActiveLevelLabel.Text = "Trigger Active Level";
            // 
            // TriggerEnabledCheckBox
            // 
            this.TriggerEnabledCheckBox.CheckAlign = System.Drawing.ContentAlignment.MiddleRight;
            this.TriggerEnabledCheckBox.Location = new System.Drawing.Point(9, 28);
            this.TriggerEnabledCheckBox.Name = "TriggerEnabledCheckBox";
            this.TriggerEnabledCheckBox.Size = new System.Drawing.Size(190, 22);
            this.TriggerEnabledCheckBox.TabIndex = 33;
            this.TriggerEnabledCheckBox.Text = "Trigger Enabled";
            this.TriggerEnabledCheckBox.UseVisualStyleBackColor = true;
            this.TriggerEnabledCheckBox.CheckedChanged += new System.EventHandler(this.TriggerEnabledCheckBox_CheckedChanged);
            // 
            // DataTransferRateLabel
            // 
            this.DataTransferRateLabel.AutoSize = true;
            this.DataTransferRateLabel.Location = new System.Drawing.Point(6, 112);
            this.DataTransferRateLabel.Name = "DataTransferRateLabel";
            this.DataTransferRateLabel.Size = new System.Drawing.Size(131, 13);
            this.DataTransferRateLabel.TabIndex = 14;
            this.DataTransferRateLabel.Text = "Data Transfer Rate [KB/s]";
            // 
            // DataTransferRateTextBox
            // 
            this.DataTransferRateTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.DataTransferRateTextBox.Location = new System.Drawing.Point(144, 110);
            this.DataTransferRateTextBox.Name = "DataTransferRateTextBox";
            this.DataTransferRateTextBox.ReadOnly = true;
            this.DataTransferRateTextBox.Size = new System.Drawing.Size(55, 20);
            this.DataTransferRateTextBox.TabIndex = 12;
            // 
            // ViewerGroupBox
            // 
            this.ViewerGroupBox.Controls.Add(this.ImuSensorSelectorLabel);
            this.ViewerGroupBox.Controls.Add(this.ImuSensorSelectorNumericUpDown);
            this.ViewerGroupBox.Controls.Add(this.MagTChartPanel);
            this.ViewerGroupBox.Controls.Add(this.GyroTChartPanel);
            this.ViewerGroupBox.Controls.Add(this.AccTChartPanel);
            this.ViewerGroupBox.Controls.Add(this.EmgTChartPanel);
            this.ViewerGroupBox.Controls.Add(this.EmgSensorSelectorLabel);
            this.ViewerGroupBox.Controls.Add(this.EmgSensorSelectorNumericUpDown);
            this.ViewerGroupBox.Controls.Add(this.PlotEnabledCheckBox);
            this.ViewerGroupBox.Location = new System.Drawing.Point(12, 5);
            this.ViewerGroupBox.Name = "ViewerGroupBox";
            this.ViewerGroupBox.Size = new System.Drawing.Size(997, 717);
            this.ViewerGroupBox.TabIndex = 8;
            this.ViewerGroupBox.TabStop = false;
            this.ViewerGroupBox.Text = "Samples Viewer";
            // 
            // ImuSensorSelectorLabel
            // 
            this.ImuSensorSelectorLabel.Location = new System.Drawing.Point(386, 689);
            this.ImuSensorSelectorLabel.Name = "ImuSensorSelectorLabel";
            this.ImuSensorSelectorLabel.Size = new System.Drawing.Size(117, 20);
            this.ImuSensorSelectorLabel.TabIndex = 35;
            this.ImuSensorSelectorLabel.Text = "IMU Sensor to Plot";
            this.ImuSensorSelectorLabel.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
            // 
            // ImuSensorSelectorNumericUpDown
            // 
            this.ImuSensorSelectorNumericUpDown.Anchor = System.Windows.Forms.AnchorStyles.None;
            this.ImuSensorSelectorNumericUpDown.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.ImuSensorSelectorNumericUpDown.Font = new System.Drawing.Font("Microsoft Sans Serif", 9.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.ImuSensorSelectorNumericUpDown.Location = new System.Drawing.Point(509, 689);
            this.ImuSensorSelectorNumericUpDown.Maximum = new decimal(new int[] {
            36,
            0,
            0,
            0});
            this.ImuSensorSelectorNumericUpDown.Minimum = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.ImuSensorSelectorNumericUpDown.Name = "ImuSensorSelectorNumericUpDown";
            this.ImuSensorSelectorNumericUpDown.Size = new System.Drawing.Size(65, 22);
            this.ImuSensorSelectorNumericUpDown.TabIndex = 34;
            this.ImuSensorSelectorNumericUpDown.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            this.ImuSensorSelectorNumericUpDown.Value = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.ImuSensorSelectorNumericUpDown.ValueChanged += new System.EventHandler(this.ImuSensorSelectorNumericUpDown_ValueChanged);
            // 
            // MagTChartPanel
            // 
            this.MagTChartPanel.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.MagTChartPanel.BackColor = System.Drawing.Color.White;
            this.MagTChartPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.MagTChartPanel.Location = new System.Drawing.Point(20, 523);
            this.MagTChartPanel.Name = "MagTChartPanel";
            this.MagTChartPanel.Size = new System.Drawing.Size(961, 144);
            this.MagTChartPanel.TabIndex = 33;
            // 
            // GyroTChartPanel
            // 
            this.GyroTChartPanel.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.GyroTChartPanel.BackColor = System.Drawing.Color.White;
            this.GyroTChartPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.GyroTChartPanel.Location = new System.Drawing.Point(20, 372);
            this.GyroTChartPanel.Name = "GyroTChartPanel";
            this.GyroTChartPanel.Size = new System.Drawing.Size(961, 144);
            this.GyroTChartPanel.TabIndex = 32;
            // 
            // AccTChartPanel
            // 
            this.AccTChartPanel.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.AccTChartPanel.BackColor = System.Drawing.Color.White;
            this.AccTChartPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.AccTChartPanel.Location = new System.Drawing.Point(20, 221);
            this.AccTChartPanel.Name = "AccTChartPanel";
            this.AccTChartPanel.Size = new System.Drawing.Size(961, 144);
            this.AccTChartPanel.TabIndex = 31;
            // 
            // EmgTChartPanel
            // 
            this.EmgTChartPanel.Anchor = ((System.Windows.Forms.AnchorStyles)(((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
            this.EmgTChartPanel.BackColor = System.Drawing.Color.White;
            this.EmgTChartPanel.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.EmgTChartPanel.Location = new System.Drawing.Point(20, 30);
            this.EmgTChartPanel.Name = "EmgTChartPanel";
            this.EmgTChartPanel.Size = new System.Drawing.Size(961, 144);
            this.EmgTChartPanel.TabIndex = 30;
            // 
            // EmgSensorSelectorLabel
            // 
            this.EmgSensorSelectorLabel.Location = new System.Drawing.Point(386, 177);
            this.EmgSensorSelectorLabel.Name = "EmgSensorSelectorLabel";
            this.EmgSensorSelectorLabel.Size = new System.Drawing.Size(117, 20);
            this.EmgSensorSelectorLabel.TabIndex = 29;
            this.EmgSensorSelectorLabel.Text = "Emg Sensor to Plot";
            this.EmgSensorSelectorLabel.TextAlign = System.Drawing.ContentAlignment.MiddleRight;
            // 
            // EmgSensorSelectorNumericUpDown
            // 
            this.EmgSensorSelectorNumericUpDown.Anchor = System.Windows.Forms.AnchorStyles.None;
            this.EmgSensorSelectorNumericUpDown.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.EmgSensorSelectorNumericUpDown.Font = new System.Drawing.Font("Microsoft Sans Serif", 9.75F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.EmgSensorSelectorNumericUpDown.Location = new System.Drawing.Point(509, 177);
            this.EmgSensorSelectorNumericUpDown.Maximum = new decimal(new int[] {
            36,
            0,
            0,
            0});
            this.EmgSensorSelectorNumericUpDown.Minimum = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.EmgSensorSelectorNumericUpDown.Name = "EmgSensorSelectorNumericUpDown";
            this.EmgSensorSelectorNumericUpDown.Size = new System.Drawing.Size(65, 22);
            this.EmgSensorSelectorNumericUpDown.TabIndex = 28;
            this.EmgSensorSelectorNumericUpDown.TextAlign = System.Windows.Forms.HorizontalAlignment.Center;
            this.EmgSensorSelectorNumericUpDown.Value = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.EmgSensorSelectorNumericUpDown.ValueChanged += new System.EventHandler(this.EmgSensorSelectorNumericUpDown_ValueChanged);
            // 
            // PlotEnabledCheckBox
            // 
            this.PlotEnabledCheckBox.AutoSize = true;
            this.PlotEnabledCheckBox.Checked = true;
            this.PlotEnabledCheckBox.CheckState = System.Windows.Forms.CheckState.Checked;
            this.PlotEnabledCheckBox.Location = new System.Drawing.Point(20, 694);
            this.PlotEnabledCheckBox.Name = "PlotEnabledCheckBox";
            this.PlotEnabledCheckBox.Size = new System.Drawing.Size(86, 17);
            this.PlotEnabledCheckBox.TabIndex = 23;
            this.PlotEnabledCheckBox.Text = "Plot Enabled";
            this.PlotEnabledCheckBox.UseVisualStyleBackColor = true;
            // 
            // StopCaptureButton
            // 
            this.StopCaptureButton.Location = new System.Drawing.Point(6, 49);
            this.StopCaptureButton.Name = "StopCaptureButton";
            this.StopCaptureButton.Size = new System.Drawing.Size(193, 21);
            this.StopCaptureButton.TabIndex = 1;
            this.StopCaptureButton.Text = "Stop Capture";
            this.StopCaptureButton.UseVisualStyleBackColor = true;
            this.StopCaptureButton.Click += new System.EventHandler(this.StopCaptureButton_Click);
            // 
            // GetHwVersionButton
            // 
            this.GetHwVersionButton.Location = new System.Drawing.Point(147, 55);
            this.GetHwVersionButton.Name = "GetHwVersionButton";
            this.GetHwVersionButton.Size = new System.Drawing.Size(52, 21);
            this.GetHwVersionButton.TabIndex = 10;
            this.GetHwVersionButton.Text = "Get";
            this.GetHwVersionButton.UseVisualStyleBackColor = true;
            this.GetHwVersionButton.Click += new System.EventHandler(this.GetHwVersionButton_Click);
            // 
            // DeviceGroupBox
            // 
            this.DeviceGroupBox.BackColor = System.Drawing.SystemColors.Control;
            this.DeviceGroupBox.Controls.Add(this.GetInstalledsSensorsButton);
            this.DeviceGroupBox.Controls.Add(this.InstalledSensorsTextBox);
            this.DeviceGroupBox.Controls.Add(this.InstalledSensorsLabel);
            this.DeviceGroupBox.Controls.Add(this.Hw1VersionTextBox);
            this.DeviceGroupBox.Controls.Add(this.Fw1VersionTextBox);
            this.DeviceGroupBox.Controls.Add(this.DeviceErrorTextBox);
            this.DeviceGroupBox.Controls.Add(this.HwVersionLabel);
            this.DeviceGroupBox.Controls.Add(this.FwVersionLabel);
            this.DeviceGroupBox.Controls.Add(this.Fw2VersionTextBox);
            this.DeviceGroupBox.Controls.Add(this.DeviceErrorLabel);
            this.DeviceGroupBox.Controls.Add(this.Hw2VersionTextBox);
            this.DeviceGroupBox.Controls.Add(this.DeviceStatusTextBox);
            this.DeviceGroupBox.Controls.Add(this.GetFwVersionButton);
            this.DeviceGroupBox.Controls.Add(this.GetHwVersionButton);
            this.DeviceGroupBox.Controls.Add(this.DeviceStatusLabel);
            this.DeviceGroupBox.Location = new System.Drawing.Point(1144, 447);
            this.DeviceGroupBox.Name = "DeviceGroupBox";
            this.DeviceGroupBox.Size = new System.Drawing.Size(208, 205);
            this.DeviceGroupBox.TabIndex = 13;
            this.DeviceGroupBox.TabStop = false;
            this.DeviceGroupBox.Text = "Device";
            // 
            // GetInstalledsSensorsButton
            // 
            this.GetInstalledsSensorsButton.Location = new System.Drawing.Point(147, 100);
            this.GetInstalledsSensorsButton.Name = "GetInstalledsSensorsButton";
            this.GetInstalledsSensorsButton.Size = new System.Drawing.Size(52, 21);
            this.GetInstalledsSensorsButton.TabIndex = 75;
            this.GetInstalledsSensorsButton.Text = "Get";
            this.GetInstalledsSensorsButton.UseVisualStyleBackColor = true;
            this.GetInstalledsSensorsButton.Click += new System.EventHandler(this.GetInstalledSensorsButton_Click);
            // 
            // InstalledSensorsTextBox
            // 
            this.InstalledSensorsTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.InstalledSensorsTextBox.Location = new System.Drawing.Point(103, 102);
            this.InstalledSensorsTextBox.Name = "InstalledSensorsTextBox";
            this.InstalledSensorsTextBox.ReadOnly = true;
            this.InstalledSensorsTextBox.Size = new System.Drawing.Size(38, 20);
            this.InstalledSensorsTextBox.TabIndex = 74;
            // 
            // InstalledSensorsLabel
            // 
            this.InstalledSensorsLabel.Location = new System.Drawing.Point(6, 103);
            this.InstalledSensorsLabel.Name = "InstalledSensorsLabel";
            this.InstalledSensorsLabel.Size = new System.Drawing.Size(92, 18);
            this.InstalledSensorsLabel.TabIndex = 73;
            this.InstalledSensorsLabel.Text = "Installed Sensors";
            this.InstalledSensorsLabel.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            // 
            // Hw1VersionTextBox
            // 
            this.Hw1VersionTextBox.AcceptsReturn = true;
            this.Hw1VersionTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.Hw1VersionTextBox.ImeMode = System.Windows.Forms.ImeMode.HangulFull;
            this.Hw1VersionTextBox.Location = new System.Drawing.Point(59, 56);
            this.Hw1VersionTextBox.Name = "Hw1VersionTextBox";
            this.Hw1VersionTextBox.ReadOnly = true;
            this.Hw1VersionTextBox.Size = new System.Drawing.Size(38, 20);
            this.Hw1VersionTextBox.TabIndex = 72;
            // 
            // Fw1VersionTextBox
            // 
            this.Fw1VersionTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.Fw1VersionTextBox.ImeMode = System.Windows.Forms.ImeMode.HangulFull;
            this.Fw1VersionTextBox.Location = new System.Drawing.Point(59, 28);
            this.Fw1VersionTextBox.Name = "Fw1VersionTextBox";
            this.Fw1VersionTextBox.ReadOnly = true;
            this.Fw1VersionTextBox.Size = new System.Drawing.Size(38, 20);
            this.Fw1VersionTextBox.TabIndex = 71;
            // 
            // DeviceErrorTextBox
            // 
            this.DeviceErrorTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.DeviceErrorTextBox.Location = new System.Drawing.Point(59, 170);
            this.DeviceErrorTextBox.Name = "DeviceErrorTextBox";
            this.DeviceErrorTextBox.ReadOnly = true;
            this.DeviceErrorTextBox.Size = new System.Drawing.Size(140, 20);
            this.DeviceErrorTextBox.TabIndex = 64;
            // 
            // HwVersionLabel
            // 
            this.HwVersionLabel.AutoSize = true;
            this.HwVersionLabel.Location = new System.Drawing.Point(6, 60);
            this.HwVersionLabel.Name = "HwVersionLabel";
            this.HwVersionLabel.Size = new System.Drawing.Size(23, 13);
            this.HwVersionLabel.TabIndex = 63;
            this.HwVersionLabel.Text = "Hw";
            // 
            // FwVersionLabel
            // 
            this.FwVersionLabel.AutoSize = true;
            this.FwVersionLabel.Location = new System.Drawing.Point(6, 31);
            this.FwVersionLabel.Name = "FwVersionLabel";
            this.FwVersionLabel.Size = new System.Drawing.Size(21, 13);
            this.FwVersionLabel.TabIndex = 62;
            this.FwVersionLabel.Text = "Fw";
            // 
            // Fw2VersionTextBox
            // 
            this.Fw2VersionTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.Fw2VersionTextBox.ImeMode = System.Windows.Forms.ImeMode.HangulFull;
            this.Fw2VersionTextBox.Location = new System.Drawing.Point(103, 31);
            this.Fw2VersionTextBox.Name = "Fw2VersionTextBox";
            this.Fw2VersionTextBox.ReadOnly = true;
            this.Fw2VersionTextBox.Size = new System.Drawing.Size(38, 20);
            this.Fw2VersionTextBox.TabIndex = 36;
            // 
            // DeviceErrorLabel
            // 
            this.DeviceErrorLabel.AutoSize = true;
            this.DeviceErrorLabel.Location = new System.Drawing.Point(6, 174);
            this.DeviceErrorLabel.Name = "DeviceErrorLabel";
            this.DeviceErrorLabel.Size = new System.Drawing.Size(29, 13);
            this.DeviceErrorLabel.TabIndex = 29;
            this.DeviceErrorLabel.Text = "Error";
            // 
            // Hw2VersionTextBox
            // 
            this.Hw2VersionTextBox.AcceptsReturn = true;
            this.Hw2VersionTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.Hw2VersionTextBox.ImeMode = System.Windows.Forms.ImeMode.HangulFull;
            this.Hw2VersionTextBox.Location = new System.Drawing.Point(103, 56);
            this.Hw2VersionTextBox.Name = "Hw2VersionTextBox";
            this.Hw2VersionTextBox.ReadOnly = true;
            this.Hw2VersionTextBox.Size = new System.Drawing.Size(38, 20);
            this.Hw2VersionTextBox.TabIndex = 22;
            // 
            // CaptureGroupBox
            // 
            this.CaptureGroupBox.BackColor = System.Drawing.SystemColors.Control;
            this.CaptureGroupBox.Controls.Add(this.CaptureSampleRateLabel);
            this.CaptureGroupBox.Controls.Add(this.CaptureDataRateTextBox);
            this.CaptureGroupBox.Controls.Add(this.GenerateStopTriggerButton);
            this.CaptureGroupBox.Controls.Add(this.GenerateStartTriggerButton);
            this.CaptureGroupBox.Controls.Add(this.StopTriggerScanTextBox);
            this.CaptureGroupBox.Controls.Add(this.StopTriggerScanLabel);
            this.CaptureGroupBox.Controls.Add(this.StartTriggerScanTextBox);
            this.CaptureGroupBox.Controls.Add(this.StartTriggerScanLabel);
            this.CaptureGroupBox.Controls.Add(this.StopTriggerDetectedCheckBox);
            this.CaptureGroupBox.Controls.Add(this.StartTriggerDetectedCheckBox);
            this.CaptureGroupBox.Controls.Add(this.DataTransferRateLabel);
            this.CaptureGroupBox.Controls.Add(this.DataTransferRateTextBox);
            this.CaptureGroupBox.Controls.Add(this.StartCaptureButton);
            this.CaptureGroupBox.Controls.Add(this.StopCaptureButton);
            this.CaptureGroupBox.Location = new System.Drawing.Point(1144, 5);
            this.CaptureGroupBox.Name = "CaptureGroupBox";
            this.CaptureGroupBox.RightToLeft = System.Windows.Forms.RightToLeft.No;
            this.CaptureGroupBox.Size = new System.Drawing.Size(208, 271);
            this.CaptureGroupBox.TabIndex = 14;
            this.CaptureGroupBox.TabStop = false;
            this.CaptureGroupBox.Text = "Capture";
            // 
            // CaptureSampleRateLabel
            // 
            this.CaptureSampleRateLabel.AutoSize = true;
            this.CaptureSampleRateLabel.Location = new System.Drawing.Point(8, 82);
            this.CaptureSampleRateLabel.Name = "CaptureSampleRateLabel";
            this.CaptureSampleRateLabel.Size = new System.Drawing.Size(108, 13);
            this.CaptureSampleRateLabel.TabIndex = 30;
            this.CaptureSampleRateLabel.Text = "Capture Sample Rate";
            // 
            // CaptureDataRateTextBox
            // 
            this.CaptureDataRateTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.CaptureDataRateTextBox.Location = new System.Drawing.Point(144, 80);
            this.CaptureDataRateTextBox.Name = "CaptureDataRateTextBox";
            this.CaptureDataRateTextBox.ReadOnly = true;
            this.CaptureDataRateTextBox.Size = new System.Drawing.Size(55, 20);
            this.CaptureDataRateTextBox.TabIndex = 29;
            // 
            // GenerateStopTriggerButton
            // 
            this.GenerateStopTriggerButton.Location = new System.Drawing.Point(6, 181);
            this.GenerateStopTriggerButton.Name = "GenerateStopTriggerButton";
            this.GenerateStopTriggerButton.Size = new System.Drawing.Size(193, 21);
            this.GenerateStopTriggerButton.TabIndex = 28;
            this.GenerateStopTriggerButton.Text = "Generate Internal Stop Trigger";
            this.GenerateStopTriggerButton.UseVisualStyleBackColor = true;
            this.GenerateStopTriggerButton.Click += new System.EventHandler(this.GenerateStopTriggerButton_Click);
            // 
            // GenerateStartTriggerButton
            // 
            this.GenerateStartTriggerButton.Location = new System.Drawing.Point(6, 150);
            this.GenerateStartTriggerButton.Name = "GenerateStartTriggerButton";
            this.GenerateStartTriggerButton.Size = new System.Drawing.Size(193, 21);
            this.GenerateStartTriggerButton.TabIndex = 27;
            this.GenerateStartTriggerButton.Text = "Generate Internal Start Trigger";
            this.GenerateStartTriggerButton.UseVisualStyleBackColor = true;
            this.GenerateStartTriggerButton.Click += new System.EventHandler(this.GenerateStartTriggerButton_Click);
            // 
            // StopTriggerScanTextBox
            // 
            this.StopTriggerScanTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.StopTriggerScanTextBox.Location = new System.Drawing.Point(144, 240);
            this.StopTriggerScanTextBox.Name = "StopTriggerScanTextBox";
            this.StopTriggerScanTextBox.ReadOnly = true;
            this.StopTriggerScanTextBox.Size = new System.Drawing.Size(55, 20);
            this.StopTriggerScanTextBox.TabIndex = 26;
            // 
            // StopTriggerScanLabel
            // 
            this.StopTriggerScanLabel.AutoSize = true;
            this.StopTriggerScanLabel.Location = new System.Drawing.Point(96, 243);
            this.StopTriggerScanLabel.Name = "StopTriggerScanLabel";
            this.StopTriggerScanLabel.Size = new System.Drawing.Size(32, 13);
            this.StopTriggerScanLabel.TabIndex = 25;
            this.StopTriggerScanLabel.Text = "Scan";
            this.StopTriggerScanLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // StartTriggerScanTextBox
            // 
            this.StartTriggerScanTextBox.AcceptsReturn = true;
            this.StartTriggerScanTextBox.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            this.StartTriggerScanTextBox.Location = new System.Drawing.Point(144, 214);
            this.StartTriggerScanTextBox.Name = "StartTriggerScanTextBox";
            this.StartTriggerScanTextBox.ReadOnly = true;
            this.StartTriggerScanTextBox.Size = new System.Drawing.Size(55, 20);
            this.StartTriggerScanTextBox.TabIndex = 24;
            // 
            // StartTriggerScanLabel
            // 
            this.StartTriggerScanLabel.AutoSize = true;
            this.StartTriggerScanLabel.Location = new System.Drawing.Point(96, 217);
            this.StartTriggerScanLabel.Name = "StartTriggerScanLabel";
            this.StartTriggerScanLabel.Size = new System.Drawing.Size(32, 13);
            this.StartTriggerScanLabel.TabIndex = 23;
            this.StartTriggerScanLabel.Text = "Scan";
            this.StartTriggerScanLabel.TextAlign = System.Drawing.ContentAlignment.TopCenter;
            // 
            // StopTriggerDetectedCheckBox
            // 
            this.StopTriggerDetectedCheckBox.CheckAlign = System.Drawing.ContentAlignment.MiddleRight;
            this.StopTriggerDetectedCheckBox.Enabled = false;
            this.StopTriggerDetectedCheckBox.Location = new System.Drawing.Point(6, 239);
            this.StopTriggerDetectedCheckBox.Name = "StopTriggerDetectedCheckBox";
            this.StopTriggerDetectedCheckBox.Size = new System.Drawing.Size(69, 22);
            this.StopTriggerDetectedCheckBox.TabIndex = 22;
            this.StopTriggerDetectedCheckBox.Text = "Stop Trig";
            this.StopTriggerDetectedCheckBox.UseVisualStyleBackColor = true;
            // 
            // StartTriggerDetectedCheckBox
            // 
            this.StartTriggerDetectedCheckBox.CheckAlign = System.Drawing.ContentAlignment.MiddleRight;
            this.StartTriggerDetectedCheckBox.Enabled = false;
            this.StartTriggerDetectedCheckBox.Location = new System.Drawing.Point(6, 213);
            this.StartTriggerDetectedCheckBox.Name = "StartTriggerDetectedCheckBox";
            this.StartTriggerDetectedCheckBox.Size = new System.Drawing.Size(69, 22);
            this.StartTriggerDetectedCheckBox.TabIndex = 21;
            this.StartTriggerDetectedCheckBox.Text = "Start Trig";
            this.StartTriggerDetectedCheckBox.UseVisualStyleBackColor = true;
            // 
            // StartCaptureButton
            // 
            this.StartCaptureButton.BackColor = System.Drawing.SystemColors.Control;
            this.StartCaptureButton.ForeColor = System.Drawing.SystemColors.ControlText;
            this.StartCaptureButton.Location = new System.Drawing.Point(6, 22);
            this.StartCaptureButton.Name = "StartCaptureButton";
            this.StartCaptureButton.Size = new System.Drawing.Size(193, 21);
            this.StartCaptureButton.TabIndex = 0;
            this.StartCaptureButton.Text = "Start Capture";
            this.StartCaptureButton.UseVisualStyleBackColor = true;
            this.StartCaptureButton.Click += new System.EventHandler(this.StartCaptureButton_Click);
            // 
            // toolStripButton1
            // 
            this.toolStripButton1.DisplayStyle = System.Windows.Forms.ToolStripItemDisplayStyle.Image;
            this.toolStripButton1.Image = ((System.Drawing.Image)(resources.GetObject("toolStripButton1.Image")));
            this.toolStripButton1.ImageTransparentColor = System.Drawing.Color.Magenta;
            this.toolStripButton1.Name = "toolStripButton1";
            this.toolStripButton1.Size = new System.Drawing.Size(23, 21);
            this.toolStripButton1.Text = "toolStripButton1";
            // 
            // SensorStateGroupBox
            // 
            this.SensorStateGroupBox.Location = new System.Drawing.Point(1015, 5);
            this.SensorStateGroupBox.Name = "SensorStateGroupBox";
            this.SensorStateGroupBox.Size = new System.Drawing.Size(123, 717);
            this.SensorStateGroupBox.TabIndex = 19;
            this.SensorStateGroupBox.TabStop = false;
            this.SensorStateGroupBox.Text = "Sensor Battery Level";
            // 
            // ConfigGroupBox
            // 
            this.ConfigGroupBox.Controls.Add(this.ConfigureCaptureButton);
            this.ConfigGroupBox.Location = new System.Drawing.Point(1144, 376);
            this.ConfigGroupBox.Name = "ConfigGroupBox";
            this.ConfigGroupBox.Size = new System.Drawing.Size(208, 65);
            this.ConfigGroupBox.TabIndex = 20;
            this.ConfigGroupBox.TabStop = false;
            this.ConfigGroupBox.Text = "Capture and Sensors Configuration";
            // 
            // ConfigureCaptureButton
            // 
            this.ConfigureCaptureButton.Location = new System.Drawing.Point(6, 30);
            this.ConfigureCaptureButton.Name = "ConfigureCaptureButton";
            this.ConfigureCaptureButton.Size = new System.Drawing.Size(193, 21);
            this.ConfigureCaptureButton.TabIndex = 29;
            this.ConfigureCaptureButton.Text = "Configure Capture and Sensors";
            this.ConfigureCaptureButton.UseVisualStyleBackColor = true;
            this.ConfigureCaptureButton.Click += new System.EventHandler(this.ConfigureCaptureButton_Click);
            // 
            // WaveXExampleForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(1364, 732);
            this.Controls.Add(this.ConfigGroupBox);
            this.Controls.Add(this.ViewerGroupBox);
            this.Controls.Add(this.CaptureGroupBox);
            this.Controls.Add(this.DeviceGroupBox);
            this.Controls.Add(this.TriggerConfigurationGroupBox);
            this.Controls.Add(this.SensorStateGroupBox);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.Fixed3D;
            this.MaximizeBox = false;
            this.Name = "WaveXExampleForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "WaveX/Waveplus Example";
            this.FormClosing += new System.Windows.Forms.FormClosingEventHandler(this.DaqToolForm_FormClosing);
            this.TriggerConfigurationGroupBox.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.TriggerActiveLevelNumericUpDown)).EndInit();
            this.ViewerGroupBox.ResumeLayout(false);
            this.ViewerGroupBox.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)(this.ImuSensorSelectorNumericUpDown)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.EmgSensorSelectorNumericUpDown)).EndInit();
            this.DeviceGroupBox.ResumeLayout(false);
            this.DeviceGroupBox.PerformLayout();
            this.CaptureGroupBox.ResumeLayout(false);
            this.CaptureGroupBox.PerformLayout();
            this.ConfigGroupBox.ResumeLayout(false);
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.Label DeviceStatusLabel;
        private System.Windows.Forms.TextBox DeviceStatusTextBox;
        private System.Windows.Forms.Button GetFwVersionButton;
        private System.Windows.Forms.GroupBox TriggerConfigurationGroupBox;
        private System.Windows.Forms.GroupBox ViewerGroupBox;
        private System.Windows.Forms.Button StopCaptureButton;
        private System.Windows.Forms.Label DataTransferRateLabel;
        private System.Windows.Forms.TextBox DataTransferRateTextBox;
        private System.Windows.Forms.Button GetHwVersionButton;
        private System.Windows.Forms.GroupBox DeviceGroupBox;
        private System.Windows.Forms.GroupBox CaptureGroupBox;
        private System.Windows.Forms.TextBox Hw2VersionTextBox;
        private System.Windows.Forms.CheckBox PlotEnabledCheckBox;
        private System.Windows.Forms.Label DeviceErrorLabel;
        private System.Windows.Forms.TextBox Fw2VersionTextBox;
        private System.Windows.Forms.Label HwVersionLabel;
        private System.Windows.Forms.Label FwVersionLabel;
        private System.Windows.Forms.NumericUpDown EmgSensorSelectorNumericUpDown;
        private System.Windows.Forms.Label EmgSensorSelectorLabel;
        private System.Windows.Forms.ToolStripButton toolStripButton1;
        private System.Windows.Forms.TextBox DeviceErrorTextBox;
        private System.Windows.Forms.GroupBox SensorStateGroupBox;
        private System.Windows.Forms.TextBox StopTriggerScanTextBox;
        private System.Windows.Forms.Label StopTriggerScanLabel;
        private System.Windows.Forms.TextBox StartTriggerScanTextBox;
        private System.Windows.Forms.Label StartTriggerScanLabel;
        private System.Windows.Forms.CheckBox StopTriggerDetectedCheckBox;
        private System.Windows.Forms.CheckBox StartTriggerDetectedCheckBox;
        private System.Windows.Forms.Button GenerateStopTriggerButton;
        private System.Windows.Forms.Button GenerateStartTriggerButton;
        private System.Windows.Forms.TextBox Hw1VersionTextBox;
        private System.Windows.Forms.TextBox Fw1VersionTextBox;
        private System.Windows.Forms.NumericUpDown TriggerActiveLevelNumericUpDown;
        private System.Windows.Forms.Label TriggerActiveLevelLabel;
        private System.Windows.Forms.CheckBox TriggerEnabledCheckBox;
        private System.Windows.Forms.TextBox InstalledSensorsTextBox;
        private System.Windows.Forms.Label InstalledSensorsLabel;
        private System.Windows.Forms.Button StartCaptureButton;
        private System.Windows.Forms.Panel EmgTChartPanel;
        private System.Windows.Forms.Panel MagTChartPanel;
        private System.Windows.Forms.Panel GyroTChartPanel;
        private System.Windows.Forms.Panel AccTChartPanel;
        private System.Windows.Forms.Label ImuSensorSelectorLabel;
        private System.Windows.Forms.NumericUpDown ImuSensorSelectorNumericUpDown;
        private System.Windows.Forms.Button GetInstalledsSensorsButton;
        private System.Windows.Forms.Label CaptureSampleRateLabel;
        private System.Windows.Forms.TextBox CaptureDataRateTextBox;
        private System.Windows.Forms.GroupBox ConfigGroupBox;
        private System.Windows.Forms.Button ConfigureCaptureButton;
    }
}