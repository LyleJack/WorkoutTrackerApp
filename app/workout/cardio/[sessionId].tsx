import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, FlatList, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  getCardioTypes, addCardioType, addCardioLog, deleteCardioLog,
  getCardioLogsForSession, saveLastSessionTime, getCardioWorkout, CardioType, CardioLogFull,
} from '@/src/db';

const STATUS_BAR_H = Platform.OS === 'android' ? (Constants.statusBarHeight ?? 24) : 44;

export default function CardioLogScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();

  const [cardioTypes, setCardioTypes] = useState<CardioType[]>([]);
  const [logs,        setLogs]        = useState<CardioLogFull[]>([]);

  const [selectedType, setSelectedType] = useState<CardioType | null>(null);
  const [duration,     setDuration]     = useState('');
  const [calories,     setCalories]     = useState('');
  const [distance,     setDistance]     = useState('');
  const [notes,        setNotes]        = useState('');
  const [errors,       setErrors]       = useState<{ type?: string; duration?: string }>({});

  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [addTypeVisible,    setAddTypeVisible]    = useState(false);
  const [newTypeName,       setNewTypeName]       = useState('');

  // Inline delete confirm
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

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
    const newErrors: typeof errors = {};
    if (!selectedType) newErrors.type = 'Choose a type first';
    const dur = parseFloat(duration);
    if (!dur || dur <= 0) newErrors.duration = 'Enter duration (minutes)';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setErrors({});
    addCardioLog(
      Number(sessionId),
      selectedType!.id,
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

  async function finish() {
    const cardio = getCardioWorkout();
    if (cardio) await saveLastSessionTime(Number(sessionId), cardio.id, cardio.name, 1);
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#aaa" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cardio</Text>
        <TouchableOpacity style={styles.finishBtn} onPress={finish}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logged entries */}
        {logs.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Logged</Text>
            {logs.map(log => (
              <View key={log.id} style={styles.logRow}>
                {pendingDelete === log.id ? (
                  // Inline confirm row
                  <View style={styles.deleteConfirmRow}>
                    <Text style={styles.deleteConfirmText}>Delete this entry?</Text>
                    <View style={styles.deleteConfirmBtns}>
                      <TouchableOpacity onPress={() => setPendingDelete(null)} style={styles.deleteCancel}>
                        <Text style={styles.deleteCancelText}>Keep</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { deleteCardioLog(log.id); setPendingDelete(null); load(); }} style={styles.deleteConfirm}>
                        <Ionicons name="trash" size={13} color="#fff" />
                        <Text style={styles.deleteConfirmBtnText}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.logLeft}>
                      <View style={styles.logTypeRow}>
                        <View style={styles.logTypeDot} />
                        <Text style={styles.logType}>{log.cardio_type_name}</Text>
                      </View>
                      <Text style={styles.logDetail}>
                        {log.duration_minutes} min
                        {log.calories ? `  ·  ${log.calories} kcal` : ''}
                        {log.distance_km ? `  ·  ${log.distance_km} km` : ''}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setPendingDelete(log.id)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#3a1111" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Entry form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Entry</Text>

          {/* Type selector */}
          <Text style={styles.label}>Activity Type</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typePicker, errors.type && styles.inputError]}
              onPress={() => { setErrors({}); setTypePickerVisible(true); }}
            >
              <View style={styles.typePickerLeft}>
                <View style={[styles.typeColorDot, { backgroundColor: '#22c55e' }]} />
                <Text style={styles.typePickerText}>{selectedType?.name ?? 'Select type'}</Text>
              </View>
              <Ionicons name="chevron-down" size={16} color="#555" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addTypeBtn} onPress={() => setAddTypeVisible(true)}>
              <Ionicons name="add" size={20} color="#6C63FF" />
            </TouchableOpacity>
          </View>
          {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}

          {/* Duration */}
          <Text style={styles.label}>Duration <Text style={styles.required}>(minutes) *</Text></Text>
          <TextInput
            style={[styles.input, errors.duration && styles.inputError]}
            keyboardType="decimal-pad"
            value={duration}
            onChangeText={v => { setDuration(v); setErrors(prev => ({ ...prev, duration: undefined })); }}
            placeholder="e.g. 30"
            placeholderTextColor="#333"
          />
          {errors.duration && <Text style={styles.errorText}>{errors.duration}</Text>}

          {/* Optional fields row */}
          <View style={styles.optionalRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Calories <Text style={styles.optional}>(opt)</Text></Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={calories}
                onChangeText={setCalories}
                placeholder="kcal"
                placeholderTextColor="#333"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Distance <Text style={styles.optional}>(opt)</Text></Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                value={distance}
                onChangeText={setDistance}
                placeholder="km"
                placeholderTextColor="#333"
              />
            </View>
          </View>

          {/* Notes */}
          <Text style={styles.label}>Notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it feel?"
            placeholderTextColor="#333"
            multiline
          />

          <TouchableOpacity style={styles.logBtn} onPress={handleLog}>
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.logBtnText}>Log Entry</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.bigFinish} onPress={finish}>
          <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
          <Text style={styles.bigFinishText}>Finish Session</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Type picker bottom sheet — tap backdrop to close ── */}
      <Modal visible={typePickerVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={sheet.root}>
          {/* Backdrop — fills the space above the sheet */}
          <TouchableOpacity
            style={sheet.backdrop}
            activeOpacity={1}
            onPress={() => setTypePickerVisible(false)}
          />
          {/* Sheet — sits at the bottom, touches here do NOT dismiss */}
          <View style={sheet.box}>
            <View style={sheet.handle} />
            <Text style={sheet.title}>Activity Type</Text>
            <FlatList
              data={cardioTypes}
              keyExtractor={t => String(t.id)}
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selectedType?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[sheet.item, isSelected && sheet.itemSelected]}
                    onPress={() => { setSelectedType(item); setTypePickerVisible(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[sheet.itemDot, isSelected && sheet.itemDotSelected]} />
                    <Text style={[sheet.itemText, isSelected && sheet.itemTextSelected]}>
                      {item.name}
                    </Text>
                    {isSelected && (
                      <View style={sheet.checkBadge}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity style={sheet.dismissBtn} onPress={() => setTypePickerVisible(false)}>
              <Text style={sheet.dismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add type bottom sheet — tap backdrop to close ── */}
      <Modal visible={addTypeVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={sheet.root}>
          <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={() => { setAddTypeVisible(false); setNewTypeName(''); }} />
          <View style={sheet.box}>
            <View style={sheet.handle} />
            <Text style={sheet.title}>New Activity Type</Text>
            <TextInput
              style={sheet.input}
              value={newTypeName}
              onChangeText={setNewTypeName}
              placeholder="e.g. Jump Rope"
              placeholderTextColor="#444"
              autoFocus
              onSubmitEditing={handleAddType}
              returnKeyType="done"
            />
            <View style={sheet.btnRow}>
              <TouchableOpacity style={sheet.cancelBtn} onPress={() => { setAddTypeVisible(false); setNewTypeName(''); }}>
                <Text style={sheet.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[sheet.addBtn, !newTypeName.trim() && sheet.addBtnOff]}
                onPress={handleAddType}
                disabled={!newTypeName.trim()}
              >
                <Text style={sheet.addText}>Add Type</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const sheet = StyleSheet.create({
  root:     { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  box: {
    backgroundColor: '#09090f',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8,
    borderTopWidth: 1, borderColor: '#1a1a28',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 20,
  },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 20 },
  title:    { color: '#e8e8ff', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, marginBottom: 3,
    backgroundColor: '#0a0a0a',
  },
  itemSelected: { backgroundColor: '#0d1f12', borderWidth: 1, borderColor: '#22c55e33' },
  itemDot:         { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1a1a2a', borderWidth: 1, borderColor: '#333' },
  itemDotSelected: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  itemText:        { flex: 1, color: '#666', fontSize: 16, fontWeight: '500' },
  itemTextSelected:{ color: '#e8e8ff', fontWeight: '700' },
  checkBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center',
  },
  dismissBtn: {
    marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: '#111',
    alignItems: 'center',
  },
  dismissText: { color: '#555', fontWeight: '600', fontSize: 14 },
  input: {
    backgroundColor: '#000', color: '#e8e8ff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#1a1a28', marginBottom: 16,
  },
  btnRow:    { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#111', alignItems: 'center' },
  cancelText:{ color: '#888', fontWeight: '600' },
  addBtn:    { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#22c55e', alignItems: 'center' },
  addBtnOff: { backgroundColor: '#1a2a1a' },
  addText:   { color: '#fff', fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: STATUS_BAR_H + 12, paddingBottom: 14,
    backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#0d0d14',
  },
  back:        { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#e8e8ff', fontSize: 17, fontWeight: '700' },
  finishBtn:   { backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  finishText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  scroll: { padding: 16, paddingBottom: 60 },

  card: {
    backgroundColor: '#0a0a0a', borderRadius: 16, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#111',
  },
  cardTitle: { color: '#22c55e', fontSize: 14, fontWeight: '700', letterSpacing: 0.3, marginBottom: 12 },

  logRow: {
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#111',
  },
  logLeft:    { flex: 1, marginRight: 8 },
  logTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  logTypeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  logType:    { color: '#e8e8ff', fontSize: 14, fontWeight: '600' },
  logDetail:  { color: '#555', fontSize: 13, paddingLeft: 14 },

  // Inline delete confirm
  deleteConfirmRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  deleteConfirmText:  { color: '#888', fontSize: 13 },
  deleteConfirmBtns:  { flexDirection: 'row', gap: 8 },
  deleteCancel:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#111' },
  deleteCancelText:   { color: '#888', fontSize: 13, fontWeight: '600' },
  deleteConfirm:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#dc2626' },
  deleteConfirmBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  label:    { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  optional: { color: '#333', fontWeight: '400', letterSpacing: 0 },
  required: { color: '#888', fontWeight: '400' },

  typeRow: { flexDirection: 'row', gap: 10 },
  typePicker: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#000', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#1a1a2a',
  },
  typePickerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typeColorDot:   { width: 10, height: 10, borderRadius: 5 },
  typePickerText: { color: '#e8e8ff', fontSize: 15, fontWeight: '500' },
  addTypeBtn: {
    width: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#000', borderRadius: 12, borderWidth: 1, borderColor: '#1a1a2a',
  },

  optionalRow: { flexDirection: 'row', gap: 10 },

  input: {
    backgroundColor: '#000', color: '#e8e8ff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: '#1a1a2a',
  },
  inputError: { borderColor: '#ef444466' },
  errorText:  { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 4 },
  notesInput: { minHeight: 70, textAlignVertical: 'top' },

  logBtn: {
    backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12, marginTop: 18,
  },
  logBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  bigFinish: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14,
    backgroundColor: '#0d1f12', borderWidth: 1, borderColor: '#1a3a22',
  },
  bigFinishText: { color: '#22c55e', fontWeight: '700', fontSize: 16 },
});
