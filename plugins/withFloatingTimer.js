/**
 * plugins/withFloatingTimer.js
 */
const { withAndroidManifest, withMainApplication, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

function withFloatingTimerFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;

      const javaSrc  = path.join(projectRoot, 'modules', 'floating-timer', 'android', 'src', 'main',
                                 'java', 'com', 'yourname', 'workouttracker', 'floatingtimer');
      const javaDest = path.join(projectRoot, 'android', 'app', 'src', 'main',
                                 'java', 'com', 'yourname', 'workouttracker', 'floatingtimer');
      const resSrc   = path.join(projectRoot, 'modules', 'floating-timer', 'android', 'src', 'main', 'res');
      const resDest  = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

      if (!fs.existsSync(javaSrc)) {
        throw new Error(`[withFloatingTimer] Kotlin source not found at: ${javaSrc}`);
      }

      function copyDir(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
          const s = path.join(src, entry.name);
          const d = path.join(dest, entry.name);
          entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
        }
      }

      copyDir(javaSrc, javaDest);
      copyDir(resSrc, resDest);
      console.log('[withFloatingTimer] ✓ Copied Kotlin sources and res to android/app/src/main/');
      return cfg;
    },
  ]);
}

function withFloatingTimerManifest(config) {
  return withAndroidManifest(config, async (cfg) => {
    const app = cfg.modResults.manifest;

    if (!app['uses-permission']) app['uses-permission'] = [];
    for (const perm of [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
    ]) {
      if (!app['uses-permission'].some(p => p.$?.['android:name'] === perm)) {
        app['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    const application = app.application[0];
    if (!application.service) application.service = [];
    const serviceName = 'com.yourname.workouttracker.floatingtimer.FloatingTimerService';
    if (!application.service.some(s => s.$?.['android:name'] === serviceName)) {
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

function withFloatingTimerPackage(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    const correctImport = 'import com.yourname.workouttracker.floatingtimer.FloatingTimerPackage';
    const packageCall   = 'FloatingTimerPackage()';

    if (!src.includes(correctImport)) {
      const lines = src.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith('import ')) lastImportIdx = i;
      }
      if (lastImportIdx >= 0) {
        lines.splice(lastImportIdx + 1, 0, correctImport);
        src = lines.join('\n');
      }
    }

    if (!src.includes(packageCall)) {
      src = src.replace(
        /(PackageList\(this\)\.packages\.apply \{)([\s\S]*?)(\/\/ Packages that cannot be autolinked)/,
        '$1$2add(FloatingTimerPackage())\n          $3'
      );
    }

    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = function withFloatingTimer(config) {
  config = withFloatingTimerFiles(config);
  config = withFloatingTimerManifest(config);
  config = withFloatingTimerPackage(config);
  return config;
};
