# MovieBox LG webOS TV App — Master Handover & Architecture Document

**Version:** 1.1.7  
**Target Platform:** LG webOS Smart TV (webOS 4.x through webOS 24, ARM architecture)  
**Package:** `com.moviebox.webos_1.1.7_all.ipk` (332 KB)  
**Companion Daemon Service:** `com.moviebox.webos.service` (Node.js Luna bus service + Local Streaming Proxy on `0.0.0.0:8888`)  
**Design Standard:** Anti-Slop UI Architecture, Emil Kowalski Design Engineering, Paul Bakaus Impeccable 10-Foot TV Framework.

---

## 1. Executive Summary & Latest Fixes (v1.1.7)

### A. Player Remote D-Pad Navigation & Selector Fix (Jerkiness Elimination)
* **Root Causes:**
  1. In `player.js`, the code had top-level quick-seeking shortcuts:
     ```javascript
     if (keyCode === KEYS.LEFT) {
       if (!cur || cur.id === 'progressTrack' || cur.id === 'btnSeekBack') {
         this.seekRelative(-10); return true;
       }
     }
     ```
     Because `cur.id === 'btnSeekBack'` was matched inside the global `KEYS.LEFT` branch, pressing Left on the D-Pad from the `-10s` button was intercepted and commanded a -10s seek instead of navigating back to the `Play/Pause` button!
  2. Similarly, when on `btnSeekFwd` (`+30s`), pressing Right was intercepted by `cur.id === 'btnSeekFwd'` and commanded a +30s seek instead of moving focus to the `Subtitles` button!
  3. Furthermore, when `cur` momentarily lost reference during remote gyroscope hover events, pressing Right from `Play` evaluated `!cur` as true and triggered a +30s seek rather than focusing `-10s`.
* **The Fix:**
  - Removed conflicting shortcut traps from the visible OSD navigation branch.
  - Implemented **Strict Deterministic Spatial Navigation**:
    - **From `Play/Pause`:**
      - `RIGHT` -> Focuses `-10s` button.
      - `UP` -> Focuses `← Exit Player`.
      - `ENTER` -> Toggles play/pause.
    - **From `-10s` button:**
      - `LEFT` -> Focuses `Play/Pause` button. **(Never seeks)**
      - `RIGHT` -> Focuses `+30s` button.
      - `UP` -> Focuses `← Exit Player`.
      - `ENTER` -> Seeks back 10 seconds.
    - **From `+30s` button:**
      - `LEFT` -> Focuses `-10s` button.
      - `RIGHT` -> Focuses `Subtitles` button. **(Never seeks)**
      - `UP` -> Focuses `← Exit Player`.
      - `ENTER` -> Seeks forward 30 seconds.
    - **From `Subtitles` button:**
      - `LEFT` -> Focuses `+30s` button.
      - `RIGHT` -> Focuses `Quality` button.
      - `UP` -> Focuses `← Exit Player`.
      - `ENTER` -> Opens Subtitles modal.
    - **From `Quality` button:**
      - `LEFT` -> Focuses `Subtitles` button.
      - `UP` -> Focuses `← Exit Player`.
      - `ENTER` -> Opens Quality modal.
    - **From `← Exit Player`:**
      - `DOWN` -> Focuses `Play/Pause`.
      - `ENTER` -> Exits player.
  - When the OSD is **hidden**, `LEFT` and `RIGHT` retain their instant seek shortcuts (`-10s` / `+30s`), and the Center button (Enter) reveals the OSD.

---

### B. Network Slowdown & Infinite Buffering Watchdog (v1.1.6 - v1.1.7)
* **Root Causes:**
  - When network speeds fluctuated or dipped momentarily, WebKit's video buffer drained and fired `'waiting'`. On LG webOS (WebKit / GStreamer), the media engine frequently remained parked in `GST_STATE_PAUSED` even after data resumed flowing, because nothing commanded the pipeline to resume.
* **The Fix:**
  1. **Playback Watchdog in `player.js`:** Runs every 500ms in `progressInterval`. If the video is supposed to be playing but `currentTime` does not advance:
     - **3.5s stall:** Explicitly kicks `video.play()`.
     - **5.5s stall:** Nudges the stream position forward by `+0.3s` to bypass any dropped byte frame and re-triggers `video.play()`.
     - **8.0s stall:** Re-initializes the stream connection at the current position, ensuring a clean HTTP range connection.
     - When playback moves forward normally, the watchdog automatically dismisses all buffering banners.
  2. **Proxy Inactivity Timeout in `service.js`:** Added a 20-second inactivity watchdog on `proxyRes`. If upstream data stops for 20 seconds, the idle socket is terminated cleanly so the client can re-request without deadlocking.

---

### C. Quality Switch Infinite Buffering Fix
* **Root Causes:**
  - In `switchStream(index)`, the new stream was loaded and `video.currentTime = curTime` was assigned immediately upon `loadedmetadata`, before the new stream had demuxed initial frames or reached `canplay`. Calling seek before `canplay` caused GStreamer's `qtdemux` pipeline to lock up, and `video.play()` was never called post-seek.
