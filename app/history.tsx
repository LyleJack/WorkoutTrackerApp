import { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Modal, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FONT } from '@/src/theme';
import { formatDuration, formatSessionDate } from '@/src/utils';
import {
  getHistory, getSessionDetails, deleteSession,
  updateSessionNotes, updateSetFull, deleteSet,
  updateCardioLog, deleteCardioLog,
  createSessionOnDate, getWorkouts, addSet, getExercises,
  combineSessions,
  HistorySession, Set as WorkoutSet, Workout,
} from '@/src/db';

type Detail = ReturnType<typeof getSessionDetails>;

// ─── Inline Calendar ──────────────────────────────────────────────────────────

const CAL_DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const CAL_MONTHS = ['January','February','March','April','May','June',
                    'July','August','September','October','November','December'];

// Fixed cell size so every month is the same height regardless of row count
const CELL_SIZE = 38;

function InlineCalendar({ year, month, selectedDate, sessionDates, onSelectDate, onChangeMonth }: {
  year: number; month: number; selectedDate: string;
  sessionDates?: Set<string>;
  onSelectDate: (d: string) => void;
  onChangeMonth: (y: number, m: number) => void;
}) {
  const t = useTheme();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  function prevMonth() {
    if (month === 0) onChangeMonth(year - 1, 11);
    else onChangeMonth(year, month - 1);
  }
  function nextMonth() {
    if (year === today.getFullYear() && month === today.getMonth()) return;
    if (month === 11) onChangeMonth(year + 1, 0);
    else onChangeMonth(year, month + 1);
  }

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Always 6 rows so height never changes
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length < 42) cells.push(null);

  const isAtCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  function dateStr(day: number) {
    return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  return (
    <View style={[cal.container, { backgroundColor: t.bgCard, borderColor: t.border }]}>
      <View style={cal.header}>
        <TouchableOpacity onPress={prevMonth} style={[cal.navBtn, { backgroundColor: t.bgInput }]}>
          <Ionicons name="chevron-back" size={18} color={t.textSecondary} />
        </TouchableOpacity>
        <Text style={[cal.monthTitle, { color: t.textPrimary }]}>{CAL_MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth}
          style={[cal.navBtn, { backgroundColor: t.bgInput }, isAtCurrentMonth && { opacity: 0.25 }]}>
          <Ionicons name="chevron-forward" size={18} color={t.textSecondary} />
        </TouchableOpacity>
      </View>
      <View style={cal.weekRow}>
        {CAL_DAYS.map(d => (
          <View key={d} style={cal.cellWrap}>
            <Text style={[cal.dayLabel, { color: t.textFaint }]}>{d}</Text>
          </View>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, row) => (
        <View key={row} style={cal.weekRow}>
          {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
            if (!day) return <View key={col} style={cal.cellWrap} />;
            const ds       = dateStr(day);
            const cellDate = new Date(year, month, day);
            const isFuture = cellDate > today;
            const isSel    = ds === selectedDate;
            const isToday  = cellDate.getTime() === today.getTime();
            const hasSess  = sessionDates?.has(ds) ?? false;
            return (
              <TouchableOpacity key={col}
                style={[
                  cal.cellWrap,
                  isSel   && { backgroundColor: t.purple, borderRadius: 8 },
                  isToday && !isSel && { backgroundColor: t.bgInput, borderRadius: 8, borderWidth: 1, borderColor: t.purple },
                  isFuture && { opacity: 0.15 },
                ]}
                onPress={() => { if (!isFuture) onSelectDate(ds); }}
                disabled={isFuture} activeOpacity={0.7}>
                <Text style={[cal.cellText, { color: t.textSecondary },
                  isSel   && { color: '#fff', fontWeight: '700' },
                  isToday && !isSel && { color: t.purple, fontWeight: '700' },
                ]}>
                  {day}
                </Text>
                {hasSess && !isSel && (
                  <View style={[cal.dot, { backgroundColor: t.purple }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
      {selectedDate ? (
        <Text style={[cal.selectedLabel, { color: t.purple }]}>
          {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long',
          })}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────

function ConfirmModal({ visible, title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  visible: boolean; title: string; message?: string;
  confirmLabel?: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={cm.overlay}>
        <TouchableOpacity style={cm.backdrop} activeOpacity={1} onPress={onCancel} />
        <View style={[cm.box, { backgroundColor: t.bgSheet, borderColor: t.borderSheet }]}>
          <Text style={[cm.title,   { color: t.textPrimary }]}>{title}</Text>
          {message ? <Text style={[cm.message, { color: t.textMuted }]}>{message}</Text> : null}
          <View style={cm.row}>
            <TouchableOpacity style={[cm.cancel, { backgroundColor: t.bgInput, borderColor: t.borderMid }]} onPress={onCancel}>
              <Text style={[cm.cancelText, { color: t.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.confirm, { backgroundColor: confirmColor ?? t.red }]} onPress={onConfirm}>
              <Text style={cm.confirmText}>{confirmLabel ?? 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in History.">
      <HistoryScreenInner />
    </ErrorBoundary>
  );
}

function HistoryScreenInner() {
  const router = useRouter();
  const t      = useTheme();
  const listRef = useRef<FlatList>(null);

  const [sessions,  setSessions]  = useState<HistorySession[]>([]);
  const [selected,  setSelected]  = useState<HistorySession | null>(null);
  const [detail,    setDetail]    = useState<Detail | null>(null);

  // Editing state
  const [editingSetId,    setEditingSetId]    = useState<number | null>(null);
  const [editWeight,      setEditWeight]      = useState('');
  const [editReps,        setEditReps]        = useState('');
  const [editComment,     setEditComment]     = useState('');
  const [editNotes,       setEditNotes]       = useState('');
  const [notesEditing,    setNotesEditing]    = useState(false);
  const [editingCardioId, setEditingCardioId] = useState<number | null>(null);
  const [editDuration,    setEditDuration]    = useState('');
  const [editCalories,    setEditCalories]    = useState('');
  const [editDistance,    setEditDistance]    = useState('');
  const [editCardioNotes, setEditCardioNotes] = useState('');

  // Confirm modal
  const [confirmState, setConfirmState] = useState<{
    visible: boolean; title: string; message?: string;
    confirmLabel?: string; confirmColor?: string;
    onConfirm: () => void;
  }>({ visible: false, title: '', onConfirm: () => {} });

  // Calendar jump
  const [calJumpVisible, setCalJumpVisible] = useState(false);
  const [jumpYear,  setJumpYear]  = useState(new Date().getFullYear());
  const [jumpMonth, setJumpMonth] = useState(new Date().getMonth());
  const [jumpDate,  setJumpDate]  = useState('');

  // Add missing session
  const [addMissingVisible,      setAddMissingVisible]      = useState(false);
  const [missingDate,            setMissingDate]            = useState('');
  const [missingWorkouts,        setMissingWorkouts]        = useState<Workout[]>([]);
  const [missingSelectedWorkout, setMissingSelectedWorkout] = useState<Workout | null>(null);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const load = useCallback(() => setSessions(getHistory()), []);
  useFocusEffect(load);

  function confirm(opts: typeof confirmState) { setConfirmState(opts); }
  function dismissConfirm() { setConfirmState(s => ({ ...s, visible: false })); }

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
    setDetail(getSessionDetails(sessionId));
  }

  function handleDeleteSession() {
    if (!selected) return;
    confirm({
      visible: true,
      title: 'Delete session?',
      message: `Remove ${selected.workout_name} on ${selected.date}?`,
      confirmLabel: 'Delete', confirmColor: t.red,
      onConfirm: () => {
        deleteSession(selected.session_id);
        setSelected(null);
        dismissConfirm();
        load();
      },
    });
  }

  function handleCombineSession() {
    if (!selected) return;
    const idx  = sessions.findIndex(s => s.session_id === selected.session_id);
    const prev = idx > 0 ? sessions[idx - 1] : null;
    const next = idx < sessions.length - 1 ? sessions[idx + 1] : null;
    const candidates: HistorySession[] = [];
    if (prev && prev.workout_id === selected.workout_id) candidates.push(prev);
    if (next && next.workout_id === selected.workout_id) candidates.push(next);
    if (candidates.length === 0) {
      confirm({
        visible: true, title: 'No matching sessions',
        message: 'Combine requires two consecutive sessions of the same workout type.',
        confirmLabel: 'OK', confirmColor: t.purple, onConfirm: dismissConfirm,
      });
      return;
    }
    const target = candidates[0];
    confirm({
      visible: true, title: 'Combine sessions?',
      message: `Move all sets from this session into the adjacent "${target.workout_name}" session? Durations will be summed.`,
      confirmLabel: 'Combine', confirmColor: t.orange,
      onConfirm: () => {
        combineSessions(target.session_id, selected.session_id);
        setSelected(null);
        dismissConfirm();
        load();
      },
    });
  }

  function startEditSet(s: WorkoutSet & { exercise_name: string }) {
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
    confirm({
      visible: true, title: 'Delete set?',
      confirmLabel: 'Delete', confirmColor: t.red,
      onConfirm: () => { deleteSet(id); dismissConfirm(); refreshDetail(selected.session_id); },
    });
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
    confirm({
      visible: true, title: 'Delete entry?',
      confirmLabel: 'Delete', confirmColor: t.red,
      onConfirm: () => { deleteCardioLog(id); dismissConfirm(); refreshDetail(selected.session_id); },
    });
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
    setAddMissingVisible(true);
  }

  function confirmAddMissing() {
    if (!missingSelectedWorkout || !missingDate) return;
    createSessionOnDate(missingSelectedWorkout.id, missingDate);
    setAddMissingVisible(false);
    load();
  }

  function openCalJump() {
    setJumpDate('');
    setJumpYear(new Date().getFullYear());
    setJumpMonth(new Date().getMonth());
    setCalJumpVisible(true);
  }

  function doJump() {
    if (!jumpDate) return;
    setCalJumpVisible(false);
    // Find the index in dates array and scroll to it
    const idx = dates.indexOf(jumpDate);
    if (idx >= 0) {
      setTimeout(() => listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0 }), 100);
    } else {
      // Date has no sessions — find the closest date before it
      const closest = dates.find(d => d <= jumpDate);
      if (closest) {
        const ci = dates.indexOf(closest);
        setTimeout(() => listRef.current?.scrollToIndex({ index: ci, animated: true, viewPosition: 0 }), 100);
      }
    }
  }

  // Group by date
  const grouped: Record<string, HistorySession[]> = {};
  sessions.forEach(s => {
    if (!grouped[s.date]) grouped[s.date] = [];
    grouped[s.date].push(s);
  });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  const sessionDateSet = new Set(dates);

  // ── Set renderer ────────────────────────────────────────────────────────────

  function renderSets() {
    if (!detail || !selected) return null;
    if (detail.sets.length === 0) {
      const exercises = getExercises(selected.workout_id);
      return (
        <View>
          {exercises.length === 0 ? (
            <Text style={[ds.emptyNote, { color: t.textFaint }]}>No exercises in this workout.</Text>
          ) : (
            exercises.map(e => (
              <View key={e.id} style={[ds.exBlock, { borderBottomColor: t.border }]}>
                <Text style={[ds.exName, { color: t.purple }]}>{e.name}</Text>
                <Text style={[ds.emptyNote, { color: t.textFaint }]}>No sets logged</Text>
              </View>
            ))
          )}
          <TouchableOpacity style={[ds.logBtn, { borderColor: t.purpleBg, backgroundColor: t.bgCard }]}
            onPress={() => { setSelected(null); router.push(`/workout/log/${selected.session_id}?workoutId=${selected.workout_id}`); }}>
            <Ionicons name="add-circle-outline" size={16} color={t.purple} />
            <Text style={[ds.logBtnText, { color: t.purple }]}>Log sets for this session</Text>
          </TouchableOpacity>
        </View>
      );
    }
    const byEx: Record<string, (WorkoutSet & { exercise_name: string })[]> = {};
    detail.sets.forEach(s => {
      if (!byEx[s.exercise_name]) byEx[s.exercise_name] = [];
      byEx[s.exercise_name].push(s);
    });
    return Object.entries(byEx).map(([exName, sets]) => (
      <View key={exName} style={[ds.exBlock, { borderBottomColor: t.border }]}>
        <Text style={[ds.exName, { color: t.purple }]}>{exName}</Text>
        {sets.map(s => {
          const durSecs  = (s as any).duration_seconds as number | undefined;
          const durLabel = durSecs && durSecs > 0
            ? (durSecs >= 60 ? `${Math.floor(durSecs / 60)}m${durSecs % 60 > 0 ? ` ${durSecs % 60}s` : ''}` : `${durSecs}s`)
            : null;
          return editingSetId === s.id ? (
            <View key={s.id} style={ds.editRow}>
              <TextInput style={[ds.editInput, { backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
                value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad" placeholder="kg" placeholderTextColor={t.textFaint} />
              <TextInput style={[ds.editInput, { backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
                value={editReps} onChangeText={setEditReps} keyboardType="number-pad" placeholder="reps" placeholderTextColor={t.textFaint} />
              <TextInput style={[ds.editInput, { flex: 2, backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
                value={editComment} onChangeText={setEditComment} placeholder="note" placeholderTextColor={t.textFaint} />
              <TouchableOpacity onPress={saveSet} style={ds.iconBtn}><Ionicons name="checkmark" size={18} color={t.green} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setEditingSetId(null)} style={ds.iconBtn}><Ionicons name="close" size={18} color={t.textMuted} /></TouchableOpacity>
            </View>
          ) : (
            <View key={s.id} style={ds.setRow}>
              <Text style={[ds.setNum, { color: t.textFaint }]}>{s.set_number}</Text>
              <Text style={[ds.setVal, { color: t.textSecondary }]}>
                {s.weight > 0 ? `${s.weight} kg` : 'BW'}
                {durLabel ? `  ·  ${durLabel}` : `  ×  ${s.reps}`}
              </Text>
              {s.comment ? <Text style={[ds.setNote, { color: t.textMuted }]}>{s.comment}</Text> : null}
              <View style={ds.setActions}>
                <TouchableOpacity onPress={() => startEditSet(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="pencil-outline" size={15} color={t.textFaint} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteSet(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={15} color={t.redDim} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>
    ));
  }

  function renderCardioLogs() {
    if (!detail) return null;
    return detail.cardioLogs.map(log => (
      editingCardioId === log.id ? (
        <View key={log.id} style={[ds.exBlock, { borderBottomColor: t.border }]}>
          <Text style={[ds.exName, { color: t.green }]}>{log.cardio_type_name}</Text>
          <View style={ds.cardioGrid}>
            {[
              { label: 'Duration (min)', val: editDuration, set: setEditDuration, kbType: 'decimal-pad' as any },
              { label: 'Calories',       val: editCalories, set: setEditCalories, kbType: 'number-pad'  as any, ph: 'optional' },
              { label: 'Distance (km)',  val: editDistance, set: setEditDistance, kbType: 'decimal-pad' as any, ph: 'optional' },
            ].map(({ label, val, set, kbType, ph }) => (
              <View key={label} style={ds.cardioField}>
                <Text style={[ds.cardioFieldLabel, { color: t.textFaint }]}>{label}</Text>
                <TextInput style={[ds.editInputFull, { backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
                  value={val} onChangeText={set} keyboardType={kbType}
                  placeholder={ph ?? ''} placeholderTextColor={t.textFaint} />
              </View>
            ))}
            <View style={[ds.cardioField, { width: '100%' }]}>
              <Text style={[ds.cardioFieldLabel, { color: t.textFaint }]}>Notes</Text>
              <TextInput style={[ds.editInputFull, { backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
                value={editCardioNotes} onChangeText={setEditCardioNotes}
                placeholder="optional" placeholderTextColor={t.textFaint} />
            </View>
          </View>
          <View style={ds.editBtnRow}>
            <TouchableOpacity style={[ds.saveBtnFull, { backgroundColor: t.green }]} onPress={saveCardio}>
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={ds.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[ds.cancelBtnFull, { backgroundColor: t.bgInput }]} onPress={() => setEditingCardioId(null)}>
              <Text style={[ds.cancelBtnText, { color: t.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View key={log.id} style={[ds.exBlock, { borderBottomColor: t.border }]}>
          <View style={ds.cardioHeaderRow}>
            <Text style={[ds.exName, { color: t.green }]}>{log.cardio_type_name}</Text>
            <View style={ds.setActions}>
              <TouchableOpacity onPress={() => startEditCardio(log)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="pencil-outline" size={15} color={t.textFaint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteCardioLog(log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={15} color={t.redDim} />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[ds.setVal, { color: t.textSecondary }]}>
            {log.duration_minutes} min
            {log.calories    ? `  ·  ${log.calories} kcal` : ''}
            {log.distance_km ? `  ·  ${log.distance_km} km` : ''}
          </Text>
          {log.notes ? <Text style={[ds.setNote, { color: t.textMuted }]}>{log.notes}</Text> : null}
        </View>
      )
    ));
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <AppHeader
        title="History"
        right={
          <TouchableOpacity onPress={openCalJump} style={[s.calJumpBtn, { backgroundColor: t.bgCard, borderColor: t.borderMid }]}>
            <Ionicons name="calendar-outline" size={16} color={t.purple} />
          </TouchableOpacity>
        }
      />

      <ConfirmModal
        visible={confirmState.visible}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        confirmColor={confirmState.confirmColor}
        onConfirm={confirmState.onConfirm}
        onCancel={dismissConfirm}
      />

      <FlatList
        ref={listRef}
        data={dates}
        keyExtractor={d => d}
        contentContainerStyle={s.list}
        onScrollToIndexFailed={({ index }) => {
          // Fallback for when layout hasn't computed yet
          setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 300);
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyEmoji}>📋</Text>
            <Text style={[s.emptyText, { color: t.textPrimary }]}>No history yet</Text>
            <Text style={[s.emptySub, { color: t.textFaint }]}>Completed workouts appear here</Text>
          </View>
        }
        renderItem={({ item: date }) => (
          <View>
            <Text style={[s.dateHeader, { color: t.textFaint }]}>{formatSessionDate(date)}</Text>
            {grouped[date].map(session => (
              <TouchableOpacity key={session.session_id}
                style={[s.sessionCard, { backgroundColor: t.bgCard, borderColor: t.border }]}
                onPress={() => openDetail(session)} activeOpacity={0.75}>
                <View style={[s.sessionAccent, { backgroundColor: session.is_cardio ? t.green : t.purple }]} />
                <View style={s.sessionBody}>
                  <Text style={[s.sessionName, { color: t.textPrimary }]}>{session.workout_name}</Text>
                  {!!session.is_cardio ? (
                    <View style={s.sessionMetaRow}>
                      <Text style={[s.sessionMeta, { color: t.textFaint }]}>
                        {session.cardio_type_name ?? 'Cardio'}
                        {session.cardio_calories ? `  ·  ${session.cardio_calories} kcal` : ''}
                      </Text>
                      {session.cardio_duration ? (
                        <Text style={[s.sessionDuration, { color: t.textFaint }]}>{Math.round(session.cardio_duration)} min</Text>
                      ) : null}
                    </View>
                  ) : (
                    <View style={s.sessionMetaRow}>
                      <Text style={[s.sessionMeta, { color: t.textFaint }]}>
                        {session.set_count > 0
                          ? `${session.set_count} sets${session.total_volume > 0 ? `  ·  ${Math.round(session.total_volume / 1000 * 10) / 10}t` : ''}`
                          : 'No sets logged'}
                      </Text>
                      {session.duration_seconds && session.duration_seconds > 0 ? (
                        <Text style={[s.sessionDuration, { color: t.textFaint }]}>{formatDuration(session.duration_seconds)}</Text>
                      ) : null}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Calendar jump modal */}
      <Modal visible={calJumpVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={ds.overlay}>
          <TouchableOpacity style={ds.backdrop} activeOpacity={1} onPress={() => setCalJumpVisible(false)} />
          <View style={[ds.sheet, { backgroundColor: t.bgSheet }]}>
            <View style={[ds.handle, { backgroundColor: t.borderMid }]} />
            <View style={ds.sheetHeader}>
              <Text style={[ds.sheetTitle, { color: t.textPrimary }]}>Jump to Date</Text>
              <TouchableOpacity onPress={() => setCalJumpVisible(false)} style={[ds.closeBtn, { backgroundColor: t.bgInput }]}>
                <Ionicons name="close" size={20} color={t.textMuted} />
              </TouchableOpacity>
            </View>
            <InlineCalendar
              year={jumpYear} month={jumpMonth}
              selectedDate={jumpDate}
              sessionDates={sessionDateSet}
              onSelectDate={setJumpDate}
              onChangeMonth={(y, m) => { setJumpYear(y); setJumpMonth(m); }}
            />
            <TouchableOpacity
              style={[add.confirmBtn, { backgroundColor: jumpDate ? t.purple : t.border, marginTop: 12 }]}
              onPress={doJump} disabled={!jumpDate}>
              <Ionicons name="arrow-down-circle-outline" size={18} color="#fff" />
              <Text style={add.confirmBtnText}>Jump to {jumpDate || '—'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Add missing session FAB */}
      <TouchableOpacity style={[s.fab, { backgroundColor: t.purple }]} onPress={openAddMissing} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Session detail sheet */}
      <Modal visible={!!selected} transparent animationType="slide" statusBarTranslucent>
        <View style={ds.overlay}>
          <TouchableOpacity style={ds.backdrop} activeOpacity={1} onPress={() => setSelected(null)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={ds.sheetKAV}>
            <View style={[ds.sheet, { backgroundColor: t.bgSheet }]}>
              <View style={[ds.handle, { backgroundColor: t.borderMid }]} />
              <View style={ds.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[ds.sheetTitle, { color: t.textPrimary }]}>{selected?.workout_name}</Text>
                  <Text style={[ds.sheetDate, { color: t.textMuted }]}>{selected ? formatSessionDate(selected.date) : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => setSelected(null)} style={[ds.closeBtn, { backgroundColor: t.bgInput }]}>
                  <Ionicons name="close" size={20} color={t.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView style={ds.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={[ds.notesBlock, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                  {notesEditing ? (
                    <View style={ds.notesEditRow}>
                      <TextInput style={[ds.notesInput, { color: t.textPrimary, borderBottomColor: t.purple }]}
                        value={editNotes} onChangeText={setEditNotes}
                        placeholder="Session notes..." placeholderTextColor={t.textFaint} autoFocus multiline />
                      <TouchableOpacity onPress={saveNotes} style={ds.iconBtn}>
                        <Ionicons name="checkmark" size={18} color={t.green} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={ds.notesRow} onPress={() => setNotesEditing(true)}>
                      <Text style={detail?.session.notes
                        ? [ds.notesText, { color: t.textMuted }]
                        : [ds.notesText, { color: t.textDead, fontStyle: 'italic' }]}>
                        {detail?.session.notes || 'Add session notes...'}
                      </Text>
                      <Ionicons name="pencil-outline" size={14} color={t.textFaint} />
                    </TouchableOpacity>
                  )}
                </View>
                {selected && !!selected.is_cardio ? renderCardioLogs() : renderSets()}
              </ScrollView>
              <View style={[ds.bottomActions, { borderTopColor: t.border }]}>
                <TouchableOpacity style={ds.combineBtn} onPress={handleCombineSession}>
                  <Ionicons name="git-merge-outline" size={16} color={t.orange} />
                  <Text style={[ds.combineText, { color: t.orange }]}>Combine</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ds.deleteBtn} onPress={handleDeleteSession}>
                  <Ionicons name="trash-outline" size={16} color={t.red} />
                  <Text style={[ds.deleteText, { color: t.red }]}>Delete session</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add missing session modal */}
      <Modal visible={addMissingVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={ds.overlay}>
          <TouchableOpacity style={ds.backdrop} activeOpacity={1} onPress={() => setAddMissingVisible(false)} />
          <View style={[ds.sheet, { backgroundColor: t.bgSheet }]}>
            <View style={[ds.handle, { backgroundColor: t.borderMid }]} />
            <View style={ds.sheetHeader}>
              <Text style={[ds.sheetTitle, { color: t.textPrimary }]}>Add Missing Workout</Text>
              <TouchableOpacity onPress={() => setAddMissingVisible(false)} style={[ds.closeBtn, { backgroundColor: t.bgInput }]}>
                <Ionicons name="close" size={20} color={t.textMuted} />
              </TouchableOpacity>
            </View>
            <InlineCalendar
              year={calYear} month={calMonth}
              selectedDate={missingDate}
              onSelectDate={setMissingDate}
              onChangeMonth={(y, m) => { setCalYear(y); setCalMonth(m); }}
            />
            <Text style={[add.label, { color: t.textFaint, marginTop: 14 }]}>Workout</Text>
            <ScrollView style={add.workoutList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {missingWorkouts.map(w => (
                <TouchableOpacity key={w.id}
                  style={[add.option, { backgroundColor: t.bgCard, borderColor: missingSelectedWorkout?.id === w.id ? t.purple : t.border }]}
                  onPress={() => setMissingSelectedWorkout(w)}>
                  <Text style={[add.optionText, { color: missingSelectedWorkout?.id === w.id ? t.textPrimary : t.textMuted }]}>
                    {!!w.is_cardio ? '🏃 ' : '🏋️ '}{w.name}
                  </Text>
                  {missingSelectedWorkout?.id === w.id && <Ionicons name="checkmark" size={16} color={t.purple} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[add.hint, { color: t.textFaint }]}>
              Creates an empty session for that date. Open it from History to log sets.
            </Text>
            <TouchableOpacity
              style={[add.confirmBtn, { backgroundColor: (!missingDate || !missingSelectedWorkout) ? t.border : t.purple }]}
              onPress={confirmAddMissing} disabled={!missingDate || !missingSelectedWorkout}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={add.confirmBtnText}>Add Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cal = StyleSheet.create({
  container:    { borderRadius: 14, padding: 12, marginBottom: 6, borderWidth: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  navBtn:       { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthTitle:   { fontSize: 15, fontWeight: '700' },
  weekRow:      { flexDirection: 'row' },
  dayLabel:     { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textAlign: 'center' },
  // Fixed-size cells — every month takes the same vertical space (6 rows)
  cellWrap:     { flex: 1, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  cellText:     { fontSize: 13, fontWeight: '500' },
  dot:          { width: 4, height: 4, borderRadius: 2, position: 'absolute', bottom: 4 },
  selectedLabel:{ textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 6 },
});

const cm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box:      { width: '82%', borderRadius: 20, padding: 24, borderWidth: 1, elevation: 20 },
  title:    { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  message:  { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  row:      { flexDirection: 'row', gap: 10 },
  cancel:   { flex: 1, padding: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  confirm:  { flex: 1, padding: 13, borderRadius: 12, alignItems: 'center' },
  cancelText:  { fontWeight: '600', fontSize: 15 },
  confirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const s = StyleSheet.create({
  container: { flex: 1 },
  calJumpBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fab: {
    position: 'absolute', right: 20, bottom: 28,
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    elevation: 6,
  },
  list:      { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  dateHeader:{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },
  sessionCard: {
    borderRadius: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, overflow: 'hidden',
  },
  sessionAccent:  { width: 4, alignSelf: 'stretch' },
  sessionBody:    { flex: 1, paddingVertical: 14, paddingHorizontal: 14 },
  sessionName:    { fontSize: 15, fontWeight: '600', marginBottom: 3 },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionMeta:    { fontSize: 13, flex: 1 },
  sessionDuration:{ fontSize: 12 },
  empty:     { alignItems: 'center', marginTop: 80, gap: 8 },
  emptyEmoji:{ fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 8 },
  emptySub:  { fontSize: 14 },
});

const ds = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheetKAV: { maxHeight: '92%', justifyContent: 'flex-end' },
  sheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 34 },
  handle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  sheetTitle:  { fontSize: 20, fontWeight: '700' },
  sheetDate:   { fontSize: 14, marginTop: 3 },
  closeBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  content:     { maxHeight: 440 },
  notesBlock:  { borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1 },
  notesRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notesText:   { flex: 1, fontSize: 14 },
  notesEditRow:{ flexDirection: 'row', gap: 8, alignItems: 'center' },
  notesInput:  { flex: 1, fontSize: 14, borderBottomWidth: 1, paddingVertical: 4 },
  exBlock:     { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1 },
  exName:      { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  setRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  setNum:      { fontSize: 13, width: 20, textAlign: 'center' },
  setVal:      { fontSize: 14, flex: 1 },
  setNote:     { fontSize: 13, fontStyle: 'italic' },
  setActions:  { flexDirection: 'row', gap: 12 },
  iconBtn:     { padding: 4 },
  editRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  editInput:   { flex: 1, borderRadius: 8, padding: 8, fontSize: 14, borderWidth: 1, textAlign: 'center' },
  editInputFull:{ borderRadius: 8, padding: 10, fontSize: 14, borderWidth: 1 },
  cardioHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardioGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  cardioField: { width: '47%' },
  cardioFieldLabel: { fontSize: 11, marginBottom: 4 },
  editBtnRow:  { flexDirection: 'row', gap: 10, marginTop: 12 },
  saveBtnFull: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  cancelBtnFull:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 11, borderRadius: 10 },
  cancelBtnText:{ fontWeight: '600' },
  bottomActions:{ flexDirection: 'row', borderTopWidth: 1, marginTop: 4 },
  deleteBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  deleteText:  { fontWeight: '600' },
  combineBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14 },
  combineText: { fontWeight: '600' },
  emptyNote:   { fontSize: 13, fontStyle: 'italic', paddingVertical: 6 },
  logBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, marginTop: 8, borderWidth: 1 },
  logBtnText:  { fontWeight: '600', fontSize: 14 },
});

const add = StyleSheet.create({
  label:      { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  workoutList:{ maxHeight: 180, marginBottom: 4 },
  option:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 13, borderRadius: 10, marginBottom: 6, borderWidth: 1 },
  optionText: { fontSize: 15 },
  hint:       { fontSize: 12, marginVertical: 10, textAlign: 'center', lineHeight: 18 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 12 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
