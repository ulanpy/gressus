import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    bringup_dir = os.path.join(get_package_share_directory('gressus_bringup'), 'launch')

    game_args = {
        'output_rotation': LaunchConfiguration('output_rotation'),
        'insole_thresh_kpa': LaunchConfiguration('insole_thresh_kpa'),
        'speed': LaunchConfiguration('speed'),
        'step_time_s': LaunchConfiguration('step_time_s'),
        'display': LaunchConfiguration('display'),
        'demo': LaunchConfiguration('demo'),
        'no_insole': LaunchConfiguration('no_insole'),
    }

    return LaunchDescription([
        DeclareLaunchArgument('output_rotation', default_value='270'),
        DeclareLaunchArgument('insole_thresh_kpa', default_value='8.0'),
        DeclareLaunchArgument('speed', default_value='0.35'),
        DeclareLaunchArgument('step_time_s', default_value='2.5'),
        DeclareLaunchArgument('display', default_value='none'),
        DeclareLaunchArgument('demo', default_value='false'),
        DeclareLaunchArgument('no_insole', default_value='true'),
        DeclareLaunchArgument('game_start_delay_s', default_value='3.0'),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(os.path.join(bringup_dir, 'camera.launch.py')),
        ),
        TimerAction(
            period=LaunchConfiguration('game_start_delay_s'),
            actions=[
                IncludeLaunchDescription(
                    PythonLaunchDescriptionSource(os.path.join(bringup_dir, 'game.launch.py')),
                    launch_arguments=game_args.items(),
                ),
            ],
        ),
    ])
