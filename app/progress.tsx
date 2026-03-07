import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import {
  getWorkouts, getExercises, getExerciseProgress,
  Workout, Exercise, ProgressPoint,
} from '@/src/db';

const SCREEN_W = Dimensions.get('window').width;
const COLORS = ['#6C63FF', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

export default function ProgressScreen() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [progressData, setProgressData] = useState<Record<number, ProgressPoint[]>>({});
  const [viewMode, setViewMode] = useState<'weight' | 'volume'>('weight');

  // Load workouts when screen is focused
  useFocusEffect(
    useCallback(() => {
      const ws = getWorkouts();
      setWorkouts(ws);
      if (ws.length > 0) {
        setSelectedWorkout(prev => prev ?? ws[0]);
      }
    }, [])
  );

  // Load exercises + progress when selected workout changes
  useEffect(() => {
    if (!selectedWorkout) return;
    const exs = getExercises(selectedWorkout.id);
    setExercises(exs);
    const pd: Record<number, ProgressPoint[]> = {};
    exs.forEach(e => { pd[e.id] = getExerciseProgress(e.id); });
    setProgressData(pd);
  }, [selectedWorkout]);

  function selectWorkout(w: Workout) {
    setSelectedWorkout(w);
  }

  function chartPoints(points: ProgressPoint[]) {
    if (points.length === 0) return [];
    return points.map(p => ({
      value: viewMode === 'weight' ? p.weight : p.volume,
      label: p.date.slice(5),
      dataPointText: viewMode === 'weight' ? `${p.weight}` : `${Math.round(p.volume)}`,
    }));
  }

  return (
    <View style={styles.container}>
      {/* Workout tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.tabBar} contentContainerStyle={styles.tabContent}
      >
        {workouts.map(w => (
          <TouchableOpacity
            key={w.id}
            style={[styles.tab, selectedWorkout?.id === w.id && styles.tabActive]}
            onPress={() => selectWorkout(w)}
          >
            <Text style={[styles.tabText, selectedWorkout?.id === w.id && styles.tabTextActive]}>
              {w.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trending-up-outline" size={64} color="#333" />
          <Text style={styles.emptyText}>No workouts yet</Text>
        </View>
      ) : (
        <>
          <View style={styles.modeRow}>
            <View style={styles.toggle}>
              {(['weight', 'volume'] as const).map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.toggleBtn, viewMode === m && styles.toggleActive]}
                  onPress={() => setViewMode(m)}
                >
                  <Text style={[styles.toggleText, viewMode === m && styles.toggleTextActive]}>
                    {m === 'weight' ? '⬆ Weight' : '📦 Volume'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {exercises.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No exercises in this workout</Text>
              </View>
            ) : (
              exercises.map((e, i) => {
                const points = chartPoints(progressData[e.id] ?? []);
                return (
                  <View key={e.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={[styles.dot, { backgroundColor: COLORS[i % COLORS.length] }]} />
                      <Text style={styles.exerciseName}>{e.name}</Text>
                    </View>
                    {points.length < 2 ? (
                      <View style={styles.noData}>
                        <Text style={styles.noDataText}>
                          {points.length === 0
                            ? 'No data yet — log a session to see progress'
                            : 'Log one more session to see the chart'}
                        </Text>
                      </View>
                    ) : (
                      <LineChart
                        data={points}
                        width={SCREEN_W - 80}
                        height={160}
                        color={COLORS[i % COLORS.length]}
                        thickness={2}
                        hideDataPoints={false}
                        dataPointsColor={COLORS[i % COLORS.length]}
                        dataPointsRadius={4}
                        startFillColor={COLORS[i % COLORS.length]}
                        startOpacity={0.2}
                        endOpacity={0}
                        areaChart
                        curved
                        hideRules={false}
                        rulesColor="#2a2a4a"
                        xAxisThickness={0}
                        yAxisThickness={0}
                        yAxisTextStyle={{ color: '#666', fontSize: 10 }}
                        xAxisLabelTextStyle={{ color: '#666', fontSize: 9 }}
                        noOfSections={4}
                        textShiftY={-8}
                        textShiftX={-4}
                        textColor={COLORS[i % COLORS.length]}
                        textFontSize={10}
                      />
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  tabBar: { maxHeight: 52, backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#2a2a4a' },
  tabContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#0f0f1a' },
  tabActive: { backgroundColor: '#6C63FF' },
  tabText: { color: '#666', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },
  modeRow: { padding: 12, backgroundColor: '#1a1a2e' },
  toggle: { flexDirection: 'row', backgroundColor: '#0f0f1a', borderRadius: 8, padding: 4 },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 6, alignItems: 'center' },
  toggleActive: { backgroundColor: '#6C63FF' },
  toggleText: { color: '#666', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff' },
  scroll: { padding: 16, paddingBottom: 40 },
  exerciseCard: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#2a2a4a',
  },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  exerciseName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  noData: { padding: 24, alignItems: 'center' },
  noDataText: { color: '#555', fontSize: 13, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 12 },
  emptyText: { color: '#555', fontSize: 16 },
});
