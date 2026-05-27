FROM osrf/ros:jazzy-desktop-full

ENV DEBIAN_FRONTEND=noninteractive
ENV ROS_DISTRO=jazzy

# Base tooling + GUI (X11 + Wayland) + audio + RealSense + ROS game Python deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    curl \
    wget \
    python3-pip \
    python3-rosdep \
    python3-colcon-common-extensions \
    x11-apps \
    xauth \
    x11-xserver-utils \
    libxcb1 \
    libxtst6 \
    libxi6 \
    libxcb-xfixes0-dev \
    libxcb-shape0 \
    libxcb-render0 \
    libxcb-render0-dev \
    libxcb-randr0 \
    libxcb-randr0-dev \
    libxcb-xtest0-dev \
    libxcb-keysyms1-dev \
    libxcb-image0-dev \
    libxcb-icccm4-dev \
    libxcb-sync-dev \
    libxcb-xinerama0-dev \
    libxcb-xkb-dev \
    libxkbcommon-dev \
    libxkbcommon-x11-dev \
    libxcb-cursor0 \
    libwayland-client0 \
    libwayland-cursor0 \
    libwayland-egl1 \
    wayland-protocols \
    qtwayland5 \
    libqt5x11extras5 \
    qt5-gtk-platformtheme \
    libqt5gui5 \
    libgl1 \
    libegl1 \
    libsdl2-2.0-0 \
    libsdl2-mixer-2.0-0 \
    libsndfile1 \
    libasound2t64 \
    portaudio19-dev \
    ros-jazzy-rviz2 \
    ros-jazzy-rqt-plot \
    ros-jazzy-cv-bridge \
    ros-jazzy-rosbag2 \
    ros-jazzy-rosbag2-storage-mcap \
    ros-jazzy-apriltag-msgs \
    apt-transport-https \
    lsb-release \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# RealSense SDK — new realsenseai.com repo (for ros-jazzy-realsense2-camera later).
# Skip librealsense2-dkms in Docker: container uses host kernel via privileged + /dev.
RUN apt-get update && apt-get install -y --no-install-recommends gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -sSf https://librealsense.realsenseai.com/Debian/librealsenseai.asc | \
    gpg --dearmor -o /etc/apt/keyrings/librealsenseai.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/librealsenseai.gpg] https://librealsense.realsenseai.com/Debian/apt-repo $(lsb_release -cs) main" | \
    tee /etc/apt/sources.list.d/librealsense.list > /dev/null && \
    apt-get update && apt-get install -y --no-install-recommends \
    librealsense2-utils \
    librealsense2-dev \
    ros-jazzy-realsense2-camera \
    && rm -rf /var/lib/apt/lists/*


    # Keep NumPy 1.x for ros-jazzy cv_bridge; pip overlay must not upgrade to 2.x.
RUN pip3 install --no-cache-dir --break-system-packages --ignore-installed \
    "numpy>=1.26.0,<2" \
    "opencv-contrib-python>=4.13.0,<5" \
    "pygame>=2.6.1,<3" \
    "pyrealsense2>=2.57.7,<3" \
    "pupil-apriltags>=1.0.4.post11,<2" \
    "sounddevice>=0.5.5,<0.6" \
    "websockets>=14.0"

RUN rosdep update

RUN mkdir -p /gressus/ros2_ws/src

COPY docker/entrypoint.sh /usr/local/bin/gressus-entrypoint.sh
COPY docker/ros-env.sh /usr/local/bin/gressus-ros-env.sh
COPY docker/ros-env.sh /etc/profile.d/gressus-ros.sh
COPY docker/gui-env.sh /usr/local/bin/gressus-gui-env.sh
RUN chmod +x /usr/local/bin/gressus-entrypoint.sh /usr/local/bin/gressus-ros-env.sh /etc/profile.d/gressus-ros.sh /usr/local/bin/gressus-gui-env.sh

WORKDIR /gressus/ros2_ws

ENTRYPOINT ["/usr/local/bin/gressus-entrypoint.sh"]
CMD ["bash"]
