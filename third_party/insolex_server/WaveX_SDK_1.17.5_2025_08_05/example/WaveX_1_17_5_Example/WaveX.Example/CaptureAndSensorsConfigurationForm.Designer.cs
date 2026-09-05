namespace WaveX.Example
{
    partial class CaptureAndSensorsConfigurationForm
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
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
            this.groupBoxCaptureConfiguration = new System.Windows.Forms.GroupBox();
            this.ImuEmgAcqTypeComboBox = new System.Windows.Forms.ComboBox();
            this.ImuEmgAcqTypeLabel = new System.Windows.Forms.Label();
            this.ImuAcqTypeComboBox = new System.Windows.Forms.ComboBox();
            this.ImuAcqTypeLabel = new System.Windows.Forms.Label();
            this.EmgAcqTypeComboBox = new System.Windows.Forms.ComboBox();
            this.EmgAcqTypeLabel = new System.Windows.Forms.Label();
            this.labelCapturingEnabledTriggerLevel = new System.Windows.Forms.Label();
            this.numericUpDownCapturingEnabledTriggerLevel = new System.Windows.Forms.NumericUpDown();
            this.checkBoxTriggerEnabled = new System.Windows.Forms.CheckBox();
            this.buttonGetCaptureConfiguration = new System.Windows.Forms.Button();
            this.buttonConfigureCapture = new System.Windows.Forms.Button();
            this.groupBoxSensorConfig = new System.Windows.Forms.GroupBox();
            this.SensorConfigButton = new System.Windows.Forms.Button();
            this.GyroFullScaleComboBox = new System.Windows.Forms.ComboBox();
            this.GyroLabel = new System.Windows.Forms.Label();
            this.AccFullScaleComboBox = new System.Windows.Forms.ComboBox();
            this.AccLabel = new System.Windows.Forms.Label();
            this.SensorModeComboBox = new System.Windows.Forms.ComboBox();
            this.label3 = new System.Windows.Forms.Label();
            this.labelSensorSelection = new System.Windows.Forms.Label();
            this.numericUpDownSensorSelection = new System.Windows.Forms.NumericUpDown();
            this.InsolesAcqTypeComboBox = new System.Windows.Forms.ComboBox();
            this.InsolesAcqTypeLabel = new System.Windows.Forms.Label();
            this.InsolesGyroFullScaleComboBox = new System.Windows.Forms.ComboBox();
            this.InsolesGyroFullScaleLabel = new System.Windows.Forms.Label();
            this.InsolesAccFullScaleComboBox = new System.Windows.Forms.ComboBox();
            this.InsolesAccFullScaleLabel = new System.Windows.Forms.Label();
            this.InsoleConfigurationGroupBox = new System.Windows.Forms.GroupBox();
            this.LeftInsoleEnabledCheckBox = new System.Windows.Forms.CheckBox();
            this.RightInsoleEnabledCheckBox = new System.Windows.Forms.CheckBox();
            this.InsoleProtocolComboBox = new System.Windows.Forms.ComboBox();
            this.InsoleProtocolLabel = new System.Windows.Forms.Label();
            this.groupBoxCaptureConfiguration.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numericUpDownCapturingEnabledTriggerLevel)).BeginInit();
            this.groupBoxSensorConfig.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)(this.numericUpDownSensorSelection)).BeginInit();
            this.InsoleConfigurationGroupBox.SuspendLayout();
            this.SuspendLayout();
            // 
            // groupBoxCaptureConfiguration
            // 
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsoleProtocolComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsoleProtocolLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsolesGyroFullScaleComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsolesGyroFullScaleLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsolesAccFullScaleComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsolesAccFullScaleLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsolesAcqTypeComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.InsolesAcqTypeLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.ImuEmgAcqTypeComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.ImuEmgAcqTypeLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.ImuAcqTypeComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.ImuAcqTypeLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.EmgAcqTypeComboBox);
            this.groupBoxCaptureConfiguration.Controls.Add(this.EmgAcqTypeLabel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.labelCapturingEnabledTriggerLevel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.numericUpDownCapturingEnabledTriggerLevel);
            this.groupBoxCaptureConfiguration.Controls.Add(this.checkBoxTriggerEnabled);
            this.groupBoxCaptureConfiguration.Controls.Add(this.buttonGetCaptureConfiguration);
            this.groupBoxCaptureConfiguration.Controls.Add(this.buttonConfigureCapture);
            this.groupBoxCaptureConfiguration.Location = new System.Drawing.Point(12, 12);
            this.groupBoxCaptureConfiguration.Name = "groupBoxCaptureConfiguration";
            this.groupBoxCaptureConfiguration.Size = new System.Drawing.Size(416, 304);
            this.groupBoxCaptureConfiguration.TabIndex = 66;
            this.groupBoxCaptureConfiguration.TabStop = false;
            this.groupBoxCaptureConfiguration.Text = "Capture Configuration";
            // 
            // ImuEmgAcqTypeComboBox
            // 
            this.ImuEmgAcqTypeComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.ImuEmgAcqTypeComboBox.FormattingEnabled = true;
            this.ImuEmgAcqTypeComboBox.Location = new System.Drawing.Point(176, 80);
            this.ImuEmgAcqTypeComboBox.Name = "ImuEmgAcqTypeComboBox";
            this.ImuEmgAcqTypeComboBox.Size = new System.Drawing.Size(232, 21);
            this.ImuEmgAcqTypeComboBox.TabIndex = 49;
            // 
            // ImuEmgAcqTypeLabel
            // 
            this.ImuEmgAcqTypeLabel.Location = new System.Drawing.Point(6, 83);
            this.ImuEmgAcqTypeLabel.Name = "ImuEmgAcqTypeLabel";
            this.ImuEmgAcqTypeLabel.Size = new System.Drawing.Size(164, 17);
            this.ImuEmgAcqTypeLabel.TabIndex = 48;
            this.ImuEmgAcqTypeLabel.Text = "EMG+IMU Acq Type";
            // 
            // ImuAcqTypeComboBox
            // 
            this.ImuAcqTypeComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.ImuAcqTypeComboBox.FormattingEnabled = true;
            this.ImuAcqTypeComboBox.Location = new System.Drawing.Point(176, 49);
            this.ImuAcqTypeComboBox.Name = "ImuAcqTypeComboBox";
            this.ImuAcqTypeComboBox.Size = new System.Drawing.Size(232, 21);
            this.ImuAcqTypeComboBox.TabIndex = 47;
            // 
            // ImuAcqTypeLabel
            // 
            this.ImuAcqTypeLabel.Location = new System.Drawing.Point(6, 52);
            this.ImuAcqTypeLabel.Name = "ImuAcqTypeLabel";
            this.ImuAcqTypeLabel.Size = new System.Drawing.Size(164, 17);
            this.ImuAcqTypeLabel.TabIndex = 46;
            this.ImuAcqTypeLabel.Text = "IMU Acq Type";
            // 
            // EmgAcqTypeComboBox
            // 
            this.EmgAcqTypeComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.EmgAcqTypeComboBox.FormattingEnabled = true;
            this.EmgAcqTypeComboBox.Location = new System.Drawing.Point(176, 19);
            this.EmgAcqTypeComboBox.Name = "EmgAcqTypeComboBox";
            this.EmgAcqTypeComboBox.Size = new System.Drawing.Size(232, 21);
            this.EmgAcqTypeComboBox.TabIndex = 45;
            // 
            // EmgAcqTypeLabel
            // 
            this.EmgAcqTypeLabel.Location = new System.Drawing.Point(6, 22);
            this.EmgAcqTypeLabel.Name = "EmgAcqTypeLabel";
            this.EmgAcqTypeLabel.Size = new System.Drawing.Size(164, 17);
            this.EmgAcqTypeLabel.TabIndex = 44;
            this.EmgAcqTypeLabel.Text = "EMG Acq Type";
            // 
            // labelCapturingEnabledTriggerLevel
            // 
            this.labelCapturingEnabledTriggerLevel.Location = new System.Drawing.Point(278, 244);
            this.labelCapturingEnabledTriggerLevel.Name = "labelCapturingEnabledTriggerLevel";
            this.labelCapturingEnabledTriggerLevel.Size = new System.Drawing.Size(76, 18);
            this.labelCapturingEnabledTriggerLevel.TabIndex = 32;
            this.labelCapturingEnabledTriggerLevel.Text = "Active Level";
            // 
            // numericUpDownCapturingEnabledTriggerLevel
            // 
            this.numericUpDownCapturingEnabledTriggerLevel.Location = new System.Drawing.Point(360, 244);
            this.numericUpDownCapturingEnabledTriggerLevel.Maximum = new decimal(new int[] {
            1,
            0,
            0,
            0});
            this.numericUpDownCapturingEnabledTriggerLevel.Name = "numericUpDownCapturingEnabledTriggerLevel";
            this.numericUpDownCapturingEnabledTriggerLevel.Size = new System.Drawing.Size(48, 20);
            this.numericUpDownCapturingEnabledTriggerLevel.TabIndex = 31;
            this.numericUpDownCapturingEnabledTriggerLevel.Value = new decimal(new int[] {
            1,
            0,
            0,
            0});
            // 
            // checkBoxTriggerEnabled
            // 
            this.checkBoxTriggerEnabled.CheckAlign = System.Drawing.ContentAlignment.MiddleRight;
            this.checkBoxTriggerEnabled.Location = new System.Drawing.Point(0, 238);
            this.checkBoxTriggerEnabled.Name = "checkBoxTriggerEnabled";
            this.checkBoxTriggerEnabled.Size = new System.Drawing.Size(184, 22);
            this.checkBoxTriggerEnabled.TabIndex = 30;
            this.checkBoxTriggerEnabled.Text = "External Trigger Enabled";
            this.checkBoxTriggerEnabled.UseVisualStyleBackColor = true;
            // 
            // buttonGetCaptureConfiguration
            // 
            this.buttonGetCaptureConfiguration.Location = new System.Drawing.Point(258, 276);
            this.buttonGetCaptureConfiguration.Name = "buttonGetCaptureConfiguration";
            this.buttonGetCaptureConfiguration.Size = new System.Drawing.Size(152, 22);
            this.buttonGetCaptureConfiguration.TabIndex = 28;
            this.buttonGetCaptureConfiguration.Text = "Get Configuration";
            this.buttonGetCaptureConfiguration.UseVisualStyleBackColor = true;
            // 
            // buttonConfigureCapture
            // 
            this.buttonConfigureCapture.Location = new System.Drawing.Point(10, 276);
            this.buttonConfigureCapture.Name = "buttonConfigureCapture";
            this.buttonConfigureCapture.Size = new System.Drawing.Size(161, 22);
            this.buttonConfigureCapture.TabIndex = 27;
            this.buttonConfigureCapture.Text = "Configure";
            this.buttonConfigureCapture.UseVisualStyleBackColor = true;
            this.buttonConfigureCapture.Click += new System.EventHandler(this.buttonConfigureCapture_Click);
            // 
            // groupBoxSensorConfig
            // 
            this.groupBoxSensorConfig.Controls.Add(this.SensorConfigButton);
            this.groupBoxSensorConfig.Controls.Add(this.GyroFullScaleComboBox);
            this.groupBoxSensorConfig.Controls.Add(this.GyroLabel);
            this.groupBoxSensorConfig.Controls.Add(this.AccFullScaleComboBox);
            this.groupBoxSensorConfig.Controls.Add(this.AccLabel);
            this.groupBoxSensorConfig.Controls.Add(this.SensorModeComboBox);
            this.groupBoxSensorConfig.Controls.Add(this.label3);
            this.groupBoxSensorConfig.Controls.Add(this.labelSensorSelection);
            this.groupBoxSensorConfig.Controls.Add(this.numericUpDownSensorSelection);
            this.groupBoxSensorConfig.Location = new System.Drawing.Point(434, 12);
            this.groupBoxSensorConfig.Name = "groupBoxSensorConfig";
            this.groupBoxSensorConfig.Size = new System.Drawing.Size(316, 182);
            this.groupBoxSensorConfig.TabIndex = 67;
            this.groupBoxSensorConfig.TabStop = false;
            this.groupBoxSensorConfig.Text = "Sensor Configuration";
            // 
            // SensorConfigButton
            // 
            this.SensorConfigButton.Location = new System.Drawing.Point(6, 147);
            this.SensorConfigButton.Name = "SensorConfigButton";
            this.SensorConfigButton.Size = new System.Drawing.Size(135, 22);
            this.SensorConfigButton.TabIndex = 52;
            this.SensorConfigButton.Text = "Configure Sensor";
            this.SensorConfigButton.UseVisualStyleBackColor = true;
            this.SensorConfigButton.Click += new System.EventHandler(this.SensorConfigButton_Click);
            // 
            // GyroFullScaleComboBox
            // 
            this.GyroFullScaleComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.GyroFullScaleComboBox.FormattingEnabled = true;
            this.GyroFullScaleComboBox.Location = new System.Drawing.Point(143, 119);
            this.GyroFullScaleComboBox.Name = "GyroFullScaleComboBox";
            this.GyroFullScaleComboBox.Size = new System.Drawing.Size(166, 21);
            this.GyroFullScaleComboBox.TabIndex = 51;
            // 
            // GyroLabel
            // 
            this.GyroLabel.Location = new System.Drawing.Point(9, 123);
            this.GyroLabel.Name = "GyroLabel";
            this.GyroLabel.Size = new System.Drawing.Size(113, 17);
            this.GyroLabel.TabIndex = 50;
            this.GyroLabel.Text = "Gyro Full Scale";
            // 
            // AccFullScaleComboBox
            // 
            this.AccFullScaleComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.AccFullScaleComboBox.FormattingEnabled = true;
            this.AccFullScaleComboBox.Location = new System.Drawing.Point(143, 89);
            this.AccFullScaleComboBox.Name = "AccFullScaleComboBox";
            this.AccFullScaleComboBox.Size = new System.Drawing.Size(166, 21);
            this.AccFullScaleComboBox.TabIndex = 49;
            // 
            // AccLabel
            // 
            this.AccLabel.Location = new System.Drawing.Point(9, 92);
            this.AccLabel.Name = "AccLabel";
            this.AccLabel.Size = new System.Drawing.Size(113, 17);
            this.AccLabel.TabIndex = 48;
            this.AccLabel.Text = "Acc Full Scale";
            // 
            // SensorModeComboBox
            // 
            this.SensorModeComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.SensorModeComboBox.FormattingEnabled = true;
            this.SensorModeComboBox.Location = new System.Drawing.Point(143, 59);
            this.SensorModeComboBox.Name = "SensorModeComboBox";
            this.SensorModeComboBox.Size = new System.Drawing.Size(166, 21);
            this.SensorModeComboBox.TabIndex = 47;
            // 
            // label3
            // 
            this.label3.Location = new System.Drawing.Point(9, 61);
            this.label3.Name = "label3";
            this.label3.Size = new System.Drawing.Size(113, 17);
            this.label3.TabIndex = 46;
            this.label3.Text = "Sensor Mode";
            // 
            // labelSensorSelection
            // 
            this.labelSensorSelection.Location = new System.Drawing.Point(9, 30);
            this.labelSensorSelection.Name = "labelSensorSelection";
            this.labelSensorSelection.Size = new System.Drawing.Size(113, 17);
            this.labelSensorSelection.TabIndex = 1;
            this.labelSensorSelection.Text = "Sensor";
            this.labelSensorSelection.TextAlign = System.Drawing.ContentAlignment.MiddleLeft;
            // 
            // numericUpDownSensorSelection
            // 
            this.numericUpDownSensorSelection.Location = new System.Drawing.Point(143, 30);
            this.numericUpDownSensorSelection.Maximum = new decimal(new int[] {
            16,
            0,
            0,
            0});
            this.numericUpDownSensorSelection.Name = "numericUpDownSensorSelection";
            this.numericUpDownSensorSelection.Size = new System.Drawing.Size(166, 20);
            this.numericUpDownSensorSelection.TabIndex = 0;
            // 
            // InsolesAcqTypeComboBox
            // 
            this.InsolesAcqTypeComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.InsolesAcqTypeComboBox.FormattingEnabled = true;
            this.InsolesAcqTypeComboBox.Location = new System.Drawing.Point(176, 161);
            this.InsolesAcqTypeComboBox.Name = "InsolesAcqTypeComboBox";
            this.InsolesAcqTypeComboBox.Size = new System.Drawing.Size(232, 21);
            this.InsolesAcqTypeComboBox.TabIndex = 51;
            // 
            // InsolesAcqTypeLabel
            // 
            this.InsolesAcqTypeLabel.Location = new System.Drawing.Point(6, 168);
            this.InsolesAcqTypeLabel.Name = "InsolesAcqTypeLabel";
            this.InsolesAcqTypeLabel.Size = new System.Drawing.Size(164, 17);
            this.InsolesAcqTypeLabel.TabIndex = 50;
            this.InsolesAcqTypeLabel.Text = "Insoles Acq Type";
            // 
            // InsolesGyroFullScaleComboBox
            // 
            this.InsolesGyroFullScaleComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.InsolesGyroFullScaleComboBox.FormattingEnabled = true;
            this.InsolesGyroFullScaleComboBox.Location = new System.Drawing.Point(176, 215);
            this.InsolesGyroFullScaleComboBox.Name = "InsolesGyroFullScaleComboBox";
            this.InsolesGyroFullScaleComboBox.Size = new System.Drawing.Size(232, 21);
            this.InsolesGyroFullScaleComboBox.TabIndex = 60;
            // 
            // InsolesGyroFullScaleLabel
            // 
            this.InsolesGyroFullScaleLabel.Location = new System.Drawing.Point(7, 215);
            this.InsolesGyroFullScaleLabel.Name = "InsolesGyroFullScaleLabel";
            this.InsolesGyroFullScaleLabel.Size = new System.Drawing.Size(126, 21);
            this.InsolesGyroFullScaleLabel.TabIndex = 59;
            this.InsolesGyroFullScaleLabel.Text = "Insoles Gyro Full Scale";
            // 
            // InsolesAccFullScaleComboBox
            // 
            this.InsolesAccFullScaleComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.InsolesAccFullScaleComboBox.FormattingEnabled = true;
            this.InsolesAccFullScaleComboBox.Location = new System.Drawing.Point(176, 188);
            this.InsolesAccFullScaleComboBox.Name = "InsolesAccFullScaleComboBox";
            this.InsolesAccFullScaleComboBox.Size = new System.Drawing.Size(232, 21);
            this.InsolesAccFullScaleComboBox.TabIndex = 58;
            // 
            // InsolesAccFullScaleLabel
            // 
            this.InsolesAccFullScaleLabel.Location = new System.Drawing.Point(7, 192);
            this.InsolesAccFullScaleLabel.Name = "InsolesAccFullScaleLabel";
            this.InsolesAccFullScaleLabel.Size = new System.Drawing.Size(113, 17);
            this.InsolesAccFullScaleLabel.TabIndex = 57;
            this.InsolesAccFullScaleLabel.Text = "Insoles Acc Full Scale";
            // 
            // InsoleConfigurationGroupBox
            // 
            this.InsoleConfigurationGroupBox.Controls.Add(this.RightInsoleEnabledCheckBox);
            this.InsoleConfigurationGroupBox.Controls.Add(this.LeftInsoleEnabledCheckBox);
            this.InsoleConfigurationGroupBox.Location = new System.Drawing.Point(434, 200);
            this.InsoleConfigurationGroupBox.Name = "InsoleConfigurationGroupBox";
            this.InsoleConfigurationGroupBox.Size = new System.Drawing.Size(316, 72);
            this.InsoleConfigurationGroupBox.TabIndex = 68;
            this.InsoleConfigurationGroupBox.TabStop = false;
            this.InsoleConfigurationGroupBox.Text = "Insoles Configuration";
            // 
            // LeftInsoleEnabledCheckBox
            // 
            this.LeftInsoleEnabledCheckBox.CheckAlign = System.Drawing.ContentAlignment.MiddleRight;
            this.LeftInsoleEnabledCheckBox.Location = new System.Drawing.Point(6, 19);
            this.LeftInsoleEnabledCheckBox.Name = "LeftInsoleEnabledCheckBox";
            this.LeftInsoleEnabledCheckBox.Size = new System.Drawing.Size(184, 22);
            this.LeftInsoleEnabledCheckBox.TabIndex = 61;
            this.LeftInsoleEnabledCheckBox.Text = "Left Insole Enabled";
            this.LeftInsoleEnabledCheckBox.UseVisualStyleBackColor = true;
            this.LeftInsoleEnabledCheckBox.CheckedChanged += new System.EventHandler(this.LeftInsoleEnabledCheckBox_CheckedChanged);
            // 
            // RightInsoleEnabledCheckBox
            // 
            this.RightInsoleEnabledCheckBox.CheckAlign = System.Drawing.ContentAlignment.MiddleRight;
            this.RightInsoleEnabledCheckBox.Location = new System.Drawing.Point(6, 41);
            this.RightInsoleEnabledCheckBox.Name = "RightInsoleEnabledCheckBox";
            this.RightInsoleEnabledCheckBox.Size = new System.Drawing.Size(184, 22);
            this.RightInsoleEnabledCheckBox.TabIndex = 62;
            this.RightInsoleEnabledCheckBox.Text = "Right Insole Enabled";
            this.RightInsoleEnabledCheckBox.UseVisualStyleBackColor = true;
            this.RightInsoleEnabledCheckBox.CheckedChanged += new System.EventHandler(this.RightInsoleEnabledCheckBox_CheckedChanged);
            // 
            // InsoleProtocolComboBox
            // 
            this.InsoleProtocolComboBox.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            this.InsoleProtocolComboBox.FormattingEnabled = true;
            this.InsoleProtocolComboBox.Location = new System.Drawing.Point(177, 134);
            this.InsoleProtocolComboBox.Name = "InsoleProtocolComboBox";
            this.InsoleProtocolComboBox.Size = new System.Drawing.Size(232, 21);
            this.InsoleProtocolComboBox.TabIndex = 62;
            // 
            // InsoleProtocolLabel
            // 
            this.InsoleProtocolLabel.Location = new System.Drawing.Point(7, 141);
            this.InsoleProtocolLabel.Name = "InsoleProtocolLabel";
            this.InsoleProtocolLabel.Size = new System.Drawing.Size(164, 17);
            this.InsoleProtocolLabel.TabIndex = 61;
            this.InsoleProtocolLabel.Text = "Insoles Transmission Protocol";
            // 
            // CaptureAndSensorsConfigurationForm
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(762, 328);
            this.Controls.Add(this.InsoleConfigurationGroupBox);
            this.Controls.Add(this.groupBoxSensorConfig);
            this.Controls.Add(this.groupBoxCaptureConfiguration);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedSingle;
            this.MinimizeBox = false;
            this.Name = "CaptureAndSensorsConfigurationForm";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Capture and Sensors Configuration";
            this.groupBoxCaptureConfiguration.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.numericUpDownCapturingEnabledTriggerLevel)).EndInit();
            this.groupBoxSensorConfig.ResumeLayout(false);
            ((System.ComponentModel.ISupportInitialize)(this.numericUpDownSensorSelection)).EndInit();
            this.InsoleConfigurationGroupBox.ResumeLayout(false);
            this.ResumeLayout(false);

        }

        #endregion

        private System.Windows.Forms.GroupBox groupBoxCaptureConfiguration;
        private System.Windows.Forms.ComboBox EmgAcqTypeComboBox;
        private System.Windows.Forms.Label EmgAcqTypeLabel;
        private System.Windows.Forms.Button buttonGetCaptureConfiguration;
        private System.Windows.Forms.Button buttonConfigureCapture;
        private System.Windows.Forms.Label labelCapturingEnabledTriggerLevel;
        private System.Windows.Forms.NumericUpDown numericUpDownCapturingEnabledTriggerLevel;
        private System.Windows.Forms.CheckBox checkBoxTriggerEnabled;
        private System.Windows.Forms.GroupBox groupBoxSensorConfig;
        private System.Windows.Forms.Label labelSensorSelection;
        private System.Windows.Forms.NumericUpDown numericUpDownSensorSelection;
        private System.Windows.Forms.ComboBox ImuEmgAcqTypeComboBox;
        private System.Windows.Forms.Label ImuEmgAcqTypeLabel;
        private System.Windows.Forms.ComboBox ImuAcqTypeComboBox;
        private System.Windows.Forms.Label ImuAcqTypeLabel;
        private System.Windows.Forms.ComboBox SensorModeComboBox;
        private System.Windows.Forms.Label label3;
        private System.Windows.Forms.ComboBox AccFullScaleComboBox;
        private System.Windows.Forms.Label AccLabel;
        private System.Windows.Forms.ComboBox GyroFullScaleComboBox;
        private System.Windows.Forms.Label GyroLabel;
        private System.Windows.Forms.Button SensorConfigButton;
        private System.Windows.Forms.ComboBox InsolesAcqTypeComboBox;
        private System.Windows.Forms.Label InsolesAcqTypeLabel;
        private System.Windows.Forms.ComboBox InsolesGyroFullScaleComboBox;
        private System.Windows.Forms.Label InsolesGyroFullScaleLabel;
        private System.Windows.Forms.ComboBox InsolesAccFullScaleComboBox;
        private System.Windows.Forms.Label InsolesAccFullScaleLabel;
        private System.Windows.Forms.GroupBox InsoleConfigurationGroupBox;
        private System.Windows.Forms.CheckBox RightInsoleEnabledCheckBox;
        private System.Windows.Forms.CheckBox LeftInsoleEnabledCheckBox;
        private System.Windows.Forms.ComboBox InsoleProtocolComboBox;
        private System.Windows.Forms.Label InsoleProtocolLabel;
    }
}