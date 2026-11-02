const App = {
  historyStack: [],
  detailParams: null,

  init() {
    Navigation.init();
    API.startKeepAlive();
    this.navigate('home');
  },

  navigate(screenName) {
    const root = document.getElementById('appRoot');
    root.innerHTML = '';

    const screenDiv = document.createElement('div');
    screenDiv.className = `screen active screen-${screenName}`;
    root.appendChild(screenDiv);

    if (screenName !== 'home') {
      if (this.historyStack[this.historyStack.length - 1] !== screenName) {
        this.historyStack.push(screenName);
      }
    } else {
      this.historyStack = ['home'];
    }

    switch (screenName) {
      case 'home':
        HomeScreen.render(screenDiv);
        break;
      case 'search':
        SearchScreen.render(screenDiv);
        break;
      case 'favorites':
        FavoritesScreen.render(screenDiv);
        break;
      case 'history':
        HistoryScreen.render(screenDiv);
        break;
      case 'settings':
        SettingsScreen.render(screenDiv);
        break;
      case 'detail':
        if (this.detailParams) {
          DetailScreen.render(screenDiv, this.detailParams.subjectId, this.detailParams.provider);
        } else {
          this.navigate('home');
        }
        break;
    }

    // Give browser a frame to layout and set focus
    setTimeout(() => {
      const firstFocus = screenDiv.querySelector('.focusable');
      if (firstFocus) Navigation.setFocus(firstFocus);
    }, 40);
  },

  openDetail(subjectId, provider = 'moviebox') {
    this.detailParams = { subjectId, provider };
    const root = document.getElementById('appRoot');
    root.innerHTML = '';

    const screenDiv = document.createElement('div');
    screenDiv.className = 'screen active screen-detail';
    root.appendChild(screenDiv);

    if (this.historyStack[this.historyStack.length - 1] !== 'detail') {
      this.historyStack.push('detail');
    }

    DetailScreen.render(screenDiv, subjectId, provider);

    setTimeout(() => {
      const firstFocus = screenDiv.querySelector('.focusable');
      if (firstFocus) Navigation.setFocus(firstFocus);
    }, 40);
  },

  openPlayer(subjectId, season = 0, episode = 0, title = 'MovieBox Player') {
    if (this._openingPlayer) return;
    this._openingPlayer = true;
    setTimeout(() => { this._openingPlayer = false; }, 1500);

    const root = document.getElementById('appRoot');
    root.innerHTML = '';

    const screenDiv = document.createElement('div');
    screenDiv.className = 'screen active screen-player';
    root.appendChild(screenDiv);

    if (this.historyStack[this.historyStack.length - 1] !== 'player') {
      this.historyStack.push('player');
    }

    PlayerScreen.render(screenDiv, subjectId, season, episode, title);
  },

  handleBack() {
    if (typeof PlayerScreen !== 'undefined' && PlayerScreen.isActive) {
      PlayerScreen.exitPlayer();
      return;
    }

    if (this.historyStack.length > 1) {
      this.historyStack.pop(); // Remove current screen
      const prev = this.historyStack.pop(); // Pop target so navigate() pushes it cleanly once

      if (prev === 'detail' && this.detailParams) {
        this.openDetail(this.detailParams.subjectId, this.detailParams.provider);
      } else {
        this.navigate(prev || 'home');
      }
    } else {
      console.log('App at root screen');
    }
  }
};

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
