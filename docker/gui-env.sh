#!/usr/bin/env bash
# Auto-detect host GUI session for containerized pygame/OpenCV/RViz.
# Prefer X11 when DISPLAY socket exists (reliable for pygame multi-monitor / projector).

detect_gui_env() {
  local display_num x11_socket

  if [ -n "${DISPLAY:-}" ]; then
    display_num="${DISPLAY#*:}"
    display_num="${display_num%%.*}"
    x11_socket="/tmp/.X11-unix/X${display_num}"
    if [ -S "${x11_socket}" ]; then
      export GDK_BACKEND=x11
      export QT_QPA_PLATFORM=xcb
      export SDL_VIDEODRIVER=x11
      export QT_X11_NO_MITSHM=1
      if [ -z "${XAUTHORITY:-}" ] && [ -f /root/.Xauthority ]; then
        export XAUTHORITY=/root/.Xauthority
      fi
      echo "[gui] X11 via DISPLAY=${DISPLAY} (${x11_socket})"
      return 0
    fi
  fi

  if [ -n "${WAYLAND_DISPLAY:-}" ] && [ -n "${XDG_RUNTIME_DIR:-}" ]; then
    if [ -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]; then
      export GDK_BACKEND=wayland
      export QT_QPA_PLATFORM=wayland
      export SDL_VIDEODRIVER=wayland
      export MOZ_ENABLE_WAYLAND=1
      echo "[gui] Wayland via ${WAYLAND_DISPLAY} (${XDG_RUNTIME_DIR})"
      return 0
    fi
  fi

  echo "[gui] No GUI socket found (DISPLAY/WAYLAND). GUI apps may fail." >&2
  return 1
}

detect_gui_env || true
