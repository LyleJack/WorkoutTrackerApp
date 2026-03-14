/**
 * plugins/withFloatingTimer.js
 *
 * 1. Copies Kotlin source files from modules/ into android/app/src/main/
 * 2. Adds permissions to AndroidManifest.xml
 * 3. Registers FloatingTimerService in AndroidManifest.xml
 * 4. Adds import + add() call to MainApplication.kt
 */
const { withAndroidManifest, withMainApplication } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

// ── Step 1: Copy source files ─────────────────────────────────────────────────

function withFloatingTimerFiles(config) {
  return withMainApplication(config, (cfg) => {
    const projectRoot = process.cwd();

    // Copy res files
    const resSrc  = path.join(projectRoot, 'modules', 'floating-timer', 'android', 'src', 'main', 'res');
    const resDest = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res');

    // Copy Kotlin files — explicitly target the correct package path only
    const javaSrc  = path.join(projectRoot, 'modules', 'floating-timer', 'android', 'src', 'main',
                               'java', 'com', 'yourname', 'workouttracker', 'floatingtimer');
    const javaDest = path.join(projectRoot, 'android', 'app', 'src', 'main',
                               'java', 'com', 'yourname', 'workouttracker', 'floatingtimer');

    function copyDir(src, dest) {
      if (!fs.existsSync(src)) {
        console.warn('[withFloatingTimer] Source not found:', src);
        return;
      }
      if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
      for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
      }
    }

    copyDir(resSrc, resDest);
    copyDir(javaSrc, javaDest);
    console.log('[withFloatingTimer] Copied Kotlin sources and resources.');
    return cfg;
  });
}

// ── Step 2 + 3: AndroidManifest.xml ──────────────────────────────────────────

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

// ── Step 4: MainApplication.kt ───────────────────────────────────────────────

function withFloatingTimerPackage(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;

    const correctImport = 'import com.yourname.workouttracker.floatingtimer.FloatingTimerPackage';
    const packageCall   = 'FloatingTimerPackage()';

    // Strip any wrong import left from previous attempts
    src = src.replace(/import com\.workouttracker\.floatingtimer\.FloatingTimerPackage\r?\n?/g, '');

    // Add correct import after the last existing import line
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

    // Add package to the apply block
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
