// Vitest setup -- mock Chrome extension APIs
global.chrome = {
  runtime: {
    sendMessage: () => Promise.resolve(),
    onMessage: { addListener: () => {} },
  },
  storage: {
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    },
  },
  downloads: {
    download: () => Promise.resolve(),
  },
  alarms: {
    create: () => {},
    onAlarm: { addListener: () => {} },
  },
};
