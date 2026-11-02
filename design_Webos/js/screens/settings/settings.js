const SettingsScreen = {
  render(container) {
    const settings = Storage.getSettings();

    container.innerHTML = `
      <div class="screen-content settings-content" style="padding: 48px 64px; max-width: 1000px;">
        <header class="page-header" style="padding: 0 0 32px 0; margin-bottom: 32px;">
          <div style="display: flex; align-items: baseline; gap: 20px;">
            <button class="btn btn-secondary focusable" tabindex="0" onclick="App.navigate('home')">← Back to home</button>
            <h1 style="font-size: 36px; font-weight: 800; letter-spacing: -0.02em;">Settings</h1>
          </div>
        </header>

        <div class="settings-form" style="display: flex; flex-direction: column; gap: 40px;">
          <div class="setting-group" style="display: flex; flex-direction: column; gap: 16px;">
            <h2 style="font-size: 24px; font-weight: 700;">Content Providers</h2>
            <div style="display: flex; flex-direction: column; gap: 14px;">
              <label class="setting-toggle focusable" tabindex="0" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface-elevated); padding: 20px 28px; border-radius: 8px; border: 1px solid var(--border-hairline); cursor: pointer;" onclick="SettingsScreen.toggleCheckbox('provMb')">
                <span style="font-size: 22px; font-weight: 600;">MovieBox Cluster (Signed Mobile BFF API)</span>
                <input type="checkbox" id="provMb" ${settings.providerMoviebox ? 'checked' : ''} onchange="SettingsScreen.toggleProvider('providerMoviebox', this.checked)" style="width: 24px; height: 24px;">
              </label>

              <label class="setting-toggle focusable" tabindex="0" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface-elevated); padding: 20px 28px; border-radius: 8px; border: 1px solid var(--border-hairline); cursor: pointer;" onclick="SettingsScreen.toggleCheckbox('provDc')">
                <span style="font-size: 22px; font-weight: 600;">Dramachi (Asian Drama Provider)</span>
                <input type="checkbox" id="provDc" ${settings.providerDramachi ? 'checked' : ''} onchange="SettingsScreen.toggleProvider('providerDramachi', this.checked)" style="width: 24px; height: 24px;">
              </label>

              <label class="setting-toggle focusable" tabindex="0" style="display: flex; align-items: center; justify-content: space-between; background: var(--surface-elevated); padding: 20px 28px; border-radius: 8px; border: 1px solid var(--border-hairline); cursor: pointer;" onclick="SettingsScreen.toggleCheckbox('provSt')">
                <span style="font-size: 22px; font-weight: 600;">Stremio Community Protocol</span>
                <input type="checkbox" id="provSt" ${settings.providerStremio ? 'checked' : ''} onchange="SettingsScreen.toggleProvider('providerStremio', this.checked)" style="width: 24px; height: 24px;">
              </label>
            </div>
          </div>

          <div class="setting-group" style="display: flex; flex-direction: column; gap: 16px;">
            <h2 style="font-size: 24px; font-weight: 700;">Community Add-ons (Stremio Protocol)</h2>
            <div style="display: flex; gap: 16px;">
              <input type="text" id="addonUrl" class="focusable search-input" tabindex="0" placeholder="https://domain/manifest.json" style="flex: 1;" />
              <button class="btn btn-primary focusable" tabindex="0" onclick="SettingsScreen.addAddon()">Install add-on</button>
            </div>
            <div class="addons-list" id="addonsList" style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px;">
              ${(settings.stremioAddons || []).map(url => `
                <div style="background: var(--surface-elevated); padding: 16px 24px; border-radius: 6px; border: 1px solid var(--border-hairline); font-size: 18px; color: var(--ink-secondary); font-family: monospace;">
                  ${url}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    Navigation.setFocus(container.querySelector('.focusable'));
  },

  toggleCheckbox(id) {
    const cb = document.getElementById(id);
    if (cb) {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change'));
    }
  },

  toggleProvider(key, enabled) {
    const s = Storage.getSettings();
    s[key] = enabled;
    Storage.saveSettings(s);
  },

  addAddon() {
    const input = document.getElementById('addonUrl');
    const url = input?.value?.trim();
    if (!url) return;

    const s = Storage.getSettings();
    s.stremioAddons = s.stremioAddons || [];
    if (!s.stremioAddons.includes(url)) {
      s.stremioAddons.push(url);
      Storage.saveSettings(s);
    }
    this.render(document.getElementById('appRoot'));
  }
};
