from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('camera', default_value='realsense'),
        DeclareLaunchArgument('width', default_value='640'),
        DeclareLaunchArgument('height', default_value='480'),
        DeclareLaunchArgument('fps', default_value='30'),
        DeclareLaunchArgument('display', default_value='0'),
        DeclareLaunchArgument('tag_size', default_value='280'),
        DeclareLaunchArgument('margin', default_value='30'),
        Node(
            package='gressus_calibration',
            executable='calibrate_apriltag',
            name='calibrate_apriltag',
            output='screen',
            arguments=[
                '-c', LaunchConfiguration('camera'),
                '--width', LaunchConfiguration('width'),
                '--height', LaunchConfiguration('height'),
                '--fps', LaunchConfiguration('fps'),
                '--display', LaunchConfiguration('display'),
                '--tag-size', LaunchConfiguration('tag_size'),
                '--margin', LaunchConfiguration('margin'),
            ],
        ),
    ])
