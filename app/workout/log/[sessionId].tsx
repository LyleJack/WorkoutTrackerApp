import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform,
  Modal, FlatList, Vibration, Animated, PanResponder,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import {
  getExercises, addSet, getSetsForSession, deleteSet,
  getLastSetForExercise, saveLastSessionTime, saveSessionDuration, getWorkouts,
  addExercise, reorderExercises,
  Exercise, Set,
} from '@/src/db';
import { ErrorBoundary } from '@/src/ErrorBoundary';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_BAR_H   = Platform.OS === 'android' ? (Constants.statusBarHeight ?? 24) : 44;
const WEIGHT_OPTIONS = Array.from({ length: 101 }, (_, i) => i * 2.5);
const REPS_OPTIONS   = Array.from({ length: 50  }, (_, i) => i + 1);
// Duration options: 5s steps up to 5 min, then 15s steps up to 30 min
const DURATION_OPTIONS: number[] = [
  ...Array.from({ length: 59 }, (_, i) => (i + 1) * 5),  // 5s – 295s
  ...Array.from({ length: 57 }, (_, i) => 300 + (i + 1) * 15), // 315s – 1155s (~19min)
  ...Array.from({ length: 13 }, (_, i) => 1200 + (i + 1) * 60), // 1260s–1980s
];
const TIMER_PRESETS  = [60, 90, 120, 180, 240, 300];
const VIBRATE_KEY        = 'rest_timer_vibrate';
const TIMER_DURATION_KEY = 'rest_timer_duration';
const DURATION_MODE_KEY  = 'duration_mode_ex_';
const SWIPE_THRESHOLD    = 56;
const ARC_R              = 28;
const ARC_CIRC           = 2 * Math.PI * ARC_R;
const COL_NUM            = 24;
const COL_WEIGHT         = 72;
const COL_REPS           = 54;

type Draft        = { weight: string; reps: string; comment: string; durationSecs: number };
type ExerciseSets = { exercise: Exercise; sets: Set[] };

// ─── Nice confirmation modal (replaces Alert) ─────────────────────────────────

