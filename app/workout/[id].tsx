import { useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  getExercises, addExercise, deleteExercise, createSession,
  getWorkouts, getRecentSession, clearLastSession, saveLastSessionTime, Exercise,
} from '@/src/db';

const STATUS_BAR_H = Constants.statusBarHeight ?? 24;

export default function WorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = Number(id);
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [newName, setNewName] = useState('');

  const load = useCallback(() => {
    setExercises(getExercises(workoutId));
    const w = getWorkouts().find(w => w.id === workoutId);
    if (w) setWorkoutName(w.name);
  }, [workoutId]);

  useFocusEffect(load);

  function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    addExercise(workoutId, trimmed);
    setNewName('');
    load();
    inputRef.current?.focus();
  }

  function handleDelete(e: Exercise) {
    Alert.alert('Delete Exercise', `Delete "${e.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteExercise(e.id); load(); } },
    ]);
  }

  async function startSession() {
    if (exercises.length === 0) {
      Alert.alert('No exercises', 'Add at least one exercise first.');
      return;
    }
    // Check if a session was recently in progress for THIS workout
    const recent = await getRecentSession();
    if (recent && recent.workout_id === workoutId && !recent.is_cardio) {
      if (!recent.finished) {
        // Mid-workout — silently resume, no popup
        router.push(`/workout/log/${recent.session_id}?workoutId=${workoutId}`);
        return;
      }
      // Finished — ask whether to start fresh or edit last
      Alert.alert(
        'Start new session?',
        `You already finished ${workoutName} recently.`,
        [
          {
            text: 'New session',
            onPress: async () => {
              await clearLastSession();
              const sessionId = createSession(workoutId);
              router.push(`/workout/log/${sessionId}?workoutId=${workoutId}`);
            },
          },
          {
            text: 'Edit last',
            onPress: async () => {
              await clearLastSession();
              router.push(`/workout/log/${recent.session_id}?workoutId=${workoutId}`);
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
    const sessionId = createSession(workoutId);
    router.push(`/workout/log/${sessionId}?workoutId=${workoutId}`);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{workoutName}</Text>
        <View style={styles.back} />
      </View>

      <FlatList
        data={exercises}
        keyExtractor={e => String(e.id)}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🏋️</Text>
            <Text style={styles.emptyText}>No exercises yet</Text>
            <Text style={styles.emptySubText}>Type below to add</Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={styles.exerciseRow}>
            <Text style={styles.exerciseNum}>{index + 1}</Text>
            <Text style={styles.exerciseName}>{item.name}</Text>
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="trash-outline" size={17} color="#333" />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Bottom action area — Start button + add exercise bar */}
      <View style={styles.bottomArea}>
        <TouchableOpacity
          style={[styles.startBtn, exercises.length === 0 && styles.startBtnDisabled]}
          onPress={startSession}
          activeOpacity={0.85}
          disabled={exercises.length === 0}
        >
          <Ionicons name="flash" size={20} color="#fff" />
          <Text style={styles.startText}>Start Workout</Text>
        </TouchableOpacity>

        {/* Inline add bar */}
        <View style={styles.addBar}>
          <TextInput
            ref={inputRef}
            style={styles.addInput}
            placeholder="Add exercise..."
            placeholderTextColor="#444"
            value={newName}
            onChangeText={setNewName}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.addBtn, !newName.trim() && styles.addBtnDisabled]}
            onPress={handleAdd}
            disabled={!newName.trim()}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: STATUS_BAR_H + 12, paddingBottom: 14,
    backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#111',
  },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#e8e8ff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#6C63FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  startBtnDisabled: { backgroundColor: '#1a1a2a' },
  startText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  empty: { alignItems: 'center', marginTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { color: '#e8e8ff', fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySubText: { color: '#444', fontSize: 14 },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0a0a0a', borderRadius: 12, padding: 14, marginBottom: 7,
    borderWidth: 1, borderColor: '#111',
  },
  exerciseNum:  { color: '#6C63FF', fontSize: 14, fontWeight: '700', width: 22, textAlign: 'center' },
  exerciseName: { flex: 1, color: '#e8e8ff', fontSize: 15, fontWeight: '500' },
  bottomArea: {
    backgroundColor: '#000',
    borderTopWidth: 1, borderTopColor: '#111',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
    gap: 10,
  },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6C63FF', paddingVertical: 16, borderRadius: 16,
  },
  startBtnDisabled: { backgroundColor: '#1a1a2a' },
  startText: { color: '#fff', fontWeight: '800', fontSize: 17, letterSpacing: 0.2 },
  addBar: {
    flexDirection: 'row', gap: 10,
  },
  addInput: {
    flex: 1, backgroundColor: '#0a0a0a', color: '#e8e8ff', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#111',
  },
  addBtn: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
  },
  addBtnDisabled: { backgroundColor: '#1a1a2a' },
});
