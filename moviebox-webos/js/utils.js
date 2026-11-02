const Utils = {
  // Convert SRT subtitle text into WebVTT format for HTML5 <track>
  srtToVtt(srtText) {
    if (!srtText) return '';
    return 'WEBVTT\n\n' + srtText
      .trim()
      .replace(/\r\n/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
      .replace(/^\d+\n/gm, '');
  },

  formatDuration(seconds) {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return hrs > 0 ? `${hrs}h ${remMins}m` : `${remMins}m`;
  },

  formatBytes(bytes) {
    if (!bytes) return '';
    const num = Number(bytes);
    if (isNaN(num) || num <= 0) return '';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(num) / Math.log(1024));
    return `${(num / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }
};
