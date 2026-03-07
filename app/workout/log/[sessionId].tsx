import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList, Vibration, Animated, Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getExercises, addSet, getSetsForSession, deleteSet,
  getLastSetForExercise, saveLastSessionTime, getWorkouts, Exercise, Set,
} from '@/src/db';

// ─── Constants ────────────────────────────────────────────────────────────────

const WEIGHT_OPTIONS    = Array.from({ length: 101 }, (_, i) => i * 2.5);
const REPS_OPTIONS      = Array.from({ length: 50  }, (_, i) => i + 1);
const TIMER_PRESETS     = [60, 90, 120, 180, 240, 300];
const VIBRATE_KEY       = 'rest_timer_vibrate';
const TIMER_DURATION_KEY= 'rest_timer_duration';
const SCREEN_W          = Dimensions.get('window').width;

type Draft       = { weight: string; reps: string; comment: string };
type ExerciseSets= { exercise: Exercise; sets: Set[] };

// ─── Swipeable set row ────────────────────────────────────────────────────────

function SwipeableSetRow({
  s, onDelete,
}: { s: Set & { exercise_name?: string }; onDelete: () => void }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [swiped, setSwiped] = useState(false);

  function handleSwipeEnd() {
    if (swiped) {
      // snap back
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      setSwiped(false);
    } else {
      // reveal delete
      Animated.spring(translateX, { toValue: -72, useNativeDriver: true }).start();
      setSwiped(true);
    }
  }

  return (
    <View style={swipeStyles.wrap}>
      {/* Red delete zone behind */}
      <TouchableOpacity style={swipeStyles.deleteZone} onPress={onDelete}>
        <Ionicons name="trash" size={18} color="#fff" />
      </TouchableOpacity>
      {/* Row */}
      <Animated.View style={[swipeStyles.row, { transform: [{ translateX }] }]}>
        <TouchableOpacity style={swipeStyles.rowInner} onPress={handleSwipeEnd} activeOpacity={0.9}>
          <Text style={swipeStyles.setNum}>{s.set_number}</Text>
          <Text style={swipeStyles.cell}>{s.weight} kg</Text>
          <Text style={swipeStyles.cell}>× {s.reps}</Text>
          <Text style={[swipeStyles.cell, swipeStyles.note]} numberOfLines={1}>
            {s.comment || ''}
          </Text>
          <Ionicons name="chevron-back" size={14} color="#333" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Scroll Picker ────────────────────────────────────────────────────────────

function ScrollPicker({ values, selected, onSelect, label, unit }: {
  values: number[]; selected: number; onSelect: (v: number) => void;
  label: string; unit: string;
}) {
  const [visible,    setVisible]    = useState(false);
  const [isManual,   setIsManual]   = useState(false);
  const [manualText, setManualText] = useState('');
  const flatRef = useRef<FlatList>(null);

  function open() {
    setManualText(String(selected));
    setIsManual(false);
    setVisible(true);
    const idx = values.indexOf(selected);
    setTimeout(() => {
      if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, viewPosition: 0.4, animated: false });
    }, 100);
  }

  function confirm() {
    const p = parseFloat(manualText);
    if (!isNaN(p) && p >= 0) onSelect(p);
    setVisible(false);
  }

  return (
    <>
      <TouchableOpacity style={pickerStyles.trigger} onPress={open}>
        <Text style={pickerStyles.value}>{selected === 0 && label === 'Weight' ? '–' : selected}</Text>
        {unit ? <Text style={pickerStyles.unit}>{unit}</Text> : null}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="slide">
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <Text style={pickerStyles.title}>{label}</Text>
            <View style={pickerStyles.tabs}>
              {(['Scroll', 'Type'] as const).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[pickerStyles.tab, (t === 'Type') === isManual && pickerStyles.tabActive]}
                  onPress={() => setIsManual(t === 'Type')}
                >
                  <Text style={[pickerStyles.tabText, (t === 'Type') === isManual && pickerStyles.tabTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {isManual ? (
              <View style={pickerStyles.manualWrap}>
                <TextInput
                  style={pickerStyles.manualInput} keyboardType="decimal-pad"
                  value={manualText} onChangeText={setManualText} autoFocus
                  placeholder="e.g. 12.5" placeholderTextColor="#555"
                />
                {unit ? <Text style={pickerStyles.manualUnit}>{unit}</Text> : null}
              </View>
            ) : (
              <FlatList
                ref={flatRef} data={values} keyExtractor={v => String(v)}
                style={pickerStyles.list} showsVerticalScrollIndicator={false}
                getItemLayout={(_, i) => ({ length: 52, offset: 52 * i, index: i })}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[pickerStyles.item, item === selected && pickerStyles.itemSel]}
                    onPress={() => { onSelect(item); setVisible(false); }}
                  >
                    <Text style={[pickerStyles.itemText, item === selected && pickerStyles.itemTextSel]}>
                      {item}{unit ? ` ${unit}` : ''}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
            <View style={pickerStyles.btnRow}>
              <TouchableOpacity style={pickerStyles.cancelBtn} onPress={() => setVisible(false)}>
                <Text style={pickerStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              {isManual && (
                <TouchableOpacity style={pickerStyles.confirmBtn} onPress={confirm}>
                  <Text style={pickerStyles.confirmText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Floating Rest Timer pill ─────────────────────────────────────────────────

function FloatingTimer({
  timerKey, onDismiss,
}: { timerKey: number; onDismiss: () => void }) {
  const [totalSeconds,    setTotalSeconds]    = useState(90);
  const [remaining,       setRemaining]       = useState(90);
  const [running,         setRunning]         = useState(true);
  const [vibrateEnabled,  setVibrateEnabled]  = useState(true);
  const [expanded,        setExpanded]        = useState(false);
  const intervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef     = useRef(Date.now());
  const totalRef     = useRef(90);

  // Load prefs + restart whenever timerKey changes
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(VIBRATE_KEY),
      AsyncStorage.getItem(TIMER_DURATION_KEY),
    ]).then(([vib, dur]) => {
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

  // Ticker
  useEffect(() => {
    if (!running) { intervalRef.current && clearInterval(intervalRef.current); return; }
    startRef.current = Date.now() - (totalRef.current - remaining) * 1000;
    intervalRef.current = setInterval(() => {
      const left = Math.max(0, totalRef.current - Math.floor((Date.now() - startRef.current) / 1000));
      setRemaining(left);
      if (left === 0) {
        clearInterval(intervalRef.current!);
        setRunning(false);
        if (vibrateEnabled) Vibration.vibrate([0, 350, 150, 350]);
      }
    }, 250);
    return () => { intervalRef.current && clearInterval(intervalRef.current); };
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

  function handlePillTap() {
    if (remaining === 0) {
      setRemaining(totalSeconds); setRunning(true); startRef.current = Date.now();
    } else {
      setExpanded(e => !e);
    }
  }

  const done   = remaining === 0;
  const mins   = Math.floor(remaining / 60);
  const secs   = remaining % 60;
  const pct    = remaining / totalSeconds;
  const timeStr= `${mins}:${String(secs).padStart(2, '0')}`;
  const pillColor = done ? '#22c55e' : running ? '#6C63FF' : '#f59e0b';

  return (
    <View style={floatStyles.wrapper}>
      {/* Expanded panel */}
      {expanded && (
        <View style={floatStyles.panel}>
          {/* Presets */}
          <View style={floatStyles.presets}>
            {TIMER_PRESETS.map(p => (
              <TouchableOpacity
                key={p}
                style={[floatStyles.preset, totalSeconds === p && floatStyles.presetActive]}
                onPress={() => changePreset(p)}
              >
                <Text style={[floatStyles.presetText, totalSeconds === p && floatStyles.presetTextActive]}>
                  {p < 60 ? `${p}s` : `${p / 60}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Vibrate toggle */}
          <TouchableOpacity style={floatStyles.vibRow} onPress={toggleVibrate}>
            <Ionicons
              name={vibrateEnabled ? 'phone-portrait-outline' : 'phone-portrait'}
              size={15} color={vibrateEnabled ? '#6C63FF' : '#444'}
            />
            <Text style={[floatStyles.vibText, !vibrateEnabled && floatStyles.vibOff]}>
              Vibrate {vibrateEnabled ? 'on' : 'off'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pill */}
      <View style={floatStyles.pillRow}>
        <TouchableOpacity
          style={[floatStyles.pill, { borderColor: pillColor }]}
          onPress={handlePillTap}
          activeOpacity={0.85}
        >
          {/* Progress bar behind */}
          <View style={[floatStyles.pillProgress, { width: `${pct * 100}%` as any, backgroundColor: pillColor + '28' }]} />
          <Ionicons name="timer-outline" size={16} color={pillColor} />
          <Text style={[floatStyles.pillTime, { color: pillColor }]}>
            {done ? 'Rest done — tap to reset' : timeStr}
          </Text>
          {!done && (
            <Ionicons name={running ? 'pause' : 'play'} size={14} color={pillColor} />
          )}
          <TouchableOpacity
            onPress={() => setExpanded(e => !e)}
            hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
            style={floatStyles.chevron}
          >
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-up'} size={14} color="#555" />
          </TouchableOpacity>
        </TouchableOpacity>
        <TouchableOpacity style={floatStyles.dismissBtn} onPress={onDismiss}>
          <Ionicons name="close" size={16} color="#555" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Elapsed workout clock ────────────────────────────────────────────────────

function ElapsedClock({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [startTime]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <Text style={styles.elapsedText}>{m}:{String(s).padStart(2, '0')}</Text>
  );
}

// ─── Main Log Screen ──────────────────────────────────────────────────────────

export default function LogScreen() {
  const { sessionId, workoutId } = useLocalSearchParams<{ sessionId: string; workoutId: string }>();
  const router = useRouter();

  const [data,          setData]          = useState<ExerciseSets[]>([]);
  const [drafts,        setDrafts]        = useState<Record<number, Draft>>({});
  const [timerVisible,  setTimerVisible]  = useState(false);
  const [timerKey,      setTimerKey]      = useState(0);
  const [collapsed,     setCollapsed]     = useState<Record<number, boolean>>({});
  const [flashId,       setFlashId]       = useState<number | null>(null);  // for set-added flash
  const startTime = useRef(Date.now());
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(() => {
    const exercises = getExercises(Number(workoutId));
    const sets = getSetsForSession(Number(sessionId));
    setData(exercises.map(e => ({ exercise: e, sets: sets.filter(s => s.exercise_id === e.id) })));
    setDrafts(prev => {
      const next: Record<number, Draft> = {};
      exercises.forEach(e => { next[e.id] = prev[e.id] ?? { weight: '0', reps: '1', comment: '' }; });
      return next;
    });
  }, [sessionId, workoutId]);

  useFocusEffect(load);

  function setDraftField(id: number, field: keyof Draft, val: string) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }
  function setDraftNum(id: number, field: 'weight' | 'reps', val: number) {
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: String(val) } }));
  }

  function handleCopyLast(exerciseId: number) {
    const last = getLastSetForExercise(exerciseId);
    if (!last) { Alert.alert('No previous set', 'Nothing to copy yet.'); return; }
    setDrafts(prev => ({
      ...prev,
      [exerciseId]: { weight: String(last.weight), reps: String(last.reps), comment: prev[exerciseId]?.comment ?? '' },
    }));
  }

  function handleAddSet(exerciseId: number) {
    const draft  = drafts[exerciseId];
    const weight = parseFloat(draft?.weight || '0') || 0;
    const reps   = parseInt(draft?.reps     || '0') || 0;
    if (reps === 0) { Alert.alert('Enter reps', 'Please enter at least 1 rep.'); return; }
    const existing = data.find(d => d.exercise.id === exerciseId)?.sets ?? [];
    addSet(Number(sessionId), exerciseId, weight, reps, existing.length + 1, draft?.comment);
    load();
    // Flash feedback
    setFlashId(exerciseId);
    setTimeout(() => setFlashId(null), 600);
    // Start rest timer
    setTimerKey(k => k + 1);
    setTimerVisible(true);
  }

  function handleDeleteSet(id: number) {
    Alert.alert('Delete set?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteSet(id); load(); } },
    ]);
  }

  function toggleCollapse(exId: number) {
    setCollapsed(prev => ({ ...prev, [exId]: !prev[exId] }));
  }

  async function finishWorkout() {
    const workouts = getWorkouts();
    const w = workouts.find(w => w.id === Number(workoutId));
    if (w) await saveLastSessionTime(Number(sessionId), w.id, w.name, w.is_cardio);
    router.replace('/');
  }

  const liftWorkouts = data;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#aaa" />
        </TouchableOpacity>
        <ElapsedClock startTime={startTime.current} />
        <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      {/* ── Floating timer (sits between chip bar and scroll) ── */}
      {timerVisible && (
        <FloatingTimer timerKey={timerKey} onDismiss={() => setTimerVisible(false)} />
      )}

      {/* ── Exercise cards ── */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {data.map(({ exercise, sets }, idx) => {
          const draft      = drafts[exercise.id] ?? { weight: '0', reps: '1', comment: '' };
          const weightVal  = parseFloat(draft.weight) || 0;
          const repsVal    = parseInt(draft.reps)     || 1;
          const isCollapsed= !!collapsed[exercise.id] && sets.length > 0;
          const isFlashing = flashId === exercise.id;

          return (
            <View
              key={exercise.id}
            >
              <View style={[styles.exerciseCard, isFlashing && styles.exerciseCardFlash]}>

                {/* Card header */}
                <TouchableOpacity
                  style={styles.exerciseHeader}
                  onPress={() => { setActiveExIdx(idx); toggleCollapse(exercise.id); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.exerciseTitleRow}>
                    <View style={[styles.exIndex, sets.length > 0 && styles.exIndexDone]}>
                      {sets.length > 0
                        ? <Ionicons name="checkmark" size={12} color="#fff" />
                        : <Text style={styles.exIndexText}>{idx + 1}</Text>
                      }
                    </View>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                  </View>
                  <View style={styles.exerciseHeaderRight}>
                    {sets.length > 0 && (
                      <Text style={styles.setCount}>{sets.length} set{sets.length !== 1 ? 's' : ''}</Text>
                    )}
                    <Ionicons
                      name={isCollapsed ? 'chevron-down' : 'chevron-up'}
                      size={16} color="#444"
                    />
                  </View>
                </TouchableOpacity>

                {!isCollapsed && (
                  <>
                    {/* Sets table */}
                    {sets.length > 0 && (
                      <View style={styles.setsTable}>
                        <View style={styles.tableHeader}>
                          <Text style={[styles.tableHead, { width: 28 }]}>#</Text>
                          <Text style={[styles.tableHead, { flex: 1 }]}>WEIGHT</Text>
                          <Text style={[styles.tableHead, { flex: 1 }]}>REPS</Text>
                          <Text style={[styles.tableHead, { flex: 1.5 }]}>NOTE</Text>
                        </View>
                        {sets.map(s => (
                          <SwipeableSetRow
                            key={s.id}
                            s={s}
                            onDelete={() => handleDeleteSet(s.id)}
                          />
                        ))}
                      </View>
                    )}

                    {/* Pickers */}
                    <View style={styles.pickerRow}>
                      <View style={styles.pickerGroup}>
                        <Text style={styles.pickerLabel}>WEIGHT</Text>
                        <ScrollPicker
                          values={WEIGHT_OPTIONS} selected={weightVal}
                          onSelect={v => setDraftNum(exercise.id, 'weight', v)}
                          label="Weight" unit="kg"
                        />
                      </View>
                      <View style={styles.pickerGroup}>
                        <Text style={styles.pickerLabel}>REPS</Text>
                        <ScrollPicker
                          values={REPS_OPTIONS} selected={repsVal}
                          onSelect={v => setDraftNum(exercise.id, 'reps', v)}
                          label="Reps" unit=""
                        />
                      </View>
                    </View>

                    <TextInput
                      style={styles.commentInput}
                      value={draft.comment}
                      onChangeText={v => setDraftField(exercise.id, 'comment', v)}
                      placeholder="Note (optional)"
                      placeholderTextColor="#333"
                    />

                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopyLast(exercise.id)}>
                        <Ionicons name="copy-outline" size={14} color="#555" />
                        <Text style={styles.copyText}>Copy last</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.addSetBtn} onPress={() => handleAddSet(exercise.id)}>
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

        <TouchableOpacity style={styles.bigFinish} onPress={finishWorkout}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.bigFinishText}>Finish Workout</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Swipeable styles ─────────────────────────────────────────────────────────

const swipeStyles = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 2, overflow: 'hidden', borderRadius: 8 },
  deleteZone: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: 64,
    backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', borderRadius: 8,
  },
  row: { backgroundColor: '#000' },
  rowInner: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: '#0a0a0a', borderRadius: 8,
  },
  setNum: { color: '#6C63FF', fontWeight: '700', fontSize: 13, width: 20, textAlign: 'center', marginRight: 8 },
  cell:   { flex: 1, color: '#aaa', fontSize: 14 },
  note:   { color: '#444', fontSize: 13, fontStyle: 'italic', flex: 1.5 },
});

// ─── Picker styles ────────────────────────────────────────────────────────────

const pickerStyles = StyleSheet.create({
  trigger: {
    backgroundColor: '#000', borderRadius: 10, borderWidth: 1, borderColor: '#1e1e32',
    paddingVertical: 14, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  value: { color: '#fff', fontSize: 22, fontWeight: '700' },
  unit:  { color: '#444', fontSize: 13, marginTop: 3 },
  overlay: { flex: 1, backgroundColor: '#000000cc', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d0d16', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '70%', borderTopWidth: 1, borderColor: '#1e1e32',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  tabs:  { flexDirection: 'row', backgroundColor: '#000', borderRadius: 8, padding: 4, marginBottom: 12 },
  tab:   { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText: { color: '#444', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { maxHeight: 260 },
  item: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  itemSel: { backgroundColor: '#0d0d1f' },
  itemText: { color: '#444', fontSize: 18 },
  itemTextSel: { color: '#6C63FF', fontWeight: '700', fontSize: 22 },
  manualWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  manualInput: {
    backgroundColor: '#000', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 28, fontWeight: '700', textAlign: 'center',
    borderWidth: 1, borderColor: '#1e1e32', width: 140,
  },
  manualUnit: { color: '#555', fontSize: 18 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn:  { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#0d0d16', alignItems: 'center', borderWidth: 1, borderColor: '#1e1e32' },
  cancelText: { color: '#666', fontWeight: '600' },
  confirmBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#6C63FF', alignItems: 'center' },
  confirmText:{ color: '#fff', fontWeight: '600' },
});

// ─── Floating timer styles ────────────────────────────────────────────────────

const floatStyles = StyleSheet.create({
  wrapper: { backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#0d0d1a' },
  panel: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    borderBottomWidth: 1, borderBottomColor: '#0d0d1a',
  },
  presets: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  preset: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
    backgroundColor: '#0d0d16', borderWidth: 1, borderColor: '#1e1e32',
  },
  presetActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  presetText: { color: '#444', fontSize: 13, fontWeight: '600' },
  presetTextActive: { color: '#fff' },
  vibRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  vibText: { color: '#6C63FF', fontSize: 13, fontWeight: '600' },
  vibOff: { color: '#444' },
  // Pill
  pillRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  pill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    borderWidth: 1, backgroundColor: '#000', overflow: 'hidden', position: 'relative',
  },
  pillProgress: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 24 },
  pillTime: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: 0.5 },
  chevron: { padding: 2 },
  dismissBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#0d0d16', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#1e1e32',
  },
});

// ─── Main styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
    backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#0d0d1a',
  },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  elapsedText: { color: '#555', fontSize: 16, fontWeight: '700', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  finishBtn: { backgroundColor: '#22c55e', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Cards
  scroll: { padding: 12, paddingBottom: 60 },
  exerciseCard: {
    backgroundColor: '#0a0a0a', borderRadius: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#111',
    overflow: 'hidden',
  },
  exerciseCardFlash: { borderColor: '#22c55e55', backgroundColor: '#001a0a' },

  exerciseHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 13,
  },
  exerciseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  exIndex: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#1a1a2a',
    alignItems: 'center', justifyContent: 'center',
  },
  exIndexDone: { backgroundColor: '#22c55e' },
  exIndexText: { color: '#6C63FF', fontSize: 11, fontWeight: '700' },
  exerciseName: { color: '#e8e8ff', fontSize: 14, fontWeight: '700', flex: 1 },
  exerciseHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setCount: { color: '#444', fontSize: 12 },

  // Sets table
  setsTable: {
    marginHorizontal: 14, marginBottom: 12,
    borderRadius: 10, overflow: 'hidden', backgroundColor: '#000',
    borderWidth: 1, borderColor: '#111',
  },
  tableHeader: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  tableHead: { color: '#2a2a2a', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  // Pickers
  pickerRow:   { flexDirection: 'row', gap: 10, paddingHorizontal: 14, marginBottom: 10 },
  pickerGroup: { flex: 1 },
  pickerLabel: { color: '#333', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },

  // Comment
  commentInput: {
    marginHorizontal: 14, backgroundColor: '#000', color: '#888', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
    borderWidth: 1, borderColor: '#111', marginBottom: 10,
  },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#000', borderWidth: 1, borderColor: '#1a1a1a',
  },
  copyText:   { color: '#444', fontWeight: '600', fontSize: 13 },
  addSetBtn:  {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: '#6C63FF',
  },
  addSetText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Finish
  bigFinish: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 14, marginTop: 4,
    backgroundColor: '#0d1f12', borderWidth: 1, borderColor: '#1a3a22',
  },
  bigFinishText: { color: '#22c55e', fontWeight: '700', fontSize: 16 },
});
