const crypto = require('crypto');

const REDMI_MODELS = [
  '23078RKD5C', '2201117TY', '2201117TG',
  '22101316G', '21121210G', 'M2012K11AG', 'M2007J20CG'
];

const VERSION_CODES = [50020117, 50020118, 50020119, 50020120, 50020121];

const INDIAN_IP_PREFIXES = [
  '103.241', '49.36', '117.195', '106.198', '122.162',
  '157.32', '182.70', '103.58', '27.60', '59.90'
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomIndianIP() {
  const prefix = getRandomItem(INDIAN_IP_PREFIXES);
  const octet3 = Math.floor(Math.random() * 254) + 1;
  const octet4 = Math.floor(Math.random() * 254) + 1;
  return `${prefix}.${octet3}.${octet4}`;
}

function generateDeviceProfile() {
  const model = getRandomItem(REDMI_MODELS);
  const versionCode = getRandomItem(VERSION_CODES);
  const deviceId = crypto.randomBytes(16).toString('hex');
  const gaid = crypto.randomUUID();
  const androidVer = (Math.floor(Math.random() * 4) + 10).toString(); // Android 10-13

  const userAgent = `com.community.oneroom/${versionCode} (Linux; U; Android ${androidVer}; en_US; ${model}; Build/TQ3A.230901.001; Cronet/135.0.7012.3)`;

  const clientInfo = JSON.stringify({
    package_name: 'com.community.oneroom',
    version_name: '4.0.01.0813.03',
    version_code: versionCode,
    os: 'android',
    os_version: androidVer,
    install_ch: 'ps',
    device_id: deviceId,
    install_store: 'ps',
    gaid: gaid,
    brand: 'Redmi',
    model: model,
    system_language: 'en',
    net: 'NETWORK_WIFI',
    region: 'US',
    timezone: 'Asia/Kolkata',
    sp_code: '40401',
    'X-Play-Mode': '2'
  });

  return {
    userAgent,
    clientInfo,
    spoofedIp: getRandomIndianIP()
  };
}

module.exports = {
  generateDeviceProfile
};
