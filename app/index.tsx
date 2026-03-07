import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Alert, StatusBar, ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getWorkouts, addWorkout, deleteWorkout, createSession, addExercise,
  getRecentSession, clearLastSession, Workout,
} from '@/src/db';

const TEMPLATES = [
  { name: 'Chest',     emoji: '💪', exercises: ['Bench Press', 'Incline Dumbbell Press', 'Cable Fly', 'Push Ups'] },
  { name: 'Back',      emoji: '🔙', exercises: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Lat Pulldown'] },
  { name: 'Legs',      emoji: '🦵', exercises: ['Squat', 'Leg Press', 'Romanian Deadlift', 'Leg Curl'] },
  { name: 'Shoulders', emoji: '🏋️', exercises: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pull'] },
  { name: 'Arms',      emoji: '💪', exercises: ['Barbell Curl', 'Tricep Dip', 'Hammer Curl', 'Skull Crusher'] },
  { name: 'Full Body', emoji: '⚡', exercises: ['Squat', 'Bench Press', 'Deadlift', 'Pull Ups'] },
  { name: 'Push',      emoji: '🔼', exercises: ['Bench Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown'] },
  { name: 'Pull',      emoji: '🔽', exercises: ['Deadlift', 'Pull Ups', 'Barbell Row', 'Bicep Curl'] },
];

export default function HomeScreen() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [mode, setMode] = useState<'list' | 'new' | 'template'>('list');
  const [newName, setNewName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [templateExercises, setTemplateExercises] = useState<string[]>([]);
  const [newExercise, setNewExercise] = useState('');

  const load = useCallback(() => setWorkouts(getWorkouts()), []);

  useFocusEffect(useCallback(() => {
    load();
  }, []));

  async function handlePress(w: Workout) {
    if (!!w.is_cardio) {
      const sessionId = createSession(w.id);
      router.push(`/workout/cardio/${sessionId}`);
      return;
    }

    // Check if this exact workout was recently finished (within 1hr)
    const recent = await getRecentSession();
    if (recent && recent.workout_id === w.id && !recent.is_cardio) {
      Alert.alert(
        `Continue ${w.name}?`,
        'You finished this workout less than an hour ago.',
        [
          {
            text: 'Edit last session',
            onPress: async () => {
              await clearLastSession();
              // Navigate directly into the existing session
              router.push(`/workout/log/${recent.session_id}?workoutId=${w.id}`);
            },
          },
          {
            text: 'Start new session',
            onPress: async () => {
              await clearLastSession();
              const sessionId = createSession(w.id);
              router.push(`/workout/log/${sessionId}?workoutId=${w.id}`);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      router.push(`/workout/${w.id}`);
    }
  }

  function handleDelete(w: Workout) {
    if (!!w.is_cardio) { Alert.alert('Cannot delete', 'The Cardio workout is permanent.'); return; }
    Alert.alert(`Delete "${w.name}"?`, 'This removes all its exercises and history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteWorkout(w.id); load(); } },
    ]);
  }

  function handleCreateBlank() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addWorkout(trimmed);
    setNewName('');
    setMode('list');
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
    setMode('list');
    setNewName('');
    setSelectedTemplate(null);
    load();
    router.push(`/workout/${id}`);
  }

  const liftWorkouts = workouts.filter(w => !w.is_cardio);
  const cardioWorkout = workouts.find(w => !!w.is_cardio);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── MAIN LIST ── */}
      {mode === 'list' && (
        <>
          <ScrollView contentContainerStyle={styles.scroll}>
            {cardioWorkout && (
              <TouchableOpacity style={styles.cardioCard} onPress={() => handlePress(cardioWorkout)}>
                <View style={styles.cardioLeft}>
                  <Text style={styles.cardioEmoji}>🏃</Text>
                  <View>
                    <Text style={styles.cardioTitle}>Cardio</Text>
                    <Text style={styles.cardioSub}>Log a cardio session</Text>
                  </View>
                </View>
                <View style={styles.cardioArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#22c55e" />
                </View>
              </TouchableOpacity>
            )}

            {liftWorkouts.length > 0 && <Text style={styles.sectionLabel}>MY WORKOUTS</Text>}

            {liftWorkouts.map(w => (
              <TouchableOpacity
                key={w.id}
                style={styles.workoutCard}
                onPress={() => handlePress(w)}
                onLongPress={() => handleDelete(w)}
                activeOpacity={0.75}
              >
                <View style={styles.workoutCardInner}>
                  <View style={styles.workoutDot} />
                  <Text style={styles.workoutName}>{w.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#444" />
              </TouchableOpacity>
            ))}

            {liftWorkouts.length === 0 && (
              <View style={styles.emptyHint}>
                <Text style={styles.emptyHintText}>Tap the button below to add your first workout</Text>
              </View>
            )}
            <View style={{ height: 120 }} />
          </ScrollView>

          <View style={styles.fabArea}>
            <TouchableOpacity style={styles.newBtn} onPress={() => setMode('new')}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.newBtnText}>New Workout</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── NEW WORKOUT ── */}
      {mode === 'new' && (
        <View style={styles.fullModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setMode('list'); setNewName(''); }} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Workout</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <Text style={styles.sectionLabel}>QUICK START TEMPLATES</Text>
            <View style={styles.templateGrid}>
              {TEMPLATES.map(t => (
                <TouchableOpacity key={t.name} style={styles.templateChip} onPress={() => pickTemplate(t)}>
                  <Text style={styles.templateEmoji}>{t.emoji}</Text>
                  <Text style={styles.templateName}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR START BLANK</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.blankRow}>
              <TextInput
                style={styles.blankInput}
                placeholder="Workout name..."
                placeholderTextColor="#555"
                value={newName}
                onChangeText={setNewName}
                onSubmitEditing={handleCreateBlank}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={[styles.createBtn, !newName.trim() && styles.createBtnDisabled]}
                onPress={handleCreateBlank}
                disabled={!newName.trim()}
              >
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* ── TEMPLATE CUSTOMISE ── */}
      {mode === 'template' && selectedTemplate && (
        <View style={styles.fullModal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setMode('new')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{selectedTemplate.emoji} {selectedTemplate.name}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.modalScroll}>
            <TextInput
              style={styles.blankInput}
              placeholder={`Name (default: ${selectedTemplate.name})`}
              placeholderTextColor="#555"
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>EXERCISES</Text>
            {templateExercises.map((e, i) => (
              <View key={i} style={styles.exerciseRow}>
                <View style={styles.exerciseDot} />
                <Text style={styles.exerciseRowText}>{e}</Text>
                <TouchableOpacity onPress={() => removeTemplateExercise(i)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={20} color="#444" />
                </TouchableOpacity>
              </View>
            ))}
            <View style={styles.blankRow}>
              <TextInput
                style={styles.blankInput}
                placeholder="Add exercise..."
                placeholderTextColor="#555"
                value={newExercise}
                onChangeText={setNewExercise}
                onSubmitEditing={addTemplateExercise}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <TouchableOpacity style={styles.addExBtn} onPress={addTemplateExercise}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.startWorkoutBtn} onPress={createFromTemplate}>
              <Ionicons name="flash" size={20} color="#fff" />
              <Text style={styles.startWorkoutText}>Create & Open Workout</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a12' },
  scroll: { paddingTop: 16, paddingHorizontal: 16 },
  cardioCard: {
    backgroundColor: '#0d1f15', borderRadius: 16, padding: 16, marginBottom: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#1a3a22',
  },
  cardioLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardioEmoji: { fontSize: 32 },
  cardioTitle: { color: '#22c55e', fontSize: 17, fontWeight: '700' },
  cardioSub: { color: '#3a7a4a', fontSize: 13, marginTop: 2 },
  cardioArrow: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#1a3a22', alignItems: 'center', justifyContent: 'center',
  },
  sectionLabel: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  workoutCard: {
    backgroundColor: '#13131f', borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#1e1e32',
  },
  workoutCardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workoutDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6C63FF' },
  workoutName: { color: '#e8e8ff', fontSize: 16, fontWeight: '600' },
  emptyHint: { alignItems: 'center', marginTop: 40, marginBottom: 20 },
  emptyHintText: { color: '#333', fontSize: 14, textAlign: 'center' },
  fabArea: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  newBtn: {
    backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 16, borderRadius: 16,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  newBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  fullModal: { flex: 1, backgroundColor: '#0a0a12' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#1e1e32',
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalScroll: { padding: 20, paddingBottom: 60 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  templateChip: {
    backgroundColor: '#13131f', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    alignItems: 'center', width: '47%', borderWidth: 1, borderColor: '#1e1e32', gap: 6,
  },
  templateEmoji: { fontSize: 28 },
  templateName: { color: '#e8e8ff', fontSize: 14, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e1e32' },
  dividerText: { color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  blankRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  blankInput: {
    flex: 1, backgroundColor: '#13131f', color: '#fff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    borderWidth: 1, borderColor: '#1e1e32',
  },
  createBtn: { backgroundColor: '#6C63FF', paddingHorizontal: 18, borderRadius: 12, justifyContent: 'center' },
  createBtnDisabled: { backgroundColor: '#2a2a4a' },
  createBtnText: { color: '#fff', fontWeight: '700' },
  addExBtn: { width: 48, backgroundColor: '#6C63FF', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#13131f', borderRadius: 10, padding: 13, marginBottom: 6,
    borderWidth: 1, borderColor: '#1e1e32',
  },
  exerciseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6C63FF' },
  exerciseRowText: { flex: 1, color: '#ccc', fontSize: 14 },
  startWorkoutBtn: {
    backgroundColor: '#6C63FF', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, marginTop: 24,
    shadowColor: '#6C63FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  startWorkoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