* **The Fix:**
  - In `switchStream(index)`:
    1. Pauses the outgoing stream cleanly.
    2. Attaches a `{ once: true }` listener for `'canplay'` on the new stream.
    3. Only restores `video.currentTime = curTime` and invokes `video.play()` once the new stream confirms it is ready to play.
    4. Automatically dismisses the buffering indicator.

---

### D. Center Button (Remote OK / Enter) Controls Access
* **Behavior:**
  - When the player overlay (OSD) is **hidden**, pressing the center button (Enter / OK, keycode `13`):
    1. Shows the OSD overlay (`this.showControls()`).
    2. Immediately places focus on the primary action button (`Pause` / `btnPlayToggle`).
    3. **Does NOT pause the video.** The movie keeps playing smoothly while all controls (Pause, -10s, +30s, Subtitles, Quality, Exit) are displayed.
  - When the OSD overlay is **visible**, pressing the center button executes the currently focused control.
  - Pressing `Back` (461 / 27) when the OSD is visible closes the OSD without exiting the video player.

---

### E. 10-Foot TV Typography & Text Sizing Upgrades
* **Typography Polish:**
  - Upgraded font sizes across the entire UI for 10-foot readability on 1080p/4K TVs:
    - **Searching indicator (`.loading-indicator`):** **32px bold** with an integrated animated spinner.
    - **Empty search state (`.empty-state`):** **30px** with high contrast.
    - **Error messages (`.error-state`):** **32px bold** with a subtle red tinted card background (`rgba(239, 68, 68, 0.12)`).
    - **Search input (`.search-input`):** **28px** with generous 20px padding.
    - **Player Error Banner (`.error-banner`):** Features a **34px bold** title, **26px** body text, and **22px** hint text.
    - **Player Buffering Text (`.player-loading-text`):** Increased to **28px bold**.

---

## 2. Package & Installation Information

* **Package File:** `D:\MOVIEBOX\com.moviebox.webos_1.1.7_all.ipk`
* **Size:** ~332 KB (340,866 bytes)
* **Packaging Tool:** `@webos-tools/cli` (`ares-package`)
* **Local Proxy Port:** `http://127.0.0.1:8888` / `http://0.0.0.0:8888`

### Installation via webOS Dev Manager
1. Open **webOS Dev Manager** on your PC.
2. Select your LG TV.
3. Click **Install App** and choose:
   📁 **`D:\MOVIEBOX\com.moviebox.webos_1.1.7_all.ipk`**
4. Launch **MovieBox** from your TV's launcher.

### Installation via Command Line (`ares-cli`)
```bash
# Install to TV
ares-install --device <YOUR_TV_NAME> "D:\MOVIEBOX\com.moviebox.webos_1.1.7_all.ipk"

# Launch app directly
ares-launch --device <YOUR_TV_NAME> com.moviebox.webos
```

---

## 3. Architecture & File Breakdown

```
D:\MOVIEBOX\
├── com.moviebox.webos_1.1.7_all.ipk    ← Installable webOS TV package (v1.1.7)
├── moviebox-webos/                      ← Frontend TV Application
│   ├── appinfo.json                     ← v1.1.7, "disableBackHistoryAPI": true
│   ├── index.html                       ← 1080p shell with cache-busting v1.1.7
│   ├── css/app.css                      ← 10-foot TV typography (32px), ::cue subtitles, modal styling
│   ├── js/
│   │   ├── api.js                       ← Luna bridge with extended parameters (title, se, ep)
│   │   ├── app.js                       ← Navigation history stack and Back handler
│   │   ├── navigation.js                ← Spatial D-Pad engine with player isolation & input guards
│   │   ├── storage.js                   ← LocalStorage favorites & history persistence
│   │   ├── utils.js                     ← WebVTT subtitle converter (srtToVtt) & duration formatters
│   │   └── screens/
│   │       ├── home.js                  ← 3 curated rows x 7 tiles (21 cards) for 60fps TV scrolling
│   │       ├── search.js                ← 28px search input with 32px status messages
│   │       ├── detail.js                ← Season tabs & episode list parser (allEp support)
│   │       └── player.js                ← Deterministic D-pad navigation, watchdog, center-button OSD
│   └── lib/
│       ├── webOSTV.js                   ← Official webOS client library
│       └── dash.all.min.js              ← DASH streaming library
└── service/                             ← Node.js Luna Daemon Service
    ├── service.js                       ← Local proxy on 8888 with 20s stream idle timeout & Luna bus
    ├── services.json                    ← Luna permissions configuration
    ├── package.json                     ← Service metadata
    ├── auth/moviebox-auth.js            ← HMAC-MD5 request signing & token rotation
    ├── providers/
    │   ├── moviebox.js                  ← MovieBox API client (with relaxed resource fallback)
    │   ├── dramachi.js                  ← Dramachi secondary provider
    │   └── stremio.js                   ← Stremio provider
    ├── proxy/stream-proxy.js            ← DASH/MP4 manifest parser
    └── utils/
        ├── crypto.js                    ← HMAC-MD5 30-byte signing engine
        └── device-spoof.js              ← Android 13 / Redmi Note 11 Pro spoof headers
```
