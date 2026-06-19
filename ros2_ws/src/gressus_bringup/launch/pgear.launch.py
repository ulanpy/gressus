from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('host', default_value='0.0.0.0'),
        DeclareLaunchArgument('port', default_value='47000'),
        DeclareLaunchArgument('publish_hz', default_value='100.0'),
        DeclareLaunchArgument('stale_after_s', default_value='0.5'),
        DeclareLaunchArgument('topic', default_value='/exoskeleton/telemetry'),
        Node(
            package='gressus_pgear',
            executable='pgear_bridge_node',
            name='pgear_bridge_node',
            output='screen',
            parameters=[{
                'host': LaunchConfiguration('host'),
                'port': LaunchConfiguration('port'),
                'publish_hz': LaunchConfiguration('publish_hz'),
                'stale_after_s': LaunchConfiguration('stale_after_s'),
                'topic': LaunchConfiguration('topic'),
            }],
        ),
    ])
