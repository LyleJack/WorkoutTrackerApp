import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, ScrollView, Dimensions, Modal, KeyboardAvoidingView, Platform,
  Animated, AppState, AppStateStatus,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getWorkouts, addWorkout, createSession, addExercise,
  getRecentSession, clearLastSession, getLastSessionSummary,
  getRoutine, getRoutineDays, getTodayRoutineWorkout, updateRoutineProgress,
  deleteRoutine, clearRoutineProgress, hasWorkoutToday, getTotalWorkouts,
  checkMilestone, getFirstSessionDate, pauseRoutine, resumeRoutine, isRoutinePaused,
  Workout, Routine,
} from '@/src/db';
import { WorkoutIcon, getWorkoutIcon } from '@/src/WorkoutIcons';
import { AppHeader } from '@/app/_layout';
import { useTheme, FONT } from '@/src/theme';

const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP  = 12;
const CARD_W    = (SCREEN_W - 32 - CARD_GAP) / 2;

const TEMPLATES = [
  { name: 'Chest',     exercises: ['Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Push Ups'] },
  { name: 'Back',      exercises: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Lat Pulldown'] },
  { name: 'Legs',      exercises: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curl'] },
  { name: 'Shoulders', exercises: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pull'] },
  { name: 'Arms',      exercises: ['Barbell Curl', 'Tricep Dip', 'Hammer Curl', 'Skull Crusher'] },
  { name: 'Full Body', exercises: ['Squat', 'Bench Press', 'Deadlift', 'Pull Ups'] },
  { name: 'Push',      exercises: ['Bench Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown'] },
  { name: 'Pull',      exercises: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Bicep Curl'] },
];

// ── Reusable bottom-sheet action modal ────────────────────────────────────────

function ActionSheet({
  visible, title, subtitle, actions, onDismiss,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: { label: string; sub?: string; icon: string; color?: string; onPress: () => void }[];
  onDismiss: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={[sh.overlay]}>
        <TouchableOpacity style={sh.backdrop} activeOpacity={1} onPress={onDismiss} />
        <View style={[sh.box, { backgroundColor: t.bgSheet, borderColor: t.borderMid }]}>
          <View style={[sh.handle, { backgroundColor: t.borderMid }]} />
          <Text style={[sh.title, { color: t.textPrimary }]}>{title}</Text>
          {subtitle ? <Text style={[sh.sub, { color: t.textMuted }]}>{subtitle}</Text> : null}
          <View style={sh.actions}>
            {actions.map((a, i) => (
              <TouchableOpacity key={i} style={[sh.action, { backgroundColor: t.bgCard, borderColor: t.borderMid }]}
                onPress={() => { onDismiss(); a.onPress(); }}>
                <View style={[sh.actionIcon, { backgroundColor: (a.color ?? t.purple) + '22' }]}>
                  <Ionicons name={a.icon as any} size={20} color={a.color ?? t.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[sh.actionLabel, { color: t.textPrimary }]}>{a.label}</Text>
                  {a.sub ? <Text style={[sh.actionSub, { color: t.textMuted }]}>{a.sub}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Workout card last-session summary ─────────────────────────────────────────

function WorkoutCardSummary({ workoutId }: { workoutId: number }) {
  const t = useTheme();
  const summary = getLastSessionSummary(workoutId);
  if (!summary) return <Text style={[styles.cardSummaryNone, { color: t.textDead }]}>No sessions yet</Text>;
  const dayLabel = summary.daysAgo === 0 ? 'Today' : summary.daysAgo === 1 ? 'Yesterday' : `${summary.daysAgo}d ago`;
  return <Text style={[styles.cardSummary, { color: t.textFaint }]} numberOfLines={1}>{dayLabel} · {summary.totalSets} sets</Text>;
}


// ── Milestone banner ───────────────────────────────────────────────────────────
function MilestoneBanner({ message, onHide }: { message: string; onHide: () => void }) {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(opacity, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => onHide());
  }, []);

  return (
    <Animated.View style={[mb.banner, { backgroundColor: t.purple, opacity }]}>
      <Text style={mb.text}>{message}</Text>
    </Animated.View>
  );
}

const mb = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
    paddingVertical: 14, paddingHorizontal: 20,
    alignItems: 'center', elevation: 20,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: FONT.md, textAlign: 'center' },
});

// ── Home screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router  = useRouter();
  const t       = useTheme();

  const [workouts,  setWorkouts]  = useState<Workout[]>([]);
  const [routine,   setRoutine]   = useState<Routine | null>(null);
  const [todayInfo, setTodayInfo] = useState<{ workout: Workout | null; isRest: boolean; dayIndex: number; totalDays: number } | null>(null);
  const [mode,      setMode]      = useState<'grid' | 'new' | 'template'>('grid');
  const [newName,   setNewName]   = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [templateExercises, setTemplateExercises] = useState<string[]>([]);
  const [newExercise, setNewExercise] = useState('');

  // Modal states
  const [resumeModal,    setResumeModal]    = useState(false);
  const [pendingWorkout, setPendingWorkout] = useState<{ w: Workout; sessionId: number } | null>(null);
  const [routineModal,   setRoutineModal]   = useState(false);
  const [differentModal,  setDifferentModal]  = useState(false);
  const [pendingDifferent, setPendingDifferent] = useState<Workout | null>(null);

  // Pause + milestone state
  const [routinePaused,   setRoutinePaused]   = useState(false);
  const [milestoneMsg,    setMilestoneMsg]     = useState<string | null>(null);
  // True only while the app is coming from background/inactive → active (cold open or foreground).
  // Stays false when merely switching tabs, so auto-nav doesn't fire on tab changes.
  const appStateRef      = useRef<AppStateStatus>(AppState.currentState);
  const didColdOpenRef   = useRef(true);   // true on very first mount
  const hasAutoNavRef    = useRef(false);  // prevent double-fire within one open

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if ((prev === 'background' || prev === 'inactive') && next === 'active') {
        // App came to foreground — allow one auto-nav
        didColdOpenRef.current = true;
        hasAutoNavRef.current  = false;
      }
      if (next === 'background' || next === 'inactive') {
        // App went to background — reset so next foreground counts as cold open
        didColdOpenRef.current = false;
      }
    });
    return () => sub.remove();
  }, []);

  const load = useCallback(async () => {
    setWorkouts(getWorkouts());
    const r = getRoutine();
    setRoutine(r);
    if (r) {
      const info = await getTodayRoutineWorkout();
      setTodayInfo(info);
      const paused = await isRoutinePaused();
      setRoutinePaused(paused);
    } else {
      setTodayInfo(null);
      setRoutinePaused(false);
    }
    // Check calendar anniversary milestone on every app open
    const firstDate = getFirstSessionDate();
    if (firstDate) {
      const first = new Date(firstDate);
      const today = new Date();
      if (
        today.getMonth()    === first.getMonth() &&
        today.getDate()     === first.getDate()  &&
        today.getFullYear()  >  first.getFullYear()
      ) {
        const years = today.getFullYear() - first.getFullYear();
        const labels: Record<number, string> = {
          1:  "1 year of training — happy anniversary! 🎂",
          2:  "2 years of showing up 🎂🎂",
          3:  "3 years strong 🎂🎂🎂",
          4:  "4 years — incredible commitment 🎂🎂🎂🎂",
          5:  "5 years of training! Half a decade 🎆",
          6:  "6 years — elite dedication 🌟",
          7:  "7 years of lifting — legendary 👑",
          8:  "8 years strong 🦾",
          9:  "9 years — almost a decade!",
          10: "10 years of training! A full decade 🏆🌍",
          15: "15 years — a way of life 🗿",
          20: "20 years of training! Truly iconic 🌠",
        };
        const msg = labels[years] ?? `${years} year${years !== 1 ? "s" : ""} of training! 🎂`;
        setMilestoneMsg(msg);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  // Auto-navigate only on cold app open (not tab switches)
  useEffect(() => {
    if (!routine || !todayInfo || routinePaused) return;
    if (!didColdOpenRef.current || hasAutoNavRef.current) return;
    if (todayInfo.isRest || !todayInfo.workout) return;
    if (hasWorkoutToday()) return;
    hasAutoNavRef.current  = true;
    didColdOpenRef.current = false;
    startWorkout(todayInfo.workout);
  }, [routine, todayInfo, routinePaused]);

  // ── Navigation helpers ──────────────────────────────────────────────────────

  async function startWorkout(w: Workout) {
    if (w.is_cardio) {
      const sessionId = createSession(w.id);
      router.push(`/workout/cardio/${sessionId}`);
      return;
    }
    const recent = await getRecentSession();
    if (recent && !recent.is_cardio) {
      if (!recent.finished) {
        if (recent.workout_id === w.id) {
          // Same workout mid-session → auto-resume
          router.push(`/workout/log/${recent.session_id}?workoutId=${w.id}`);
          return;
        } else {
          // Different workout — ask what to do with the old one
          setPendingWorkout({ w: workouts.find(x => x.id === recent.workout_id) ?? w, sessionId: recent.session_id });
          setPendingDifferent(w);
          setDifferentModal(true);
          return;
        }
      }
      if (recent.workout_id === w.id && recent.finished) {
        // Same workout finished recently — offer new/edit
        setPendingWorkout({ w, sessionId: recent.session_id });
        setResumeModal(true);
        return;
      }
    }
    const sessionId = createSession(w.id);
    // Check milestone after creating the session
    const total = getTotalWorkouts();
    const msg   = checkMilestone(total);
    if (msg) setMilestoneMsg(msg);
    router.push(`/workout/log/${sessionId}?workoutId=${w.id}`);
  }

  async function handlePress(w: Workout) {
    // If a routine is active and user taps a DIFFERENT workout than today's routine workout
    if (routine && todayInfo && !todayInfo.isRest && todayInfo.workout && todayInfo.workout.id !== w.id && !w.is_cardio) {
      setPendingDifferent(w);
      setDifferentModal(true);
      return;
    }
    await startWorkout(w);
  }

  function handleRoutineWorkoutStart() {
    if (!todayInfo?.workout) return;
    startWorkout(todayInfo.workout);
  }

  // After a routine workout finishes we'll advance the day via the log screen calling back
  async function advanceRoutine() {
    if (!todayInfo || !routine) return;
    const next = (todayInfo.dayIndex + 1);
    updateRoutineProgress(next);
  }

  // ── Create workout ──────────────────────────────────────────────────────────

  function handleCreateBlank() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addWorkout(trimmed);
    setNewName('');
    setMode('grid');
    load();
  }

  function pickTemplate(t: typeof TEMPLATES[0]) {
    setSelectedTemplate(t);
    setTemplateExercises([...t.exercises]);
    setMode('template');
  }

  function removeTemplateExercise(i: number) {
    setTemplateExercises(prev => prev.filter((_, idx) => idx !== i));
  }

  function addTemplateExercise() {
    const trimmed = newExercise.trim();
    if (!trimmed) return;
    setTemplateExercises(prev => [...prev, trimmed]);
    setNewExercise('');
  }

  function createFromTemplate() {
    if (!selectedTemplate) return;
    const name = newName.trim() || selectedTemplate.name;
    const id   = addWorkout(name);
    templateExercises.forEach(e => addExercise(id, e));
    setMode('grid');
    setNewName('');
    setSelectedTemplate(null);
    load();
    const sessionId = createSession(id);
    router.push(`/workout/log/${sessionId}?workoutId=${id}`);
  }

  const liftWorkouts  = workouts.filter(w => !w.is_cardio);
  const cardioWorkout = workouts.find(w => !!w.is_cardio);
  const hasRoutine    = !!routine;

  // ── ROUTINE MODE: redirect home screen directly to today's workout ──────────
  if (mode === 'grid' && hasRoutine && todayInfo) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <AppHeader title="Workouts" theme={t} />
        {milestoneMsg && <MilestoneBanner message={milestoneMsg} onHide={() => setMilestoneMsg(null)} />}

        {/* "Different workout" gate */}
        <ActionSheet
          visible={differentModal}
          title="Different workout?"
          subtitle={`Your routine says: ${todayInfo.workout?.name ?? 'Choose'}`}
          onDismiss={() => { setDifferentModal(false); setPendingDifferent(null); }}
          actions={[
            {
              label: 'Continue routine',
              sub: todayInfo.workout?.name ?? '',
              icon: 'calendar-outline',
              color: t.purple,
              onPress: () => { if (todayInfo.workout) startWorkout(todayInfo.workout); },
            },
            {
              label: `Do ${pendingDifferent?.name ?? 'this'} instead`,
              sub: 'Pauses routine for today',
              icon: 'swap-horizontal-outline',
              color: t.orange,
              onPress: async () => {
                await pauseRoutine();
                setRoutinePaused(true);
                if (pendingDifferent) startWorkout(pendingDifferent);
              },
            },
            {
              label: 'Cancel routine',
              sub: 'Remove the active routine',
              icon: 'close-circle-outline',
              color: t.red,
              onPress: () => { deleteRoutine(); clearRoutineProgress(); load(); },
            },
          ]}
        />

        {/* Routine management sheet */}
        <ActionSheet
          visible={routineModal}
          title={routine?.name ?? 'Routine'}
          subtitle="Active routine options"
          onDismiss={() => setRoutineModal(false)}
          actions={[
            {
              label: 'Edit / Change routine',
              sub: 'Modify or rebuild',
              icon: 'create-outline',
              color: t.purple,
              onPress: () => router.push('/routine'),
            },
            {
              label: 'Jump to a day',
              sub: 'Skip ahead or go back',
              icon: 'play-skip-forward-outline',
              color: t.orange,
              onPress: () => router.push('/routine'),
            },
            routinePaused ? {
              label: 'Resume routine',
              sub: 'Pick up where you left off',
              icon: 'play-circle-outline',
              color: t.green,
              onPress: async () => { await resumeRoutine(); setRoutinePaused(false); },
            } : {
              label: 'Pause routine',
              sub: 'Skip today without losing progress',
              icon: 'pause-circle-outline',
              color: t.orange,
              onPress: async () => { await pauseRoutine(); setRoutinePaused(true); },
            },
            {
              label: 'Cancel routine',
              sub: 'Remove the active routine',
              icon: 'close-circle-outline',
              color: t.red,
              onPress: () => { deleteRoutine(); clearRoutineProgress(); setRoutine(null); setTodayInfo(null); setRoutineModal(false); },
            },
          ]}
        />

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Today's routine card */}
          {todayInfo.isRest ? (
            <View style={[styles.routineCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Text style={styles.restEmoji}>😴</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.routineCardLabel, { color: t.textMuted }]}>TODAY — {routine.name}</Text>
                <Text style={[styles.routineCardName, { color: t.textPrimary }]}>Rest Day</Text>
              </View>
            </View>
          ) : todayInfo.workout ? (
            <TouchableOpacity style={[styles.routineCard, { backgroundColor: t.bgCard, borderColor: t.purple + '55' }]}
              onPress={handleRoutineWorkoutStart}>
              <View style={[styles.routineIconWrap, { backgroundColor: t.purpleBg }]}>
                <WorkoutIcon name={todayInfo.workout.name} size={36} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.routineCardLabel, { color: routinePaused ? t.orange : t.purple }]}>
                  {routinePaused ? '⏸ PAUSED — ' : 'TODAY — '}{routine.name}
                </Text>
                <Text style={[styles.routineCardName, { color: t.textPrimary }]}>{todayInfo.workout.name}</Text>
                <Text style={[styles.routineCardSub, { color: t.textMuted }]}>
                  Day {todayInfo.dayIndex + 1} of {todayInfo.totalDays}
                </Text>
              </View>
              <View style={[styles.routineArrow, { backgroundColor: t.purple + '22' }]}>
                <Ionicons name="play" size={16} color={t.purple} />
              </View>
            </TouchableOpacity>
          ) : (
            // "Choose on the day" — show full grid
            <View style={[styles.routineCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <Text style={styles.restEmoji}>🤔</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.routineCardLabel, { color: t.textMuted }]}>{routine.name}</Text>
                <Text style={[styles.routineCardName, { color: t.textPrimary }]}>Choose your workout below</Text>
              </View>
            </View>
          )}

          {/* Cardio strip */}
          {cardioWorkout && (
            <TouchableOpacity style={[styles.cardioCard, { backgroundColor: t.bgCard, borderColor: t.green + '44' }]}
              onPress={() => handlePress(cardioWorkout)}>
              <View style={[styles.cardioIconWrap, { backgroundColor: t.greenDim }]}>
                <WorkoutIcon name="cardio" size={32} />
              </View>
              <Text style={[styles.cardioTitle, { color: t.green }]}>Cardio</Text>
              <Ionicons name="arrow-forward" size={15} color={t.green} />
            </TouchableOpacity>
          )}

          {/* All workouts grid (smaller when routine active) */}
          {liftWorkouts.length > 0 && (
            <Text style={[styles.sectionLabel, { color: t.textFaint }]}>ALL WORKOUTS</Text>
          )}
          <View style={styles.grid}>
            {liftWorkouts.map(w => {
              const { color } = getWorkoutIcon(w.name);
              const isToday   = todayInfo?.workout?.id === w.id;
              return (
                <TouchableOpacity key={w.id}
                  style={[styles.workoutCard, { borderColor: isToday ? t.purple + '55' : color + '30', backgroundColor: t.bgCard }]}
                  onPress={() => handlePress(w)}
                  activeOpacity={0.75}>
                  <View style={[styles.cardBg, { backgroundColor: color + '12' }]} />
                  <WorkoutIcon name={w.name} size={44} />
                  <Text style={[styles.workoutName, { color: t.textPrimary }]} numberOfLines={2}>{w.name}</Text>
                  <WorkoutCardSummary workoutId={w.id} />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Change Routine FAB */}
        <View style={styles.fab}>
          <TouchableOpacity style={[styles.fabBtn, { backgroundColor: t.bgCard, borderColor: t.purple + '55', borderWidth: 1 }]}
            onPress={() => setRoutineModal(true)}>
            <Ionicons name="calendar-outline" size={18} color={t.purple} />
            <Text style={[styles.fabText, { color: t.purple }]}>Change Routine</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── GRID MODE (no routine) ──────────────────────────────────────────────────
  if (mode === 'grid') return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <AppHeader title="Workouts" theme={t} />
      {milestoneMsg && <MilestoneBanner message={milestoneMsg} onHide={() => setMilestoneMsg(null)} />}

      {/* Resume / new session modal */}
      {pendingWorkout && (
        <ActionSheet
          visible={resumeModal}
          title={pendingWorkout.w.name}
          subtitle="You finished this recently"
          onDismiss={() => setResumeModal(false)}
          actions={[
            {
              label: 'New session',
              sub: 'Start fresh',
              icon: 'flash-outline',
              color: t.purple,
              onPress: async () => {
                await clearLastSession();
                const sessionId = createSession(pendingWorkout.w.id);
                router.push(`/workout/log/${sessionId}?workoutId=${pendingWorkout.w.id}`);
              },
            },
            {
              label: 'Edit last session',
              sub: 'Review and adjust',
              icon: 'pencil-outline',
              color: t.orange,
              onPress: async () => {
                await clearLastSession();
                router.push(`/workout/log/${pendingWorkout.sessionId}?workoutId=${pendingWorkout.w.id}`);
              },
            },
          ]}
        />
      )}

      {/* "Different workout while mid-session" modal */}
      <ActionSheet
        visible={differentModal}
        title="Unfinished session"
        subtitle={`You have an open ${pendingWorkout?.w.name ?? ''} session`}
        onDismiss={() => { setDifferentModal(false); setPendingDifferent(null); }}
        actions={[
          {
            label: `Resume ${pendingWorkout?.w.name ?? ''}`,
            sub: 'Go back to your open session',
            icon: 'arrow-undo-outline',
            color: t.purple,
            onPress: async () => {
              if (pendingWorkout && !pendingWorkout.w.is_cardio) {
                router.push(`/workout/log/${pendingWorkout.sessionId}?workoutId=${pendingWorkout.w.id}`);
              }
            },
          },
          {
            label: `Start ${pendingDifferent?.name ?? 'new workout'}`,
            sub: 'Abandon the open session',
            icon: 'flash-outline',
            color: t.orange,
            onPress: async () => {
              await clearLastSession();
              if (pendingDifferent) {
                const sessionId = createSession(pendingDifferent.id);
                router.push(`/workout/log/${sessionId}?workoutId=${pendingDifferent.id}`);
              }
            },
          },
        ]}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {cardioWorkout && (
          <TouchableOpacity style={[styles.cardioCard, { backgroundColor: t.bgCard, borderColor: t.green + '44' }]}
            onPress={() => handlePress(cardioWorkout)}>
            <View style={[styles.cardioIconWrap, { backgroundColor: t.greenDim }]}>
              <WorkoutIcon name="cardio" size={32} />
            </View>
            <Text style={[styles.cardioTitle, { color: t.green }]}>Cardio</Text>
            <Ionicons name="arrow-forward" size={15} color={t.green} />
          </TouchableOpacity>
        )}

        {liftWorkouts.length > 0 && (
          <Text style={[styles.sectionLabel, { color: t.textFaint }]}>MY WORKOUTS</Text>
        )}

        <View style={styles.grid}>
          {liftWorkouts.map(w => {
            const { color } = getWorkoutIcon(w.name);
            return (
              <TouchableOpacity key={w.id}
                style={[styles.workoutCard, { borderColor: color + '30', backgroundColor: t.bgCard }]}
                onPress={() => handlePress(w)}
                activeOpacity={0.75}>
                <View style={[styles.cardBg, { backgroundColor: color + '12' }]} />
                <WorkoutIcon name={w.name} size={52} />
                <Text style={[styles.workoutName, { color: t.textPrimary }]} numberOfLines={2}>{w.name}</Text>
                <WorkoutCardSummary workoutId={w.id} />
              </TouchableOpacity>
            );
          })}
        </View>

        {liftWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={64} color={t.textDead} />
            <Text style={[styles.emptyTitle, { color: t.textFaint }]}>No workouts yet</Text>
            <Text style={[styles.emptySub, { color: t.textDead }]}>Tap below to add your first</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB row: New Workout + Routine */}
      <View style={styles.fab}>
        <TouchableOpacity style={[styles.fabBtn, { backgroundColor: t.purple }]} onPress={() => setMode('new')}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={[styles.fabText, { color: '#fff' }]}>New Workout</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.fabBtnSecondary, { backgroundColor: t.bgCard, borderColor: t.borderMid }]}
          onPress={() => router.push('/routine')}>
          <Ionicons name="calendar-outline" size={20} color={t.purple} />
          <Text style={[styles.fabText, { color: t.purple }]}>Routine</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── NEW WORKOUT ─────────────────────────────────────────────────────────────
  if (mode === 'new') return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
        <TouchableOpacity onPress={() => { setMode('grid'); setNewName(''); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={t.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.modalTitle, { color: t.textPrimary }]}>New Workout</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
        <Text style={[styles.sectionLabel, { color: t.textFaint }]}>QUICK START</Text>
        <View style={styles.templateGrid}>
          {TEMPLATES.map(tp => {
            const { color } = getWorkoutIcon(tp.name);
            return (
              <TouchableOpacity key={tp.name}
                style={[styles.templateCard, { backgroundColor: t.bgCard, borderColor: color + '40' }]}
                onPress={() => pickTemplate(tp)}>
                <View style={[styles.templateIconBg, { backgroundColor: color + '18' }]}>
                  <WorkoutIcon name={tp.name} size={40} />
                </View>
                <Text style={[styles.templateName, { color: t.textPrimary }]}>{tp.name}</Text>
                <Text style={[styles.templateSub, { color: t.textFaint }]}>{tp.exercises.length} exercises</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
          <Text style={[styles.dividerText, { color: t.textFaint }]}>OR BLANK</Text>
          <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
        </View>

        <View style={styles.blankRow}>
          <TextInput
            style={[styles.blankInput, { backgroundColor: t.bgCard, color: t.textPrimary, borderColor: t.border }]}
            placeholder="Workout name..."
            placeholderTextColor={t.textFaint}
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleCreateBlank}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: newName.trim() ? t.purple : t.border }]}
            onPress={handleCreateBlank}
            disabled={!newName.trim()}>
            <Text style={[styles.createBtnText, { color: newName.trim() ? '#fff' : t.textFaint }]}>Create</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  // ── TEMPLATE CUSTOMISE ──────────────────────────────────────────────────────
  if (mode === 'template' && selectedTemplate) {
    const { color } = getWorkoutIcon(selectedTemplate.name);
    return (
      <KeyboardAvoidingView style={[styles.container, { backgroundColor: t.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={[styles.modalHeader, { borderBottomColor: t.border }]}>
          <TouchableOpacity onPress={() => setMode('new')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={t.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: t.textPrimary }]}>{selectedTemplate.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={[styles.templatePreview, { backgroundColor: color + '15', borderColor: color + '30' }]}>
            <WorkoutIcon name={selectedTemplate.name} size={72} />
          </View>

          <TextInput
            style={[styles.blankInput, { backgroundColor: t.bgCard, color: t.textPrimary, borderColor: t.border, marginBottom: 20 }]}
            placeholder={`Name (default: ${selectedTemplate.name})`}
            placeholderTextColor={t.textFaint}
            value={newName}
            onChangeText={setNewName}
          />

          <Text style={[styles.sectionLabel, { color: t.textFaint }]}>EXERCISES</Text>
          {templateExercises.map((e, i) => (
            <View key={i} style={[styles.exerciseRow, { backgroundColor: t.bgCard, borderColor: t.border }]}>
              <View style={[styles.exDot, { backgroundColor: color }]} />
              <Text style={[styles.exerciseRowText, { color: t.textSecondary }]}>{e}</Text>
              <TouchableOpacity onPress={() => removeTemplateExercise(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={t.textFaint} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.blankRow}>
            <TextInput
              style={[styles.blankInput, { backgroundColor: t.bgCard, color: t.textPrimary, borderColor: t.border }]}
              placeholder="Add exercise..."
              placeholderTextColor={t.textFaint}
              value={newExercise}
              onChangeText={setNewExercise}
              onSubmitEditing={addTemplateExercise}
              returnKeyType="done"
              blurOnSubmit={false}
            />
            <TouchableOpacity style={[styles.addExBtn, { backgroundColor: color }]} onPress={addTemplateExercise}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.startBtn, { backgroundColor: color }]} onPress={createFromTemplate}>
            <Ionicons name="flash" size={18} color="#fff" />
            <Text style={styles.startBtnText}>Create & Start</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  backdrop:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box:         { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8, borderTopWidth: 1, elevation: 20 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title:       { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sub:         { fontSize: 13, marginBottom: 20 },
  actions:     { gap: 10 },
  action:      { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 14, padding: 14, borderWidth: 1 },
  actionIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 15, fontWeight: '600' },
  actionSub:   { fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  container:  { flex: 1 },
  scroll:     { paddingTop: 16, paddingHorizontal: 16 },

  routineCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1,
  },
  routineIconWrap:  { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  routineArrow:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  routineCardLabel: { fontSize: FONT.xs, fontWeight: '700', letterSpacing: 1, marginBottom: 2 },
  routineCardName:  { fontSize: FONT.xl, fontWeight: '800' },
  routineCardSub:   { fontSize: FONT.base, marginTop: 2 },
  restEmoji:        { fontSize: 36 },

  cardioCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1,
  },
  cardioIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardioTitle:    { flex: 1, fontSize: FONT.lg, fontWeight: '700' },

  sectionLabel: { fontSize: FONT.sm, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  workoutCard:  { width: CARD_W, aspectRatio: 1, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 12, overflow: 'hidden', gap: 8 },
  cardBg:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 },
  workoutName:  { fontSize: FONT.base, fontWeight: '700', textAlign: 'center', lineHeight: 17 },
  cardSummary:     { fontSize: FONT.xs, textAlign: 'center' },
  cardSummaryNone: { fontSize: FONT.xs, textAlign: 'center' },

  emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub:   { fontSize: 14 },

  fab: { position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', gap: 10 },
  fabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  fabBtnSecondary: { flex: 0, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderRadius: 16, borderWidth: 1 },
  fabText: { fontSize: FONT.lg, fontWeight: '700' },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16, borderBottomWidth: 1,
  },
  backBtn:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle:  { fontSize: 18, fontWeight: '700' },
  modalScroll: { padding: 20, paddingBottom: 60 },

  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  templateCard: { width: (SCREEN_W - 60) / 2, borderRadius: 16, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1 },
  templateIconBg: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  templateName: { fontSize: FONT.md, fontWeight: '700' },
  templateSub:  { fontSize: 12 },
  templatePreview: { alignSelf: 'center', width: 110, height: 110, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  blankRow:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  blankInput: { flex: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, borderWidth: 1 },
  createBtn:     { paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' },
  createBtnText: { fontWeight: '700' },
  addExBtn:      { width: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  exerciseRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, padding: 13, marginBottom: 6, borderWidth: 1 },
  exDot:           { width: 7, height: 7, borderRadius: 4 },
  exerciseRowText: { flex: 1, fontSize: 14 },

  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, marginTop: 24 },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
