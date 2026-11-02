// Ultra High-Performance TV Remote Navigation & Focus Engine
const KEYS = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 461,     // LG webOS TV Remote Back
  BACK_ALT: 27, // ESC / PC Keyboard
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406
};

const Navigation = {
  currentFocus: null,
  _dpadTimer: null,

  init() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e), true);

    // Keep Navigation.currentFocus in sync if user clicks or points with Magic Remote
    window.addEventListener('focusin', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('focusable')) {
        if (this.currentFocus && this.currentFocus !== e.target) {
          this.currentFocus.classList.remove('focused');
        }
        this.currentFocus = e.target;
        this.currentFocus.classList.add('focused');
      }
    }, true);

    // Suppress pointer hover events while using D-Pad to prevent remote gyro jitter
    window.addEventListener('keydown', (e) => {
      if ([37, 38, 39, 40, 13, 461].includes(e.keyCode)) {
        document.body.classList.add('dpad-active');
        clearTimeout(this._dpadTimer);
        this._dpadTimer = setTimeout(() => {
          document.body.classList.remove('dpad-active');
        }, 1200);
      }
    }, true);

    window.addEventListener('mousemove', () => {
      document.body.classList.remove('dpad-active');
    }, true);
  },

  getFocusableElements() {
    const activeScreen = document.querySelector('.screen.active, .player-screen-wrapper');
    if (!activeScreen) return [];
    return Array.from(activeScreen.querySelectorAll('[tabindex="0"], button, input, .focusable'));
  },

  setFocus(el) {
    if (!el) return;
    if (this.currentFocus) {
      this.currentFocus.classList.remove('focused');
      this.currentFocus.blur();
    }
    this.currentFocus = el;
    this.currentFocus.classList.add('focused');
    this.currentFocus.focus();

    // McMaster-Carr Intent Prefetching:
    // If the focused element has a data-subject-id, prefetch details after 140ms
    clearTimeout(this._prefetchTimer);
    const subjectId = el.getAttribute('data-subject-id');
    if (subjectId && typeof DetailScreen !== 'undefined' && DetailScreen.prefetch) {
      this._prefetchTimer = setTimeout(() => {
        DetailScreen.prefetch(subjectId);
      }, 140);
    }

    // Check if inside carousel
    const carousel = el.closest('.row-carousel');
    if (carousel) {
      // ONLY scroll the horizontal carousel. DO NOT call scrollIntoView to eliminate layout jitter!
      carousel.scrollLeft = Math.max(0, el.offsetLeft - 64);
    } else {
      // For vertical pages, scroll cleanly into view
      this.currentFocus.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }
  },

  handleKeyDown(e) {
    const key = e.keyCode;

    // Delegate to Fullscreen Player if active
    if (typeof PlayerScreen !== 'undefined' && PlayerScreen.isActive) {
      PlayerScreen.handleKey(key);
      e.preventDefault();
      return;
    }

    // Handle Back key
    if (key === KEYS.BACK || key === KEYS.BACK_ALT) {
      App.handleBack();
      e.preventDefault();
      return;
    }

    // Do not interfere with virtual keyboard / native text typing in <input>
    if (e.target && e.target.tagName === 'INPUT') {
      if (key === KEYS.ENTER) {
        e.preventDefault();
        e.target.blur();
        SearchScreen.performSearch();
      } else if (key === KEYS.DOWN) {
        const next = document.getElementById('searchSubmitBtn') || document.querySelector('.filter-chip.active');
        if (next) { this.setFocus(next); e.preventDefault(); }
      }
      return;
    }

    const focusables = this.getFocusableElements();
    if (!focusables.length) return;

    if (!this.currentFocus || !focusables.includes(this.currentFocus)) {
      this.setFocus(focusables[0]);
      e.preventDefault();
      return;
    }

    if (key === KEYS.ENTER) {
      if (this.currentFocus) {
        this.currentFocus.click();
        e.preventDefault();
      }
      return;
    }

    // ── 1. Top Nav Bar Spatial Navigation ──
    const inTopNav = this.currentFocus.closest('.top-nav');
    if (inTopNav) {
      if (key === KEYS.LEFT) {
        const prev = this.currentFocus.previousElementSibling;
        if (prev && prev.classList.contains('focusable')) {
          this.setFocus(prev);
          e.preventDefault();
          return;
        }
      } else if (key === KEYS.RIGHT) {
        const next = this.currentFocus.nextElementSibling;
        if (next && next.classList.contains('focusable')) {
          this.setFocus(next);
          e.preventDefault();
          return;
        }
      } else if (key === KEYS.DOWN) {
        const heroBtn = document.querySelector('.hero-actions .focusable');
        const firstCard = document.querySelector('.card.focusable');
        this.setFocus(heroBtn || firstCard);
        e.preventDefault();
        return;
      }
      return;
    }

    // ── 2. Hero Banner Actions ──
    const inHero = this.currentFocus.closest('.hero-actions');
    if (inHero) {
      if (key === KEYS.UP) {
        const navBtn = document.querySelector('.top-nav .focusable');
        if (navBtn) { this.setFocus(navBtn); e.preventDefault(); return; }
      } else if (key === KEYS.DOWN) {
        const firstCard = document.querySelector('.card.focusable');
        if (firstCard) { this.setFocus(firstCard); e.preventDefault(); return; }
      }
      return;
    }

    // ── 3. Horizontal Carousel Row Navigation ──
    const inCarousel = this.currentFocus.closest('.row-carousel');
    if (inCarousel) {
      const currentRowSection = this.currentFocus.closest('.row-section');
      const currentCards = Array.from(inCarousel.querySelectorAll('.card.focusable'));
      const colIndex = currentCards.indexOf(this.currentFocus);

      if (key === KEYS.LEFT) {
        const prev = this.currentFocus.previousElementSibling;
        if (prev && prev.classList.contains('focusable')) {
          this.setFocus(prev);
          e.preventDefault();
          return;
        }
      } else if (key === KEYS.RIGHT) {
        const next = this.currentFocus.nextElementSibling;
        if (next && next.classList.contains('focusable')) {
          this.setFocus(next);
          e.preventDefault();
          return;
        }
      } else if (key === KEYS.UP) {
        const prevRowSection = currentRowSection?.previousElementSibling;
        if (prevRowSection && prevRowSection.classList.contains('row-section')) {
          const prevCards = Array.from(prevRowSection.querySelectorAll('.card.focusable'));
          if (prevCards.length) {
            const target = prevCards[Math.min(colIndex, prevCards.length - 1)];
            this.setFocus(target);
            e.preventDefault();
            return;
          }
        } else {
          // Jump up to Hero button or Top Nav
          const heroBtn = document.querySelector('.hero-actions .focusable');
          const navBtn = document.querySelector('.top-nav .focusable');
          this.setFocus(heroBtn || navBtn);
          e.preventDefault();
          return;
        }
      } else if (key === KEYS.DOWN) {
        const nextRowSection = currentRowSection?.nextElementSibling;
        if (nextRowSection && nextRowSection.classList.contains('row-section')) {
          const nextCards = Array.from(nextRowSection.querySelectorAll('.card.focusable'));
          if (nextCards.length) {
            const target = nextCards[Math.min(colIndex, nextCards.length - 1)];
            this.setFocus(target);
            e.preventDefault();
            return;
          }
        }
        e.preventDefault();
        return;
      }
      return;
    }

    // ── 4. Detail Screen Spatial Navigation ──
    const inDetail = this.currentFocus.closest('.detail-content');
    if (inDetail) {
      const isBack = this.currentFocus.classList.contains('back-top');
      const isPlay = this.currentFocus.id === 'playBtn';
      const isFav = this.currentFocus.id === 'favBtn';
      const isSeason = this.currentFocus.classList.contains('season-tab');
      const isEpisode = this.currentFocus.classList.contains('episode-card');

      if (isBack) {
        if (key === KEYS.DOWN) {
          const playBtn = document.getElementById('playBtn');
          if (playBtn) { this.setFocus(playBtn); e.preventDefault(); return; }
        }
      } else if (isPlay) {
        if (key === KEYS.UP) {
          const backBtn = inDetail.querySelector('.back-top');
          if (backBtn) { this.setFocus(backBtn); e.preventDefault(); return; }
        } else if (key === KEYS.RIGHT) {
          const favBtn = document.getElementById('favBtn');
          if (favBtn) { this.setFocus(favBtn); e.preventDefault(); return; }
        } else if (key === KEYS.DOWN) {
          const firstTab = inDetail.querySelector('.season-tab.focusable') || inDetail.querySelector('.episode-card.focusable');
          if (firstTab) { this.setFocus(firstTab); e.preventDefault(); return; }
        }
      } else if (isFav) {
        if (key === KEYS.LEFT) {
          const playBtn = document.getElementById('playBtn');
          if (playBtn) { this.setFocus(playBtn); e.preventDefault(); return; }
        } else if (key === KEYS.UP) {
          const backBtn = inDetail.querySelector('.back-top');
          if (backBtn) { this.setFocus(backBtn); e.preventDefault(); return; }
        } else if (key === KEYS.DOWN) {
          const firstTab = inDetail.querySelector('.season-tab.focusable') || inDetail.querySelector('.episode-card.focusable');
          if (firstTab) { this.setFocus(firstTab); e.preventDefault(); return; }
        }
      } else if (isSeason) {
        if (key === KEYS.LEFT && this.currentFocus.previousElementSibling?.classList.contains('focusable')) {
          this.setFocus(this.currentFocus.previousElementSibling);
          e.preventDefault();
          return;
        } else if (key === KEYS.RIGHT && this.currentFocus.nextElementSibling?.classList.contains('focusable')) {
          this.setFocus(this.currentFocus.nextElementSibling);
          e.preventDefault();
          return;
        } else if (key === KEYS.UP) {
          const playBtn = document.getElementById('playBtn');
          if (playBtn) { this.setFocus(playBtn); e.preventDefault(); return; }
        } else if (key === KEYS.DOWN) {
          const firstEp = inDetail.querySelector('.episode-card.focusable');
          if (firstEp) { this.setFocus(firstEp); e.preventDefault(); return; }
        }
      } else if (isEpisode) {
        const epCards = Array.from(inDetail.querySelectorAll('.episode-card.focusable'));
        const epIdx = epCards.indexOf(this.currentFocus);
        const epCols = 4;

        if (key === KEYS.LEFT && epIdx > 0) {
          this.setFocus(epCards[epIdx - 1]);
          e.preventDefault();
          return;
        } else if (key === KEYS.RIGHT && epIdx < epCards.length - 1) {
          this.setFocus(epCards[epIdx + 1]);
          e.preventDefault();
          return;
        } else if (key === KEYS.UP) {
          if (epIdx >= epCols) {
            this.setFocus(epCards[epIdx - epCols]);
          } else {
            const seasonTab = inDetail.querySelector('.season-tab.active') || document.getElementById('playBtn');
            if (seasonTab) this.setFocus(seasonTab);
          }
          e.preventDefault();
          return;
        } else if (key === KEYS.DOWN) {
          if (epIdx + epCols < epCards.length) {
            this.setFocus(epCards[epIdx + epCols]);
            e.preventDefault();
            return;
          }
        }
      }
      return;
    }

    // ── 5. Fast Grid & List Fallback (Search, Favorites, History, Settings) ──
    const currentIndex = focusables.indexOf(this.currentFocus);

    if (key === KEYS.RIGHT && currentIndex < focusables.length - 1) {
      this.setFocus(focusables[currentIndex + 1]);
      e.preventDefault();
    } else if (key === KEYS.LEFT && currentIndex > 0) {
      this.setFocus(focusables[currentIndex - 1]);
      e.preventDefault();
    } else if (key === KEYS.DOWN) {
      this.fastStepVertical(1, focusables, currentIndex);
      e.preventDefault();
    } else if (key === KEYS.UP) {
      this.fastStepVertical(-1, focusables, currentIndex);
      e.preventDefault();
    }
  },

  fastStepVertical(direction, focusables, currentIndex) {
    const columns = 4;
    const targetIdx = currentIndex + (direction * columns);
    if (targetIdx >= 0 && targetIdx < focusables.length) {
      this.setFocus(focusables[targetIdx]);
    } else if (direction < 0 && currentIndex > 0) {
      this.setFocus(focusables[0]);
    } else if (direction > 0 && currentIndex < focusables.length - 1) {
      this.setFocus(focusables[focusables.length - 1]);
    }
  }
};
