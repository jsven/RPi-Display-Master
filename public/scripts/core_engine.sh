#!/usr/bin/env bash
set -euo pipefail

# RPi-Display Master - Core Engine
# This file is a template. The web backend will inject values into the placeholders below.

SCREEN_ID="__SCREEN_ID__"
SCREEN_NAME="__SCREEN_NAME__"
OS_VARIANT="__OS_VARIANT__"   # e.g. bookworm64 / bullseye32 (informational)
ROT_DEG="__ROT_DEG__"         # 0 / 90 / 180 / 270
LANGUAGE="__LANG__"          # zh / en
SCENARIO="__SCENARIO__"      # hdmi_cvt / lcd_show_driver

HDMI_GROUP="__HDMI_GROUP__"
HDMI_MODE="__HDMI_MODE__"
HDMI_DRIVE="__HDMI_DRIVE__"
HDMI_CVT="__HDMI_CVT__"       # e.g. "480 1920 60 6 0 0 0"

TOUCH_TYPE="__TOUCH_TYPE__"   # usb / i2c / none

LCDSHOW_REPO="__LCDSHOW_REPO__"
LCDSHOW_INSTALLER="__LCDSHOW_INSTALLER__"
LCDSHOW_ROTARG="__LCDSHOW_ROTARG__" # 1/0

BEGIN_MARK="# >>> RPi-Display-Master BEGIN (${SCREEN_ID}) >>>"
END_MARK="# <<< RPi-Display-Master END (${SCREEN_ID}) <<<"

tr() {
  local key="$1"
  case "${LANGUAGE}:${key}" in
    zh:need_root) echo "请使用 root 运行：sudo bash <(curl -sL ... )" ;;
    en:need_root) echo "Please run as root: sudo bash <(curl -sL ... )" ;;

    zh:missing_config) echo "未找到 config.txt（/boot/firmware/config.txt 或 /boot/config.txt）" ;;
    en:missing_config) echo "config.txt not found (/boot/firmware/config.txt or /boot/config.txt)" ;;

    zh:backup_done) echo "已备份" ;;
    en:backup_done) echo "Backup created" ;;

    zh:remove_old_block) echo "检测到旧配置块，正在移除旧块以便重写（幂等）" ;;
    en:remove_old_block) echo "Existing config block found, removing it for idempotency" ;;

    zh:write_hdmi_done) echo "已写入 HDMI 参数（hdmi_group/mode/cvt）" ;;
    en:write_hdmi_done) echo "HDMI parameters written (hdmi_group/mode/cvt)" ;;

    zh:touch_none) echo "触摸：none（跳过触摸校准）" ;;
    en:touch_none) echo "Touch: none (skip calibration)" ;;

    zh:touch_written) echo "已写入触摸校准（X11/libinput）" ;;
    en:touch_written) echo "Touch calibration written (X11/libinput)" ;;

    zh:touch_skip_wayland) echo "未检测到 /etc/X11/xorg.conf.d，跳过触摸校准文件写入（可能是 Wayland/精简系统）。" ;;
    en:touch_skip_wayland) echo "No /etc/X11/xorg.conf.d found; skipping touch calibration (maybe Wayland/minimal OS)." ;;

    zh:done_reboot) echo "完成。建议重启生效：sudo reboot" ;;
    en:done_reboot) echo "Done. Reboot recommended: sudo reboot" ;;

    zh:lcdshow_start) echo "开始安装 LCD-show 驱动" ;;
    en:lcdshow_start) echo "Starting LCD-show driver install" ;;

    zh:lcdshow_clone) echo "克隆/更新 LCD-show 仓库" ;;
    en:lcdshow_clone) echo "Cloning/updating LCD-show repo" ;;

    zh:lcdshow_run) echo "执行驱动安装脚本" ;;
    en:lcdshow_run) echo "Running installer script" ;;

    zh:lcdshow_done) echo "LCD-show 安装流程已触发（部分脚本会自动重启）" ;;
    en:lcdshow_done) echo "LCD-show install flow triggered (some installers reboot automatically)" ;;

    zh:restore_no_backup) echo "未找到备份文件" ;;
    en:restore_no_backup) echo "No backup file found" ;;

    zh:restore_done) echo "恢复完成。建议重启：sudo reboot" ;;
    en:restore_done) echo "Restore complete. Reboot recommended: sudo reboot" ;;

    zh:using_config) echo "使用配置文件" ;;
    en:using_config) echo "Using config file" ;;

    zh:touch_removed) echo "已移除触摸配置" ;;
    en:touch_removed) echo "Touch config removed" ;;

    zh:start_config) echo "开始配置" ;;
    en:start_config) echo "Starting configuration" ;;

    zh:unsupported_rot) echo "不支持的旋转角度（仅支持 0/90/180/270）" ;;
    en:unsupported_rot) echo "Unsupported rotation (only 0/90/180/270 supported)" ;;

    *) echo "$key" ;;
  esac
}

