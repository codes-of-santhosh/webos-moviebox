# 🎬 MovieBox for LG webOS TV

<p align="center">
  <img src="design_Webos/images/largeIcon.png" alt="MovieBox webOS Logo" width="160" height="160" style="border-radius: 24px; box-shadow: 0 12px 32px rgba(0,0,0,0.4);" />
</p>

<p align="center">
  <strong>The Ultimate Native Streaming Experience for LG webOS Smart TVs.</strong><br>
  Stream movies, TV series, and anime with 4K/1080p hardware-accelerated playback, instant seeking, multi-provider failover, and full Magic Remote spatial navigation.
</p>

<p align="center">
  <a href="https://github.com/codes-of-santhosh/webos-moviebox/releases/latest"><img src="https://img.shields.io/github/v/release/codes-of-santhosh/webos-moviebox?color=4f46e5&label=Latest%20Release&style=for-the-badge" alt="Latest Release"></a>
  <a href="#-homebrew-channel-auto-update-installation"><img src="https://img.shields.io/badge/Homebrew%20Channel-Compatible-00c853?style=for-the-badge&logo=lg" alt="Homebrew Channel Compatible"></a>
  <a href="#"><img src="https://img.shields.io/badge/webOS-4.0%20to%2024%2B-blue?style=for-the-badge&logo=webos" alt="webOS Compatibility"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-orange?style=for-the-badge" alt="License"></a>
</p>

---

## 🌟 Highlights

- **⚡ Native 4K & 1080p HEVC Hardware Decoding:** Plays full-bitrate MP4 and DASH streams using LG TV hardware demuxers with zero CPU throttling.
- **⏩ Fluid Non-Blocking Seeking:** Custom high-speed seek engine allows instant `+30s` and `-10s` timeline navigation without decoder stalls or black screens.
- **🔄 Multi-Provider Intelligent Failover:** Automatically queries MovieBox's latest detector CDN endpoints with seamless multi-tier fallback to alternative streaming backends (Dramachi & Stremio).
- **🛡️ Immortal Streaming Proxy Daemon:** Built-in background Node.js Luna service with keep-alive subscription IPC prevents webOS's aggressive 5-second process teardown, stripping CDN download headers and injecting private network CORS dynamically.
- **🎮 Built for Magic Remote & Spatial Navigation:** Full D-Pad spatial grid navigation, pointer-friendly touch zones, tabular-nums time scrubber, and TV OSD overlays.
- **💬 Multi-Language Subtitles:** Integrated SRT and WebVTT subtitle track parser with real-time selection and synchronization.
- **📦 Homebrew Channel Auto-Updates:** Direct integration with webOS Homebrew Channel repository manifests (`apps.json`) for seamless 1-click updates straight from your couch.

---

## 📺 Compatibility

| webOS Version | TV Models / Year | Status |
| :--- | :--- | :--- |
| **webOS 24 (v9.x)** | 2024 OLED (B4, C4, G4, M4) / QNED | ✅ Fully Tested |
| **webOS 23 (v8.x)** | 2023 OLED (B3, C3, G3) / UR80 / UR90 | ✅ Fully Compatible |
| **webOS 22 (v7.x)** | 2022 OLED (A2, B2, C2, G2) / UQ Series | ✅ Fully Compatible |
| **webOS 6.0** | 2021 OLED (A1, B1, C1, G1) / UP Series | ✅ Fully Compatible |
| **webOS 5.0** | 2020 OLED (BX, CX, GX) / UN Series | ✅ Fully Compatible |
| **webOS 4.x** | 2018–2019 OLED (C8, C9) / UK/UM Series | ✅ Compatible |

---

## 🚀 Installation & Update Methods

### Method 1: WebOS Homebrew Channel (Recommended — Auto-Updates!)

You can add MovieBox directly into your TV's **Homebrew Channel** to install and receive automatic update notifications whenever a new version is released.

1. Launch **Homebrew Channel** on your LG webOS TV.
2. Navigate to **Settings** (Gear Icon in the top right).
3. Select **Add Repository**.
4. Enter the MovieBox repository URL:
   ```text
   https://raw.githubusercontent.com/codes-of-santhosh/webos-moviebox/main/repo/apps.json
   ```
5. Click **Add** and return to the Homebrew Channel main screen.
6. Locate **MovieBox** in the app store list and click **Install**.
7. Whenever a new update is released, Homebrew Channel will automatically show an **Update** button!

---

### Method 2: WebOS Dev Manager (Desktop GUI)

