"""Persistent Gressus ROS runtime supervised by one top-level launch process."""

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def _launch_file(package: str, name: str) -> str:
    return f"{get_package_share_directory(package)}/launch/{name}"


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('threshold_kpa', default_value='8.0'),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(_launch_file('gressus_session', 'session_manager.launch.py')),
        ),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(_launch_file('gressus_bringup', 'insole.launch.py')),
            launch_arguments={
                'threshold_kpa': LaunchConfiguration('threshold_kpa'),
            }.items(),
        ),
    ])
