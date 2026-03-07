import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getHistory, getSessionDetails, deleteSession,
  updateSessionNotes, updateSetFull, deleteSet,
  updateCardioLog, deleteCardioLog,
  createSessionOnDate, getWorkouts, addSet, getExercises,
  HistorySession, Set, Workout,
} from '@/src/db';

type Detail = ReturnType<typeof getSessionDetails>;

export default function HistoryScreen() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [selected, setSelected] = useState<HistorySession | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editingSetId, setEditingSetId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [notesEditing, setNotesEditing] = useState(false);
  const [editingCardioId, setEditingCardioId] = useState<number | null>(null);
  const [editDuration, setEditDuration] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editDistance, setEditDistance] = useState('');
  const [editCardioNotes, setEditCardioNotes] = useState('');

  // Add missing workout state
  const [addMissingVisible, setAddMissingVisible] = useState(false);
  const [missingDate, setMissingDate] = useState('');
  const [missingWorkouts, setMissingWorkouts] = useState<Workout[]>([]);
  const [missingSelectedWorkout, setMissingSelectedWorkout] = useState<Workout | null>(null);
  const [missingStep, setMissingStep] = useState<'date' | 'workout'>('date');

  const load = useCallback(() => setSessions(getHistory()), []);
  useFocusEffect(load);

  function openDetail(s: HistorySession) {
    setSelected(s);
    const d = getSessionDetails(s.session_id);
    setDetail(d);
    setEditNotes(d.session.notes ?? '');
    setEditingSetId(null);
    setEditingCardioId(null);
    setNotesEditing(false);
  }

  function refreshDetail(sessionId: number) {
    const d = getSessionDetails(sessionId);
    setDetail(d);
  }

  function handleDeleteSession() {
    if (!selected) return;
    Alert.alert('Delete session?', `Remove ${selected.workout_name} on ${selected.date}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          deleteSession(selected.session_id);
          setSelected(null);
          load();
        }
      },
    ]);
  }

  function startEditSet(s: Set & { exercise_name: string }) {
    setEditingSetId(s.id);
    setEditWeight(String(s.weight));
    setEditReps(String(s.reps));
    setEditComment(s.comment ?? '');
    setEditingCardioId(null);
  }

  function saveSet() {
    if (!editingSetId || !selected) return;
    updateSetFull(editingSetId, parseFloat(editWeight) || 0, parseInt(editReps) || 0, editComment);
    setEditingSetId(null);
    refreshDetail(selected.session_id);
  }

  function handleDeleteSet(id: number) {
    if (!selected) return;
    Alert.alert('Delete set?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteSet(id); refreshDetail(selected.session_id); } },
    ]);
  }

  function saveNotes() {
    if (!selected) return;
    updateSessionNotes(selected.session_id, editNotes);
    setNotesEditing(false);
    refreshDetail(selected.session_id);
  }

  function startEditCardio(log: Detail['cardioLogs'][0]) {
    setEditingCardioId(log.id);
    setEditDuration(String(log.duration_minutes));
    setEditCalories(log.calories ? String(log.calories) : '');
    setEditDistance(log.distance_km ? String(log.distance_km) : '');
    setEditCardioNotes(log.notes ?? '');
    setEditingSetId(null);
  }

  function saveCardio() {
    if (!editingCardioId || !selected) return;
    updateCardioLog(
      editingCardioId,
      parseFloat(editDuration) || 0,
      editCalories ? parseInt(editCalories) : null,
      editDistance ? parseFloat(editDistance) : null,
      editCardioNotes || null,
    );
    setEditingCardioId(null);
    refreshDetail(selected.session_id);
  }

  function handleDeleteCardioLog(id: number) {
    if (!selected) return;
    Alert.alert('Delete entry?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCardioLog(id); refreshDetail(selected.session_id); } },
    ]);
  }

  function openAddMissing() {
    const ws = getWorkouts();
    setMissingWorkouts(ws);
    setMissingSelectedWorkout(ws.find(w => !w.is_cardio) ?? null);
    // Default to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setMissingDate(yesterday.toISOString().slice(0, 10));
    setMissingStep('date');
    setAddMissingVisible(true);
  }

  function confirmAddMissing() {
    if (!missingSelectedWorkout || !missingDate) return;
    createSessionOnDate(missingSelectedWorkout.id, missingDate);
    setAddMissingVisible(false);
    load();
  }

  // Group by date
  const grouped: Record<string, HistorySession[]> = {};
  sessions.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  // Group sets by exercise for the detail view
  function renderSets() {
    if (!detail) return null;
    const byEx: Record<string, (Set & { exercise_name: string })[]> = {};
    detail.sets.forEach(s => {
      if (!byEx[s.exercise_name]) byEx[s.exercise_name] = [];
      byEx[s.exercise_name].push(s);
    });
    return Object.entries(byEx).map(([exName, sets]) => (
      <View key={exName} style={detailStyles.exBlock}>
        <Text style={detailStyles.exName}>{exName}</Text>
        {sets.map(s => (
          editingSetId === s.id ? (
            <View key={s.id} style={detailStyles.editRow}>
              <TextInput style={detailStyles.editInput} value={editWeight} onChangeText={setEditWeight}
                keyboardType="decimal-pad" placeholder="kg" placeholderTextColor="#555" />
              <TextInput style={detailStyles.editInput} value={editReps} onChangeText={setEditReps}
                keyboardType="number-pad" placeholder="reps" placeholderTextColor="#555" />
              <TextInput style={[detailStyles.editInput, { flex: 2 }]} value={editComment} onChangeText={setEditComment}
                placeholder="note" placeholderTextColor="#555" />
              <TouchableOpacity onPress={saveSet} style={detailStyles.saveBtn}>
                <Ionicons name="checkmark" size={18} color="#22c55e" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingSetId(null)}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          ) : (
            <View key={s.id} style={detailStyles.setRow}>
              <Text style={detailStyles.setNum}>{s.set_number}</Text>
              <Text style={detailStyles.setVal}>{s.weight}kg × {s.reps}</Text>
              {s.comment ? <Text style={detailStyles.setNote}>{s.comment}</Text> : null}
              <View style={detailStyles.setActions}>
                <TouchableOpacity onPress={() => startEditSet(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil-outline" size={15} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSet(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={15} color="#3a1111" />
                </TouchableOpacity>
              </View>
            </View>
          )
        ))}
      </View>
    ));
  }

  function renderCardioLogs() {
    if (!detail) return null;
    return detail.cardioLogs.map(log => (
      editingCardioId === log.id ? (
        <View key={log.id} style={detailStyles.exBlock}>
          <Text style={detailStyles.exName}>{log.cardio_type_name}</Text>
          <View style={detailStyles.cardioEditGrid}>
            <View style={detailStyles.cardioEditField}>
              <Text style={detailStyles.cardioEditLabel}>Duration (min)</Text>
              <TextInput style={detailStyles.editInputFull} value={editDuration} onChangeText={setEditDuration} keyboardType="decimal-pad" placeholderTextColor="#555" />
            </View>
            <View style={detailStyles.cardioEditField}>
              <Text style={detailStyles.cardioEditLabel}>Calories</Text>
              <TextInput style={detailStyles.editInputFull} value={editCalories} onChangeText={setEditCalories} keyboardType="number-pad" placeholder="optional" placeholderTextColor="#555" />
            </View>
            <View style={detailStyles.cardioEditField}>
              <Text style={detailStyles.cardioEditLabel}>Distance (km)</Text>
              <TextInput style={detailStyles.editInputFull} value={editDistance} onChangeText={setEditDistance} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor="#555" />
            </View>
            <View style={[detailStyles.cardioEditField, { width: '100%' }]}>
              <Text style={detailStyles.cardioEditLabel}>Notes</Text>
              <TextInput style={detailStyles.editInputFull} value={editCardioNotes} onChangeText={setEditCardioNotes} placeholder="optional" placeholderTextColor="#555" />
            </View>
          </View>
          <View style={detailStyles.editBtnRow}>
            <TouchableOpacity style={detailStyles.saveBtnFull} onPress={saveCardio}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={detailStyles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={detailStyles.cancelBtnFull} onPress={() => setEditingCardioId(null)}>
              <Text style={detailStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View key={log.id} style={detailStyles.exBlock}>
          <View style={detailStyles.cardioHeaderRow}>
            <Text style={detailStyles.exName}>{log.cardio_type_name}</Text>
            <View style={detailStyles.setActions}>
              <TouchableOpacity onPress={() => startEditCardio(log)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="pencil-outline" size={15} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteCardioLog(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={15} color="#3a1111" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={detailStyles.setVal}>{log.duration_minutes} min{log.calories ? `  ·  ${log.calories} kcal` : ''}{log.distance_km ? `  ·  ${log.distance_km} km` : ''}</Text>
          {log.notes ? <Text style={detailStyles.setNote}>{log.notes}</Text> : null}
        </View>
      )
    ));
  }

  return (
    <View style={styles.container}>
      {/* Header bar with Add Missing button */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>History</Text>
        <TouchableOpacity style={styles.addMissingBtn} onPress={openAddMissing}>
          <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
          <Text style={styles.addMissingText}>Add missing</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={dates}
        keyExtractor={d => d}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No history yet</Text>
            <Text style={styles.emptySub}>Completed workouts appear here</Text>
          </View>
        }
        renderItem={({ item: date }) => (
          <View>
            <Text style={styles.dateHeader}>{formatDate(date)}</Text>
            {grouped[date].map(session => (
              <TouchableOpacity
                key={session.session_id}
                style={styles.sessionCard}
                onPress={() => openDetail(session)}
                activeOpacity={0.75}
              >
                <View style={[styles.sessionAccent, !!session.is_cardio && styles.cardioAccent]} />
                <View style={styles.sessionBody}>
                  <Text style={styles.sessionName}>{session.workout_name}</Text>
                  <Text style={styles.sessionMeta}>
                    {!!session.is_cardio ? 'Cardio' : `${session.set_count} sets`}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#333" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Detail bottom sheet */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={detailStyles.overlay}>
          <View style={detailStyles.sheet}>
            {/* Handle */}
            <View style={detailStyles.handle} />

            <View style={detailStyles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={detailStyles.sheetTitle}>{selected?.workout_name}</Text>
                <Text style={detailStyles.sheetDate}>{selected ? formatDate(selected.date) : ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={detailStyles.closeBtn}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={detailStyles.content} showsVerticalScrollIndicator={false}>
              {/* Session notes */}
              <View style={detailStyles.notesBlock}>
                {notesEditing ? (
                  <View style={detailStyles.notesEditRow}>
                    <TextInput
                      style={detailStyles.notesInput}
                      value={editNotes}
                      onChangeText={setEditNotes}
                      placeholder="Session notes..."
                      placeholderTextColor="#444"
                      autoFocus
                      multiline
                    />
                    <TouchableOpacity onPress={saveNotes} style={detailStyles.saveBtn}>
                      <Ionicons name="checkmark" size={18} color="#22c55e" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={detailStyles.notesRow} onPress={() => setNotesEditing(true)}>
                    <Text style={detail?.session.notes ? detailStyles.notesText : detailStyles.notesPlaceholder}>
                      {detail?.session.notes || 'Add session notes...'}
                    </Text>
                    <Ionicons name="pencil-outline" size={14} color="#444" />
                  </TouchableOpacity>
                )}
              </View>

              {selected && !!selected.is_cardio ? renderCardioLogs() : renderSets()}
            </ScrollView>

            <TouchableOpacity style={detailStyles.deleteBtn} onPress={handleDeleteSession}>
              <Ionicons name="trash-outline" size={16} color="#ff4444" />
              <Text style={detailStyles.deleteText}>Delete session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Add Missing Workout Modal */}
      <Modal visible={addMissingVisible} transparent animationType="slide">
        <View style={detailStyles.overlay}>
          <View style={detailStyles.sheet}>
            <View style={detailStyles.handle} />
            <View style={detailStyles.sheetHeader}>
              <Text style={detailStyles.sheetTitle}>Add Missing Workout</Text>
              <TouchableOpacity onPress={() => setAddMissingVisible(false)} style={detailStyles.closeBtn}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={addStyles.label}>Date</Text>
            <TextInput
              style={addStyles.dateInput}
              value={missingDate}
              onChangeText={setMissingDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#444"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={[addStyles.label, { marginTop: 16 }]}>Workout</Text>
            <ScrollView style={addStyles.workoutList} showsVerticalScrollIndicator={false}>
              {missingWorkouts.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[addStyles.workoutOption, missingSelectedWorkout?.id === w.id && addStyles.workoutOptionSelected]}
                  onPress={() => setMissingSelectedWorkout(w)}
                >
                  <Text style={[addStyles.workoutOptionText, missingSelectedWorkout?.id === w.id && addStyles.workoutOptionTextSelected]}>
                    {!!w.is_cardio ? '🏃 ' : '🏋️ '}{w.name}
                  </Text>
                  {missingSelectedWorkout?.id === w.id && <Ionicons name="checkmark" size={16} color="#6C63FF" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={addStyles.hint}>
              This creates an empty session for that date. Open it from History to log sets.
            </Text>

            <TouchableOpacity
              style={[addStyles.confirmBtn, (!missingDate || !missingSelectedWorkout) && addStyles.confirmBtnDisabled]}
              onPress={confirmAddMissing}
              disabled={!missingDate || !missingSelectedWorkout}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={addStyles.confirmBtnText}>Add Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const addStyles = StyleSheet.create({
  label: { color: '#555', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  dateInput: {
    backgroundColor: '#0a0a12', color: '#e8e8ff', borderRadius: 10,
    padding: 13, fontSize: 16, borderWidth: 1, borderColor: '#2a2a4a', fontVariant: ['tabular-nums'],
  },
  workoutList: { maxHeight: 200, marginBottom: 4 },
  workoutOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 13, borderRadius: 10, marginBottom: 6, backgroundColor: '#0a0a12',
    borderWidth: 1, borderColor: '#1e1e32',
  },
  workoutOptionSelected: { borderColor: '#6C63FF', backgroundColor: '#110d1f' },
  workoutOptionText: { color: '#888', fontSize: 15 },
  workoutOptionTextSelected: { color: '#e8e8ff', fontWeight: '600' },
  hint: { color: '#333', fontSize: 12, marginVertical: 12, textAlign: 'center', lineHeight: 18 },
  confirmBtn: {
    backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12,
  },
  confirmBtnDisabled: { backgroundColor: '#2a2a4a' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a12' },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1e1e32',
  },
  topBarTitle: { color: '#e8e8ff', fontSize: 18, fontWeight: '700' },
  addMissingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  addMissingText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  dateHeader: {
    color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 8, marginTop: 16,
  },
  sessionCard: {
    backgroundColor: '#13131f', borderRadius: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#1e1e32', overflow: 'hidden',
  },
  sessionAccent: { width: 4, alignSelf: 'stretch', backgroundColor: '#6C63FF' },
  cardioAccent: { backgroundColor: '#22c55e' },
  sessionBody: { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  sessionName: { color: '#e8e8ff', fontSize: 15, fontWeight: '600' },
  sessionMeta: { color: '#444', fontSize: 13, marginTop: 3 },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: '#e8e8ff', fontSize: 18, fontWeight: '600', marginTop: 8 },
  emptySub: { color: '#444', fontSize: 14 },
});

const detailStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#13131f', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 34, maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#2a2a4a',
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { color: '#e8e8ff', fontSize: 20, fontWeight: '700' },
  sheetDate: { color: '#555', fontSize: 14, marginTop: 3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1e1e32',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { maxHeight: 440 },

  // Notes
  notesBlock: {
    backgroundColor: '#0a0a12', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#1e1e32',
  },
  notesRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notesText: { flex: 1, color: '#888', fontSize: 14 },
  notesPlaceholder: { flex: 1, color: '#333', fontSize: 14, fontStyle: 'italic' },
  notesEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  notesInput: {
    flex: 1, color: '#e8e8ff', fontSize: 14, borderBottomWidth: 1, borderBottomColor: '#6C63FF', paddingVertical: 4,
  },

  // Exercises / sets
  exBlock: {
    marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1e1e32',
  },
  exName: { color: '#6C63FF', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  setNum: { color: '#444', fontSize: 13, width: 20, textAlign: 'center' },
  setVal: { color: '#ccc', fontSize: 14, flex: 1 },
  setNote: { color: '#555', fontSize: 13, fontStyle: 'italic' },
  setActions: { flexDirection: 'row', gap: 12 },

  // Edit row
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  editInput: {
    flex: 1, backgroundColor: '#0a0a12', color: '#fff', borderRadius: 8,
    padding: 8, fontSize: 14, borderWidth: 1, borderColor: '#2a2a4a', textAlign: 'center',
  },
  editInputFull: {
    backgroundColor: '#0a0a12', color: '#fff', borderRadius: 8,
    padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#2a2a4a',
  },
  saveBtn: { padding: 6 },

  // Cardio edit
  cardioHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardioEditGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  cardioEditField: { width: '47%' },
  cardioEditLabel: { color: '#555', fontSize: 11, marginBottom: 4 },
  editBtnRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtnFull: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#22c55e', padding: 11, borderRadius: 10,
  },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtnFull: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1e1e32', padding: 11, borderRadius: 10,
  },
  cancelBtnText: { color: '#888', fontWeight: '600' },

  // Delete
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, borderRadius: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#2a1111',
  },
  deleteText: { color: '#ff4444', fontWeight: '600' },
});
