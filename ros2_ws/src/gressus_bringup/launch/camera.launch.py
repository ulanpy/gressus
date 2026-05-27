from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        Node(
            package='gressus_realsense',
            executable='realsense_node',
            name='realsense_node',
            output='screen',
        ),
    ])
