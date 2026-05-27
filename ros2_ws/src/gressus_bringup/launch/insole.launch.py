from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        Node(
            package='gressus_insole',
            executable='insole_bridge_node',
            name='insole_bridge_node',
            output='screen',
        ),
    ])
