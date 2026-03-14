import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FONT } from '@/src/theme';
import {
  getWorkouts, getRoutine, getRoutineDays, createRoutine, deleteRoutine,
  updateRoutineProgress, getRoutineProgress, clearRoutineProgress,
  pauseRoutine, resumeRoutine, isRoutinePaused,
  Routine, RoutineDay, RoutineType, Workout,
} from '@/src/db';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
// DB stores 0=Sun..6=Sat, our UI shows Mon-Sun so map accordingly
const UI_TO_DB_DOW = [1, 2, 3, 4, 5, 6, 0]; // UI index → DB day_of_week

type DraftDay = {
  workout_id: number | null;
  is_rest: boolean;
  day_of_week: number | null;
};

// Weekly draft is always exactly 7 entries, one per day Mon-Sun
function emptyWeeklyDraft(): DraftDay[] {
  return DAYS_OF_WEEK.map((_, i) => ({
    workout_id: null,
    is_rest: false,
    day_of_week: UI_TO_DB_DOW[i],
  }));
}

export default function RoutineScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in Routine.">
      <RoutineScreenInner />
    </ErrorBoundary>
  );
}

function RoutineScreenInner() {
  const t      = useTheme();
  const router = useRouter();

  const [workouts,  setWorkouts]  = useState<Workout[]>([]);
  const [routine,   setRoutine]   = useState<Routine | null>(null);
  const [days,      setDays]      = useState<(RoutineDay & { workout_name?: string })[]>([]);
  const [progress,  setProgress]  = useState(0);
  const [paused,    setPaused]    = useState(false);

  // Builder state
  const [editing,   setEditing]   = useState(false);
  const [name,      setName]      = useState('My Routine');
  const [type,      setType]      = useState<RoutineType>('repeating');
  const [draftDays, setDraftDays] = useState<DraftDay[]>([]);

  // Workout picker — lifted OUT of ScrollView to avoid ReactFabric crash
  const [pickerIdx,     setPickerIdx]     = useState<number | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const load = useCallback(async () => {
    setWorkouts(getWorkouts().filter(w => !w.is_cardio));
    const r = getRoutine();
    setRoutine(r);
    if (r) {
      setDays(getRoutineDays(r.id));
      setProgress(await getRoutineProgress());
      setPaused(await isRoutinePaused());
    }
  }, []);

  useEffect(() => { load(); }, []);

  // ── Draft helpers ────────────────────────────────────────────────────────────

  function startNew() {
    setName('My Routine');
    setType('repeating');
    setDraftDays([
      { workout_id: null, is_rest: false, day_of_week: null },
      { workout_id: null, is_rest: false, day_of_week: null },
    ]);
    setEditing(true);
  }

  function addDraftDay() {
    setDraftDays(prev => [...prev, { workout_id: null, is_rest: false, day_of_week: null }]);
  }

  function removeDraftDay(i: number) {
    setDraftDays(prev => prev.filter((_, idx) => idx !== i));
  }

  function openPicker(i: number) {
    setPickerIdx(i);
    setPickerVisible(true);
  }

  function setDraftDayWorkout(workoutId: number | null) {
    if (pickerIdx === null) return;
    setDraftDays(prev => prev.map((d, idx) =>
      idx === pickerIdx ? { ...d, workout_id: workoutId, is_rest: false } : d
    ));
    setPickerVisible(false);
    setPickerIdx(null);
  }

  function toggleDraftRest(i: number) {
    setDraftDays(prev => prev.map((d, idx) =>
      idx === i ? { ...d, is_rest: !d.is_rest, workout_id: d.is_rest ? d.workout_id : null } : d
    ));
  }

  function switchType(newType: RoutineType) {
    setType(newType);
    if (newType === 'weekly') {
      setDraftDays(emptyWeeklyDraft());
    } else {
      setDraftDays([
        { workout_id: null, is_rest: false, day_of_week: null },
        { workout_id: null, is_rest: false, day_of_week: null },
      ]);
    }
  }

  function save() {
    if (!name.trim()) { Alert.alert('Name required', 'Give your routine a name.'); return; }
    const hasWorkout = draftDays.some(d => !d.is_rest && d.workout_id);
    if (!hasWorkout) { Alert.alert('No workouts', 'Add at least one workout day.'); return; }
    if (type === 'repeating' && draftDays.length < 2) {
      Alert.alert('Too short', 'Add at least 2 days to a repeating routine.'); return;
    }

    createRoutine(name.trim(), type, draftDays.map((d, i) => ({
      day_index:   i,
      workout_id:  d.workout_id,
      is_rest:     d.is_rest ? 1 : 0,
      day_of_week: d.day_of_week,
    })));
    clearRoutineProgress();
    setEditing(false);
    load();
  }

  function handleDelete() {
    Alert.alert('Cancel routine?', 'Your progress will be lost.', [
      { text: 'Keep routine', style: 'cancel' },
      { text: 'Cancel routine', style: 'destructive', onPress: () => {
          deleteRoutine();
          clearRoutineProgress();
          setRoutine(null);
          setDays([]);
          router.replace('/');
        }
      },
    ]);
  }

  async function jumpToDay(dayIndex: number) {
    await updateRoutineProgress(dayIndex);
    setProgress(dayIndex);
  }

  // ── Workout picker modal (at root level — NOT inside ScrollView) ──────────────

  function WorkoutPicker() {
    return (
      <Modal visible={pickerVisible} transparent animationType="slide" statusBarTranslucent>
        <View style={ps.root}>
          <TouchableOpacity style={ps.backdrop} activeOpacity={1} onPress={() => { setPickerVisible(false); setPickerIdx(null); }} />
          <View style={[ps.box, { backgroundColor: t.bgSheet, borderColor: t.borderSheet }]}>
            <View style={[ps.handle, { backgroundColor: t.borderMid }]} />
            <Text style={[ps.title, { color: t.textPrimary }]}>Select Workout</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
              {workouts.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[ps.item, { borderColor: t.border }]}
                  onPress={() => setDraftDayWorkout(w.id)}
                >
                  <Text style={[ps.itemText, { color: t.textPrimary }]}>{w.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[ps.item, { borderColor: t.border }]}
                onPress={() => setDraftDayWorkout(null)}
              >
                <Ionicons name="help-circle-outline" size={16} color={t.textMuted} style={{ marginRight: 8 }} />
                <Text style={[ps.itemText, { color: t.textMuted }]}>Choose on the day</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Active routine view ──────────────────────────────────────────────────────

  if (routine && !editing) {
    const totalDays  = days.length;
    const currentDay = progress % totalDays;
    const curDay     = days[currentDay];

    return (
      <View style={[s.container, { backgroundColor: t.bg }]}>
        <AppHeader title="Routine" />
        <WorkoutPicker />
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Text style={[s.routineName, { color: t.textPrimary }]}>{routine.name}</Text>
            <Text style={[s.routineMeta, { color: t.textMuted }]}>
              {routine.type === 'repeating' ? `${totalDays}-day repeating` : 'Weekly schedule'}
              {'  ·  Day '}{currentDay + 1}{' of '}{totalDays}
            </Text>
            <View style={[s.todayBox, { backgroundColor: t.purpleBg, borderColor: t.purple + '44' }]}>
              <Text style={[s.todayLabel, { color: paused ? t.orange : t.purple }]}>{paused ? '⏸ PAUSED' : 'TODAY'}</Text>
              <Text style={[s.todayName, { color: t.textPrimary }]}>
                {curDay?.is_rest ? '😴  Rest Day' : (curDay?.workout_name ?? 'Choose your workout')}
              </Text>
            </View>
          </View>

          <Text style={[s.sectionLabel, { color: t.textFaint }]}>SCHEDULE</Text>
          {days.map((d, i) => {
            const isCur = i === currentDay;
            const label = routine.type === 'weekly'
              ? DAYS_OF_WEEK[UI_TO_DB_DOW.indexOf(d.day_of_week ?? 1)] ?? `Day ${i + 1}`
              : `Day ${i + 1}`;
            return (
              <TouchableOpacity key={i}
                style={[s.dayRow, { backgroundColor: t.bgCard, borderColor: isCur ? t.purple : t.border },
                  isCur && { borderWidth: 1.5 }]}
                onPress={() => jumpToDay(i)}
              >
                <View style={[s.dayNum, { backgroundColor: isCur ? t.purple : t.borderMid }]}>
                  <Text style={[s.dayNumText, { color: isCur ? '#fff' : t.textMuted }]}>{label}</Text>
                </View>
                <Text style={[s.dayName, { color: d.is_rest ? t.textMuted : t.textPrimary }]}>
                  {d.is_rest ? '😴  Rest' : (d.workout_name ?? '— Choose —')}
                </Text>
                {isCur && <Ionicons name="play-circle" size={18} color={t.purple} />}
              </TouchableOpacity>
            );
          })}

          <View style={s.actionRow}>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.bgCard, borderColor: paused ? t.green + '55' : t.orange + '55' }]}
              onPress={async () => {
                if (paused) { await resumeRoutine(); setPaused(false); }
                else { await pauseRoutine(); setPaused(true); }
              }}
            >
              <Ionicons name={paused ? 'play-circle-outline' : 'pause-circle-outline'} size={18} color={paused ? t.green : t.orange} />
              <Text style={[s.actionBtnText, { color: paused ? t.green : t.orange }]}>{paused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
              onPress={() => {
                setName(routine.name);
                setType(routine.type);
                if (routine.type === 'weekly') {
                  // Reconstruct weekly draft from saved days
                  const draft = emptyWeeklyDraft();
                  days.forEach(d => {
                    const uiIdx = UI_TO_DB_DOW.indexOf(d.day_of_week ?? 1);
                    if (uiIdx >= 0) draft[uiIdx] = { workout_id: d.workout_id, is_rest: !!d.is_rest, day_of_week: d.day_of_week };
                  });
                  setDraftDays(draft);
                } else {
                  setDraftDays(days.map(d => ({ workout_id: d.workout_id, is_rest: !!d.is_rest, day_of_week: d.day_of_week })));
                }
                setEditing(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color={t.purple} />
              <Text style={[s.actionBtnText, { color: t.purple }]}>Edit Routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.actionBtn, { backgroundColor: t.bgCard, borderColor: t.redDim }]}
              onPress={handleDelete}
            >
              <Ionicons name="close-circle-outline" size={18} color={t.red} />
              <Text style={[s.actionBtnText, { color: t.red }]}>Cancel Routine</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Builder ──────────────────────────────────────────────────────────────────

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <AppHeader title={routine ? 'Edit Routine' : 'Create Routine'} />

      {/* Picker modal is at root level — outside ScrollView — to avoid ReactFabric crash */}
      <WorkoutPicker />

      {!editing ? (
        <View style={s.empty}>
          <Text style={s.emptyEmoji}>🗓️</Text>
          <Text style={[s.emptyTitle, { color: t.textPrimary }]}>No active routine</Text>
          <Text style={[s.emptySub, { color: t.textMuted }]}>
            A routine repeats a sequence of workouts automatically so you always know what's next.
          </Text>
          <TouchableOpacity style={[s.createBtn, { backgroundColor: t.purple }]} onPress={startNew}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={s.createBtnText}>Create Routine</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

            {/* Name */}
            <Text style={[s.fieldLabel, { color: t.textMuted }]}>ROUTINE NAME</Text>
            <TextInput
              style={[s.nameInput, { backgroundColor: t.bgInput, color: t.textPrimary, borderColor: t.borderMid }]}
              value={name} onChangeText={setName}
              placeholder="e.g. Push Pull Legs"
              placeholderTextColor={t.textFaint}
            />

            {/* Type toggle */}
            <Text style={[s.fieldLabel, { color: t.textMuted }]}>TYPE</Text>
            <View style={[s.typeToggle, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              {(['repeating', 'weekly'] as RoutineType[]).map(tp => (
                <TouchableOpacity
                  key={tp}
                  style={[s.typeBtn, type === tp && { backgroundColor: t.purple }]}
                  onPress={() => switchType(tp)}
                >
                  <Text style={[s.typeBtnText, { color: type === tp ? '#fff' : t.textMuted }]}>
                    {tp === 'repeating' ? '🔁  Repeating' : '📅  Weekly'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[s.typeHint, { color: t.textFaint }]}>
              {type === 'repeating'
                ? 'Loops through your workouts in order, one per day.'
                : 'Assigns a workout to each day of the week.'}
            </Text>

            {/* Days */}
            <Text style={[s.fieldLabel, { color: t.textMuted }]}>
              {type === 'weekly' ? 'WEEKLY SCHEDULE' : 'DAYS'}
            </Text>

            {type === 'weekly' ? (
              // Fixed Mon–Sun layout
              draftDays.map((d, i) => (
                <View key={i} style={[s.draftDay, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                  <View style={[s.dayLabelBox, { backgroundColor: t.borderMid }]}>
                    <Text style={[s.dayLabelText, { color: t.textMuted }]}>{DAYS_OF_WEEK[i].slice(0, 3)}</Text>
                  </View>

                  {d.is_rest ? (
                    <Text style={[s.restLabel, { color: t.textMuted, flex: 1 }]}>😴  Rest day</Text>
                  ) : (
                    <TouchableOpacity
                      style={[s.workoutSelector, { borderColor: t.borderMid, backgroundColor: t.bgInput }]}
                      onPress={() => openPicker(i)}
                    >
                      <Text style={{ color: d.workout_id ? t.textPrimary : t.textFaint, fontSize: FONT.md, flex: 1 }} numberOfLines={1}>
                        {d.workout_id ? (workouts.find(w => w.id === d.workout_id)?.name ?? 'Select') : 'Choose workout…'}
                      </Text>
                      <Ionicons name="chevron-down" size={14} color={t.textMuted} />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[s.restToggle, { borderColor: d.is_rest ? t.orange : t.border }]}
                    onPress={() => toggleDraftRest(i)}
                  >
                    <Text style={{ color: d.is_rest ? t.orange : t.textMuted, fontSize: FONT.xs, fontWeight: '600' }}>
                      {d.is_rest ? 'Active' : 'Rest'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))
            ) : (
              // Repeating — dynamic list
              <>
                {draftDays.map((d, i) => (
                  <View key={i} style={[s.draftDay, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                    <View style={[s.dayNumSm, { backgroundColor: t.borderMid }]}>
                      <Text style={[s.dayNumSmText, { color: t.textMuted }]}>{i + 1}</Text>
                    </View>

                    {d.is_rest ? (
                      <Text style={[s.restLabel, { color: t.textMuted, flex: 1 }]}>😴  Rest day</Text>
                    ) : (
                      <TouchableOpacity
                        style={[s.workoutSelector, { borderColor: t.borderMid, backgroundColor: t.bgInput }]}
                        onPress={() => openPicker(i)}
                      >
                        <Text style={{ color: d.workout_id ? t.textPrimary : t.textFaint, fontSize: FONT.md, flex: 1 }} numberOfLines={1}>
                          {d.workout_id ? (workouts.find(w => w.id === d.workout_id)?.name ?? 'Select') : 'Choose workout…'}
                        </Text>
                        <Ionicons name="chevron-down" size={14} color={t.textMuted} />
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[s.restToggle, { borderColor: d.is_rest ? t.orange : t.border }]}
                      onPress={() => toggleDraftRest(i)}
                    >
                      <Text style={{ color: d.is_rest ? t.orange : t.textMuted, fontSize: FONT.xs, fontWeight: '600' }}>
                        {d.is_rest ? 'Active' : 'Rest'}
                      </Text>
                    </TouchableOpacity>

                    {draftDays.length > 2 && (
                      <TouchableOpacity onPress={() => removeDraftDay(i)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color={t.textFaint} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                <TouchableOpacity style={[s.addDayBtn, { borderColor: t.borderMid }]} onPress={addDraftDay}>
                  <Ionicons name="add" size={18} color={t.purple} />
                  <Text style={[s.addDayBtnText, { color: t.purple }]}>Add Day</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Save / Cancel */}
            <View style={s.builderActions}>
              <TouchableOpacity style={[s.saveBtn, { backgroundColor: t.purple }]} onPress={save}>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={s.saveBtnText}>Save Routine</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.cancelBtn, { backgroundColor: t.bgCard, borderColor: t.border }]}
                onPress={() => { setEditing(false); load(); }}
              >
                <Text style={[s.cancelBtnText, { color: t.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { padding: 16 },

  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: { fontSize: 22, fontWeight: '800' },
  emptySub:   { fontSize: FONT.md, textAlign: 'center', lineHeight: 22 },
  createBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT.lg },

  card:        { borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1 },
  routineName: { fontSize: FONT['3xl'], fontWeight: '800', marginBottom: 4 },
  routineMeta: { fontSize: FONT.base, marginBottom: 16 },
  todayBox:    { borderRadius: 12, padding: 14, borderWidth: 1 },
  todayLabel:  { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  todayName:   { fontSize: FONT['2xl'], fontWeight: '700' },

  sectionLabel: { fontSize: FONT.sm, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8, marginTop: 4 },
  dayRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1,
  },
  dayNum:     { minWidth: 48, paddingHorizontal: 6, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  dayNumText: { fontSize: FONT.xs, fontWeight: '700' },
  dayName:    { flex: 1, fontSize: FONT.md, fontWeight: '600' },

  actionRow:     { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionBtn:     { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontWeight: '700', fontSize: FONT.base },

  fieldLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  nameInput:  { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: FONT.lg, borderWidth: 1, marginBottom: 4 },
  typeToggle: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: 1, gap: 4, marginBottom: 4 },
  typeBtn:    { flex: 1, padding: 10, borderRadius: 9, alignItems: 'center' },
  typeBtnText:{ fontWeight: '700', fontSize: FONT.base },
  typeHint:   { fontSize: FONT.base, lineHeight: 18, marginBottom: 4 },

  draftDay: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, padding: 10, marginBottom: 6, borderWidth: 1,
  },
  dayLabelBox:    { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dayLabelText:   { fontSize: FONT.xs, fontWeight: '800', letterSpacing: 0.5 },
  dayNumSm:       { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dayNumSmText:   { fontSize: FONT.xs, fontWeight: '700' },
  workoutSelector:{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1 },
  restLabel:      { fontSize: FONT.md },
  restToggle:     { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, borderWidth: 1, flexShrink: 0 },

  addDayBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginBottom: 16 },
  addDayBtnText: { fontWeight: '700', fontSize: FONT.base },

  builderActions:{ gap: 10, marginTop: 8 },
  saveBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14 },
  saveBtnText:   { color: '#fff', fontWeight: '700', fontSize: FONT.lg },
  cancelBtn:     { alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1 },
  cancelBtnText: { fontWeight: '600', fontSize: FONT.md },
});

const ps = StyleSheet.create({
  root:     { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)' },
  box:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8, borderTopWidth: 1 },
  handle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:    { fontSize: FONT['2xl'], fontWeight: '700', marginBottom: 12 },
  item:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, borderTopWidth: 1 },
  itemText: { fontSize: FONT.lg, fontWeight: '500' },
});
