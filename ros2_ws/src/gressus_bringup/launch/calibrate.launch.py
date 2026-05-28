from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, RegisterEventHandler, Shutdown
from launch.event_handlers import OnProcessExit
from launch.substitutions import LaunchConfiguration


def generate_launch_description() -> LaunchDescription:
    calibrate = ExecuteProcess(
        cmd=[
            'ros2',
            'run',
            'gressus_calibration',
            'calibrate_apriltag',
            '--',
            '-c',
            LaunchConfiguration('camera'),
            '--width',
            LaunchConfiguration('width'),
            '--height',
            LaunchConfiguration('height'),
            '--fps',
            LaunchConfiguration('fps'),
            '--display',
            LaunchConfiguration('display'),
            '--tag-size',
            LaunchConfiguration('tag_size'),
            '--margin',
            LaunchConfiguration('margin'),
            '--output-rotation',
            LaunchConfiguration('output_rotation'),
        ],
        output='screen',
    )
    return LaunchDescription([
        DeclareLaunchArgument('camera', default_value='realsense'),
        DeclareLaunchArgument('width', default_value='640'),
        DeclareLaunchArgument('height', default_value='480'),
        DeclareLaunchArgument('fps', default_value='30'),
        DeclareLaunchArgument('display', default_value='0'),
        DeclareLaunchArgument('tag_size', default_value='280'),
        DeclareLaunchArgument('margin', default_value='30'),
        DeclareLaunchArgument('output_rotation', default_value='270'),
        calibrate,
        RegisterEventHandler(
            OnProcessExit(
                target_action=calibrate,
                on_exit=[Shutdown(reason='calibration finished')],
            )
        ),
    ])
