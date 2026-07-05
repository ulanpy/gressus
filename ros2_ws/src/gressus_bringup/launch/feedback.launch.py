import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    bringup_dir = os.path.join(get_package_share_directory('gressus_bringup'), 'launch')

    return LaunchDescription([
        DeclareLaunchArgument('udp_port', default_value='47000'),
        DeclareLaunchArgument('insole_thresh_kpa', default_value='8.0'),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(bringup_dir, 'insole.launch.py')),
            launch_arguments={
                'threshold_kpa': LaunchConfiguration('insole_thresh_kpa'),
            }.items(),
        ),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(bringup_dir, 'camera.launch.py')),
        ),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(bringup_dir, 'pgear.launch.py')),
            launch_arguments={
                'udp_port': LaunchConfiguration('udp_port'),
            }.items(),
        ),
    ])
