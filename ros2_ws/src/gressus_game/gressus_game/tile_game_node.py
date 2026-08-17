"""ROS 2 tile game node: subscribes to insole + camera topics."""

from __future__ import annotations

import sys
import threading

import cv2
import numpy as np
import rclpy
from cv_bridge import CvBridge
from rclpy.executors import MultiThreadedExecutor
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Image
from std_msgs.msg import Float32

from gressus_msgs.msg import InsolePressure


class TileGameNode(Node):
    def __init__(self) -> None:
        super().__init__("tile_game_node")
        self.declare_parameter("insole_topic", "/insole/pressure")
        self.declare_parameter("color_topic", "/camera/color/image_raw")
        self.declare_parameter("depth_topic", "/camera/aligned_depth_to_color/image_raw")
        self.declare_parameter("depth_scale_topic", "/camera/depth_scale_m")

        from gressus_game.insole_ros_feed import RosInsoleFeed
        from gressus_game.sources import RosCameraFeed

        self.insole_feed = RosInsoleFeed()
        self.camera_feed = RosCameraFeed()
        self._bridge = CvBridge()

        insole_topic = str(self.get_parameter("insole_topic").value)
        color_topic = str(self.get_parameter("color_topic").value)
        depth_topic = str(self.get_parameter("depth_topic").value)
        scale_topic = str(self.get_parameter("depth_scale_topic").value)

        self.create_subscription(
            InsolePressure,
            insole_topic,
            self.insole_feed.update_from_msg,
            10,
        )
        self.create_subscription(
            Image,
            depth_topic,
            self._on_depth,
            qos_profile_sensor_data,
        )
        self.create_subscription(
            Image,
            color_topic,
            self._on_color,
            qos_profile_sensor_data,
        )
        self.create_subscription(Float32, scale_topic, self._on_depth_scale, 10)

        self.get_logger().info(
            f"subscribed insole={insole_topic}, color={color_topic}, depth={depth_topic}"
        )

    def _on_depth_scale(self, msg: Float32) -> None:
        self.camera_feed.set_depth_scale_m(float(msg.data))

    def _depth_msg_to_mm(self, msg: Image) -> np.ndarray:
        encoding = (msg.encoding or "").upper()
        if encoding == "32FC1":
            depth = self._bridge.imgmsg_to_cv2(msg, desired_encoding="passthrough")
            return np.ascontiguousarray(depth, dtype=np.float32)
        if encoding in {"16UC1", "MONO16"}:
            raw = self._bridge.imgmsg_to_cv2(msg, desired_encoding="passthrough")
            return raw.astype(np.float32) * self.camera_feed.depth_scale_m * 1000.0
        depth = self._bridge.imgmsg_to_cv2(msg, desired_encoding="32FC1")
        return np.ascontiguousarray(depth, dtype=np.float32)

    def _on_depth(self, msg: Image) -> None:
        try:
            depth_mm = self._depth_msg_to_mm(msg)
            self.camera_feed.update_depth(depth_mm)
        except Exception as exc:
            self.get_logger().error(f"depth frame dropped: {exc}")

    def _on_color(self, msg: Image) -> None:
        try:
            color_bgr = self._bridge.imgmsg_to_cv2(msg, desired_encoding="bgr8")
            color_gray = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2GRAY)
            self.camera_feed.update_color_gray(color_gray)
        except Exception as exc:
            self.get_logger().error(f"color frame dropped: {exc}")


def main(args=None) -> None:
    rclpy.init(args=args)
    node = TileGameNode()

    executor = MultiThreadedExecutor(num_threads=2)
    executor.add_node(node)
    spin_thread = threading.Thread(target=executor.spin, daemon=True)
    spin_thread.start()

    from rclpy.utilities import remove_ros_args

    from gressus_game.tile_game import parse_args, run_tile_game

    game_argv = remove_ros_args(args=sys.argv)[1:]
    game_args = parse_args(game_argv)

    try:
        insole_feed = node.insole_feed if game_args.mode == "full" else None
        camera_feed = node.camera_feed if game_args.mode in {"full", "camera"} else None
        run_tile_game(
            game_args,
            insole_feed=insole_feed,
            camera_feed=camera_feed,
            log_info=node.get_logger().info,
            log_warn=node.get_logger().warning,
        )
    finally:
        executor.shutdown()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
