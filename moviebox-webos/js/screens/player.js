const PlayerScreen = {
  isActive: false,
  currentStream: null,
  currentStreamIndex: 0,
  currentStreamUrl: null,
  allStreams: [],
  dashPlayer: null,
  subtitles: [],
  activeSubUrl: null,
  activeSubLang: null,
  mediaTitle: '',
  currentSubjectId: null,
  currentSeason: 0,
  currentEpisode: 0,
  controlsTimeout: null,
  progressInterval: null,
  isPaused: false,
  _seekTargetTime: null,
  _pendingSeekTarget: null,
  _lastSeekDest: null,
  _seekDebounceTimer: null,
  _seekSafetyTimer: null,
  _seekRetryCount: 0,
  _streamRetries: 0,
  _wasPlayingBeforeSeek: null,
  _bufferTimeout: null,
  _connectTimeout: null,
  _initialLoadTimeout: null,
  _playbackSessionId: 0,
  _lastStreamSwitchTime: 0,
  _triedDirect: false,
  _lastPlayhead: -1,
  _stallTicks: 0,
  _playPauseBusy: false,
  _isSeeking: false,
  _hasStartedPlaying: false,

  async render(container, subjectId, season = 0, episode = 0, title = 'MovieBox Player') {
    this.isActive = true;
    this.isPaused = false;
    this.subtitles = [];
    this.allStreams = [];
    this.currentStreamIndex = 0;
    this.currentStreamUrl = null;
    this.activeSubUrl = null;
    this.activeSubLang = null;
    this.mediaTitle = title;
    this.currentSubjectId = subjectId;
    this.currentSeason = season;
    this.currentEpisode = episode;
    this._seekTargetTime = null;
    this._pendingSeekTarget = null;
    this._lastSeekDest = null;
    this._wasPlayingBeforeSeek = null;
    this._triedDirect = false;
    this._lastPlayhead = -1;
    this._stallTicks = 0;
    this._hasStartedPlaying = false;
    this._isSeeking = false;
    this._seekRetryCount = 0;
    this._streamRetries = 0;
    this._playPauseBusy = false;
    clearTimeout(this._connectTimeout);
    clearTimeout(this._initialLoadTimeout);
    clearTimeout(this._seekDebounceTimer);
    clearTimeout(this._seekSafetyTimer);

    container.innerHTML = `
      <div class="player-screen-wrapper" id="playerWrapper">
        <video id="tvVideo" class="tv-video-element" preload="auto" playsinline webkit-playsinline></video>
        
        <!-- Center State Indicator (Play/Pause/Buffer/Seek) -->
        <div class="player-center-indicator" id="playerCenterIndicator">
          <div class="center-badge" id="centerBadge">
            <span id="centerIcon">▶</span>
          </div>
        </div>

        <!-- TV OSD Overlay -->
        <div class="player-overlay" id="playerOverlay">
          <!-- Top Bar -->
          <div class="player-top-bar">
            <button class="player-btn focusable" id="btnPlayerExit" tabindex="0" onclick="PlayerScreen.exitPlayer()">
              ← Exit Player
            </button>
            <div class="player-title-box">
              <span class="player-media-title" id="playerMediaTitle">${title}</span>
              <span class="player-stream-badge" id="playerQualityBadge">HD</span>
            </div>
          </div>

          <!-- Bottom Controls & Scrubber -->
          <div class="player-bottom-panel" id="playerBottomPanel">
            <!-- Progress Track -->
            <div class="player-progress-area">
              <span class="time-label tabular-nums" id="currentTimeLabel">00:00:00</span>
              <div class="progress-bar-track" id="progressTrack">
                <div class="progress-buffered" id="progressBuffered"></div>
                <div class="progress-played" id="progressPlayed"></div>
              </div>
              <span class="time-label tabular-nums" id="totalDurationLabel">00:00:00</span>
            </div>

            <!-- Action Controls -->
            <div class="player-action-row">
              <div class="action-cluster-left">
                <button class="player-btn focusable" id="btnPlayToggle" tabindex="0" onclick="PlayerScreen.togglePlayPause()">
                  Pause
                </button>
                <button class="player-btn focusable" id="btnSeekBack" tabindex="0" onclick="PlayerScreen.seekRelative(-10)">
                  -10s
                </button>
                <button class="player-btn focusable" id="btnSeekFwd" tabindex="0" onclick="PlayerScreen.seekRelative(30)">
                  +30s
                </button>
              </div>

              <div class="action-cluster-right">
                <button class="player-btn focusable" id="btnSubtitles" tabindex="0" onclick="PlayerScreen.openSubMenu()">
                  Subtitles
                </button>
                <button class="player-btn focusable" id="btnQuality" tabindex="0" onclick="PlayerScreen.openQualityMenu()">
                  Quality
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading / Status Banner -->
        <div class="player-loading-banner" id="playerLoadingBanner">
          <div class="player-spinner"></div>
          <div class="player-loading-text" id="playerLoadingText">Connecting to stream...</div>
        </div>

        <!-- Subtitles Modal -->
        <div class="player-modal" id="subModal" style="display: none;">
          <div class="player-modal-box">
            <h2 class="modal-title">Select Subtitle Track</h2>
            <div id="subList" class="modal-list"></div>
            <button class="modal-close-btn focusable" id="btnCloseSubModal" tabindex="0" onclick="PlayerScreen.closeSubMenu()">Close</button>
          </div>
        </div>

        <!-- Quality Modal -->
        <div class="player-modal" id="qualityModal" style="display: none;">
          <div class="player-modal-box">
            <h2 class="modal-title">Select Playback Quality</h2>
            <div id="qualityList" class="modal-list"></div>
            <button class="modal-close-btn focusable" id="btnCloseQualityModal" tabindex="0" onclick="PlayerScreen.closeQualityMenu()">Close</button>
          </div>
        </div>
      </div>
    `;

    // Ensure initial focus is on Play/Pause button
    setTimeout(() => {
      const playBtn = document.getElementById('btnPlayToggle') || document.getElementById('btnPlayerExit');
      if (playBtn) Navigation.setFocus(playBtn);
    }, 60);

    // Save to playback history
    Storage.addHistory({
      id: subjectId,
      season: season,
      episode: episode,
      title: title
    });

    // Attach video lifecycle events
    this.setupVideoEvents();

    try {
      const res = await API.getPlayInfo(subjectId, season, episode, title);
      const streams = res?.streams || [];

      if (!streams.length) {
        this.showError('No playable stream links found for this title.');
        return;
      }

      this.allStreams = streams;
      this.currentStreamIndex = 0;
      const selected = streams[0];
      this.currentStream = selected;
      const proxyPort = res?.proxyPort || 8888;

      this.updateQualityBadge(selected.quality, selected.codec);
      this.initPlayback(selected, proxyPort);
      this.loadSubtitles(subjectId, selected.id);
    } catch (err) {
      console.error('Player stream error:', err);
      this.showError(`Playback initialization failed: ${err.message}`);
    }
  },

  setupVideoEvents() {
    const video = document.getElementById('tvVideo');
    if (!video) return;

    video.addEventListener('timeupdate', () => {
      if (video.currentTime > 0 && !video.paused) {
        this.showBufferIndicator(false);
      }
      this.onTimeUpdate();
    });

    video.addEventListener('loadedmetadata', () => this.onMetadataLoaded());

    video.addEventListener('waiting', () => {
      clearTimeout(this._bufferTimeout);
      this._bufferTimeout = setTimeout(() => {
        if (video && video.readyState < 3 && !video.paused) {
          this.showBufferIndicator(true);
        }
      }, 400);
    });

    video.addEventListener('canplay', () => {
      clearTimeout(this._bufferTimeout);
      clearTimeout(this._connectTimeout);
      clearTimeout(this._initialLoadTimeout);
      this.showBufferIndicator(false);
      this.hideLoadingBanner();
    });

    video.addEventListener('canplaythrough', () => {
      clearTimeout(this._bufferTimeout);
      clearTimeout(this._connectTimeout);
      clearTimeout(this._initialLoadTimeout);
      this.showBufferIndicator(false);
      this.hideLoadingBanner();
    });

    video.addEventListener('seeked', () => {
      clearTimeout(this._bufferTimeout);
      this.showBufferIndicator(false);
      this.hideLoadingBanner();
    });

    video.addEventListener('playing', () => {
      this._hasStartedPlaying = true;
      this._streamRetries = 0;
      this._playPauseBusy = false;
      clearTimeout(this._bufferTimeout);
      clearTimeout(this._connectTimeout);
      clearTimeout(this._initialLoadTimeout);
      this.showBufferIndicator(false);
      this.hideLoadingBanner();
      this.isPaused = false;
      this.updatePlayPauseButton();
      this.scheduleControlsHide();
    });

    video.addEventListener('pause', () => {
      this.isPaused = true;
      this._playPauseBusy = false;
      this.updatePlayPauseButton();
      this.showControls();
    });

    video.addEventListener('ended', () => {
      this.showControls();
    });

    video.addEventListener('error', (e) => this.handleVideoError(e));

    // ── Auto-Recovery Watchdog & Smooth TV Progress Polling ──
    clearInterval(this.progressInterval);
    this._lastPlayhead = -1;
    this._stallTicks = 0;

    this.progressInterval = setInterval(() => {
      this.onTimeUpdate();

      const vid = document.getElementById('tvVideo');
      // Do not monitor stalls if paused, modal open, seeking, buffering (readyState < 3), or before playback starts
      if (!vid || this.isPaused || this.isModalOpen() || this._seekTargetTime !== null || this._pendingSeekTarget !== null || this._isSeeking || vid.seeking || !this._hasStartedPlaying || vid.currentTime < 0.5 || vid.readyState < 3) {
        this._stallTicks = 0;
        return;
      }

      // If active video stream stops advancing mid-playback
      if (vid.currentTime === this._lastPlayhead && !vid.paused) {
        this._stallTicks++;
        // 6 seconds stall: kick pipeline play()
        if (this._stallTicks === 12) {
          console.warn('[MovieBox Watchdog] Playback stalled at', vid.currentTime, '- kicking pipeline play()');
          vid.play().catch(() => {});
        } else if (this._stallTicks >= 26) {
          // 13 seconds stall: reconnect stream cleanly at current position
          console.warn('[MovieBox Watchdog] Reconnecting stream after 13s stall at', vid.currentTime);
          this._stallTicks = 0;
          const resumePos = vid.currentTime;
          this.showBufferIndicator(true);
          this.initPlayback(this.currentStream, 8888, resumePos);
        }
      } else {
        // Advancing normally — reset counters
        this._lastPlayhead = vid.currentTime;
        this._stallTicks = 0;
        this.showBufferIndicator(false);
        this.hideLoadingBanner();
      }
    }, 500);
  },

  handleVideoError(e) {
    const video = document.getElementById('tvVideo');
    const errCode = video && video.error ? video.error.code : 0;
    console.error('HTML5 Video Error:', e, video ? video.error : null);

    // 1. MEDIA_ERR_ABORTED (code 1): Transient abort caused by new .load(), ignore
    if (errCode === 1) {
      console.log('[MovieBox Player] Ignoring MEDIA_ERR_ABORTED (code 1)');
      return;
    }

    // 2. If error happens during seeking, soft-recover current stream at seek target
    if ((this._isSeeking || (video && video.seeking)) && (this._seekRetryCount || 0) < 3) {
      this._seekRetryCount = (this._seekRetryCount || 0) + 1;
      const resumeTime = this._pendingSeekTarget !== null
        ? this._pendingSeekTarget
        : (this._lastSeekDest !== null ? this._lastSeekDest : (video ? video.currentTime : 0));
      console.warn(`[MovieBox Player] Pipeline died during seek (code ${errCode}). Soft-recovering stream at ${resumeTime}s (Attempt ${this._seekRetryCount}/3)...`);

      this._isSeeking = false;
      this._pendingSeekTarget = null;
      clearTimeout(this._seekSafetyTimer);
      this.showBufferIndicator(true);

      setTimeout(() => {
        if (this.isActive && this.currentStream) {
          this.initPlayback(this.currentStream, 8888, resumeTime);
        }
      }, 250);
      return;
    }

    // 3. Fallback to direct CDN if local proxy failed
    if (!this._triedDirect && this.currentStream && this.currentStream.url) {
      console.warn('[MovieBox Player] Local proxy error. Trying direct CDN fallback...');
      this._triedDirect = true;
      const resumePos = video ? Math.max(0, video.currentTime) : 0;
      this.showBufferIndicator(true);
      setTimeout(() => {
        if (this.isActive && this.currentStream) {
          this.initPlayback(this.currentStream, 8888, resumePos);
        }
      }, 200);
      return;
    }

    // 4. MEDIA_ERR_NETWORK (code 2) during normal playback:
    if (errCode === 2 && (this._streamRetries || 0) < 2) {
      this._streamRetries = (this._streamRetries || 0) + 1;
      const resumePos = video ? video.currentTime : 0;
      console.warn(`[MovieBox Player] Transient network disconnect (code 2). Reconnecting current stream at ${resumePos}s...`);
      this.showBufferIndicator(true);
      setTimeout(() => {
        if (this.isActive && this.currentStream) {
          this.initPlayback(this.currentStream, 8888, resumePos);
        }
      }, 500);
      return;
    }

    // 5. Unrecoverable or exhausted retries: trigger alternate stream failover
    console.warn('[MovieBox Player] Stream failed. Auto-switching to alternate stream...');
    this.handlePlaybackFailover();
  },

  handlePlaybackFailover() {
    this._streamRetries = 0;
    this._seekRetryCount = 0;
    const video = document.getElementById('tvVideo');
    if (video && video.currentTime > 1.0 && !video.paused) {
      console.warn('Ignoring transient media error event on playing stream at:', video.currentTime);
      return;
    }

    // 1. If alternate streams exist (e.g. 720P or 480P), try next available stream
    if (this.allStreams && this.allStreams.length > 1) {
      const nextIdx = this.currentStreamIndex + 1;
      if (nextIdx < this.allStreams.length) {
        console.log(`[MovieBox Player] Stream failed. Auto-switching to alternate stream #${nextIdx}...`);
        this.switchStream(nextIdx);
        return;
      }
    }

    // 2. Attempt direct CDN stream connection as a last resort
    if (!this._triedDirect && this.currentStream && this.currentStream.url) {
      console.log('[MovieBox Player] Attempting direct CDN stream fallback...');
      this._triedDirect = true;
      if (video) {
        while (video.firstChild) video.removeChild(video.firstChild);
        const source = document.createElement('source');
        source.setAttribute('src', this.currentStream.url);
        source.setAttribute('type', 'video/mp4');
        video.appendChild(source);
        video.load();
        video.play().catch(e => console.log('Direct fallback play deferred:', e));
        return;
      }
    }

    this.showError('Stream playback error encountered. Press Back to return.');
  },

  initPlayback(stream, proxyPort = 8888, startTime = 0) {
    const video = document.getElementById('tvVideo');
    if (!video) return;

    // Increment monotonic session ID so stale timers/listeners from old loads are ignored
    this._playbackSessionId = (this._playbackSessionId || 0) + 1;
    const sessionId = this._playbackSessionId;

    // ALWAYS clear existing connection timer and seek timers first!
    clearTimeout(this._connectTimeout);
    clearTimeout(this._initialLoadTimeout);
    clearTimeout(this._seekDebounceTimer);
    clearTimeout(this._seekSafetyTimer);
    clearTimeout(this._bufferTimeout);
    this._connectTimeout = null;
    this._initialLoadTimeout = null;

    // Reset state locks
    this._isSeeking = false;
    this._pendingSeekTarget = null;
    this._playPauseBusy = false;
    this._seekRetryCount = 0;
    this._hasStartedPlaying = false;
    this.currentStream = stream;

    // Prefer sanitized local proxy stream (strips content-disposition: attachment, adds CORS & byte-range support)
    // Fall back to direct CDN only if local proxy fails
    let streamUrl = (this._triedDirect && stream.url)
      ? stream.url
      : (stream.proxyUrl || `http://127.0.0.1:${proxyPort}/video.mp4?url=${encodeURIComponent(stream.url)}`);
    this.currentStreamUrl = streamUrl;

    console.log(`[MovieBox Player] Commencing playback (Session #${sessionId}, startTime: ${startTime}s):`, streamUrl);

    // Guarded 18s initial connection watchdog
    this._connectTimeout = setTimeout(() => {
      if (this._playbackSessionId !== sessionId) return; // Ignore orphaned timers!
      console.warn('[MovieBox Player] Initial stream connect timed out after 18s. Trying failover...');
      this.handlePlaybackFailover();
    }, 18000);

    // Remove old sources cleanly
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    const source = document.createElement('source');
    source.setAttribute('src', streamUrl);
    source.setAttribute('type', 'video/mp4');
    video.appendChild(source);

    if (startTime > 0.5) {
      // Seek recovery / quality switch position restoration:
      const onMetadata = () => {
        if (this._playbackSessionId !== sessionId) return;
        video.removeEventListener('loadedmetadata', onMetadata);
        try {
          console.log(`[MovieBox Player] Restoring seek position to: ${startTime}s`);
          const onRestored = () => {
            if (this._playbackSessionId !== sessionId) return;
            video.removeEventListener('seeked', onRestored);
            video.removeEventListener('canplay', onRestored);
            clearTimeout(this._connectTimeout);
            this._connectTimeout = null;
            this._hasStartedPlaying = true;
            this.showBufferIndicator(false);
            this.hideLoadingBanner();
          };
          video.addEventListener('seeked', onRestored, { once: true });
          video.addEventListener('canplay', onRestored, { once: true });
          video.currentTime = startTime;
          const p = video.play();
          if (p !== undefined) p.catch(() => {});
        } catch (e) {
          console.warn('[MovieBox Player] Error restoring currentTime:', e);
        }
      };

      video.addEventListener('loadedmetadata', onMetadata, { once: true });
      video.load();
    } else {
      const onStreamReady = () => {
        if (this._playbackSessionId !== sessionId) return;
        clearTimeout(this._connectTimeout);
        this._connectTimeout = null;
        this._hasStartedPlaying = true;
        this._streamRetries = 0;
        this.showBufferIndicator(false);
        this.hideLoadingBanner();
      };

      video.addEventListener('loadeddata', onStreamReady, { once: true });
      video.addEventListener('canplay', onStreamReady, { once: true });
      video.addEventListener('playing', onStreamReady, { once: true });

      video.load();
      const p = video.play();
      if (p !== undefined) {
        p.catch(err => console.log('Autoplay deferred:', err.message || err));
      }
    }

    this.showControls();
    this.scheduleControlsHide();
  },

  loadNativeSource(video, streamUrl) {
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }

    const source = document.createElement('source');
    source.setAttribute('src', streamUrl);
    source.setAttribute('type', 'video/mp4');
    video.appendChild(source);

    video.load();
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.log('Autoplay deferred or pending user action:', err.message || err);
      });
    }
  },

  onTimeUpdate() {
    const video = document.getElementById('tvVideo');
    if (!video || !video.duration) return;

    // If debounced seek is actively accumulating, do not overwrite scrubber with stale playback time
    if (this._seekTargetTime !== null || this._pendingSeekTarget !== null) return;

    const cur = video.currentTime || 0;
    const dur = video.duration || 0;

    const curEl = document.getElementById('currentTimeLabel');
    const durEl = document.getElementById('totalDurationLabel');
    const playedEl = document.getElementById('progressPlayed');
    const bufEl = document.getElementById('progressBuffered');

    if (curEl) curEl.textContent = this.formatTime(cur);
    if (durEl) durEl.textContent = this.formatTime(dur);

    if (playedEl && dur > 0) {
      const pct = (cur / dur) * 100;
      playedEl.style.width = `${pct}%`;
    }

    if (bufEl && dur > 0 && video.buffered.length > 0) {
      try {
        const bufEnd = video.buffered.end(video.buffered.length - 1);
        const bufPct = (bufEnd / dur) * 100;
        bufEl.style.width = `${bufPct}%`;
      } catch (e) {}
    }
  },

  onMetadataLoaded() {
    const video = document.getElementById('tvVideo');
    if (!video) return;
    const durEl = document.getElementById('totalDurationLabel');
    if (durEl && video.duration) {
      durEl.textContent = this.formatTime(video.duration);
    }
  },

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    const s = Math.floor(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => (n < 10 ? '0' + n : n);
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
  },

  togglePlayPause() {
    const video = document.getElementById('tvVideo');
    if (!video || this._playPauseBusy) return;
    this._playPauseBusy = true;

    if (video.paused) {
      this.flashCenterIcon('▶');
      const p = video.play();
      if (p !== undefined) {
        p.then(() => { this._playPauseBusy = false; })
         .catch(err => {
           console.log('Play deferred/aborted:', err.message || err);
           this._playPauseBusy = false;
         });
      } else {
        this._playPauseBusy = false;
      }
    } else {
      this.flashCenterIcon('❚❚');
      video.pause();
      setTimeout(() => { this._playPauseBusy = false; }, 250);
    }
    this.showControls();
  },

  seekRelative(deltaSeconds) {
    const video = document.getElementById('tvVideo');
    if (!video || !video.duration || isNaN(video.duration) || video.duration < 5 || !this._hasStartedPlaying || video.readyState < 2) {
      this.flashCenterIcon('Buffering...');
      return;
    }

    // Capture initial playing state before user starts multi-tapping
    if (this._seekTargetTime === null && !this._isSeeking) {
      this._wasPlayingBeforeSeek = !video.paused;
    }

    const baseTime = this._seekTargetTime !== null
      ? this._seekTargetTime
      : (this._pendingSeekTarget !== null ? this._pendingSeekTarget : (this._lastSeekDest !== null ? this._lastSeekDest : video.currentTime));

    this._seekTargetTime = Math.max(0, Math.min(Math.floor(video.duration) - 2, baseTime + deltaSeconds));
    
    // Immediate visual feedback on UI
    this.updateSeekPreviewUI(this._seekTargetTime, video.duration);
    this.showControls();

    clearTimeout(this._seekDebounceTimer);
    this._seekDebounceTimer = setTimeout(() => {
      const dest = this._seekTargetTime;
      this._seekTargetTime = null;
      if (dest !== null) {
        this._commitHardwareSeek(dest);
      }
    }, 400);
  },

  updateSeekPreviewUI(targetTime, duration) {
    const video = document.getElementById('tvVideo');
    const curTime = video ? video.currentTime : 0;
    const dur = duration || (video ? video.duration : 0);

    const totalDelta = Math.round(targetTime - curTime);
    const sign = totalDelta >= 0 ? '+' : '';
    this.flashCenterIcon(`${sign}${totalDelta}s`);

    const playedEl = document.getElementById('progressPlayed');
    const curEl = document.getElementById('currentTimeLabel');
    if (playedEl && dur > 0) {
      playedEl.style.width = `${(targetTime / dur) * 100}%`;
    }
    if (curEl) {
      curEl.textContent = this.formatTime(targetTime);
    }
  },

  _commitHardwareSeek(dest) {
    const video = document.getElementById('tvVideo');
    if (!video || !video.duration) return;

    // Boundary clamp: never seek past duration - 2 seconds
    dest = Math.max(0, Math.min(Math.floor(video.duration) - 2, dest));

    // CRITICAL: If GStreamer is STILL seeking from previous command, do NOT overwrite currentTime!
    if (this._isSeeking || video.seeking) {
      console.log(`[MovieBox Player] Hardware busy (isSeeking: ${this._isSeeking}, video.seeking: ${video.seeking}). Queuing seek to ${dest}s`);
      this._pendingSeekTarget = dest;
      return;
    }

    this._isSeeking = true;
    this._lastSeekDest = dest;
    this.showBufferIndicator(true);

    const sessionId = this._playbackSessionId;
    clearTimeout(this._seekSafetyTimer);

    const wasPlaying = this._wasPlayingBeforeSeek !== null ? this._wasPlayingBeforeSeek : !video.paused;
    this._wasPlayingBeforeSeek = wasPlaying;

    const onSeekDone = () => {
      if (this._playbackSessionId !== sessionId) return;
      clearTimeout(this._seekSafetyTimer);
      video.removeEventListener('seeked', onSeekDone);
      video.removeEventListener('canplay', onSeekDone);
      this._isSeeking = false;
      this._seekRetryCount = 0;

      // If user queued another seek while hardware was busy, fire it now
      if (this._pendingSeekTarget !== null) {
        const nextDest = this._pendingSeekTarget;
        this._pendingSeekTarget = null;
        this._commitHardwareSeek(nextDest);
        return;
      }

      this.showBufferIndicator(false);
      this.hideLoadingBanner();

      if (this._wasPlayingBeforeSeek) {
        this._wasPlayingBeforeSeek = null;
        const p = video.play();
        if (p !== undefined) {
          p.catch(e => console.log('Resume after seek:', e.message || e));
        }
      } else {
        this._wasPlayingBeforeSeek = null;
      }
    };

    video.addEventListener('seeked', onSeekDone, { once: true });
    video.addEventListener('canplay', onSeekDone, { once: true });
    this._seekSafetyTimer = setTimeout(onSeekDone, 4000);

    console.log(`[MovieBox Player] Commencing hardware seek to: ${dest}s (shouldResume: ${wasPlaying})`);
    try {
      video.currentTime = dest;
      if (wasPlaying && video.paused) {
        video.play().catch(() => {});
      }
    } catch (e) {
      console.warn('Hardware seek rejected:', e);
      onSeekDone();
    }
  },

  flashCenterIcon(text) {
    const el = document.getElementById('centerBadge');
    const icon = document.getElementById('centerIcon');
    if (!el || !icon) return;

    icon.textContent = text;
    el.classList.add('visible');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => {
      el.classList.remove('visible');
    }, 700);
  },

  showControls() {
    const overlay = document.getElementById('playerOverlay');
    if (overlay) {
      overlay.classList.remove('hidden');
    }
    this.scheduleControlsHide();
  },

  scheduleControlsHide() {
    clearTimeout(this.controlsTimeout);
    this.controlsTimeout = setTimeout(() => {
      const video = document.getElementById('tvVideo');
      const subModal = document.getElementById('subModal');
      const qualityModal = document.getElementById('qualityModal');

      // Do not hide OSD if video is paused or any modal is currently open
      const modalOpen = (subModal && subModal.style.display === 'flex') || (qualityModal && qualityModal.style.display === 'flex');
      if (video && !video.paused && !modalOpen) {
        const overlay = document.getElementById('playerOverlay');
        if (overlay) overlay.classList.add('hidden');
      }
    }, 4500);
  },

  updatePlayPauseButton() {
    const btn = document.getElementById('btnPlayToggle');
    if (!btn) return;
    btn.textContent = this.isPaused ? 'Play' : 'Pause';
  },

  updateQualityBadge(res, codec) {
    const badge = document.getElementById('playerQualityBadge');
    if (badge) {
      badge.textContent = `${res || 'HD'} • ${(codec || 'HEVC').toUpperCase()}`;
    }
  },

  showBufferIndicator(visible) {
    const banner = document.getElementById('playerLoadingBanner');
    const text = document.getElementById('playerLoadingText');
    if (banner && text) {
      if (visible) {
        text.textContent = 'Buffering media stream...';
        banner.style.display = 'flex';
      } else {
        banner.style.display = 'none';
      }
    }
  },

  hideLoadingBanner() {
    const banner = document.getElementById('playerLoadingBanner');
    if (banner) banner.style.display = 'none';
  },

  showError(msg) {
    const banner = document.getElementById('playerLoadingBanner');
    if (banner) {
      banner.style.display = 'block';
      banner.classList.add('error-banner');
      banner.innerHTML = `
        <div class="player-error-title">Playback Notice</div>
        <div class="player-error-body">${msg}</div>
        <div class="player-error-hint">Press Back on remote to return.</div>
      `;
    }
  },

  isModalOpen() {
    const subModal = document.getElementById('subModal');
    const qualityModal = document.getElementById('qualityModal');
    return (subModal && subModal.style.display === 'flex') || (qualityModal && qualityModal.style.display === 'flex');
  },

  // Key Event Interceptor for Remote Controls inside Player
  handleKey(keyCode) {
    const KEYS = {
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      ENTER: 13,
      BACK: 461,
      BACK_ALT: 27
    };

    const subModal = document.getElementById('subModal');
    const qualityModal = document.getElementById('qualityModal');
    const isSubOpen = subModal && subModal.style.display === 'flex';
    const isQualityOpen = qualityModal && qualityModal.style.display === 'flex';
    const activeModal = isSubOpen ? subModal : (isQualityOpen ? qualityModal : null);

    // ── 1. Focus Trapping & Spatial Navigation inside Active Modal ──
    if (activeModal) {
      if (keyCode === KEYS.BACK || keyCode === KEYS.BACK_ALT) {
        if (isSubOpen) this.closeSubMenu();
        if (isQualityOpen) this.closeQualityMenu();
        return true;
      }

      const focusables = Array.from(activeModal.querySelectorAll('.focusable'));
      if (!focusables.length) return true;

      const cur = Navigation.currentFocus;
      const curIdx = focusables.indexOf(cur);

      if (keyCode === KEYS.UP) {
        const nextIdx = curIdx <= 0 ? focusables.length - 1 : curIdx - 1;
        const target = focusables[nextIdx];
        Navigation.setFocus(target);
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        return true;
      } else if (keyCode === KEYS.DOWN) {
        const nextIdx = curIdx >= focusables.length - 1 ? 0 : curIdx + 1;
        const target = focusables[nextIdx];
        Navigation.setFocus(target);
        if (target) target.scrollIntoView({ behavior: 'auto', block: 'nearest' });
        return true;
      } else if (keyCode === KEYS.ENTER) {
        if (cur) cur.click();
        return true;
      } else if (keyCode === KEYS.LEFT || keyCode === KEYS.RIGHT) {
        // Prevent accidental seeking while navigating modal
        return true;
      }
      return true;
    }

    // ── 2. Player Remote Navigation (When No Modal is Open) ──
    const overlay = document.getElementById('playerOverlay');
    const isHidden = overlay && overlay.classList.contains('hidden');

    if (keyCode === KEYS.BACK || keyCode === KEYS.BACK_ALT) {
      if (!isHidden) {
        // Back key closes OSD when visible
        overlay.classList.add('hidden');
        return true;
      }
      this.exitPlayer();
      return true;
    }

    if (isHidden) {
      // ANY NAVIGATION KEY WAKES UP OSD & HIGHLIGHTS TARGET BUTTON WITHOUT UNINTENDED SEEKING!
      this.showControls();

      if (keyCode === KEYS.ENTER || keyCode === KEYS.DOWN) {
        // Center button or Down: Focus Play/Pause
        const playBtn = document.getElementById('btnPlayToggle') || document.getElementById('btnPlayerExit');
        if (playBtn) Navigation.setFocus(playBtn);
        return true;
      } else if (keyCode === KEYS.LEFT) {
        // Left: Focus -10s button cleanly without triggering premature seek
        const seekBackBtn = document.getElementById('btnSeekBack');
        if (seekBackBtn) Navigation.setFocus(seekBackBtn);
        return true;
      } else if (keyCode === KEYS.RIGHT) {
        // Right: Focus +30s button cleanly without triggering premature seek
        const seekFwdBtn = document.getElementById('btnSeekFwd');
        if (seekFwdBtn) Navigation.setFocus(seekFwdBtn);
        return true;
      } else if (keyCode === KEYS.UP) {
        // Up: Focus Exit button
        const exitBtn = document.getElementById('btnPlayerExit');
        if (exitBtn) Navigation.setFocus(exitBtn);
        return true;
      }
      return true;
    }

    // ── When OSD is VISIBLE: Strict Button-to-Button Spatial Navigation ──
    this.scheduleControlsHide();

    let cur = Navigation.currentFocus || document.activeElement;
    if (!cur || !cur.classList.contains('focusable') || !document.contains(cur)) {
      cur = document.getElementById('btnPlayToggle') || document.getElementById('btnPlayerExit');
      if (cur) Navigation.setFocus(cur);
    }

    if (cur) {
      // Exit button (Top Bar)
      if (cur.id === 'btnPlayerExit') {
        if (keyCode === KEYS.DOWN) {
          Navigation.setFocus(document.getElementById('btnPlayToggle'));
          return true;
        } else if (keyCode === KEYS.ENTER) {
          this.exitPlayer();
          return true;
        }
      }
      // Play/Pause button
      else if (cur.id === 'btnPlayToggle') {
        if (keyCode === KEYS.UP) {
          Navigation.setFocus(document.getElementById('btnPlayerExit'));
          return true;
        } else if (keyCode === KEYS.RIGHT) {
          Navigation.setFocus(document.getElementById('btnSeekBack'));
          return true;
        } else if (keyCode === KEYS.ENTER) {
          this.togglePlayPause();
          return true;
        }
      }
      // -10s Seek Back button
      else if (cur.id === 'btnSeekBack') {
        if (keyCode === KEYS.UP) {
          Navigation.setFocus(document.getElementById('btnPlayerExit'));
          return true;
        } else if (keyCode === KEYS.LEFT) {
          Navigation.setFocus(document.getElementById('btnPlayToggle'));
          return true;
        } else if (keyCode === KEYS.RIGHT) {
          Navigation.setFocus(document.getElementById('btnSeekFwd'));
          return true;
        } else if (keyCode === KEYS.ENTER) {
          this.seekRelative(-10);
          return true;
        }
      }
      // +30s Seek Forward button
      else if (cur.id === 'btnSeekFwd') {
        if (keyCode === KEYS.UP) {
          Navigation.setFocus(document.getElementById('btnPlayerExit'));
          return true;
        } else if (keyCode === KEYS.LEFT) {
          Navigation.setFocus(document.getElementById('btnSeekBack'));
          return true;
        } else if (keyCode === KEYS.RIGHT) {
          Navigation.setFocus(document.getElementById('btnSubtitles'));
          return true;
        } else if (keyCode === KEYS.ENTER) {
          this.seekRelative(30);
          return true;
        }
      }
      // Subtitles button
      else if (cur.id === 'btnSubtitles') {
        if (keyCode === KEYS.UP) {
          Navigation.setFocus(document.getElementById('btnPlayerExit'));
          return true;
        } else if (keyCode === KEYS.LEFT) {
          Navigation.setFocus(document.getElementById('btnSeekFwd'));
          return true;
        } else if (keyCode === KEYS.RIGHT) {
          Navigation.setFocus(document.getElementById('btnQuality'));
          return true;
        } else if (keyCode === KEYS.ENTER) {
          this.openSubMenu();
          return true;
        }
      }
      // Quality button
      else if (cur.id === 'btnQuality') {
        if (keyCode === KEYS.UP) {
          Navigation.setFocus(document.getElementById('btnPlayerExit'));
          return true;
        } else if (keyCode === KEYS.LEFT) {
          Navigation.setFocus(document.getElementById('btnSubtitles'));
          return true;
        } else if (keyCode === KEYS.ENTER) {
          this.openQualityMenu();
          return true;
        }
      }
    }

    return false;
  },

  openQualityMenu() {
    const modal = document.getElementById('qualityModal');
    const list = document.getElementById('qualityList');
    if (!modal || !list) return;

    modal.style.display = 'flex';
    this.showControls();

    if (!this.allStreams || !this.allStreams.length) {
      list.innerHTML = '<div style="font-size: 26px; color: var(--ink-muted); padding: 18px 0;">No alternate streams available for this title.</div>';
    } else {
      list.innerHTML = this.allStreams.map((s, idx) => `
        <button class="player-modal-item focusable ${this.currentStreamIndex === idx ? 'active-track' : ''}" tabindex="0" onclick="PlayerScreen.switchStream(${idx})">
          <span>${s.quality || 'HD'} • ${(s.codec || 'HEVC').toUpperCase()} ${s.size ? '• ' + Math.round(s.size / (1024 * 1024)) + 'MB' : ''}</span>
        </button>
      `).join('');
    }

    const target = list.querySelector('.active-track') || modal.querySelector('.focusable');
    if (target) Navigation.setFocus(target);
  },

  closeQualityMenu() {
    const modal = document.getElementById('qualityModal');
    if (modal) modal.style.display = 'none';
    Navigation.setFocus(document.getElementById('btnQuality') || document.getElementById('btnPlayerExit'));
    this.scheduleControlsHide();
  },

  switchStream(index) {
    const now = Date.now();
    if (this._lastStreamSwitchTime && (now - this._lastStreamSwitchTime) < 600) {
      console.warn('[MovieBox Player] Debouncing duplicate switchStream request');
      return;
    }
    this._lastStreamSwitchTime = now;

    const selected = this.allStreams[index];
    if (!selected) return;

    const video = document.getElementById('tvVideo');
    const curTime = video ? Math.max(0, video.currentTime) : 0;
    const wasPlaying = video ? !video.paused : true;

    if (video) {
      try { video.pause(); } catch (_) {}
    }

    this.currentStreamIndex = index;
    this.currentStream = selected;
    this.updateQualityBadge(selected.quality, selected.codec);
    this.closeQualityMenu();

    this.showBufferIndicator(true);

    if (this.dashPlayer) {
      try { this.dashPlayer.reset(); } catch (e) {}
      this.dashPlayer = null;
    }

    this._wasPlayingBeforeSeek = wasPlaying;
    this.initPlayback(selected, 8888, curTime);
  },

  async loadSubtitles(subjectId, resourceId) {
    try {
      const res = await API.getCaptions(subjectId, resourceId || 0, this.mediaTitle || '', this.currentSeason || 0, this.currentEpisode || 0);
      this.subtitles = res?.captions || [];
    } catch (e) {
      console.log('No captions returned:', e);
    }
  },

  openSubMenu() {
    const modal = document.getElementById('subModal');
    const list = document.getElementById('subList');
    if (!modal || !list) return;

    modal.style.display = 'flex';
    this.showControls();

    let html = `
      <button class="player-modal-item focusable ${!this.activeSubUrl ? 'active-track' : ''}" tabindex="0" onclick="PlayerScreen.disableSubtitles()">
        <span>Off (Subtitles Disabled)</span>
      </button>
    `;

    if (this.subtitles && this.subtitles.length > 0) {
      html += this.subtitles.map(s => `
        <button class="player-modal-item focusable ${this.activeSubUrl === s.url ? 'active-track' : ''}" tabindex="0" onclick="PlayerScreen.applySubtitle('${s.url.replace(/'/g, "\\'")}', '${s.lan || 'en'}', '${(s.lanName || s.lan || 'Unknown').replace(/'/g, "\\'")}')">
          <span>${s.lanName || s.lan || 'Unknown'} (${(s.lan || 'EN').toUpperCase()})</span>
        </button>
      `).join('');
    } else {
      html += '<div style="font-size: 26px; color: var(--ink-muted); padding: 18px 0;">No external subtitles found for this title.</div>';
    }

    list.innerHTML = html;

    const target = list.querySelector('.active-track') || modal.querySelector('.focusable');
    if (target) Navigation.setFocus(target);
  },

  closeSubMenu() {
    const modal = document.getElementById('subModal');
    if (modal) modal.style.display = 'none';
    Navigation.setFocus(document.getElementById('btnSubtitles') || document.getElementById('btnPlayerExit'));
    this.scheduleControlsHide();
  },

  async fetchSubtitleText(url) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch (_) {}
    // Proxy fallback for CORS-restricted subtitle CDNs
    const proxyUrl = `http://127.0.0.1:8888/video.mp4?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    return await res.text();
  },

  async applySubtitle(url, lang, langName) {
    try {
      this.showBufferIndicator(true);
      const text = await this.fetchSubtitleText(url);
      const vtt = Utils.srtToVtt(text);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);

      const video = document.getElementById('tvVideo');
      if (video) {
        // Clear old track elements
        const oldTracks = video.querySelectorAll('track');
        oldTracks.forEach(t => t.remove());

        const track = document.createElement('track');
        track.kind = 'subtitles';
        track.label = langName || (lang ? lang.toUpperCase() : 'Subtitles');
        track.srclang = lang || 'en';
        track.src = blobUrl;
        track.default = true;
        video.appendChild(track);

        // Explicitly set mode to showing
        if (video.textTracks && video.textTracks.length > 0) {
          for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = 'showing';
          }
        }
      }
      this.activeSubUrl = url;
      this.activeSubLang = langName || lang;
      this.closeSubMenu();
      this.flashCenterIcon(`Subtitles: ${this.activeSubLang}`);
    } catch (e) {
      console.error('Subtitle apply error:', e);
      alert('Failed to load subtitle track: ' + e.message);
    } finally {
      this.showBufferIndicator(false);
    }
  },

  disableSubtitles() {
    const video = document.getElementById('tvVideo');
    if (video) {
      const oldTracks = video.querySelectorAll('track');
      oldTracks.forEach(t => t.remove());
      if (video.textTracks) {
        for (let i = 0; i < video.textTracks.length; i++) {
          video.textTracks[i].mode = 'disabled';
        }
      }
    }
    this.activeSubUrl = null;
    this.activeSubLang = null;
    this.closeSubMenu();
    this.flashCenterIcon('Subtitles Off');
  },

  exitPlayer() {
    this.isActive = false;
    this._playbackSessionId = (this._playbackSessionId || 0) + 1;
    clearTimeout(this.controlsTimeout);
    clearTimeout(this._seekDebounceTimer);
    clearTimeout(this._seekSafetyTimer);
    clearTimeout(this._bufferTimeout);
    clearTimeout(this._connectTimeout);
    clearTimeout(this._initialLoadTimeout);
    clearInterval(this.progressInterval);

    if (this.dashPlayer) {
      try { this.dashPlayer.reset(); } catch (e) {}
      this.dashPlayer = null;
    }

    const video = document.getElementById('tvVideo');
    if (video) {
      try {
        video.pause();
        while (video.firstChild) video.removeChild(video.firstChild);
        video.removeAttribute('src');
        video.load();
      } catch (e) {}
    }

    App.handleBack();
  }
};
