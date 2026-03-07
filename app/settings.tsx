import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, Platform, TextInput,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  requestNotificationPermission,
  scheduleDailyNotification,
  cancelDailyNotification,
  getSavedNotificationTime,
  setupNotificationHandler,
  isNotificationsSupported,
} from '@/src/notifications';
import { exportAllData, importAllData, getStreakOffset, setStreakOffset } from '@/src/db';

export default function SettingsScreen() {
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifTime, setNotifTime] = useState(new Date(new Date().setHours(18, 0, 0, 0)));
  const [showTimePicker, setShowTimePicker] = useState(false);
  const notifSupported = isNotificationsSupported();
  const [streakOffsetText, setStreakOffsetText] = useState('0');
  const [streakSaved, setStreakSaved] = useState(false);

  useEffect(() => {
    setupNotificationHandler();
    getSavedNotificationTime().then(t => {
      if (t) {
        setNotifEnabled(true);
        const d = new Date();
        d.setHours(t.hour, t.minute, 0, 0);
        setNotifTime(d);
      }
    });
    getStreakOffset().then(v => setStreakOffsetText(String(v)));
  }, []);

  async function saveStreakOffset() {
    const n = parseInt(streakOffsetText) || 0;
    await setStreakOffset(Math.max(0, n));
    setStreakSaved(true);
    setTimeout(() => setStreakSaved(false), 2000);
  }

  async function toggleNotifications(value: boolean) {
    if (value) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('Permission denied', 'Enable notifications in your device settings.');
        return;
      }
      await scheduleDailyNotification(notifTime.getHours(), notifTime.getMinutes());
      setNotifEnabled(true);
    } else {
      await cancelDailyNotification();
      setNotifEnabled(false);
    }
  }

  async function handleTimeChange(_: any, date?: Date) {
    setShowTimePicker(Platform.OS === 'ios');
    if (date) {
      setNotifTime(date);
      if (notifEnabled) {
        await scheduleDailyNotification(date.getHours(), date.getMinutes());
      }
    }
  }

  async function handleExport() {
    try {
      const data = exportAllData();
      const json = JSON.stringify(data, null, 2);
      const filename = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Export Workout Data' });
    } catch (e) {
      Alert.alert('Export failed', String(e));
    }
  }

  async function handleImport() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const data = JSON.parse(content);
      Alert.alert(
        'Import Data',
        'This will REPLACE all current data. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace', style: 'destructive', onPress: () => {
              importAllData(data);
              Alert.alert('Imported!', 'Your data has been restored.');
            }
          },
        ]
      );
    } catch (e) {
      Alert.alert('Import failed', "The file could not be read. Make sure it's a valid backup.");
    }
  }

  const timeStr = notifTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Reminder</Text>
        {!notifSupported ? (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowTitle}>Notifications unavailable in Expo Go</Text>
              <Text style={styles.rowSub}>Build with EAS to enable this feature.</Text>
            </View>
            <Text style={styles.lockedIcon}>🔒</Text>
          </View>
        ) : (
          <>
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowTitle}>Enable daily notification</Text>
                <Text style={styles.rowSub}>Reminds you to log your workout</Text>
              </View>
              <Switch
                value={notifEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: '#1a1a2a', true: '#6C63FF' }}
                thumbColor="#fff"
              />
            </View>
            {notifEnabled && (
              <TouchableOpacity style={styles.timeRow} onPress={() => setShowTimePicker(true)}>
                <Text style={styles.rowTitle}>Reminder time</Text>
                <Text style={styles.timeText}>{timeStr}</Text>
              </TouchableOpacity>
            )}
            {showTimePicker && (
              <DateTimePicker
                value={notifTime}
                mode="time"
                is24Hour={true}
                onChange={handleTimeChange}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Data Management</Text>
        <TouchableOpacity style={styles.actionBtn} onPress={handleExport}>
          <Text style={styles.actionIcon}>📤</Text>
          <View>
            <Text style={styles.rowTitle}>Export Data</Text>
            <Text style={styles.rowSub}>Save a JSON backup to share or store</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleImport}>
          <Text style={styles.actionIcon}>📥</Text>
          <View>
            <Text style={styles.rowTitle}>Import Data</Text>
            <Text style={styles.rowSub}>Restore from a previous backup</Text>
          </View>
        </TouchableOpacity>
      </View>


      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Streak</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>Starting streak bonus</Text>
            <Text style={styles.rowSub}>Add days if you were already on a streak before using this app</Text>
          </View>
        </View>
        <View style={styles.streakRow}>
          <TextInput
            style={styles.streakInput}
            value={streakOffsetText}
            onChangeText={setStreakOffsetText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#555"
          />
          <TouchableOpacity style={[styles.streakSaveBtn, streakSaved && styles.streakSavedBtn]} onPress={saveStreakOffset}>
            <Text style={styles.streakSaveBtnText}>{streakSaved ? '✓ Saved' : 'Set'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.appName}>💪 WorkoutTracker</Text>
          <Text style={styles.aboutSub}>Built with React Native + Expo</Text>
          <Text style={styles.aboutSub}>All data stored locally on your device</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  section: {
    backgroundColor: '#0a0a0a', borderRadius: 14,
    borderWidth: 1, borderColor: '#1a1a2a', overflow: 'hidden',
  },
  sectionTitle: {
    color: '#6C63FF', fontSize: 13, fontWeight: '700',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a2a',
  },
  rowLeft: { flex: 1, marginRight: 12 },
  rowTitle: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowSub: { color: '#666', fontSize: 13, marginTop: 2, lineHeight: 18 },
  lockedIcon: { fontSize: 20 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a2a',
  },
  timeText: { color: '#6C63FF', fontSize: 18, fontWeight: '700' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderTopWidth: 1, borderTopColor: '#1a1a2a',
  },
  actionIcon: { fontSize: 24 },
  aboutCard: { padding: 20, alignItems: 'center', gap: 6 },
  appName: { color: '#fff', fontSize: 20, fontWeight: '800' },
  aboutSub: { color: '#666', fontSize: 13 },
  streakRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 14,
  },
  streakInput: {
    width: 80, backgroundColor: '#000', color: '#fff', borderRadius: 10,
    padding: 12, fontSize: 20, fontWeight: '700', textAlign: 'center',
    borderWidth: 1, borderColor: '#1a1a2a',
  },
  streakSaveBtn: {
    backgroundColor: '#6C63FF', paddingHorizontal: 20, paddingVertical: 13,
    borderRadius: 10,
  },
  streakSavedBtn: { backgroundColor: '#22c55e' },
  streakSaveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
