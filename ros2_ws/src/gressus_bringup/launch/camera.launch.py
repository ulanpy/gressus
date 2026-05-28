from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        Node(
            package='gressus_realsense',
            executable='realsense_node',
            name='realsense_node',
            output='screen',
            parameters=[{
                'color_width': 640,
                'color_height': 480,
                'color_fps': 30,
                'depth_width': 640,
                'depth_height': 480,
                'depth_fps': 30,
                'publish_hz': 30.0,
            }],
        ),
    ])
