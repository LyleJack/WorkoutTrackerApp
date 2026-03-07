import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, ScrollView, StatusBar,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { Ionicons } from '@expo/vector-icons';
import {
  getHistory, getSessionDetails, deleteSession,
  updateSessionNotes, updateSetFull, deleteSet,
  updateCardioLog, deleteCardioLog,
  createSessionOnDate, getWorkouts, addSet, getExercises,
  HistorySession, Set, Workout,
} from '@/src/db';

type Detail = ReturnType<typeof getSessionDetails>;


// ─── Inline Calendar ──────────────────────────────────────────────────────────

const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function InlineCalendar({ year, month, selectedDate, onSelectDate, onChangeMonth }: {
  year: number; month: number; selectedDate: string;
  onSelectDate: (d: string) => void;
  onChangeMonth: (y: number, m: number) => void;
}) {
  const today = new Date();
  today.setHours(0,0,0,0);

  function prevMonth() {
    if (month === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, month - 1);
  }
  function nextMonth() {
    // Don't allow navigating past current month
    if (year === today.getFullYear() && month === today.getMonth()) return;
    if (month === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, month + 1);
  }

  // Build grid
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  const isAtCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <View style={calStyles.container}>
      {/* Month navigation */}
      <View style={calStyles.header}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={18} color="#aaa" />
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={[calStyles.navBtn, isAtCurrentMonth && calStyles.navBtnDisabled]}
        >
          <Ionicons name="chevron-forward" size={18} color={isAtCurrentMonth ? '#222' : '#aaa'} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={calStyles.weekRow}>
        {DAYS.map(d => (
          <Text key={d} style={calStyles.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} style={calStyles.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={calStyles.cell} />;
            const ds   = dateStr(day);
            const cellDate = new Date(year, month, day);
            const isFuture = cellDate > today;
            const isSel    = ds === selectedDate;
            const isToday  = cellDate.getTime() === today.getTime();
            return (
              <TouchableOpacity
                key={col}
                style={[
                  calStyles.cell,
                  isSel    && calStyles.cellSelected,
                  isToday  && !isSel && calStyles.cellToday,
                  isFuture && calStyles.cellDisabled,
                ]}
                onPress={() => { if (!isFuture) onSelectDate(ds); }}
                disabled={isFuture}
                activeOpacity={0.7}
              >
                <Text style={[
                  calStyles.cellText,
                  isSel    && calStyles.cellTextSelected,
                  isToday  && !isSel && calStyles.cellTextToday,
                  isFuture && calStyles.cellTextDisabled,
                ]}>
                  {day}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Selected date label */}
      {selectedDate ? (
        <Text style={calStyles.selectedLabel}>
          Selected: {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>
      ) : null}
    </View>
  );
}

export default function HistoryScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in History.">
      <HistoryScreenInner />
    </ErrorBoundary>
  );
}

function HistoryScreenInner() {
  const router = useRouter();
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
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth()); // 0-indexed

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
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setMissingDate(yesterday.toISOString().slice(0, 10));
    setCalYear(yesterday.getFullYear());
    setCalMonth(yesterday.getMonth());
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
    if (!detail || !selected) return null;

    // If no sets logged at all, show exercises as empty rows + button to go log them
    if (detail.sets.length === 0) {
      const exercises = getExercises(selected.workout_id);
      return (
        <View>
          {exercises.length === 0 ? (
            <Text style={detailStyles.emptyNote}>No exercises in this workout.</Text>
          ) : (
            exercises.map(e => (
              <View key={e.id} style={detailStyles.exBlock}>
                <Text style={detailStyles.exName}>{e.name}</Text>
                <Text style={detailStyles.emptyNote}>No sets logged</Text>
              </View>
            ))
          )}
          <TouchableOpacity
            style={detailStyles.logBtn}
            onPress={() => {
              setSelected(null);
              router.push(`/workout/log/${selected.session_id}?workoutId=${selected.workout_id}`);
            }}
          >
            <Ionicons name="add-circle-outline" size={16} color="#6C63FF" />
            <Text style={detailStyles.logBtnText}>Log sets for this session</Text>
          </TouchableOpacity>
        </View>
      );
    }

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
      <StatusBar barStyle="light-content" />
      <AppHeader
        title="History"
        right={
          <TouchableOpacity style={styles.addMissingBtn} onPress={openAddMissing}>
            <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
            <Text style={styles.addMissingText}>Add missing</Text>
          </TouchableOpacity>
        }
      />
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
                  {!!session.is_cardio ? (
                    <View style={styles.sessionMetaRow}>
                      <Text style={styles.sessionMeta}>
                        {session.cardio_type_name ?? 'Cardio'}
                        {session.cardio_calories ? `  ·  ${session.cardio_calories} kcal` : ''}
                      </Text>
                      {session.cardio_duration ? (
                        <Text style={styles.sessionDuration}>{Math.round(session.cardio_duration)} min</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={styles.sessionMetaRow}>
                      <Text style={styles.sessionMeta}>
                        {session.set_count > 0
                          ? `${session.set_count} sets${session.total_volume > 0 ? `  ·  ${Math.round(session.total_volume / 1000 * 10) / 10}t` : ''}`
                          : 'No sets logged'}
                      </Text>
                      {session.duration_seconds && session.duration_seconds > 0 ? (
                        <Text style={styles.sessionDuration}>
                          {session.duration_seconds >= 3600
                            ? `${Math.floor(session.duration_seconds / 3600)}h ${Math.floor((session.duration_seconds % 3600) / 60)}m`
                            : `${Math.floor(session.duration_seconds / 60)}m`}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#333" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Detail bottom sheet — tap backdrop to close */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={detailStyles.overlay}>
          <TouchableOpacity
            style={detailStyles.backdropHit}
            activeOpacity={1}
            onPress={() => setSelected(null)}
          />
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

            <InlineCalendar
              year={calYear} month={calMonth}
              selectedDate={missingDate}
              onSelectDate={setMissingDate}
              onChangeMonth={(y, m) => { setCalYear(y); setCalMonth(m); }}
            />

            <Text style={[addStyles.label, { marginTop: 14 }]}>Workout</Text>
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

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: '#0a0a0a', borderRadius: 14, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#111',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  monthTitle: { color: '#e8e8ff', fontSize: 15, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 2 },
  dayLabel: {
    flex: 1, textAlign: 'center', color: '#333',
    fontSize: 11, fontWeight: '700', letterSpacing: 0.5, paddingVertical: 4,
  },
  cell: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, margin: 1,
  },
  cellSelected: { backgroundColor: '#6C63FF' },
  cellToday:   { backgroundColor: '#111', borderWidth: 1, borderColor: '#6C63FF' },
  cellDisabled:{ opacity: 0.15 },
  cellText:    { color: '#ccc', fontSize: 13, fontWeight: '500' },
  cellTextSelected: { color: '#fff', fontWeight: '700' },
  cellTextToday:    { color: '#6C63FF', fontWeight: '700' },
  cellTextDisabled: { color: '#333' },
  selectedLabel: {
    textAlign: 'center', color: '#6C63FF', fontSize: 12,
    fontWeight: '600', marginTop: 8,
  },
});

const addStyles = StyleSheet.create({
  label: { color: '#555', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, marginTop: 0 },
  dateInput: {
    backgroundColor: '#000', color: '#e8e8ff', borderRadius: 10,
    padding: 13, fontSize: 16, borderWidth: 1, borderColor: '#1a1a2a', fontVariant: ['tabular-nums'],
  },
  workoutList: { maxHeight: 200, marginBottom: 4 },
  workoutOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 13, borderRadius: 10, marginBottom: 6, backgroundColor: '#000',
    borderWidth: 1, borderColor: '#111',
  },
  workoutOptionSelected: { borderColor: '#6C63FF', backgroundColor: '#110d1f' },
  workoutOptionText: { color: '#888', fontSize: 15 },
  workoutOptionTextSelected: { color: '#e8e8ff', fontWeight: '600' },
  hint: { color: '#333', fontSize: 12, marginVertical: 12, textAlign: 'center', lineHeight: 18 },
  confirmBtn: {
    backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12,
  },
  confirmBtnDisabled: { backgroundColor: '#1a1a2a' },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  addMissingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#1a1a2a',
  },
  addMissingText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  dateHeader: {
    color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    marginBottom: 8, marginTop: 16,
  },
  sessionCard: {
    backgroundColor: '#0a0a0a', borderRadius: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#111', overflow: 'hidden',
  },
  sessionAccent:  { width: 4, alignSelf: 'stretch', backgroundColor: '#6C63FF' },
  cardioAccent:   { backgroundColor: '#22c55e' },
  sessionBody:    { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  sessionName:    { color: '#e8e8ff', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionMeta:    { color: '#444', fontSize: 13, flex: 1 },
  sessionDuration:{ color: '#444', fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: '#e8e8ff', fontSize: 18, fontWeight: '600', marginTop: 8 },
  emptySub: { color: '#444', fontSize: 14 },
});

const detailStyles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  backdropHit: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 34, maxHeight: '88%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#1a1a2a',
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle: { color: '#e8e8ff', fontSize: 20, fontWeight: '700' },
  sheetDate: { color: '#555', fontSize: 14, marginTop: 3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#111',
    alignItems: 'center', justifyContent: 'center',
  },
  content: { maxHeight: 440 },

  // Notes
  notesBlock: {
    backgroundColor: '#000', borderRadius: 12, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#111',
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
    marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#111',
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
    flex: 1, backgroundColor: '#000', color: '#fff', borderRadius: 8,
    padding: 8, fontSize: 14, borderWidth: 1, borderColor: '#1a1a2a', textAlign: 'center',
  },
  editInputFull: {
    backgroundColor: '#000', color: '#fff', borderRadius: 8,
    padding: 10, fontSize: 14, borderWidth: 1, borderColor: '#1a1a2a',
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
    backgroundColor: '#111', padding: 11, borderRadius: 10,
  },
  cancelBtnText: { color: '#888', fontWeight: '600' },

  // Delete
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 14, borderRadius: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#2a1111',
  },
  deleteText: { color: '#ff4444', fontWeight: '600' },
  emptyNote: { color: '#333', fontSize: 13, fontStyle: 'italic', paddingVertical: 6 },
  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 13, borderRadius: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#6C63FF22', backgroundColor: '#0d0d1f',
  },
  logBtnText: { color: '#6C63FF', fontWeight: '600', fontSize: 14 },
});
