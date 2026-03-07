import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  Modal, FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  getExercises, addSet, getSetsForSession, deleteSet,
  getLastSetForExercise, saveLastSessionTime, getWorkouts, Exercise, Set,
} from '@/src/db';

type ExerciseSets = { exercise: Exercise; sets: Set[] };
type Draft = { weight: string; reps: string; comment: string };

// Generate scroll picker options
const WEIGHT_OPTIONS = Array.from({ length: 101 }, (_, i) => i * 2.5); // 0 to 250kg in 2.5 steps
const REPS_OPTIONS = Array.from({ length: 50 }, (_, i) => i + 1); // 1–50

function ScrollPicker({
  values, selected, onSelect, label, unit,
}: {
  values: number[]; selected: number; onSelect: (v: number) => void;
  label: string; unit: string;
}) {
  const [visible, setVisible] = useState(false);
  const [manualText, setManualText] = useState('');
  const [isManual, setIsManual] = useState(false);
  const flatRef = useRef<FlatList>(null);

  function open() {
    setManualText(String(selected));
    setIsManual(false);
    setVisible(true);
    // scroll to selected item
    const idx = values.indexOf(selected);
    setTimeout(() => {
      if (idx >= 0) flatRef.current?.scrollToIndex({ index: idx, viewPosition: 0.4, animated: false });
    }, 100);
  }

  function confirm() {
    if (isManual) {
      const parsed = parseFloat(manualText);
      if (!isNaN(parsed) && parsed >= 0) onSelect(parsed);
    }
    setVisible(false);
  }

  return (
    <>
      <TouchableOpacity style={pickerStyles.trigger} onPress={open}>
        <Text style={pickerStyles.triggerValue}>{selected === 0 && label === 'Weight' ? '–' : selected}</Text>
        <Text style={pickerStyles.triggerUnit}>{unit}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.sheet}>
            <Text style={pickerStyles.title}>{label}</Text>

            <View style={pickerStyles.tabs}>
              <TouchableOpacity
                style={[pickerStyles.tab, !isManual && pickerStyles.tabActive]}
                onPress={() => setIsManual(false)}
              >
                <Text style={[pickerStyles.tabText, !isManual && pickerStyles.tabTextActive]}>Scroll</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[pickerStyles.tab, isManual && pickerStyles.tabActive]}
                onPress={() => setIsManual(true)}
              >
                <Text style={[pickerStyles.tabText, isManual && pickerStyles.tabTextActive]}>Type</Text>
              </TouchableOpacity>
            </View>

            {isManual ? (
              <View style={pickerStyles.manualWrap}>
                <TextInput
                  style={pickerStyles.manualInput}
                  keyboardType="decimal-pad"
                  value={manualText}
                  onChangeText={setManualText}
                  autoFocus
                  placeholder={`e.g. 12.5`}
                  placeholderTextColor="#555"
                />
                <Text style={pickerStyles.manualUnit}>{unit}</Text>
              </View>
            ) : (
              <FlatList
                ref={flatRef}
                data={values}
                keyExtractor={v => String(v)}
                style={pickerStyles.list}
                showsVerticalScrollIndicator={false}
                getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[pickerStyles.item, item === selected && pickerStyles.itemSelected]}
                    onPress={() => { onSelect(item); setVisible(false); }}
                  >
                    <Text style={[pickerStyles.itemText, item === selected && pickerStyles.itemTextSelected]}>
                      {item} {unit}
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

export default function LogScreen() {
  const { sessionId, workoutId } = useLocalSearchParams<{ sessionId: string; workoutId: string }>();
  const router = useRouter();

  const [data, setData] = useState<ExerciseSets[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});

  const load = useCallback(() => {
    const exercises = getExercises(Number(workoutId));
    const sets = getSetsForSession(Number(sessionId));
    const mapped: ExerciseSets[] = exercises.map(e => ({
      exercise: e,
      sets: sets.filter(s => s.exercise_id === e.id),
    }));
    setData(mapped);
    setDrafts(prev => {
      const next: Record<number, Draft> = {};
      exercises.forEach(e => {
        next[e.id] = prev[e.id] ?? { weight: '0', reps: '1', comment: '' };
      });
      return next;
    });
  }, [sessionId, workoutId]);

  useFocusEffect(load);

  function setDraftField(exerciseId: number, field: keyof Draft, value: string) {
    setDrafts(prev => ({ ...prev, [exerciseId]: { ...prev[exerciseId], [field]: value } }));
  }

  function setDraftNum(exerciseId: number, field: 'weight' | 'reps', value: number) {
    setDrafts(prev => ({ ...prev, [exerciseId]: { ...prev[exerciseId], [field]: String(value) } }));
  }

  function handleCopyLast(exerciseId: number) {
    const last = getLastSetForExercise(exerciseId);
    if (!last) { Alert.alert('No previous set', 'Nothing to copy yet.'); return; }
    setDrafts(prev => ({
      ...prev,
      [exerciseId]: {
        weight: String(last.weight),
        reps: String(last.reps),
        comment: prev[exerciseId]?.comment ?? '',
      },
    }));
  }

  function handleAddSet(exerciseId: number) {
    const draft = drafts[exerciseId];
    const weight = parseFloat(draft?.weight || '0') || 0;
    const reps = parseInt(draft?.reps || '0') || 0;
    if (reps === 0) { Alert.alert('Enter reps', 'Please enter at least 1 rep.'); return; }
    const existing = data.find(d => d.exercise.id === exerciseId)?.sets ?? [];
    addSet(Number(sessionId), exerciseId, weight, reps, existing.length + 1, draft?.comment);
    load();
  }

  function handleDeleteSet(setId: number) {
    Alert.alert('Delete set?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteSet(setId); load(); } },
    ]);
  }

  async function finishWorkout() {
    // Save session info for "resume within 1hr" detection on home screen
    const workouts = getWorkouts();
    const w = workouts.find(w => w.id === Number(workoutId));
    if (w) {
      await saveLastSessionTime(Number(sessionId), w.id, w.name, w.is_cardio);
    }
    router.replace('/');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Log Workout</Text>
        <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {data.map(({ exercise, sets }) => {
          const draft = drafts[exercise.id] ?? { weight: '0', reps: '1', comment: '' };
          const weightVal = parseFloat(draft.weight) || 0;
          const repsVal = parseInt(draft.reps) || 1;

          return (
            <View key={exercise.id} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>

              {sets.length > 0 && (
                <View style={styles.setsTable}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHead, { flex: 0.5 }]}>SET</Text>
                    <Text style={styles.tableHead}>KG</Text>
                    <Text style={styles.tableHead}>REPS</Text>
                    <Text style={[styles.tableHead, { flex: 2 }]}>NOTE</Text>
                    <Text style={[styles.tableHead, { flex: 0.4 }]} />
                  </View>
                  {sets.map(s => (
                    <View key={s.id} style={styles.tableRow}>
                      <Text style={[styles.tableCell, styles.setNum, { flex: 0.5 }]}>{s.set_number}</Text>
                      <Text style={styles.tableCell}>{s.weight}</Text>
                      <Text style={styles.tableCell}>{s.reps}</Text>
                      <Text style={[styles.tableCell, { flex: 2 }]} numberOfLines={1}>{s.comment || '–'}</Text>
                      <TouchableOpacity onPress={() => handleDeleteSet(s.id)} style={{ flex: 0.4, alignItems: 'center' }}>
                        <Ionicons name="trash-outline" size={14} color="#ff4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Scroll pickers */}
              <View style={styles.pickerRow}>
                <View style={styles.pickerGroup}>
                  <Text style={styles.pickerLabel}>Weight (kg)</Text>
                  <ScrollPicker
                    values={WEIGHT_OPTIONS}
                    selected={weightVal}
                    onSelect={v => setDraftNum(exercise.id, 'weight', v)}
                    label="Weight"
                    unit="kg"
                  />
                </View>
                <View style={styles.pickerGroup}>
                  <Text style={styles.pickerLabel}>Reps</Text>
                  <ScrollPicker
                    values={REPS_OPTIONS}
                    selected={repsVal}
                    onSelect={v => setDraftNum(exercise.id, 'reps', v)}
                    label="Reps"
                    unit=""
                  />
                </View>
              </View>

              <TextInput
                style={styles.commentInput}
                value={draft.comment}
                onChangeText={v => setDraftField(exercise.id, 'comment', v)}
                placeholder="Comment (optional)"
                placeholderTextColor="#555"
              />

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.copyBtn} onPress={() => handleCopyLast(exercise.id)}>
                  <Ionicons name="copy-outline" size={16} color="#888" />
                  <Text style={styles.copyText}>Copy last</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addSetBtn} onPress={() => handleAddSet(exercise.id)}>
                  <Ionicons name="add" size={18} color="#6C63FF" />
                  <Text style={styles.addSetText}>Add Set</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.bigFinish} onPress={() => finishWorkout()}>
          <Ionicons name="checkmark-circle" size={22} color="#fff" />
          <Text style={styles.bigFinishText}>Finish Workout</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const pickerStyles = StyleSheet.create({
  trigger: {
    backgroundColor: '#0f0f1a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a4a',
    paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center', flexDirection: 'row',
    justifyContent: 'center', gap: 4,
  },
  triggerValue: { color: '#fff', fontSize: 22, fontWeight: '700' },
  triggerUnit: { color: '#666', fontSize: 13, marginTop: 4 },
  overlay: { flex: 1, backgroundColor: '#000000bb', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#1a1a2e', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '70%',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 4, marginBottom: 12 },
  tab: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText: { color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  list: { maxHeight: 260 },
  item: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  itemSelected: { backgroundColor: '#2a2a4a' },
  itemText: { color: '#888', fontSize: 18 },
  itemTextSelected: { color: '#6C63FF', fontWeight: '700', fontSize: 20 },
  manualWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 20,
  },
  manualInput: {
    backgroundColor: '#0f0f1a', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 28, fontWeight: '700', textAlign: 'center',
    borderWidth: 1, borderColor: '#2a2a4a', width: 140,
  },
  manualUnit: { color: '#888', fontSize: 18 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#2a2a4a', alignItems: 'center',
  },
  cancelText: { color: '#aaa', fontWeight: '600' },
  confirmBtn: {
    flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#6C63FF', alignItems: 'center',
  },
  confirmText: { color: '#fff', fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, paddingTop: 56, backgroundColor: '#1a1a2e',
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  finishBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  finishText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { padding: 16, paddingBottom: 60 },
  exerciseCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#2a2a4a',
  },
  exerciseName: { color: '#6C63FF', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  setsTable: { marginBottom: 12 },
  tableHeader: { flexDirection: 'row', marginBottom: 4 },
  tableHead: { flex: 1, color: '#555', fontSize: 11, fontWeight: '700' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#2a2a4a',
  },
  tableCell: { flex: 1, color: '#ccc', fontSize: 14 },
  setNum: { color: '#6C63FF', fontWeight: '700' },
  pickerRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  pickerGroup: { flex: 1 },
  pickerLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  commentInput: {
    backgroundColor: '#0f0f1a', color: '#fff', borderRadius: 8,
    padding: 12, fontSize: 14, borderWidth: 1, borderColor: '#2a2a4a', marginBottom: 10,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  copyBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a4a',
  },
  copyText: { color: '#888', fontWeight: '600', fontSize: 13 },
  addSetBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#6C63FF',
  },
  addSetText: { color: '#6C63FF', fontWeight: '600' },
  bigFinish: {
    backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8, padding: 16, borderRadius: 14, marginTop: 8,
  },
  bigFinishText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
