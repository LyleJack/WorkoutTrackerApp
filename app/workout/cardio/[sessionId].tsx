import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getCardioTypes, addCardioType, addCardioLog, deleteCardioLog,
  getCardioLogsForSession, saveLastSessionTime, getCardioWorkout, CardioType, CardioLogFull,
} from '@/src/db';

export default function CardioLogScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();

  const [cardioTypes, setCardioTypes] = useState<CardioType[]>([]);
  const [logs, setLogs] = useState<CardioLogFull[]>([]);

  // form state
  const [selectedType, setSelectedType] = useState<CardioType | null>(null);
  const [duration, setDuration] = useState('');
  const [calories, setCalories] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');

  // modals
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [addTypeVisible, setAddTypeVisible] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const load = useCallback(() => {
    const types = getCardioTypes();
    setCardioTypes(types);
    if (!selectedType && types.length > 0) setSelectedType(types[0]);
    setLogs(getCardioLogsForSession(Number(sessionId)));
  }, [sessionId]);

  useFocusEffect(load);

  function handleAddType() {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    addCardioType(trimmed);
    setNewTypeName('');
    setAddTypeVisible(false);
    const types = getCardioTypes();
    setCardioTypes(types);
    setSelectedType(types.find(t => t.name.toLowerCase() === trimmed.toLowerCase()) ?? types[0]);
  }

  function handleLog() {
    if (!selectedType) { Alert.alert('Select a type', 'Please choose a cardio type.'); return; }
    const dur = parseFloat(duration);
    if (!dur || dur <= 0) { Alert.alert('Enter duration', 'Please enter a duration in minutes.'); return; }
    addCardioLog(
      Number(sessionId),
      selectedType.id,
      dur,
      calories ? parseInt(calories) : undefined,
      distance ? parseFloat(distance) : undefined,
      notes || undefined,
    );
    setDuration('');
    setCalories('');
    setDistance('');
    setNotes('');
    load();
  }

  function handleDelete(id: number) {
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCardioLog(id); load(); } },
    ]);
  }

  async function finish() {
    const cardio = getCardioWorkout();
    if (cardio) await saveLastSessionTime(Number(sessionId), cardio.id, cardio.name, 1);
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cardio Session</Text>
        <TouchableOpacity style={styles.finishBtn} onPress={finish}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Logged entries */}
        {logs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Logged</Text>
            {logs.map(log => (
              <View key={log.id} style={styles.logRow}>
                <View style={styles.logLeft}>
                  <Text style={styles.logType}>{log.cardio_type_name}</Text>
                  <Text style={styles.logDetail}>
                    {log.duration_minutes} min
                    {log.calories ? `  ·  ${log.calories} kcal` : ''}
                    {log.distance_km ? `  ·  ${log.distance_km} km` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(log.id)}>
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Entry form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Entry</Text>

          {/* Type selector */}
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity style={styles.typePicker} onPress={() => setTypePickerVisible(true)}>
              <Text style={styles.typePickerText}>{selectedType?.name ?? 'Select type'}</Text>
              <Ionicons name="chevron-down" size={16} color="#888" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTypeBtn} onPress={() => setAddTypeVisible(true)}>
              <Ionicons name="add" size={20} color="#6C63FF" />
            </TouchableOpacity>
          </View>

          {/* Duration - required */}
          <Text style={styles.label}>Duration (minutes) *</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={duration}
            onChangeText={setDuration}
            placeholder="e.g. 30"
            placeholderTextColor="#555"
          />

          {/* Calories - optional */}
          <Text style={styles.label}>Calories <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={calories}
            onChangeText={setCalories}
            placeholder="e.g. 320"
            placeholderTextColor="#555"
          />

          {/* Distance - optional */}
          <Text style={styles.label}>Distance km <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={distance}
            onChangeText={setDistance}
            placeholder="e.g. 5.2"
            placeholderTextColor="#555"
          />

          {/* Notes - optional */}
          <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it feel?"
            placeholderTextColor="#555"
            multiline
          />

          <TouchableOpacity style={styles.logBtn} onPress={handleLog}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.logBtnText}>Log Entry</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.bigFinish} onPress={finish}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.bigFinishText}>Finish Session</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Type picker modal */}
      <Modal visible={typePickerVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Type</Text>
            <FlatList
              data={cardioTypes}
              keyExtractor={t => String(t.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.sheetItem, selectedType?.id === item.id && styles.sheetItemSelected]}
                  onPress={() => { setSelectedType(item); setTypePickerVisible(false); }}
                >
                  <Text style={[styles.sheetItemText, selectedType?.id === item.id && styles.sheetItemTextSelected]}>
                    {item.name}
                  </Text>
                  {selectedType?.id === item.id && <Ionicons name="checkmark" size={18} color="#6C63FF" />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.sheetCancel} onPress={() => setTypePickerVisible(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add type modal */}
      <Modal visible={addTypeVisible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Cardio Type</Text>
            <TextInput
              style={styles.input}
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="e.g. Jump Rope"
              placeholderTextColor="#555"
              autoFocus
              onSubmitEditing={handleAddType}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.sheetCancel} onPress={() => { setAddTypeVisible(false); setNewTypeName(''); }}>
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleAddType}>
                <Text style={styles.confirmText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 56, backgroundColor: '#1a1a2e',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  finishBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#2a2a4a',
  },
  cardTitle: { color: '#6C63FF', fontSize: 15, fontWeight: '700', marginBottom: 14 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#2a2a4a',
  },
  logLeft: { flex: 1 },
  logType: { color: '#fff', fontSize: 15, fontWeight: '600' },
  logDetail: { color: '#888', fontSize: 13, marginTop: 2 },
  label: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  optional: { color: '#555', fontWeight: '400' },
  typeRow: { flexDirection: 'row', gap: 10 },
  typePicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0f0f1a', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  typePickerText: { color: '#fff', fontSize: 15 },
  addTypeBtn: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0f0f1a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a4a',
  },
  input: {
    backgroundColor: '#0f0f1a', color: '#fff', borderRadius: 10,
    padding: 13, fontSize: 15, borderWidth: 1, borderColor: '#2a2a4a',
  },
  notesInput: { height: 80, textAlignVertical: 'top' },
  logBtn: {
    backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 14, borderRadius: 10, marginTop: 16,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  bigFinish: {
    backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14,
  },
  bigFinishText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20,
  },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 14 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 10, marginBottom: 6,
  },
  sheetItemSelected: { backgroundColor: '#2a2a4a' },
  sheetItemText: { color: '#ccc', fontSize: 16 },
  sheetItemTextSelected: { color: '#6C63FF', fontWeight: '700' },
  sheetCancel: {
    flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2a2a4a', alignItems: 'center', marginTop: 8,
  },
  sheetCancelText: { color: '#aaa', fontWeight: '600' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  confirmBtn: {
    flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#6C63FF', alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '600' },
});
