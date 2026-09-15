from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('threshold_kpa', default_value='8.0'),
        DeclareLaunchArgument('emg_port', default_value='9101'),
        Node(
            package='gressus_insole',
            executable='insole_bridge_node',
            name='insole_bridge_node',
            output='screen',
            respawn=True,
            respawn_delay=2.0,
            parameters=[{
                'threshold_kpa': LaunchConfiguration('threshold_kpa'),
            }],
        ),
        # This listener is intentionally harmless until the Windows bridge is
        # started with explicit --emg-tcp/--emg-sensors arguments.
        Node(
            package='gressus_insole',
            executable='emg_bridge_node',
            name='emg_bridge_node',
            output='screen',
            respawn=True,
            respawn_delay=2.0,
            parameters=[{
                'port': LaunchConfiguration('emg_port'),
            }],
        ),
    ])