If you have [webOS Dev Manager](https://github.com/webosbrew/dev-manager-desktop) on Windows, macOS, or Linux:

1. Download the latest `.ipk` package from [GitHub Releases](https://github.com/codes-of-santhosh/webos-moviebox/releases/latest):
   - `com.moviebox.webos_1.2.2_all.ipk` (Modern Premium UI)
2. Connect webOS Dev Manager to your LG TV (via Developer Mode or Root).
3. Click **Install IPK** or drag-and-drop the downloaded `.ipk` into the window.
4. The app will install and appear immediately on your TV launcher ribbon.

---

### Method 3: webOS TV CLI (`ares-cli`)

For developers with `@webos-tools/cli` installed:

```bash
# 1. Download latest IPK release
curl -LO https://github.com/codes-of-santhosh/webos-moviebox/releases/download/v1.2.2/com.moviebox.webos_1.2.2_all.ipk

# 2. Install directly to your configured TV device
ares-install -d mytv com.moviebox.webos_1.2.2_all.ipk

# 3. Launch on the TV
ares-launch -d mytv com.moviebox.webos
```

---

## 🎮 Remote Control Mappings

| Remote Key | Function |
| :--- | :--- |
| **D-Pad Up / Down / Left / Right** | Spatial focus navigation across banners, media cards, and action buttons |
| **Wheel / Enter Click** | Select item, open detail page, toggle Play/Pause, or commit action |
| **Back Button (←)** | Close active modal, hide OSD overlay, or return to previous screen |
| **Left Arrow (Player)** | Highlight / trigger `-10s` Quick Replay |
| **Right Arrow (Player)** | Highlight / trigger `+30s` Quick Skip |
| **Up Arrow (Player)** | Focus Exit button |
| **Magic Pointer** | Direct pointing and click support on all UI elements |

---

## 🏗️ Architecture & How It Works

MovieBox webOS is engineered specifically to overcome webOS's browser sandbox and media limitations:


```
┌────────────────────────────────────────────────────────┐
│               LG webOS TV WebKit WAM                   │
│                                                        │
│  ┌───────────────────────┐   ┌──────────────────────┐  │
│  │  Modern UI (HTML5/CSS)│   │  HTML5 <video> Node  │  │
│  └───────────┬───────────┘   └──────────▲───────────┘  │
│              │ Luna IPC Bus             │ Stream Chunks│
└──────────────┼──────────────────────────┼──────────────┘
               │                          │
┌──────────────▼──────────────────────────┴──────────────┐
│       Node.js Luna Daemon (com.moviebox.webos.service) │
│                                                        │
│  • Keep-Alive Subscription (bypasses 5s idle teardown) │
│  • Local HTTP Proxy (http://127.0.0.1:8888)            │
│  • Header Sanitizer (strips content-disposition)       │
│  • Multi-Host Pool (aoneroom & inmoviebox failover)    │
│  • Byte-Range Pass-Through with Connection Pooling     │
└──────────────────────────────┬─────────────────────────┘
                               │ Upstream HTTPS
                               ▼
                   High-Speed Global CDN Endpoints
```

1. **Persistent Daemon Lifecycle:** By default, webOS terminates Node.js background services after 5 seconds of inactivity. MovieBox registers a persistent Luna subscription channel (`luna://com.moviebox.webos.service/keepAlive`) on app initialization, guaranteeing continuous daemon execution while you watch.
2. **Byte-Range Sanitization:** CDN endpoints deliver video streams with `content-disposition: attachment`, which causes TV media pipelines to fail during byte seeking. The local proxy strips download flags, injects `accept-ranges: bytes` and `access-control-allow-origin: *`, enabling flawless hardware-accelerated timeline scrubbing.
3. **Resilient Host Rotation:** Automatically balances requests across a dynamic pool of verified API gateways (`api4.aoneroom.com`, `api5.aoneroom.com`, etc.) with intelligent socket timeouts and exponential retry fallbacks.

---

## 🛠️ Building from Source

### Prerequisites
- Node.js (v18+ recommended)
- LG webOS TV CLI (`npm install -g @webos-tools/cli`)
- LG TV connected in Developer Mode (or rooted via Homebrew Channel)

### Build Commands

```bash
# 1. Clone repository
git clone https://github.com/codes-of-santhosh/webos-moviebox.git
cd webos-moviebox

# 2. Package Modern UI version
ares-package design_Webos service

# 3. Output IPK generated:
# com.moviebox.webos_1.2.1_all.ipk
```

---

## 🤝 Contributing

Contributions, feature requests, and bug reports are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## ⚖️ Disclaimer & License

- MovieBox webOS is an open-source software project created solely for educational and research purposes.
- This application does not host, upload, or store any media content on its own servers. All content is indexed from third-party publicly accessible web services.
- Distributed under the **MIT License**. See `LICENSE` for more information.

---

<p align="center">
  Crafted with ❤️ for the LG webOS Homebrew Community by <a href="https://github.com/codes-of-santhosh">@codes-of-santhosh</a>.
</p>
