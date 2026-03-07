import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, StatusBar, ScrollView, Dimensions, Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getWorkouts, addWorkout, deleteWorkout, createSession, addExercise,
  getRecentSession, clearLastSession, getLastSessionSummary, Workout,
} from '@/src/db';
import { WorkoutIcon, getWorkoutIcon } from '@/src/WorkoutIcons';
import { AppHeader } from '@/app/_layout';

const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP = 12;
const CARD_W   = (SCREEN_W - 32 - CARD_GAP) / 2;

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

function WorkoutCardSummary({ workoutId }: { workoutId: number }) {
  const summary = getLastSessionSummary(workoutId);
  if (!summary) return <Text style={styles.cardSummaryNone}>No sessions yet</Text>;
  const dayLabel = summary.daysAgo === 0 ? 'Today' : summary.daysAgo === 1 ? 'Yesterday' : `${summary.daysAgo}d ago`;
  return <Text style={styles.cardSummary} numberOfLines={1}>{dayLabel} · {summary.totalSets} sets</Text>;
}

// ── Nice bottom-sheet style modal (replaces Alert.alert) ──────────────────────
function ActionSheet({
  visible, title, subtitle, actions, onDismiss,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: { label: string; sub?: string; icon: string; color?: string; onPress: () => void }[];
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={sheet.overlay}>
        <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={onDismiss} />
        <View style={sheet.box}>
          <View style={sheet.handle} />
          <Text style={sheet.title}>{title}</Text>
          {subtitle ? <Text style={sheet.sub}>{subtitle}</Text> : null}
          <View style={sheet.actions}>
            {actions.map((a, i) => (
              <TouchableOpacity key={i} style={sheet.action} onPress={() => { onDismiss(); a.onPress(); }}>
                <View style={[sheet.actionIcon, { backgroundColor: (a.color ?? '#6C63FF') + '22' }]}>
                  <Ionicons name={a.icon as any} size={20} color={a.color ?? '#6C63FF'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={sheet.actionLabel}>{a.label}</Text>
                  {a.sub ? <Text style={sheet.actionSub}>{a.sub}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#333" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [mode, setMode] = useState<'grid' | 'new' | 'template'>('grid');
  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [templateExercises, setTemplateExercises] = useState<string[]>([]);
  const [newExercise, setNewExercise] = useState('');

  // Resume modal state
  const [resumeModal, setResumeModal] = useState(false);
  const [pendingWorkout, setPendingWorkout] = useState<{ w: Workout; sessionId: number } | null>(null);

  const load = useCallback(() => setWorkouts(getWorkouts()), []);
  useFocusEffect(useCallback(() => { load(); }, []));

  async function handlePress(w: Workout) {
    // Cardio: always start a new session immediately, no popup
    if (!!w.is_cardio) {
      const sessionId = createSession(w.id);
      router.push(`/workout/cardio/${sessionId}`);
      return;
    }

    const recent = await getRecentSession();
    if (recent && recent.workout_id === w.id && !recent.is_cardio) {
      if (!recent.finished) {
        // Mid-session within 15 min — auto-resume silently
        router.push(`/workout/log/${recent.session_id}?workoutId=${w.id}`);
        return;
      }
      // Finished recently — show nice modal to choose
      setPendingWorkout({ w, sessionId: recent.session_id });
      setResumeModal(true);
      return;
    }

    // No recent session — start fresh
    const sessionId = createSession(w.id);
    router.push(`/workout/log/${sessionId}?workoutId=${w.id}`);
  }

  function handleLongPress(w: Workout) {
    if (!!w.is_cardio) return;
    // Use the same nice modal pattern for delete confirmation
    // (handled inline below since it's simpler)
  }

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
    const id = addWorkout(name);
    templateExercises.forEach(e => addExercise(id, e));
    setMode('grid');
    setNewName('');
    setSelectedTemplate(null);
    load();
    const sessionId = createSession(id);
    router.push(`/workout/log/${sessionId}?workoutId=${id}`);
  }

  const liftWorkouts = workouts.filter(w => !w.is_cardio);
  const cardioWorkout = workouts.find(w => !!w.is_cardio);

  // ── GRID MODE ──────────────────────────────────────────────────────────────
  if (mode === 'grid') return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AppHeader title="Workouts" />

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
              color: '#6C63FF',
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
              color: '#f59e0b',
              onPress: async () => {
                await clearLastSession();
                router.push(`/workout/log/${pendingWorkout.sessionId}?workoutId=${pendingWorkout.w.id}`);
              },
            },
          ]}
        />
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cardio card — full width */}
        {cardioWorkout && (
          <TouchableOpacity style={styles.cardioCard} onPress={() => handlePress(cardioWorkout)}>
            <View style={styles.cardioIconWrap}>
              <WorkoutIcon name="cardio" size={36} />
            </View>
            <View style={styles.cardioText}>
              <Text style={styles.cardioTitle}>Cardio</Text>
              <Text style={styles.cardioSub}>Log a session</Text>
            </View>
            <View style={styles.cardioArrow}>
              <Ionicons name="arrow-forward" size={16} color="#22c55e" />
            </View>
          </TouchableOpacity>
        )}

        {liftWorkouts.length > 0 && <Text style={styles.sectionLabel}>MY WORKOUTS</Text>}

        <View style={styles.grid}>
          {liftWorkouts.map(w => {
            const { color } = getWorkoutIcon(w.name);
            return (
              <TouchableOpacity
                key={w.id}
                style={[styles.workoutCard, { borderColor: color + '30' }]}
                onPress={() => handlePress(w)}
                onLongPress={() => {
                  // Long-press delete — simple modal
                  setPendingWorkout({ w, sessionId: -1 });
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.cardBg, { backgroundColor: color + '12' }]} />
                <View style={styles.iconWrap}>
                  <WorkoutIcon name={w.name} size={52} />
                </View>
                <Text style={styles.workoutName} numberOfLines={2}>{w.name}</Text>
                <WorkoutCardSummary workoutId={w.id} />
              </TouchableOpacity>
            );
          })}
        </View>

        {liftWorkouts.length === 0 && (
          <View style={styles.emptyState}>
            <DefaultEmptyIcon />
            <Text style={styles.emptyTitle}>No workouts yet</Text>
            <Text style={styles.emptySub}>Tap below to add your first</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.fab}>
        <TouchableOpacity style={styles.fabBtn} onPress={() => setMode('new')}>
          <Ionicons name="add" size={22} color="#fff" />
          <Text style={styles.fabText}>New Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── NEW WORKOUT MODE ───────────────────────────────────────────────────────
  if (mode === 'new') return (
    <View style={styles.container}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={() => { setMode('grid'); setNewName(''); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>New Workout</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.modalScroll}>
        <Text style={styles.sectionLabel}>QUICK START</Text>
        <View style={styles.templateGrid}>
          {TEMPLATES.map(t => {
            const { color } = getWorkoutIcon(t.name);
            return (
              <TouchableOpacity key={t.name} style={[styles.templateCard, { borderColor: color + '40' }]} onPress={() => pickTemplate(t)}>
                <View style={[styles.templateIconBg, { backgroundColor: color + '18' }]}>
                  <WorkoutIcon name={t.name} size={40} />
                </View>
                <Text style={styles.templateName}>{t.name}</Text>
                <Text style={styles.templateSub}>{t.exercises.length} exercises</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR BLANK</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.blankRow}>
          <TextInput
            style={styles.blankInput}
            placeholder="Workout name..."
            placeholderTextColor="#444"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleCreateBlank}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.createBtn, !newName.trim() && styles.createBtnOff]}
            onPress={handleCreateBlank}
            disabled={!newName.trim()}
          >
            <Text style={styles.createBtnText}>Create</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // ── TEMPLATE CUSTOMISE MODE ────────────────────────────────────────────────
  if (mode === 'template' && selectedTemplate) {
    const { color } = getWorkoutIcon(selectedTemplate.name);
    return (
      <View style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setMode('new')} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{selectedTemplate.name}</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll}>
          <View style={[styles.templatePreview, { backgroundColor: color + '15', borderColor: color + '30' }]}>
            <WorkoutIcon name={selectedTemplate.name} size={72} />
          </View>

          <TextInput
            style={[styles.blankInput, { marginBottom: 20 }]}
            placeholder={`Name (default: ${selectedTemplate.name})`}
            placeholderTextColor="#444"
            value={newName}
            onChangeText={setNewName}
          />

          <Text style={styles.sectionLabel}>EXERCISES</Text>
          {templateExercises.map((e, i) => (
            <View key={i} style={styles.exerciseRow}>
              <View style={[styles.exDot, { backgroundColor: color }]} />
              <Text style={styles.exerciseRowText}>{e}</Text>
              <TouchableOpacity onPress={() => removeTemplateExercise(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color="#333" />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.blankRow}>
            <TextInput
              style={styles.blankInput}
              placeholder="Add exercise..."
              placeholderTextColor="#444"
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
      </View>
    );
  }

  return null;
}

function DefaultEmptyIcon() {
  return (
    <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', opacity: 0.15 }}>
      <Ionicons name="barbell-outline" size={72} color="#fff" />
    </View>
  );
}

const sheet = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box: {
    backgroundColor: '#0a0a0a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 36, paddingTop: 8,
    borderTopWidth: 1, borderColor: '#1a1a2a',
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 20,
  },
  handle:  { width: 36, height: 4, borderRadius: 2, backgroundColor: '#1e1e2e', alignSelf: 'center', marginBottom: 20 },
  title:   { color: '#e8e8ff', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sub:     { color: '#444', fontSize: 13, marginBottom: 20 },
  actions: { gap: 10 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0f0f18', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#1a1a2a',
  },
  actionIcon:  { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: '#e8e8ff', fontSize: 15, fontWeight: '600' },
  actionSub:   { color: '#444', fontSize: 12, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scroll: { paddingTop: 16, paddingHorizontal: 16 },

  cardioCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0a0a0a', borderRadius: 16, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: '#22c55e30',
  },
  cardioIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#22c55e18', alignItems: 'center', justifyContent: 'center' },
  cardioText:  { flex: 1 },
  cardioTitle: { color: '#22c55e', fontSize: 16, fontWeight: '700' },
  cardioSub:   { color: '#2a5a36', fontSize: 13, marginTop: 2 },
  cardioArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#22c55e18', alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { color: '#333', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP },
  workoutCard: {
    width: CARD_W, aspectRatio: 1,
    backgroundColor: '#0a0a0a', borderRadius: 20,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    padding: 12, overflow: 'hidden',
  },
  cardBg:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20 },
  iconWrap:    { marginBottom: 10 },
  workoutName: { color: '#e8e8ff', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 17 },
  cardSummary:     { color: '#333', fontSize: 10, textAlign: 'center', marginTop: 4 },
  cardSummaryNone: { color: '#1e1e1e', fontSize: 10, textAlign: 'center', marginTop: 4 },

  emptyState: { alignItems: 'center', marginTop: 60, gap: 10 },
  emptyTitle: { color: '#333', fontSize: 18, fontWeight: '700' },
  emptySub:   { color: '#222', fontSize: 14 },

  fab: { position: 'absolute', bottom: 24, left: 16, right: 16 },
  fabBtn: {
    backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#111',
  },
  backBtn:   { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle:{ color: '#fff', fontSize: 18, fontWeight: '700' },
  modalScroll: { padding: 20, paddingBottom: 60 },

  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  templateCard: {
    width: (SCREEN_W - 60) / 2, backgroundColor: '#0a0a0a', borderRadius: 16,
    padding: 14, alignItems: 'center', gap: 8, borderWidth: 1,
  },
  templateIconBg: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  templateName:   { color: '#e8e8ff', fontSize: 14, fontWeight: '700' },
  templateSub:    { color: '#333', fontSize: 12 },

  templatePreview: {
    alignSelf: 'center', width: 110, height: 110, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, borderWidth: 1,
  },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#111' },
  dividerText: { color: '#333', fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  blankRow:   { flexDirection: 'row', gap: 10, marginBottom: 12 },
  blankInput: {
    flex: 1, backgroundColor: '#0a0a0a', color: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: '#111',
  },
  createBtn:     { backgroundColor: '#6C63FF', paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' },
  createBtnOff:  { backgroundColor: '#111' },
  createBtnText: { color: '#fff', fontWeight: '700' },
  addExBtn:      { width: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0a0a0a', borderRadius: 10, padding: 13, marginBottom: 6,
    borderWidth: 1, borderColor: '#111',
  },
  exDot:           { width: 7, height: 7, borderRadius: 4 },
  exerciseRowText: { flex: 1, color: '#ccc', fontSize: 14 },

  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: 16, borderRadius: 14, marginTop: 24,
  },
  startBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
