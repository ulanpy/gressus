from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('esp_host', default_value=''),
        DeclareLaunchArgument('publish_hz', default_value='100.0'),
        DeclareLaunchArgument('stale_after_s', default_value='0.5'),
        DeclareLaunchArgument('topic', default_value='/exoskeleton/telemetry'),
        DeclareLaunchArgument('frame_id', default_value='exoskeleton'),
        Node(
            package='gressus_pgear',
            executable='pgear_device_node',
            name='pgear_device_node',
            output='screen',
            parameters=[{
                'esp_host': LaunchConfiguration('esp_host'),
                'publish_hz': LaunchConfiguration('publish_hz'),
                'stale_after_s': LaunchConfiguration('stale_after_s'),
                'topic': LaunchConfiguration('topic'),
                'frame_id': LaunchConfiguration('frame_id'),
            }],
        ),
    ])