function ConfirmModal({
  visible, title, message, confirmLabel, confirmColor, onConfirm, onCancel,
}: {
  visible: boolean; title: string; message?: string;
  confirmLabel?: string; confirmColor?: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={cm.overlay}>
        <TouchableOpacity style={cm.backdrop} activeOpacity={1} onPress={onCancel} />
        <View style={cm.box}>
          <Text style={cm.title}>{title}</Text>
          {message ? <Text style={cm.message}>{message}</Text> : null}
          <View style={cm.row}>
            <TouchableOpacity style={cm.cancel} onPress={onCancel}>
              <Text style={cm.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[cm.confirm, { backgroundColor: confirmColor ?? '#ef4444' }]} onPress={onConfirm}>
              <Text style={cm.confirmText}>{confirmLabel ?? 'Delete'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Exercise modal ────────────────────────────────────────────────────────

function AddExerciseModal({
  visible, onAdd, onDismiss,
}: { visible: boolean; onAdd: (name: string) => void; onDismiss: () => void }) {
  const [text, setText] = useState('');
  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  }
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={ae.overlay}>
        <TouchableOpacity style={ae.backdrop} activeOpacity={1} onPress={onDismiss} />
        <View style={ae.box}>
          <View style={ae.handle} />
          <Text style={ae.title}>Add Exercise</Text>
          <TextInput
            style={ae.input}
            placeholder="Exercise name..."
            placeholderTextColor="#444"
            value={text}
            onChangeText={setText}
            onSubmitEditing={submit}
            returnKeyType="done"
            autoFocus
          />
          <TouchableOpacity
            style={[ae.btn, !text.trim() && ae.btnOff]}
            onPress={submit}
            disabled={!text.trim()}
          >
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={ae.btnText}>Add to Workout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Swipeable set row ────────────────────────────────────────────────────────

function SwipeableSetRow({ s, onDelete }: {
  s: Set & { exercise_name?: string };
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen     = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const base = isOpen.current ? -SWIPE_THRESHOLD : 0;
        translateX.setValue(Math.max(-80, Math.min(0, g.dx + base)));
      },
      onPanResponderRelease: (_, g) => {
        const totalDx = g.dx + (isOpen.current ? -SWIPE_THRESHOLD : 0);
        if (totalDx < -SWIPE_THRESHOLD / 2) {
          Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  function closeAndDelete() {
    Animated.timing(translateX, { toValue: -400, duration: 180, useNativeDriver: true }).start(onDelete);
  }

  return (
    <View style={sw.wrap}>
      <TouchableOpacity style={sw.deleteZone} onPress={closeAndDelete}>
        <Ionicons name="trash" size={17} color="#fff" />
      </TouchableOpacity>
      <Animated.View style={[sw.row, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
        <Text style={sw.setNum}>{s.set_number}</Text>
        <Text style={sw.colWeight}>{s.weight} kg</Text>
        <Text style={sw.colReps}>× {s.reps}</Text>
        <Text style={sw.colNote} numberOfLines={1}>{s.comment || ''}</Text>
        <Ionicons name="reorder-two-outline" size={13} color="#1e1e1e" />
      </Animated.View>
    </View>
  );
}

// ─── Checkbox set row ─────────────────────────────────────────────────────────

function CheckboxSetRow({ s, checked, onToggle, onDelete }: {
  s: Set; checked: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const durLabel = s.duration_seconds
    ? (s.duration_seconds >= 60
        ? `${Math.floor(s.duration_seconds / 60)}m${s.duration_seconds % 60 > 0 ? ` ${s.duration_seconds % 60}s` : ''}`
        : `${s.duration_seconds}s`)
    : null;

  return (
    <View style={[cb.row, checked && cb.rowDone]}>
      <TouchableOpacity onPress={onToggle} style={cb.checkBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        {checked
          ? <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
          : <View style={cb.ghostCircle}><Ionicons name="checkmark" size={13} color="#2a2a2a" /></View>
        }
      </TouchableOpacity>
      <Text style={[cb.setNum,    checked && cb.textDone]}>{s.set_number}</Text>
      <Text style={[cb.colWeight, checked && cb.textDone]}>{s.weight > 0 ? `${s.weight} kg` : 'BW'}</Text>
      <Text style={[cb.colReps,   checked && cb.textDone]}>
        {durLabel ? durLabel : `× ${s.reps}`}
      </Text>
      {s.comment
        ? <Text style={[cb.colNote, checked && cb.textDone]} numberOfLines={1}>{s.comment}</Text>
        : <View style={{ flex: 1 }} />
      }
      <TouchableOpacity onPress={onDelete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="trash-outline" size={15} color="#2a1a1a" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Drag-to-reorder row ──────────────────────────────────────────────────────

function DraggableExerciseHeader({
  name, index, onDragStart,
}: { name: string; index: number; onDragStart: () => void }) {
  return (
    <View style={dr.row}>
      <TouchableOpacity
        onLongPress={onDragStart}
        delayLongPress={180}
        style={dr.handle}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="reorder-three-outline" size={20} color="#333" />
      </TouchableOpacity>
      <Text style={dr.name}>{name}</Text>
    </View>
  );
}

// ─── Digital elapsed timer (header) ──────────────────────────────────────────

function ElapsedTimer({ startTime, stopped }: { startTime: number; stopped?: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (stopped) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime, stopped]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const label = h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
  const color = elapsed < 2700 ? '#22c55e' : elapsed < 4500 ? '#f59e0b' : '#ef4444';

  return (
    <View style={et.wrap}>
      <Text style={[et.time, { color }]}>{label}</Text>
      <Text style={et.label}>elapsed</Text>
    </View>
  );
}

// ─── Arc rest timer ───────────────────────────────────────────────────────────

function ArcTimer({ remaining, total, color }: { remaining: number; total: number; color: string }) {
  const pct  = total > 0 ? remaining / total : 0;
  const dash = pct * ARC_CIRC;
  return (
    <Svg width={72} height={72} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={36} cy={36} r={ARC_R} stroke="#0f0f0f" strokeWidth={6} fill="none" />
      <Circle cx={36} cy={36} r={ARC_R} stroke={color} strokeWidth={6} fill="none"
        strokeDasharray={`${dash} ${ARC_CIRC}`} strokeLinecap="round" />
    </Svg>
  );
}

// ─── Floating Rest Timer ──────────────────────────────────────────────────────

function FloatingTimer({ timerKey, onDismiss }: { timerKey: number; onDismiss: () => void }) {
  const [totalSeconds,   setTotalSeconds]   = useState(90);
  const [remaining,      setRemaining]      = useState(90);
  const [running,        setRunning]        = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [expanded,       setExpanded]       = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef    = useRef(Date.now());
  const totalRef    = useRef(90);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(VIBRATE_KEY), AsyncStorage.getItem(TIMER_DURATION_KEY)])
      .then(([vib, dur]) => {
        const vibrate  = vib !== 'false';
        const duration = dur ? parseInt(dur) : 90;
        setVibrateEnabled(vibrate);
        setTotalSeconds(duration);
        setRemaining(duration);
        totalRef.current = duration;
        setRunning(true);
        startRef.current = Date.now();
      });
  }, [timerKey]);

  useEffect(() => {
    if (!running) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    startRef.current = Date.now() - (totalRef.current - remaining) * 1000;
    intervalRef.current = setInterval(() => {
      const left = Math.max(0, totalRef.current - Math.floor((Date.now() - startRef.current) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(intervalRef.current!);
        setRunning(false);
        if (vibrateEnabled) Vibration.vibrate([0, 350, 150, 350]);
      }
    }, 200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, vibrateEnabled]);

  async function changePreset(secs: number) {
    totalRef.current = secs;
    setTotalSeconds(secs); setRemaining(secs);
    setRunning(true); startRef.current = Date.now();
    await AsyncStorage.setItem(TIMER_DURATION_KEY, String(secs));
  }
  async function toggleVibrate() {
    const next = !vibrateEnabled;
    setVibrateEnabled(next);
    await AsyncStorage.setItem(VIBRATE_KEY, next ? 'true' : 'false');
  }
  function handleArcTap() {
    if (remaining === 0) { setRemaining(totalSeconds); setRunning(true); startRef.current = Date.now(); }
    else setRunning(r => !r);
  }

  const done     = remaining === 0;
  const mins     = Math.floor(remaining / 60);
  const secs     = remaining % 60;
  const timeStr  = `${mins}:${String(secs).padStart(2, '0')}`;
  const arcColor = done ? '#22c55e' : running ? '#6C63FF' : '#f59e0b';

  return (
    <View style={ft.wrapper}>
      {expanded && (
        <View style={ft.panel}>
          <View style={ft.presets}>
            {TIMER_PRESETS.map(p => (
              <TouchableOpacity key={p} style={[ft.preset, totalSeconds === p && ft.presetActive]} onPress={() => changePreset(p)}>
                <Text style={[ft.presetText, totalSeconds === p && ft.presetTextActive]}>
                  {p < 60 ? `${p}s` : `${p / 60}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={ft.vibRow} onPress={toggleVibrate}>
            <Ionicons name={vibrateEnabled ? 'phone-portrait-outline' : 'phone-portrait'} size={15} color={vibrateEnabled ? '#6C63FF' : '#444'} />
            <Text style={[ft.vibText, !vibrateEnabled && ft.vibOff]}>Vibrate {vibrateEnabled ? 'on' : 'off'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={ft.row}>
        <TouchableOpacity style={ft.arcWrap} onPress={handleArcTap} activeOpacity={0.8}>
          <ArcTimer remaining={remaining} total={totalSeconds} color={arcColor} />
          <View style={ft.arcOverlay}>
            <Text style={[ft.arcTime, { color: arcColor }]}>{done ? '✓' : timeStr}</Text>
          </View>
        </TouchableOpacity>
        <View style={ft.info}>
          <Text style={[ft.status, { color: arcColor }]}>{done ? 'Rest complete' : running ? 'Resting…' : 'Paused'}</Text>
          <TouchableOpacity style={[ft.controlBtn, { borderColor: arcColor + '55' }]} onPress={handleArcTap}>
            <Ionicons name={done ? 'refresh' : running ? 'pause' : 'play'} size={13} color={arcColor} />
            <Text style={[ft.controlText, { color: arcColor }]}>{done ? 'Restart' : running ? 'Pause' : 'Resume'}</Text>
          </TouchableOpacity>
        </View>
        <View style={ft.actions}>
          <TouchableOpacity style={ft.iconBtn} onPress={() => setExpanded(e => !e)}>
            <Ionicons name={expanded ? 'chevron-up' : 'options-outline'} size={15} color="#444" />
          </TouchableOpacity>
          <TouchableOpacity style={ft.iconBtn} onPress={onDismiss}>
            <Ionicons name="close" size={15} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Scroll Picker ────────────────────────────────────────────────────────────

function ScrollPicker({ values, selected, onSelect, label, unit }: {
  values: number[]; selected: number; onSelect: (v: number) => void;
  label: string; unit: string;
}) {
  const [visible, setVisible] = useState(false);
  const flatRef = useRef<FlatList>(null);

  function open() {
    setVisible(true);
    const idx = values.indexOf(selected);
    setTimeout(() => {
      if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, viewPosition: 0.4, animated: false });
    }, 80);
  }

  return (
    <>
      <TouchableOpacity style={pk.trigger} onPress={open}>
        <Text style={pk.value}>{selected === 0 && label === 'Weight' ? '–' : selected}</Text>
        {unit ? <Text style={pk.unit}>{unit}</Text> : null}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <View style={pk.root}>
          <TouchableOpacity style={pk.backdrop} activeOpacity={1} onPress={() => setVisible(false)} />
          <View style={pk.sheet}>
            <View style={pk.handle} />
            <Text style={pk.title}>{label}</Text>
            <FlatList
              ref={flatRef}
              data={values}
              keyExtractor={v => String(v)}
              style={pk.list}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[pk.item, item === selected && pk.itemSel]}
                  onPress={() => { onSelect(item); setVisible(false); }}
                >
                  <Text style={[pk.itemText, item === selected && pk.itemTextSel]}>
                    {item}{unit ? ` ${unit}` : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LogScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in the log screen.">
      <LogScreenInner />
    </ErrorBoundary>
  );
}

function LogScreenInner() {
  const { sessionId, workoutId } = useLocalSearchParams<{ sessionId: string; workoutId: string }>();
  const router = useRouter();

  const [data,          setData]          = useState<ExerciseSets[]>([]);
  const [drafts,        setDrafts]        = useState<Record<number, Draft>>({});
  const [timerVisible,  setTimerVisible]  = useState(false);
  const [timerKey,      setTimerKey]      = useState(0);
  const [collapsed,     setCollapsed]     = useState<Record<number, boolean>>({});
  const [flashId,       setFlashId]       = useState<number | null>(null);
  const [checkedSets,   setCheckedSets]   = useState<Record<number, boolean>>({});
  const [finished,      setFinished]      = useState(false);
  const finishedRef = useRef(false);
  const startTime   = useRef(Date.now());

  const [dragging,    setDragging]    = useState<number | null>(null); // exercise id
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Duration mode (plank etc.) — keyed by exercise id, persisted
  const [durationModes, setDurationModes] = useState<Record<number, boolean>>({});

  // Modals
  const [addExVisible,    setAddExVisible]    = useState(false);
  const [confirmDelete,   setConfirmDelete]   = useState<{ type: 'set'; id: number } | null>(null);
  const [workoutName,     setWorkoutName]     = useState('');

  useEffect(() => {
    startTime.current = Date.now();
    setFinished(false);
    finishedRef.current = false;
    setTimerVisible(false);
    setTimerKey(0);
    setCheckedSets({});
    setCollapsed({});
    // Load workout name
    const ws = getWorkouts();
    const w  = ws.find(w => w.id === Number(workoutId));
    if (w) setWorkoutName(w.name);
  }, [sessionId]);

  const load = useCallback(() => {
    const exercises = getExercises(Number(workoutId));
    const sets      = getSetsForSession(Number(sessionId));
    setData(exercises.map(e => ({
      exercise: e,
      sets: sets.filter(s => s.exercise_id === e.id),
    })));
    setDrafts(prev => {
      const next: Record<number, Draft> = {};
      exercises.forEach(e => {
        if (prev[e.id]) {
          next[e.id] = prev[e.id];
        } else {
          const lastSet = getLastSetForExercise(e.id);
          next[e.id] = lastSet
            ? { weight: String(lastSet.weight), reps: String(lastSet.reps), comment: '', durationSecs: lastSet.duration_seconds ?? 30 }
            : { weight: '0', reps: '1', comment: '', durationSecs: 30 };
        }
      });
      return next;
    });
    // Load duration mode prefs for all exercises
    Promise.all(exercises.map(e =>
      AsyncStorage.getItem(DURATION_MODE_KEY + e.id).then(v => ({ id: e.id, on: v === 'true' }))
    )).then(results => {
      const modes: Record<number, boolean> = {};
      results.forEach(r => { if (r.on) modes[r.id] = true; });
      setDurationModes(modes);
    });
  }, [sessionId, workoutId]);

  useFocusEffect(useCallback(() => {
    load();
    return () => {
      if (!finishedRef.current) {
        const workouts = getWorkouts();
        const w = workouts.find(w => w.id === Number(workoutId));
        if (w) saveLastSessionTime(Number(sessionId), w.id, w.name, w.is_cardio, false);
      }
    };
  }, [sessionId, workoutId]));

  function setDraftField(id: number, field: keyof Draft, val: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }
  function setDraftNum(id: number, field: 'weight' | 'reps', val: number) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: String(val) } }));
  }

  function handleCopyLast(exerciseId: number) {
    const last = getLastSetForExercise(exerciseId);
    if (!last) return;
    setDrafts(prev => ({
      ...prev,
      [exerciseId]: {
        weight: String(last.weight), reps: String(last.reps),
        comment: prev[exerciseId]?.comment ?? '',
        durationSecs: last.duration_seconds ?? prev[exerciseId]?.durationSecs ?? 30,
      },
    }));
  }

  async function toggleDurationMode(exerciseId: number) {
    const next = !durationModes[exerciseId];
    setDurationModes(prev => ({ ...prev, [exerciseId]: next }));
    await AsyncStorage.setItem(DURATION_MODE_KEY + exerciseId, next ? 'true' : 'false');
  }

  function handleAddSet(exerciseId: number) {
    const draft    = drafts[exerciseId];
    const weight   = parseFloat(draft?.weight || '0') || 0;
    const isDurMode = !!durationModes[exerciseId];
    const durSecs   = draft?.durationSecs ?? 30;

    if (isDurMode) {
      if (!durSecs || durSecs <= 0) return;
      const existing = data.find(d => d.exercise.id === exerciseId)?.sets ?? [];
      // Store duration as reps=1, duration_seconds=durSecs
      addSet(Number(sessionId), exerciseId, weight, 1, existing.length + 1, draft?.comment, durSecs);
    } else {
      const reps = parseInt(draft?.reps || '0') || 0;
      if (reps === 0) return;
      const existing = data.find(d => d.exercise.id === exerciseId)?.sets ?? [];
      addSet(Number(sessionId), exerciseId, weight, reps, existing.length + 1, draft?.comment);
    }
    load();
    setFlashId(exerciseId);
    setTimeout(() => setFlashId(null), 600);
    setTimerKey(k => k + 1);
    setTimerVisible(true);
  }

  function handleDeleteSet(id: number) {
    setConfirmDelete({ type: 'set', id });
  }

  function confirmDeleteSet() {
    if (!confirmDelete) return;
    deleteSet(confirmDelete.id);
    setCheckedSets(prev => { const n = { ...prev }; delete n[confirmDelete.id]; return n; });
    load();
    setConfirmDelete(null);
  }

  function toggleCheck(setId: number, exerciseId: number, allSetIds: number[]) {
    const next = { ...checkedSets, [setId]: !checkedSets[setId] };
    setCheckedSets(next);
    if (allSetIds.every(id => next[id])) {
      setTimeout(() => setCollapsed(prev => ({ ...prev, [exerciseId]: true })), 400);
    }
  }

  function toggleAllSets(exerciseId: number, allSetIds: number[], currentlyAllDone: boolean) {
    const next = { ...checkedSets };
    allSetIds.forEach(id => { next[id] = !currentlyAllDone; });
    setCheckedSets(next);
    if (!currentlyAllDone) {
      setTimeout(() => setCollapsed(prev => ({ ...prev, [exerciseId]: true })), 400);
    } else {
      setCollapsed(prev => ({ ...prev, [exerciseId]: false }));
    }
  }

  function handleAddExercise(name: string) {
    addExercise(Number(workoutId), name);
    load();
    setAddExVisible(false);
  }

  // Simple reorder: tap drag handle → mark as dragging. Tap another item → swap.
  function handleDragStart(exerciseId: number) {
    if (dragging === null) {
      setDragging(exerciseId);
    } else if (dragging !== exerciseId) {
      // Swap the two
      const ids = data.map(d => d.exercise.id);
      const fromIdx = ids.indexOf(dragging);
      const toIdx   = ids.indexOf(exerciseId);
      const newIds = [...ids];
      newIds.splice(fromIdx, 1);
      newIds.splice(toIdx, 0, dragging);
      reorderExercises(newIds);
      setDragging(null);
      load();
    } else {
      setDragging(null);
    }
  }

  async function finishWorkout() {
    finishedRef.current = true;
    setFinished(true);
    setTimerVisible(false);
    const durationSeconds = Math.floor((Date.now() - startTime.current) / 1000);
    saveSessionDuration(Number(sessionId), durationSeconds);
    const workouts = getWorkouts();
    const w = workouts.find(w => w.id === Number(workoutId));
    if (w) await saveLastSessionTime(Number(sessionId), w.id, w.name, w.is_cardio, true);
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Confirm delete modal */}
      <ConfirmModal
        visible={!!confirmDelete}
        title="Delete set?"
        onConfirm={confirmDeleteSet}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Add exercise modal */}
      <AddExerciseModal
        visible={addExVisible}
        onAdd={handleAddExercise}
        onDismiss={() => setAddExVisible(false)}
      />

      {/* Drag hint banner */}
      {dragging !== null && (
        <View style={styles.dragHint}>
          <Ionicons name="swap-vertical" size={14} color="#6C63FF" />
          <Text style={styles.dragHintText}>
            Tap another exercise to swap with "{data.find(d => d.exercise.id === dragging)?.exercise.name}"
          </Text>
          <TouchableOpacity onPress={() => setDragging(null)}>
            <Ionicons name="close" size={16} color="#555" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#aaa" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <ElapsedTimer startTime={startTime.current} stopped={finished} />
          {workoutName ? <Text style={styles.headerWorkoutName} numberOfLines={1}>{workoutName}</Text> : null}
        </View>

        <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* ── Rest timer ── */}
      {timerVisible && (
        <FloatingTimer timerKey={timerKey} onDismiss={() => setTimerVisible(false)} />
      )}

      {/* ── Exercise cards ── */}
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {data.map(({ exercise, sets }, idx) => {
          const draft       = drafts[exercise.id] ?? { weight: '0', reps: '1', comment: '', durationSecs: 30 };
          const weightVal   = parseFloat(draft.weight) || 0;
          const repsVal     = parseInt(draft.reps)     || 1;
          const durVal      = draft.durationSecs ?? 30;
          const isDurMode   = !!durationModes[exercise.id];
          const allSetIds   = sets.map(s => s.id);
          const allChecked  = sets.length > 0 && allSetIds.every(id => checkedSets[id]);
          const isCollapsed = !!collapsed[exercise.id] && sets.length > 0;
          const isFlashing  = flashId === exercise.id;
          const isDragging  = dragging === exercise.id;

          return (
            <View key={exercise.id}>
              <View style={[
                styles.exerciseCard,
                isFlashing && styles.cardFlash,
                allChecked && styles.cardDone,
                isDragging && styles.cardDragging,
              ]}>
                {/* Card header */}
                <View style={styles.cardHeader}>
                  {/* Drag handle */}
                  <TouchableOpacity
                    style={[styles.dragHandle, isDragging && styles.dragHandleActive]}
                    onPress={() => handleDragStart(exercise.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="reorder-three-outline" size={20} color={isDragging ? '#6C63FF' : '#2a2a2a'} />
                  </TouchableOpacity>

                  {/* Badge */}
                  <TouchableOpacity
                    style={[
                      styles.badge,
                      sets.length > 0 && !allChecked && styles.badgeHasSets,
                      allChecked && styles.badgeAllDone,
                    ]}
                    onPress={() => { if (sets.length > 0) toggleAllSets(exercise.id, allSetIds, allChecked); }}
                    activeOpacity={sets.length > 0 ? 0.7 : 1}
                  >
                    {allChecked
                      ? <Ionicons name="checkmark" size={12} color="#fff" />
                      : sets.length > 0
                        ? <Ionicons name="checkmark" size={12} color="#2a2a2a" />
                        : <Text style={styles.badgeNum}>{idx + 1}</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.titlePressable}
                    onPress={() => { if (sets.length > 0) setCollapsed(prev => ({ ...prev, [exercise.id]: !prev[exercise.id] })); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.exName}>{exercise.name}</Text>
                    <View style={styles.headerRight}>
                      {sets.length > 0 && <Text style={styles.setCount}>{sets.length} set{sets.length !== 1 ? 's' : ''}</Text>}
                      {sets.length > 0 && <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color="#333" />}
                    </View>
                  </TouchableOpacity>
                </View>

                {!isCollapsed && (
                  <>
                    {/* Duration mode toggle — subtle pill, only shows when expanded */}
                    <TouchableOpacity
                      style={[styles.durToggle, isDurMode && styles.durToggleOn]}
                      onPress={() => toggleDurationMode(exercise.id)}
                    >
                      <Ionicons
                        name="timer-outline"
                        size={12}
                        color={isDurMode ? '#6C63FF' : '#2a2a2a'}
                      />
                      <Text style={[styles.durToggleText, isDurMode && styles.durToggleTextOn]}>
                        Duration
                      </Text>
                    </TouchableOpacity>

                    {sets.length > 0 && (
                      <View style={styles.setsTable}>
                        <View style={styles.tableHead}>
                          <View style={styles.colCheck} />
                          <Text style={[styles.headCell, { width: COL_NUM, textAlign: 'center' }]}>#</Text>
                          <Text style={[styles.headCell, { width: COL_WEIGHT }]}>WEIGHT</Text>
                          <Text style={[styles.headCell, { width: COL_REPS }]}>{isDurMode ? 'TIME' : 'REPS'}</Text>
                          <Text style={[styles.headCell, { flex: 1 }]}>NOTE</Text>
                        </View>
                        {sets.map(s => (
                          <CheckboxSetRow
                            key={s.id}
                            s={s}
                            checked={!!checkedSets[s.id]}
                            onToggle={() => toggleCheck(s.id, exercise.id, allSetIds)}
                            onDelete={() => handleDeleteSet(s.id)}
                          />
                        ))}
                      </View>
                    )}

                    <View style={styles.pickerRow}>
                      <View style={styles.pickerGroup}>
                        <Text style={styles.pickerLabel}>WEIGHT</Text>
                        <ScrollPicker
                          values={WEIGHT_OPTIONS} selected={weightVal}
                          onSelect={v => setDraftNum(exercise.id, 'weight', v)}
                          label="Weight" unit="kg"
                        />
                      </View>
                      {isDurMode ? (
                        <View style={styles.pickerGroup}>
                          <Text style={styles.pickerLabel}>DURATION</Text>
                          <ScrollPicker
                            values={DURATION_OPTIONS} selected={durVal}
                            onSelect={v => setDrafts(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], durationSecs: v } }))}
                            label="Duration" unit="s"
                          />
                        </View>
                      ) : (
                        <View style={styles.pickerGroup}>
                          <Text style={styles.pickerLabel}>REPS</Text>
                          <ScrollPicker
                            values={REPS_OPTIONS} selected={repsVal}
                            onSelect={v => setDraftNum(exercise.id, 'reps', v)}
                            label="Reps" unit=""
                          />
                        </View>
                      )}
                    </View>

                    <TextInput
                      style={styles.commentInput}
                      value={draft.comment}
                      onChangeText={v => setDraftField(exercise.id, 'comment', v)}
                      placeholder="Note (optional)"
                      placeholderTextColor="#2a2a2a"
                    />

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopyLast(exercise.id)}>
                        <Ionicons name="copy-outline" size={14} color="#555" />
                        <Text style={styles.copyText}>Copy last</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.addSetBtn, (!isDurMode && repsVal === 0) && styles.addSetBtnOff]}
                        onPress={() => handleAddSet(exercise.id)}
                        disabled={!isDurMode && repsVal === 0}
                      >
                        <Ionicons name="add" size={18} color="#fff" />
                        <Text style={styles.addSetText}>Add Set</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          );
        })}

        {/* Add exercise + Finish */}
        <View style={styles.bottomButtons}>
          <TouchableOpacity style={styles.addExBtn} onPress={() => setAddExVisible(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
            <Text style={styles.addExText}>Add Exercise</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bigFinish} onPress={finishWorkout}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.bigFinishText}>Finish Workout</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cm = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box: {
    backgroundColor: '#0d0d18', borderRadius: 20, padding: 24, width: '100%',
    borderWidth: 1, borderColor: '#1a1a2a',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 20,
  },
  title:    { color: '#e8e8ff', fontSize: 17, fontWeight: '700', marginBottom: 8 },
  message:  { color: '#555', fontSize: 14, marginBottom: 20, lineHeight: 20 },
  row:      { flexDirection: 'row', gap: 10 },
  cancel:   { flex: 1, padding: 12, borderRadius: 12, backgroundColor: '#111', alignItems: 'center' },
  cancelText: { color: '#888', fontWeight: '600' },
  confirm:  { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  confirmText: { color: '#fff', fontWeight: '700' },
});

const ae = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box: {
    backgroundColor: '#09090f', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8,
    borderTopWidth: 1, borderColor: '#1a1a28',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 20 },
  title:  { color: '#e8e8ff', fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: '#000', color: '#e8e8ff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 16,
    borderWidth: 1, borderColor: '#1a1a2a', marginBottom: 14,
  },
  btn:    { backgroundColor: '#6C63FF', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnOff: { backgroundColor: '#1a1a2a' },
  btnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
});

const dr = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  handle: { padding: 4 },
  name:   { color: '#e8e8ff', fontSize: 14, fontWeight: '700', flex: 1 },
});

const sw = StyleSheet.create({
  wrap:      { position: 'relative', marginBottom: 2, overflow: 'hidden', borderRadius: 8 },
  deleteZone:{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 72, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#0a0a0a', borderRadius: 8 },
  setNum:    { width: COL_NUM, color: '#6C63FF', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  colWeight: { width: COL_WEIGHT, color: '#aaa', fontSize: 14 },
  colReps:   { width: COL_REPS, color: '#aaa', fontSize: 14 },
  colNote:   { flex: 1, color: '#444', fontSize: 13, fontStyle: 'italic' },
});

const cb = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 12, backgroundColor: '#0a0a0a', borderRadius: 8, marginBottom: 2 },
  rowDone:    { opacity: 0.4 },
  checkBtn:   { width: 28, alignItems: 'center', justifyContent: 'center' },
  ghostCircle:{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#252525', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0d0d0d' },
  setNum:    { width: COL_NUM, color: '#6C63FF', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  colWeight: { width: COL_WEIGHT, color: '#aaa', fontSize: 14 },
  colReps:   { width: COL_REPS, color: '#aaa', fontSize: 14 },
  colNote:   { flex: 1, color: '#444', fontSize: 13, fontStyle: 'italic' },
  textDone:  { color: '#222', textDecorationLine: 'line-through' },
});

const et = StyleSheet.create({
  wrap:  { alignItems: 'center' },
  time:  { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  label: { fontSize: 9, fontWeight: '600', color: '#333', letterSpacing: 1, marginTop: 1 },
});

const ft = StyleSheet.create({
  wrapper:      { backgroundColor: '#050508', borderBottomWidth: 1, borderBottomColor: '#0d0d14' },
  panel:        { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#0d0d14' },
  presets:      { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  preset:       { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#0d0d16', borderWidth: 1, borderColor: '#1a1a28' },
  presetActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  presetText:   { color: '#444', fontSize: 13, fontWeight: '600' },
  presetTextActive: { color: '#fff' },
  vibRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  vibText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  vibOff:  { color: '#444' },
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 16 },
  arcWrap: { width: 72, height: 72, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  arcOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  arcTime:    { fontSize: 12, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
  info:       { flex: 1, gap: 8 },
  status:     { fontSize: 13, fontWeight: '700' },
  controlBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#0d0d16', borderWidth: 1, alignSelf: 'flex-start' },
  controlText:{ fontSize: 12, fontWeight: '600' },
  actions:    { gap: 8 },
  iconBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0d0d16', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#111' },
});

const pk = StyleSheet.create({
  trigger: {
    backgroundColor: '#050508', borderRadius: 10, borderWidth: 1, borderColor: '#1a1a28',
    paddingVertical: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  value:  { color: '#e8e8ff', fontSize: 22, fontWeight: '700' },
  unit:   { color: '#555', fontSize: 13, marginTop: 3 },
  root:   { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    backgroundColor: '#09090f',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
    maxHeight: '65%',
    borderTopWidth: 1, borderColor: '#1a1a28',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 20,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 16 },
  title:  { color: '#e8e8ff', fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 12, letterSpacing: 0.3 },
  list:   { maxHeight: 280 },
  item:   { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  itemSel:{ backgroundColor: '#0d0d20' },
  itemText:    { color: '#3a3a5a', fontSize: 18 },
  itemTextSel: { color: '#e8e8ff', fontWeight: '700', fontSize: 24 },
});

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: STATUS_BAR_H + 12, paddingBottom: 10,
    backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#0d0d14',
  },
  back:             { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter:     { flex: 1, alignItems: 'center' },
  headerWorkoutName:{ color: '#333', fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  finishBtn:  { backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  dragHint: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#0d0d1f', borderBottomWidth: 1, borderBottomColor: '#1a1a2a',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  dragHintText: { flex: 1, color: '#6C63FF', fontSize: 12, fontWeight: '600' },

  scroll:       { padding: 12, paddingBottom: 60 },
  exerciseCard: { backgroundColor: '#0a0a0a', borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#111', overflow: 'hidden' },
  cardFlash:    { borderColor: '#22c55e55', backgroundColor: '#001a0a' },
  cardDone:     { borderColor: '#22c55e18', opacity: 0.6 },
  cardDragging: { borderColor: '#6C63FF66', backgroundColor: '#0d0d20' },

  cardHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  titlePressable:{ flex: 1, flexDirection: 'row', alignItems: 'center' },

  dragHandle:       { padding: 4, marginRight: -2 },
  dragHandleActive: { opacity: 1 },

  badge:        { width: 22, height: 22, borderRadius: 11, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  badgeHasSets: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a' },
  badgeAllDone: { backgroundColor: '#22c55e' },
  badgeNum:     { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  exName:       { color: '#e8e8ff', fontSize: 14, fontWeight: '700', flex: 1 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setCount:     { color: '#333', fontSize: 12 },

  setsTable:  { marginHorizontal: 14, marginBottom: 12, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000', borderWidth: 1, borderColor: '#111' },
  tableHead:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#111' },
  colCheck:   { width: 28 },
  headCell:   { color: '#252525', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  pickerRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 10 },
  pickerGroup: { flex: 1 },
  pickerLabel: { color: '#333', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },

  commentInput: {
    marginHorizontal: 14, backgroundColor: '#000', color: '#888', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#111', marginBottom: 10,
  },

  actionRow:  { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  copyBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: 10, backgroundColor: '#000', borderWidth: 1, borderColor: '#1a1a1a' },
  copyText:   { color: '#444', fontWeight: '600', fontSize: 13 },
  addSetBtn:  { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: '#6C63FF' },
  addSetBtnOff: { backgroundColor: '#1a1a2a' },
  addSetText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  bottomButtons: { gap: 10, marginTop: 4 },
  addExBtn:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#6C63FF33', backgroundColor: '#0d0d1f',
  },
  addExText: { color: '#6C63FF', fontWeight: '600', fontSize: 15 },
  bigFinish: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    padding: 16, borderRadius: 14,
    backgroundColor: '#0d1f12', borderWidth: 1, borderColor: '#1a3a22',
  },
  bigFinishText: { color: '#22c55e', fontWeight: '700', fontSize: 16 },

  // Duration mode toggle — small unobtrusive pill
  durToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-end', marginRight: 14, marginBottom: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    backgroundColor: '#080808', borderWidth: 1, borderColor: '#141414',
  },
  durToggleOn: {
    backgroundColor: '#0d0d1f', borderColor: '#6C63FF44',
  },
  durToggleText:    { color: '#2a2a2a', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  durToggleTextOn:  { color: '#6C63FF' },
});
