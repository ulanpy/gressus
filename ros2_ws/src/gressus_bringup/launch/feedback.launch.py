import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    bringup_dir = os.path.join(get_package_share_directory('gressus_bringup'), 'launch')

    return LaunchDescription([
        DeclareLaunchArgument('esp_host', default_value=''),
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
                'esp_host': LaunchConfiguration('esp_host'),
            }.items(),
        ),
    ])
