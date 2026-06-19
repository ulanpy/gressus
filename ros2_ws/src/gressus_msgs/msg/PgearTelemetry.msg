# P.GEAR LogPacket_v2 telemetry (100 Hz UDP). Joint arrays: [R-hip, R-knee, L-hip, L-knee].

std_msgs/Header header

uint32 seq
uint32 controller_time_ms
uint8 version

uint8 gait_phase
uint8 step_idx
uint8 profile_slot
uint8 sensor_health_mask
uint16 flags
uint16 link_age_ms

float32[4] ref_pos
float32[4] pos
float32[4] vel
float32[4] cmd_torque
float32[4] meas_torque
float32[4] grav_term
float32[4] ff_term
float32[4] iq_measured
float32[4] motor_effort
uint16[4] hb_age_ms

float32 assist_r
float32 assist_l
float32 deadzone_r
float32 deadzone_l
float32 amp_r
float32 amp_l

uint16 ctrl_loop_us
uint16 link_crc_fails
uint16 link_resyncs
uint8 cross_check_fault
uint8 hb_error_byte
uint16 packet_crc

bool connected
string error
