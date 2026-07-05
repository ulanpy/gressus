import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('udp_port', default_value='47000'),
        DeclareLaunchArgument('publish_hz', default_value='100.0'),
        DeclareLaunchArgument('stale_after_s', default_value='0.5'),
        DeclareLaunchArgument('topic', default_value='/exoskeleton/telemetry'),
        DeclareLaunchArgument('frame_id', default_value='exoskeleton'),
        DeclareLaunchArgument('serve_ws', default_value='true'),
        DeclareLaunchArgument('ws_port', default_value='8766'),
        DeclareLaunchArgument('ws_path', default_value='/ws/exoskeleton'),
        DeclareLaunchArgument('ws_hz', default_value='20.0'),
        Node(
            package='gressus_pgear',
            executable='pgear_device_node',
            name='pgear_device_node',
            output='screen',
            parameters=[{
                'udp_port': LaunchConfiguration('udp_port'),
                'publish_hz': LaunchConfiguration('publish_hz'),
                'stale_after_s': LaunchConfiguration('stale_after_s'),
                'topic': LaunchConfiguration('topic'),
                'frame_id': LaunchConfiguration('frame_id'),
                'serve_ws': LaunchConfiguration('serve_ws'),
                'ws_port': LaunchConfiguration('ws_port'),
                'ws_path': LaunchConfiguration('ws_path'),
                'ws_hz': LaunchConfiguration('ws_hz'),
            }],
        ),
    ])
