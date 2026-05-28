"""ROS 2 node: RealSense color + aligned depth publisher."""

from __future__ import annotations

import numpy as np
import rclpy
from cv_bridge import CvBridge
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import Image
from std_msgs.msg import Float32


class RealSenseNode(Node):
    def __init__(self) -> None:
        super().__init__("realsense_node")
        self.declare_parameter("color_topic", "/camera/color/image_raw")
        self.declare_parameter("depth_topic", "/camera/aligned_depth_to_color/image_raw")
        self.declare_parameter("depth_scale_topic", "/camera/depth_scale_m")
        self.declare_parameter("depth_width", 640)
        self.declare_parameter("depth_height", 480)
        self.declare_parameter("depth_fps", 15)
        self.declare_parameter("color_width", 640)
        self.declare_parameter("color_height", 480)
        self.declare_parameter("color_fps", 15)
        self.declare_parameter("publish_hz", 15.0)

        color_topic = str(self.get_parameter("color_topic").value)
        depth_topic = str(self.get_parameter("depth_topic").value)
        scale_topic = str(self.get_parameter("depth_scale_topic").value)
        dw = int(self.get_parameter("depth_width").value)
        dh = int(self.get_parameter("depth_height").value)
        dfps = int(self.get_parameter("depth_fps").value)
        cw = int(self.get_parameter("color_width").value)
        ch = int(self.get_parameter("color_height").value)
        cfps = int(self.get_parameter("color_fps").value)
        hz = float(self.get_parameter("publish_hz").value)

        import pyrealsense2 as rs

        from gressus_realsense.realsense_depth import start_realsense

        self._bridge = CvBridge()
        self._pipe, self._align, self._depth_scale_m = start_realsense(
            rs,
            depth_width=dw,
            depth_height=dh,
            depth_fps=dfps,
            color_width=cw,
            color_height=ch,
            color_fps=cfps,
        )

        self._color_pub = self.create_publisher(Image, color_topic, qos_profile_sensor_data)
        self._depth_pub = self.create_publisher(Image, depth_topic, qos_profile_sensor_data)
        self._scale_pub = self.create_publisher(Float32, scale_topic, 10)

        scale_msg = Float32()
        scale_msg.data = float(self._depth_scale_m)
        self._scale_pub.publish(scale_msg)

        self.create_timer(1.0 / max(hz, 1.0), self._publish_frames)
        self.get_logger().info(
            f"publishing color={color_topic}, depth={depth_topic}, scale={scale_topic}"
        )

    def _publish_frames(self) -> None:
        if not rclpy.ok():
            return
        try:
            frames = self._pipe.wait_for_frames(timeout_ms=1000)
        except RuntimeError as exc:
            if rclpy.ok():
                self.get_logger().warning(f"RealSense wait_for_frames: {exc}")
            return

        frames = self._align.process(frames)
        depth_frame = frames.get_depth_frame()
        color_frame = frames.get_color_frame()
        stamp = self.get_clock().now().to_msg()

        try:
            if color_frame:
                color_bgr = np.asanyarray(color_frame.get_data())
                color_msg = self._bridge.cv2_to_imgmsg(color_bgr, encoding="bgr8")
                color_msg.header.stamp = stamp
                color_msg.header.frame_id = "camera_color_optical_frame"
                self._color_pub.publish(color_msg)

            if depth_frame:
                depth_mm = (
                    np.asanyarray(depth_frame.get_data()).astype(np.float32)
                    * self._depth_scale_m
                    * 1000.0
                )
                depth_msg = self._bridge.cv2_to_imgmsg(depth_mm, encoding="32FC1")
                depth_msg.header.stamp = stamp
                depth_msg.header.frame_id = "camera_depth_optical_frame"
                self._depth_pub.publish(depth_msg)

            scale_msg = Float32()
            scale_msg.data = float(self._depth_scale_m)
            self._scale_pub.publish(scale_msg)
        except Exception as exc:
            if rclpy.ok():
                self.get_logger().debug(f"publish skipped during shutdown: {exc}")

    def destroy_node(self) -> bool:
        try:
            self._pipe.stop()
        except Exception:
            pass
        return super().destroy_node()


def main(args=None) -> None:
    rclpy.init(args=args)
    node = RealSenseNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        try:
            node.destroy_node()
        except Exception:
            pass
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == "__main__":
    main()
