from launch import LaunchDescription
from launch.actions import ExecuteProcess, DeclareLaunchArgument
from launch.substitutions import EnvironmentVariable, FindExecutable, LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        DeclareLaunchArgument(
            'session_port',
            default_value=EnvironmentVariable('GRESSUS_SESSION_PORT', default_value='9090'),
        ),
        ExecuteProcess(
            cmd=[
                FindExecutable(name='ros2'),
                'run',
                'gressus_session',
                'session_manager',
                '--port',
                LaunchConfiguration('session_port'),
            ],
            output='screen',
            respawn=True,
            respawn_delay=2.0,
        ),
    ])
