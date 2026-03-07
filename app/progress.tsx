import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { getWorkouts, getExercises, getExerciseProgress, Workout, Exercise, ProgressPoint } from '@/src/db';

const SCREEN_W = Dimensions.get('window').width;
const COLORS   = ['#6C63FF', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899'];

export default function ProgressScreen() {
  const [workouts,      setWorkouts]      = useState<Workout[]>([]);
  const [selectedWorkout, setSelected]   = useState<Workout | null>(null);
  const [exercises,     setExercises]     = useState<Exercise[]>([]);
  const [progressData,  setProgressData]  = useState<Record<number, ProgressPoint[]>>({});
  const [viewMode,      setViewMode]      = useState<'weight' | 'volume'>('weight');

  useFocusEffect(useCallback(() => {
    const ws = getWorkouts();
    setWorkouts(ws);
    setSelected(prev => prev ?? ws[0] ?? null);
  }, []));

  useEffect(() => {
    if (!selectedWorkout) return;
    const exs = getExercises(selectedWorkout.id);
    setExercises(exs);
    const pd: Record<number, ProgressPoint[]> = {};
    exs.forEach(e => { pd[e.id] = getExerciseProgress(e.id); });
    setProgressData(pd);
  }, [selectedWorkout]);

  function chartPoints(points: ProgressPoint[]) {
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
        {workouts.filter(w => !w.is_cardio).map(w => (
          <TouchableOpacity
            key={w.id}
            style={[styles.tab, selectedWorkout?.id === w.id && styles.tabActive]}
            onPress={() => setSelected(w)}
          >
            <Text style={[styles.tabText, selectedWorkout?.id === w.id && styles.tabTextActive]}>
              {w.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {workouts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trending-up-outline" size={56} color="#1a1a1a" />
          <Text style={styles.emptyText}>No workouts yet</Text>
        </View>
      ) : (
        <>
          {/* Weight / Volume toggle */}
          <View style={styles.modeBar}>
            {(['weight', 'volume'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, viewMode === m && styles.modeBtnActive]}
                onPress={() => setViewMode(m)}
              >
                <Text style={[styles.modeBtnText, viewMode === m && styles.modeBtnTextActive]}>
                  {m === 'weight' ? '⬆ Max Weight' : '📦 Volume'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.scroll}>
            {exercises.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No exercises in this workout</Text>
              </View>
            ) : exercises.map((e, i) => {
              const points = chartPoints(progressData[e.id] ?? []);
              const color  = COLORS[i % COLORS.length];
              return (
                <View key={e.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text style={styles.cardTitle}>{e.name}</Text>
                    {points.length > 0 && (
                      <Text style={[styles.cardPeak, { color }]}>
                        {viewMode === 'weight'
                          ? `${Math.max(...points.map(p => p.value))} kg`
                          : `${Math.round(Math.max(...points.map(p => p.value)))} vol`}
                      </Text>
                    )}
                  </View>
                  {points.length < 2 ? (
                    <View style={styles.noData}>
                      <Text style={styles.noDataText}>
                        {points.length === 0 ? 'Log a session to see progress' : 'One more session needed'}
                      </Text>
                    </View>
                  ) : (
                    <LineChart
                      data={points}
                      width={SCREEN_W - 72}
                      height={150}
                      color={color}
                      thickness={2}
                      dataPointsColor={color}
                      dataPointsRadius={4}
                      startFillColor={color}
                      startOpacity={0.15}
                      endOpacity={0}
                      areaChart curved
                      hideRules={false}
                      rulesColor="#111"
                      xAxisThickness={0}
                      yAxisThickness={0}
                      yAxisTextStyle={{ color: '#333', fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: '#333', fontSize: 9 }}
                      noOfSections={3}
                      textShiftY={-8} textShiftX={-4}
                      textColor={color} textFontSize={10}
                    />
                  )}
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  tabBar:    { maxHeight: 50, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#111' },
  tabContent:{ paddingHorizontal: 12, paddingVertical: 9, gap: 8, alignItems: 'center' },
  tab:       { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#111' },
  tabActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  tabText:   { color: '#333', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },

  modeBar:  {
    flexDirection: 'row', padding: 10, gap: 8,
    borderBottomWidth: 1, borderBottomColor: '#111', backgroundColor: '#000',
  },
  modeBtn:  { flex: 1, padding: 9, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  modeBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  modeBtnText: { color: '#333', fontWeight: '600', fontSize: 13 },
  modeBtnTextActive: { color: '#fff' },

  scroll: { padding: 12, paddingBottom: 40 },
  card: {
    backgroundColor: '#0a0a0a', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#111',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dot:        { width: 9, height: 9, borderRadius: 5 },
  cardTitle:  { flex: 1, color: '#e8e8ff', fontSize: 14, fontWeight: '700' },
  cardPeak:   { fontSize: 13, fontWeight: '700' },

  noData:    { padding: 20, alignItems: 'center' },
  noDataText:{ color: '#333', fontSize: 13 },
  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 10 },
  emptyText: { color: '#333', fontSize: 16 },
});
