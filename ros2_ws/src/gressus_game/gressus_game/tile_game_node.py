"""ROS 2 tile game node: subscribes to insole + camera topics."""

from __future__ import annotations

import argparse
import os
import sys
import threading
from pathlib import Path

import cv2
import rclpy
from cv_bridge import CvBridge
from rclpy.node import Node
from sensor_msgs.msg import Image
from std_msgs.msg import Float32

from gressus_msgs.msg import InsolePressure


def _ensure_gressus_path() -> Path:
    root = Path(os.environ.get("GRESSUS_ROOT", "/gressus")).resolve()
    root_str = str(root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)
    return root


class TileGameNode(Node):
    def __init__(self) -> None:
        super().__init__("tile_game_node")
        self.declare_parameter("insole_topic", "/insole/pressure")
        self.declare_parameter("color_topic", "/camera/color/image_raw")
        self.declare_parameter("depth_topic", "/camera/aligned_depth_to_color/image_raw")
        self.declare_parameter("depth_scale_topic", "/camera/depth_scale_m")

        from station.lib.game.sources import RosCameraFeed, RosInsoleFeed

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
        self.create_subscription(Image, depth_topic, self._on_depth, 10)
        self.create_subscription(Image, color_topic, self._on_color, 10)
        self.create_subscription(Float32, scale_topic, self._on_depth_scale, 10)

        self.get_logger().info(
            f"subscribed insole={insole_topic}, color={color_topic}, depth={depth_topic}"
        )

    def _on_depth_scale(self, msg: Float32) -> None:
        self.camera_feed.set_depth_scale_m(float(msg.data))

    def _on_depth(self, msg: Image) -> None:
        depth_mm = self._bridge.imgmsg_to_cv2(msg, desired_encoding="32FC1")
        self.camera_feed.update_depth(depth_mm.astype("float32", copy=False))

    def _on_color(self, msg: Image) -> None:
        color_bgr = self._bridge.imgmsg_to_cv2(msg, desired_encoding="bgr8")
        color_gray = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2GRAY)
        self.camera_feed.update_color_gray(color_gray)


def _parse_game_args(argv: list[str]) -> argparse.Namespace:
    from station.runners.tile_game import parse_args

    return parse_args(argv)


def main(args=None) -> None:
    _ensure_gressus_path()
    rclpy.init(args=args)
    node = TileGameNode()

    spin_thread = threading.Thread(target=rclpy.spin, args=(node,), daemon=True)
    spin_thread.start()

    from rclpy.utilities import remove_ros_args

    game_argv = remove_ros_args(args=sys.argv)[1:]
    game_args = _parse_game_args(game_argv)

    from station.runners.tile_game import run_tile_game

    try:
        insole_feed = None if game_args.no_insole else node.insole_feed
        camera_feed = None if game_args.demo else node.camera_feed
        run_tile_game(
            game_args,
            insole_feed=insole_feed,
            camera_feed=camera_feed,
        )
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()
