# One complete raw EMG batch from the WaveX bridge.
# header.stamp is Linux receipt time, not an asserted hardware sample clock.
std_msgs/Header header
uint64 frame_seq
uint32 sample_rate_hz
uint32 samples_per_channel
# WaveX 1-based sensor slots. Samples are channel-major in this same order.
uint16[] sensor_slots
float32[] samples