log() { printf "[RPi-Display-Master] %s\n" "$*"; }
die() { printf "[RPi-Display-Master] ERROR: %s\n" "$*" >&2; exit 1; }

need_root() {
  if [[ "${EUID:-$(id -u)}" != "0" ]]; then
    die "$(tr need_root)"
  fi
}

detect_config_txt() {
  # Bookworm: /boot/firmware/config.txt
  # Bullseye/legacy: /boot/config.txt
  if [[ -f /boot/firmware/config.txt ]]; then
    echo "/boot/firmware/config.txt"
    return 0
  fi
  if [[ -f /boot/config.txt ]]; then
    echo "/boot/config.txt"
    return 0
  fi
  return 1
}

backup_file() {
  local f="$1"
  local ts
  ts="$(date +%Y%m%d-%H%M%S)"
  local bak="${f}.rpidsm.bak.${ts}"
  cp -a "$f" "$bak"
  log "$(tr backup_done)：$bak"
  echo "$bak"
}

remove_existing_block() {
  local f="$1"
  # 删除同名标记块（幂等）
  if grep -qF "$BEGIN_MARK" "$f" 2>/dev/null; then
    log "$(tr remove_old_block)"
    # macOS sed 与 GNU sed 参数不同；树莓派环境一般是 GNU sed
    sed -i "/^$(printf '%s' "$BEGIN_MARK" | sed 's/[.[\\*^$(){}+?|]/\\\\&/g')$/,/^$(printf '%s' "$END_MARK" | sed 's/[.[\\*^$(){}+?|]/\\\\&/g')$/d" "$f"
  fi
}

append_block() {
  local f="$1"
  {
    echo ""
    echo "$BEGIN_MARK"
    echo "# Screen: ${SCREEN_NAME}"
    echo "# OS: ${OS_VARIANT}"
    echo "# Rotation: ${ROT_DEG}"
    echo "hdmi_force_hotplug=1"
    echo "disable_overscan=1"
    echo "hdmi_group=${HDMI_GROUP}"
    echo "hdmi_mode=${HDMI_MODE}"
    echo "hdmi_drive=${HDMI_DRIVE}"
    echo "hdmi_cvt=${HDMI_CVT}"
    echo "$END_MARK"
    echo ""
  } >> "$f"
}

install_via_lcdshow() {
  need_root
  [[ -n "$LCDSHOW_REPO" && "$LCDSHOW_REPO" != "__LCDSHOW_REPO__" ]] || die "LCDSHOW_REPO missing"
  [[ -n "$LCDSHOW_INSTALLER" && "$LCDSHOW_INSTALLER" != "__LCDSHOW_INSTALLER__" ]] || die "LCDSHOW_INSTALLER missing"

  log "$(tr lcdshow_start): ${SCREEN_NAME} (${SCREEN_ID})"
  log "$(tr lcdshow_clone): ${LCDSHOW_REPO}"

  local dir="/opt/LCD-show"
  if [[ -d "${dir}/.git" ]]; then
    (cd "$dir" && git fetch --all --prune && git reset --hard origin/master)
  else
    rm -rf "$dir"
    git clone --depth 1 "$LCDSHOW_REPO" "$dir"
  fi
  chmod -R 755 "$dir"

  local cmd=("$dir/$LCDSHOW_INSTALLER")
  if [[ "$LCDSHOW_ROTARG" == "1" ]]; then
    cmd+=("$ROT_DEG")
  fi

  log "$(tr lcdshow_run): ${cmd[*]}"
  bash "${cmd[@]}"

  log "$(tr lcdshow_done)"
}

