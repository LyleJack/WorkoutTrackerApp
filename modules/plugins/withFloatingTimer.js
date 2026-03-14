/**
 * plugins/withFloatingTimer.js
 *
 * Expo config plugin that automatically:
 *   1. Adds SYSTEM_ALERT_WINDOW + FOREGROUND_SERVICE permissions to AndroidManifest.xml
 *   2. Registers FloatingTimerService in AndroidManifest.xml
 *   3. Adds FloatingTimerPackage to MainApplication.kt
 *
 * Applied via app.json plugins array — runs during `expo prebuild`.
 */
const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');

// ── 1. Manifest modifications ─────────────────────────────────────────────────

function withFloatingTimerManifest(config) {
  return withAndroidManifest(config, async (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest;

    if (!app['uses-permission']) app['uses-permission'] = [];

    const neededPerms = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
    ];
    for (const perm of neededPerms) {
      const already = app['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm
      );
      if (!already) {
        app['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    const application = app.application[0];
    if (!application.service) application.service = [];

    const serviceName = 'com.yourname.workouttracker.floatingtimer.FloatingTimerService';
    const alreadyService = application.service.some(
      (s) => s.$?.['android:name'] === serviceName
    );
    if (!alreadyService) {
      application.service.push({
        $: {
          'android:name':                  serviceName,
          'android:enabled':               'true',
          'android:exported':              'false',
          'android:foregroundServiceType': 'mediaPlayback',
        },
      });
    }

    return cfg;
  });
}

// ── 2. MainApplication.kt modification ───────────────────────────────────────

function withFloatingTimerPackage(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    const importLine = 'import com.yourname.workouttracker.floatingtimer.FloatingTimerPackage';
    const packageLine = 'FloatingTimerPackage()';

    // --- Insert import ---
    // Find the last existing import line and insert after it.
    // Falls back to inserting after the package declaration if no imports exist.
    if (!src.includes(importLine)) {
      const lines = src.split('\n');
      let lastImportIdx = -1;
      let packageIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith('import ')) lastImportIdx = i;
        if (lines[i].trimStart().startsWith('package ') && packageIdx === -1) packageIdx = i;
      }

      const insertAfter = lastImportIdx >= 0 ? lastImportIdx : packageIdx;
      if (insertAfter >= 0) {
        lines.splice(insertAfter + 1, 0, importLine);
        src = lines.join('\n');
      }
    }

    // --- Insert into getPackages() ---
    if (!src.includes(packageLine)) {
      // Match the PackageList(...).packages line and append our package after it
      src = src.replace(
        /(packages\.add\(PackageList\(this\)\.packages\))/,
        `$1\n        packages.add(FloatingTimerPackage())`
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

// ── Export combined plugin ────────────────────────────────────────────────────

module.exports = function withFloatingTimer(config) {
  config = withFloatingTimerManifest(config);
  config = withFloatingTimerPackage(config);
  return config;
};
