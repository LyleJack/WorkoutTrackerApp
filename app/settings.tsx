import { useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, Platform, TextInput,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useTheme, ThemeUpdateContext, ThemeMode, FONT } from '@/src/theme';
import {
  requestNotificationPermission, scheduleDailyNotification,
  cancelDailyNotification, getSavedNotificationTime,
  setupNotificationHandler, isNotificationsSupported,
} from '@/src/notifications';
import {
  exportAllData, importAllData, getStreakOffset, setStreakOffset,
  deleteAllData, populateDummyData, resetWithDummyData,
  getPref, setPref,
} from '@/src/db';

export default function SettingsScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in Settings.">
      <SettingsScreenInner />
    </ErrorBoundary>
  );
}

function SettingsScreenInner() {
  const t = useTheme();
  const updateTheme = useContext(ThemeUpdateContext);

  const [notifEnabled,    setNotifEnabled]    = useState(false);
  const [notifTime,       setNotifTime]       = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [showTimePicker,  setShowTimePicker]  = useState(false);
  const [streakOffsetTxt, setStreakOffsetTxt] = useState('0');
  const [streakSaved,     setStreakSaved]     = useState(false);
  const [showSummary,     setShowSummary]     = useState(true);
  const [themeMode,       setThemeMode]       = useState<ThemeMode>('dark');
  const [defaultOverlay,  setDefaultOverlay]  = useState(false);
  const notifSupported = isNotificationsSupported();

  useEffect(() => {
    setupNotificationHandler();
    getSavedNotificationTime().then(nt => {
      if (nt) {
        setNotifEnabled(true);
        setNotifTime(prev => { const d = new Date(prev); d.setHours(nt.hour, nt.minute, 0, 0); return d; });
      }
    });
    getStreakOffset().then(v => setStreakOffsetTxt(String(v)));
    setShowSummary(getPref('show_summary') !== 'false');
    setThemeMode((getPref('theme_mode') ?? 'dark') as ThemeMode);
    AsyncStorage.getItem('rest_timer_mode').then(m => setDefaultOverlay(m === 'overlay'));
  }, []);

  async function toggleNotifications(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission denied', 'Enable notifications in your device settings.');
        return;
      }
      await scheduleDailyNotification(notifTime.getHours(), notifTime.getMinutes());
    } else {
      await cancelDailyNotification();
    }
    setNotifEnabled(value);
  }

  async function handleTimeChange(_: unknown, date?: Date) {
    setShowTimePicker(Platform.OS === 'ios');
    if (!date) return;
    setNotifTime(date);
    if (notifEnabled) await scheduleDailyNotification(date.getHours(), date.getMinutes());
  }

  async function saveStreakOffset() {
    const n = Math.max(0, parseInt(streakOffsetTxt) || 0);
    await setStreakOffset(n);
    setStreakSaved(true);
    setTimeout(() => setStreakSaved(false), 2000);
  }

  function toggleSummary(val: boolean) {
    setShowSummary(val);
    setPref('show_summary', val ? 'true' : 'false');
  }

  async function toggleDefaultOverlay(val: boolean) {
    setDefaultOverlay(val);
    await AsyncStorage.setItem('rest_timer_mode', val ? 'overlay' : 'in-app');
  }

  function setThemeModeVal(mode: ThemeMode) {
    setThemeMode(mode);
    updateTheme(mode);
  }

  async function handleExport() {
    try {
      const json     = JSON.stringify(exportAllData(), null, 2);
      const filename = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path     = (FileSystem.documentDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Workout Data' });
    } catch (e) { Alert.alert('Export failed', String(e)); }
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const data    = JSON.parse(content);
      Alert.alert('Import Data', 'This will replace all current data. Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Replace', style: 'destructive', onPress: () => {
            importAllData(data);
            Alert.alert('Imported', 'Your data has been restored.');
          }
        },
      ]);
    } catch { Alert.alert('Import failed', "The file could not be read. Make sure it's a valid backup."); }
  }

  function handleDeleteAll() {
    Alert.alert('⚠️ Delete All Data', 'Permanently removes ALL workouts, exercises, sessions and sets. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: () =>
          Alert.alert('Are you absolutely sure?', 'All workout history will be lost forever.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Yes, delete all', style: 'destructive', onPress: () => {
                deleteAllData();
                Alert.alert('Done', 'All data has been deleted.');
              }
            },
          ])
      },
    ]);
  }

  function handleDemoData() {
    Alert.alert('Demo Data', 'Choose how to load the sample data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add to existing', onPress: () => { populateDummyData(); Alert.alert('Done', 'Demo data added.'); } },
      { text: 'Reset & replace all', style: 'destructive', onPress: () =>
          Alert.alert('Replace all data?', 'Existing history will be permanently deleted.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Yes, reset', style: 'destructive', onPress: () => {
                resetWithDummyData();
                Alert.alert('Done', 'All data replaced with demo data.');
              }
            },
          ])
      },
    ]);
  }

  const timeStr = notifTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <AppHeader title="Settings" theme={t} />
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Appearance */}
        <Section title="Appearance" t={t}>
          <View style={[s.row, { borderTopColor: t.borderMid }]}>
            <View style={s.rowLeft}>
              <Text style={[s.rowTitle, { color: t.textPrimary }]}>Theme</Text>
              <Text style={[s.rowSub, { color: t.textMuted }]}>Applies instantly</Text>
            </View>
          </View>
          <View style={[themeToggle.row, { backgroundColor: t.bg, borderColor: t.border }]}>
            {(['dark', 'light', 'device'] as ThemeMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[themeToggle.btn, themeMode === m && { backgroundColor: t.purple }]}
                onPress={() => setThemeModeVal(m)}
              >
                <Text style={[themeToggle.icon]}>
                  {m === 'dark' ? '🌙' : m === 'light' ? '☀️' : '📱'}
                </Text>
                <Text style={[themeToggle.label, { color: themeMode === m ? '#fff' : t.textMuted }]}>
                  {m === 'dark' ? 'Dark' : m === 'light' ? 'Light' : 'Device'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>

        {/* Workout */}
        <Section title="Workout" t={t}>
          <SwitchRow
            title="Show post-workout summary"
            sub="Review personal bests and exercise comparison after finishing"
            value={showSummary}
            onValueChange={toggleSummary}
            t={t}
          />
          <SwitchRow
            title="Overlay rest timer by default"
            sub="Show a floating bubble instead of the in-app timer when logging sets"
            value={defaultOverlay}
            onValueChange={toggleDefaultOverlay}
            t={t}
          />
        </Section>

        {/* Daily reminder */}
        <Section title="Daily Reminder" t={t}>
          {!notifSupported ? (
            <View style={[s.row, { borderTopColor: t.borderMid }]}>
              <View style={s.rowLeft}>
                <Text style={[s.rowTitle, { color: t.textPrimary }]}>Notifications unavailable in Expo Go</Text>
                <Text style={[s.rowSub, { color: t.textMuted }]}>Build with EAS to enable this feature.</Text>
              </View>
              <Text style={s.lock}>🔒</Text>
            </View>
          ) : (
            <>
              <SwitchRow
                title="Enable daily reminder"
                sub="Only fires if you haven't logged a workout yet that day"
                value={notifEnabled}
                onValueChange={toggleNotifications}
                t={t}
              />
              {notifEnabled && (
                <TouchableOpacity style={[s.row, { borderTopColor: t.borderMid }]} onPress={() => setShowTimePicker(true)}>
                  <Text style={[s.rowTitle, { color: t.textPrimary }]}>Reminder time</Text>
                  <Text style={[s.timeVal, { color: t.purple }]}>{timeStr}</Text>
                </TouchableOpacity>
              )}
              {showTimePicker && (
                <DateTimePicker value={notifTime} mode="time" is24Hour onChange={handleTimeChange} />
              )}
            </>
          )}
        </Section>

        {/* Data management */}
        <Section title="Data Management" t={t}>
          <ActionRow emoji="📤" title="Export Data" sub="Save a JSON backup to share or store" onPress={handleExport} t={t} />
          <ActionRow emoji="📥" title="Import Data" sub="Restore from a previous backup" onPress={handleImport} t={t} />
        </Section>

        {/* Streak bonus */}
        <Section title="Streak" t={t}>
          <View style={[s.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 10, borderTopColor: t.borderMid }]}>
            <View>
              <Text style={[s.rowTitle, { color: t.textPrimary }]}>Starting streak bonus</Text>
              <Text style={[s.rowSub, { color: t.textMuted }]}>Add days if you were already on a streak before using this app</Text>
            </View>
            <View style={s.streakRow}>
              <TextInput
                style={[s.streakInput, { backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
                value={streakOffsetTxt}
                onChangeText={setStreakOffsetTxt}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={t.textMuted}
              />
              <TouchableOpacity
                style={[s.streakBtn, { backgroundColor: streakSaved ? t.green : t.purple }]}
                onPress={saveStreakOffset}
              >
                <Text style={s.streakBtnText}>{streakSaved ? '✓ Saved' : 'Set'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* Developer */}
        <Section title="Developer" t={t}>
          <ActionRow emoji="🧪" title="Demo Data" sub="Load 8 weeks of sample workouts for testing" onPress={handleDemoData} t={t} />
          <TouchableOpacity style={[s.actionRow, { borderTopColor: t.borderMid, backgroundColor: t.isDark ? '#0d0606' : '#fff5f5' }]} onPress={handleDeleteAll}>
            <Text style={s.actionEmoji}>🗑️</Text>
            <View>
              <Text style={[s.rowTitle, { color: t.red }]}>Delete All Data</Text>
              <Text style={[s.rowSub, { color: t.textMuted }]}>Permanently remove all workouts and history</Text>
            </View>
          </TouchableOpacity>
        </Section>

        {/* About */}
        <Section title="About" t={t}>
          <View style={s.aboutCard}>
            <Text style={[s.appName, { color: t.textPrimary }]}>💪 WorkoutTracker</Text>
            <Text style={[s.aboutSub, { color: t.textMuted }]}>Built with React Native + Expo</Text>
            <Text style={[s.aboutSub, { color: t.textMuted }]}>All data stored locally on your device</Text>
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ title, children, t }: { title: string; children: React.ReactNode; t: any }) {
  return (
    <View style={[s.section, { backgroundColor: t.bgCard, borderColor: t.borderMid }]}>
      <Text style={[s.sectionTitle, { color: t.purple }]}>{title}</Text>
      {children}
    </View>
  );
}

function SwitchRow({ title, sub, value, onValueChange, t }: {
  title: string; sub?: string; value: boolean; onValueChange: (v: boolean) => void; t: any;
}) {
  return (
    <View style={[s.row, { borderTopColor: t.borderMid }]}>
      <View style={s.rowLeft}>
        <Text style={[s.rowTitle, { color: t.textPrimary }]}>{title}</Text>
        {sub ? <Text style={[s.rowSub, { color: t.textMuted }]}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: t.borderMid, true: t.purple }}
        thumbColor={t.white}
      />
    </View>
  );
}

function ActionRow({ emoji, title, sub, onPress, t }: {
  emoji: string; title: string; sub: string; onPress: () => void; t: any;
}) {
  return (
    <TouchableOpacity style={[s.actionRow, { borderTopColor: t.borderMid }]} onPress={onPress}>
      <Text style={s.actionEmoji}>{emoji}</Text>
      <View>
        <Text style={[s.rowTitle, { color: t.textPrimary }]}>{title}</Text>
        <Text style={[s.rowSub, { color: t.textMuted }]}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

const themeToggle = StyleSheet.create({
  row:   { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  btn:   { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9, gap: 4 },
  icon:  { fontSize: 18 },
  label: { fontSize: 11, fontWeight: '700' },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { padding: 16, gap: 14, paddingBottom: 50 },

  section:      { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  sectionTitle: {
    fontSize: FONT.base, fontWeight: '700', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1,
  },
  rowLeft:  { flex: 1, marginRight: 12 },
  rowTitle: { fontSize: FONT.lg, fontWeight: '500' },
  rowSub:   { fontSize: FONT.base, marginTop: 2, lineHeight: 18 },
  lock:     { fontSize: 20 },
  timeVal:  { fontSize: 18, fontWeight: '700' },

  actionRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1 },
  actionEmoji: { fontSize: 24 },

  streakRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakInput:  { width: 80, borderRadius: 10, padding: 12, fontSize: 20, fontWeight: '700', textAlign: 'center', borderWidth: 1 },
  streakBtn:    { paddingHorizontal: 20, paddingVertical: 13, borderRadius: 10 },
  streakBtnText:{ color: '#fff', fontWeight: '700', fontSize: FONT.md },

  aboutCard: { padding: 20, alignItems: 'center', gap: 6 },
  appName:   { fontSize: 20, fontWeight: '800' },
  aboutSub:  { fontSize: FONT.base },
});
