from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _game_node(context, *args, **kwargs):
    argv = [
        '--output-rotation', LaunchConfiguration('output_rotation').perform(context),
        '--insole-thresh-kpa', LaunchConfiguration('insole_thresh_kpa').perform(context),
        '--speed', LaunchConfiguration('speed').perform(context),
        '--step-time-s', LaunchConfiguration('step_time_s').perform(context),
    ]
    display = LaunchConfiguration('display').perform(context).strip()
    if display and display.lower() not in {'none', 'auto', ''}:
        argv.extend(['-d', display])
    if LaunchConfiguration('demo').perform(context).lower() in {'true', '1', 'yes'}:
        argv.append('--demo')
    if LaunchConfiguration('no_insole').perform(context).lower() in {'true', '1', 'yes'}:
        argv.append('--no-insole')

    return [
        Node(
            package='gressus_game',
            executable='tile_game_node',
            name='tile_game_node',
            output='screen',
            arguments=argv,
        ),
    ]


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument('output_rotation', default_value='270'),
        DeclareLaunchArgument('insole_thresh_kpa', default_value='8.0'),
        DeclareLaunchArgument('speed', default_value='0.35'),
        DeclareLaunchArgument('step_time_s', default_value='2.5'),
        DeclareLaunchArgument('display', default_value='none'),
        DeclareLaunchArgument('demo', default_value='false'),
        DeclareLaunchArgument('no_insole', default_value='false'),
        OpaqueFunction(function=_game_node),
    ])