calc_calibration_matrix() {
  local rot="$1"
  case "$rot" in
    0)   echo "1 0 0 0 1 0 0 0 1" ;;
    90)  echo "0 1 0 -1 0 1 0 0 1" ;;
    180) echo "-1 0 1 0 -1 1 0 0 1" ;;
    270) echo "0 -1 1 1 0 0 0 0 1" ;;
    *)   die "${rot}: $(tr unsupported_rot)" ;;
  esac
}

write_touch_x11_conf() {
  local rot="$1"
  local mat
  mat="$(calc_calibration_matrix "$rot")"

  local dir="/etc/X11/xorg.conf.d"
  local conf="${dir}/99-rpidsm-touch.conf"

  mkdir -p "$dir"
  cat > "$conf" <<EOF
Section "InputClass"
    Identifier "RPi-Display-Master touch calibration"
    MatchIsTouchscreen "on"
    MatchDevicePath "/dev/input/event*"
    Driver "libinput"
    Option "CalibrationMatrix" "${mat}"
EndSection
EOF

  log "$(tr touch_written)：${conf}"
  log "CalibrationMatrix: ${mat}"
}

maybe_apply_touch() {
  # 只做通用的 X11/libinput 写入；Wayland(如 Bookworm 默认桌面) 触摸旋转通常由 compositor/设备树决定。
  if [[ "${TOUCH_TYPE}" == "none" ]]; then
    log "$(tr touch_none)"
    return 0
  fi
  if [[ -d /etc/X11/xorg.conf.d ]]; then
    write_touch_x11_conf "$ROT_DEG"
  else
    log "$(tr touch_skip_wayland)"
  fi
}

restore_latest() {
  need_root
  local cfg
  cfg="$(detect_config_txt)" || die "$(tr missing_config)"
  local latest
  latest="$(ls -1t "${cfg}.rpidsm.bak."* 2>/dev/null | head -n 1 || true)"
  [[ -n "$latest" ]] || die "$(tr restore_no_backup)：${cfg}.rpidsm.bak.*"

  cp -a "$latest" "$cfg"
  log "已恢复 config.txt：$cfg <- $latest"

  local touch_conf="/etc/X11/xorg.conf.d/99-rpidsm-touch.conf"
  if [[ -f "$touch_conf" ]]; then
    rm -f "$touch_conf"
    log "$(tr touch_removed): $touch_conf"
  fi

  log "$(tr restore_done)"
}

main() {
  if [[ "${1:-}" == "--restore" ]]; then
    restore_latest
    exit 0
  fi

  if [[ "$SCENARIO" == "lcd_show_driver" ]]; then
    install_via_lcdshow
    exit 0
  fi

  need_root
  log "$(tr start_config): ${SCREEN_NAME} (${SCREEN_ID})"

  local cfg
  cfg="$(detect_config_txt)" || die "$(tr missing_config)"
  log "$(tr using_config): $cfg"

  backup_file "$cfg" >/dev/null
  remove_existing_block "$cfg"
  append_block "$cfg"
  log "$(tr write_hdmi_done)"

  maybe_apply_touch

  log "$(tr done_reboot)"
  if [[ "${LANGUAGE}" == "zh" ]]; then
    log "如需恢复：再次执行同一命令后追加 --restore（或直接运行脚本并传入 --restore）"
  else
    log "To restore: re-run the same command with --restore (or run this script with --restore)"
  fi
}

main "$@"

