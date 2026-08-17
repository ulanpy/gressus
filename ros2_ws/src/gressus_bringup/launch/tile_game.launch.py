"""Start the projector tile game and the sensors selected by ``mode``."""

import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    IncludeLaunchDescription,
    OpaqueFunction,
    RegisterEventHandler,
    Shutdown,
)
from launch.conditions import IfCondition
from launch.event_handlers import OnProcessExit
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PythonExpression
from launch_ros.actions import Node


def _game_node(context, *args, **kwargs):
    argv = [
        '--output-rotation',
        LaunchConfiguration('output_rotation').perform(context),
        '--insole-thresh-kpa',
        LaunchConfiguration('insole_thresh_kpa').perform(context),
        '--speed', LaunchConfiguration('speed').perform(context),
        '--step-time-s',
        LaunchConfiguration('step_time_s').perform(context),
        '--mode', LaunchConfiguration('mode').perform(context).strip().lower(),
    ]
    display = LaunchConfiguration('display').perform(context).strip()
    if display and display.lower() not in {'none', 'auto', ''}:
        argv.extend(['-d', display])

    game = Node(
        package='gressus_game',
        executable='tile_game_node',
        name='tile_game_node',
        output='screen',
        arguments=argv,
    )
    return [
        game,
        RegisterEventHandler(
            OnProcessExit(
                target_action=game,
                on_exit=[Shutdown(reason='tile game exited')],
            )
        ),
    ]


def generate_launch_description() -> LaunchDescription:
    bringup_dir = os.path.join(
        get_package_share_directory('gressus_bringup'), 'launch'
    )

    return LaunchDescription([
        DeclareLaunchArgument('mode', default_value='camera'),
        DeclareLaunchArgument('output_rotation', default_value='270'),
        DeclareLaunchArgument('insole_thresh_kpa', default_value='8.0'),
        DeclareLaunchArgument('speed', default_value='0.35'),
        DeclareLaunchArgument('step_time_s', default_value='2.5'),
        DeclareLaunchArgument('display', default_value='none'),
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
            condition=IfCondition(PythonExpression([
                "'", LaunchConfiguration('mode'), "' in ['full', 'camera']",
            ])),
        ),
        IncludeLaunchDescription(
            PythonLaunchDescriptionSource(
                os.path.join(bringup_dir, 'insole.launch.py')
            ),
            condition=IfCondition(PythonExpression([
                "'", LaunchConfiguration('mode'), "' == 'full'",
            ])),
        ),
        # tile_game_node displays its floor-capture prompt only after it has
        # received an aligned depth/color pair. Starting it immediately avoids
        # a guessed startup delay while keeping the operator in that state
        # until the camera is actually ready.
        OpaqueFunction(function=_game_node),
    ])
