/**
 * Electron Forge Configuration for N.A.V.I.I.
 * Configured for Windows distribution and installer packaging.
 */

module.exports = {
  packagerConfig: {
    name: 'NAVII',
    executableName: 'NAVII',
    asar: true,
    appBundleId: 'com.navii.ai.assistant',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'NAVII',
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    },
  ],
};
