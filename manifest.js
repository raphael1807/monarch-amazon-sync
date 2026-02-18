import fs from 'node:fs';

const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

/**
 * After changing, please reload the extension at `chrome://extensions`
 * @type {chrome.runtime.ManifestV3}
 */
const manifest = {
  manifest_version: 3,
  name: `Monarch / Amazon Sync (CA) v${packageJson.version}`,
  version: packageJson.version,
  description: packageJson.description,
  permissions: ['storage', 'tabs', 'scripting', 'alarms', 'downloads', 'notifications', 'contextMenus'],
  host_permissions: [
    'https://amazon.ca/*',
    'https://www.amazon.ca/*',
    'https://www.amazon.com/*',
    'https://app.monarchmoney.com/*',
    'https://app.monarch.com/*',
    'https://api.monarchmoney.com/*',
    'https://api.monarch.com/*',
  ],
  background: {
    service_worker: 'src/pages/background/index.js',
    type: 'module',
  },
  action: {
    default_popup: 'src/pages/popup/index.html',
    default_icon: 'icon-34.png',
  },
  icons: {
    128: 'icon-128.png',
  },
  content_scripts: [
    {
      matches: ['https://www.amazon.com/*'],
      js: ['src/pages/content/amazonComExtractor.js'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['assets/js/*.js', 'assets/css/*.css', 'icon-128.png', 'icon-34.png'],
      matches: ['*://*/*'],
    },
  ],
};

export default manifest;
