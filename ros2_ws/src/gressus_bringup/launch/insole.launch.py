from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('threshold_kpa', default_value='8.0'),
        Node(
            package='gressus_insole',
            executable='insole_bridge_node',
            name='insole_bridge_node',
            output='screen',
            parameters=[{
                'threshold_kpa': LaunchConfiguration('threshold_kpa'),
            }],
        ),
    ])
