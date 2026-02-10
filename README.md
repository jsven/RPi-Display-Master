# RPi-Display-Master
The ultimate "One-Line" configuration tool for non-standard Raspberry Pi displays (Bar, Round, Square, Industrial). Fix resolution, rotation, and touch calibration in seconds.

# 🚀 RPi-Display-Master

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform: Raspberry Pi](https://img.shields.io/badge/Platform-Raspberry%20Pi-red.svg)](https://www.raspberrypi.org/)

**RPi-Display-Master** 是一个开源的自动化工具，旨在解决树莓派在连接非标准比例 HDMI 屏幕（如长条屏、圆形屏、正方形屏等）时常见的黑屏、分辨率拉伸及触摸坐标错位等痛点。

[English](#features) | [中文说明](#核心功能)

---

## 🌐 在线脚本生成器 (Online Generator)
为了获得最佳体验，请访问我们的 **[在线配置工具](https://your-domain.com)**。
只需选择您的屏幕型号和系统版本，即可获得专属的一键安装指令。

---

## ✨ 核心功能 (Features)

- **一键安装 (One-Line Setup):** 无需手动编辑 `config.txt`，一行指令自动搞定。
- **动态时序注入 (Smart Timing):** 自动注入精准的 `hdmi_cvt` 参数，适配各种奇葩分辨率（如 1920x480, 720x720）。
- **触摸矩阵自动校准 (Touch Calibration):** 旋转屏幕（90°/180°/270°）后，自动计算并应用触摸坐标转换矩阵（Coordinate Transformation Matrix）。
- **系统安全防护 (Safe & Clean):**
    - 自动备份原始系统配置文件。
    - 智能检测 OS 版本（支持最新的 Bookworm/KMS 架构）。
    - 提供一键恢复（Restore）功能。
- **全机型支持:** 兼容 Raspberry Pi 3, 4, 5 及 Zero 2W。

---

## 🛠️ 如何使用 (How to Use)

### 1. 快速开始
在树莓派终端输入你在网页端生成的指令，例如：
```bash
curl -sL https://your-api-domain.com/install?id=88bar&rot=90 | sudo bash
```

### 2. 参数说明
- **id**：屏幕型号 ID（内置示例：`88bar` / `7std` / `5round`）
- **rot**：旋转角度（`0` / `90` / `180` / `270`）
- **os**：系统版本（`bookworm64` / `bookworm32` / `bullseye64` / `bullseye32`）

### 3. 恢复（回滚）
脚本会自动备份 `config.txt`（路径会按系统自动选择 `/boot/firmware/config.txt` 或 `/boot/config.txt`）。

如需恢复最近一次备份：

```bash
curl -sL "https://your-api-domain.com/install?id=88bar&rot=90&os=bookworm64" | sudo bash -s -- --restore
```

---

## 🧩 本地开发与测试 (Local Dev)
### 环境要求
- Node.js 18+（推荐 20+）

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器访问：
- `http://localhost:3000`

接口自测：
- `http://localhost:3000/api/generate?id=88bar&rot=90&os=bookworm64`
- `http://localhost:3000/api/install?id=88bar&rot=90&os=bookworm64`

---

## ☁️ 线上部署与运维 (Deploy)
本项目是标准 Next.js App Router 应用，可部署到任意轻量服务器或平台（Linux/Windows 均可）。

### 方式 A：传统服务器（Node 运行）

```bash
npm install
npm run build
npm run start
```

默认监听 `3000` 端口；建议使用 Nginx/Caddy 做反向代理并开启 HTTPS。

### 方式 B：容器化（可选）
你可以按团队习惯添加 Dockerfile；本项目不依赖数据库，属于无状态服务，水平扩展很简单。

---

## 📁 关键目录结构
- `src/data/screens.json`：屏幕配置数据库（分辨率/hdmi_cvt/触摸类型）
- `src/app/page.tsx`：三步选择 UI 与结果展示
- `src/app/api/generate/route.ts`：脚本生成（返回 JSON，含 script）
- `src/app/api/install/route.ts`：直接输出 bash（便于一行命令 curl | sudo bash）
- `public/scripts/core_engine.sh`：通用脚本引擎模板（备份/写入/触摸矩阵/恢复）

## 🔌 更多屏幕接入场景（LCD-show）
除“HDMI 自定义时序写入 config.txt”外，本项目也支持基于 **LCD-show** 的“驱动安装”场景：脚本会克隆仓库并执行对应的 `XXX-show` 安装脚本，同时把旋转角度作为参数传入（具体行为以安装脚本为准，部分会自动重启）。

参考项目：[`goodtft/LCD-show`](https://github.com/goodtft/LCD-show)