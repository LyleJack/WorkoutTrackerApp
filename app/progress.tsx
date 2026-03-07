import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import {
  getUniqueWorkoutNames, getHistoricalExerciseNames,
  getExerciseProgress, ProgressPoint,
} from '@/src/db';

const SCREEN_W       = Dimensions.get('window').width;
const COLORS         = ['#6C63FF', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6'];
const WEIGHTED_CLR   = '#af14a2ff';   // orange dot for weighted sessions on a BW exercise
const BODYWEIGHT_CLR = '#6C63FF';   // normal colour for pure bodyweight reps

// Classification: if the MAJORITY of sessions are bodyweight (0 kg),
// treat the exercise as bodyweight and always plot reps.
// Weighted sessions on a BW exercise get an orange dot and a tap tooltip.
function classifyExercise(points: ProgressPoint[]) {
  if (points.length === 0) return { isBW: false, hasMixed: false };
  const bwCount      = points.filter(p => p.weight === 0).length;
  const isBW         = bwCount >= points.length / 2;   // majority rule
  const hasMixed     = isBW && points.some(p => p.weight > 0);
  return { isBW, hasMixed };
}

export default function ProgressScreen() {
  const [workoutNames,  setWorkoutNames]  = useState<string[]>([]);
  const [selectedName,  setSelectedName]  = useState<string | null>(null);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [progressData,  setProgressData]  = useState<Record<string, ProgressPoint[]>>({});
  const [viewMode,      setViewMode]      = useState<'weight' | 'volume'>('weight');
  const isTabChange = useRef(false);
  const scrollRef   = useRef<ScrollView>(null);
  const [tooltip, setTooltip] = useState<{ date: string; value: string } | null>(null);

  useFocusEffect(useCallback(() => {
    const names = getUniqueWorkoutNames();
    setWorkoutNames(names);
    setSelectedName(prev => (prev && names.includes(prev)) ? prev : (names[0] ?? null));
  }, []));

  useEffect(() => {
    if (!selectedName) return;
    const exNames = getHistoricalExerciseNames(selectedName);
    setExerciseNames(exNames);
    const pd: Record<string, ProgressPoint[]> = {};
    exNames.forEach(n => { pd[n] = getExerciseProgress(n); });
    setProgressData(pd);
    if (isTabChange.current) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      isTabChange.current = false;
    }
  }, [selectedName]);

  function selectName(name: string) {
    if (name === selectedName) return;
    isTabChange.current = true;
    setSelectedName(name);
  }

  function buildChartPoints(points: ProgressPoint[], isBW: boolean, baseColor: string) {
    return points.map(p => {
      const isWeightedSession = p.weight > 0;

      let yVal: number;
      if (isBW) {
        // Always plot reps on Y axis for bodyweight exercises
        yVal = p.max_reps ?? 1;
      } else {
        yVal = viewMode === 'weight' ? p.weight : p.volume;
      }

      const dotColor = (isBW && isWeightedSession) ? WEIGHTED_CLR : baseColor;

      return {
        value: yVal,
        label: p.date.slice(5),
        dataPointColor: dotColor,
        onPress: () => {
          let label: string;
          if (isBW && isWeightedSession) {
            label = `${p.max_reps} reps + ${p.weight} kg`;
          } else if (isBW) {
            label = `${p.max_reps ?? '?'} reps`;
          } else {
            label = viewMode === 'weight' ? `${p.weight} kg` : `${Math.round(p.volume)} vol`;
          }
          setTooltip({ date: p.date, value: label });
        },
      };
    });
  }

  return (
    <ErrorBoundary fallbackLabel="Something went wrong in Progress.">
      <View style={styles.container}>
        <AppHeader title="Progress" />

        {/* Tap-to-dismiss tooltip */}
        <Modal visible={!!tooltip} transparent animationType="fade">
          <TouchableOpacity style={tt.overlay} activeOpacity={1} onPress={() => setTooltip(null)}>
            <View style={tt.box}>
              <Text style={tt.date}>{tooltip?.date}</Text>
              <Text style={tt.value}>{tooltip?.value}</Text>
              <Text style={tt.hint}>Tap to close</Text>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Workout name tab strip — deduplicated by name */}
        {workoutNames.length > 0 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.tabBar} contentContainerStyle={styles.tabContent}
          >
            {workoutNames.map(name => (
              <TouchableOpacity
                key={name}
                style={[styles.tab, selectedName === name && styles.tabActive]}
                onPress={() => selectName(name)}
              >
                <Text style={[styles.tabText, selectedName === name && styles.tabTextActive]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Weight / Volume toggle — hidden for pure-BW workouts where it's irrelevant */}
        {workoutNames.length > 0 && (
          <View style={styles.modeBar}>
            {(['weight', 'volume'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, viewMode === m && styles.modeBtnActive]}
                onPress={() => setViewMode(m)}
              >
                <Text style={[styles.modeBtnText, viewMode === m && styles.modeBtnTextActive]}>
                  {m === 'weight' ? 'Max Weight' : 'Volume'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {workoutNames.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trending-up-outline" size={56} color="#1a1a1a" />
            <Text style={styles.emptyText}>No workouts yet</Text>
          </View>
        ) : (
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {exerciseNames.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No sets logged for this workout yet</Text>
              </View>
            ) : exerciseNames.map((name, i) => {
              const rawPoints  = progressData[name] ?? [];
              const { isBW, hasMixed } = classifyExercise(rawPoints);
              const baseColor  = COLORS[i % COLORS.length];
              const points     = buildChartPoints(rawPoints, isBW, baseColor);

              // Peak values for header badge
              const peakReps   = isBW ? Math.max(0, ...rawPoints.map(p => p.max_reps ?? 0)) : 0;
              const peakWeight = !isBW ? Math.max(0, ...rawPoints.filter(p => p.weight > 0).map(p => p.weight)) : 0;
              const peakVol    = !isBW ? Math.max(0, ...rawPoints.map(p => p.volume)) : 0;

              return (
                <View key={name} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.dot, { backgroundColor: baseColor }]} />
                    <Text style={styles.cardTitle}>{name}</Text>

                    {/* Badge: BW label */}
                    {isBW && (
                      <View style={styles.bwBadge}>
                        <Text style={styles.bwBadgeText}>BW</Text>
                      </View>
                    )}

                    {/* Peak value */}
                    {isBW && peakReps > 0 && (
                      <Text style={[styles.cardPeak, { color: baseColor }]}>{peakReps} reps</Text>
                    )}
                    {!isBW && peakWeight > 0 && (
                      <Text style={[styles.cardPeak, { color: baseColor }]}>
                        {viewMode === 'weight' ? `${peakWeight} kg` : `${Math.round(peakVol)} vol`}
                      </Text>
                    )}
                  </View>

                  {/* Mixed legend — only shown when a BW exercise has some weighted sessions */}
                  {hasMixed && (
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: baseColor }]} />
                        <Text style={styles.legendText}>Bodyweight</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: WEIGHTED_CLR }]} />
                        <Text style={styles.legendText}>+ added weight (tap for kg)</Text>
                      </View>
                    </View>
                  )}

                  {points.length < 2 ? (
                    <View style={styles.noData}>
                      <Text style={styles.noDataText}>
                        {points.length === 0 ? 'No sets logged yet' : 'One more session to show chart'}
                      </Text>
                    </View>
                  ) : (
                    <LineChart
                      data={points}
                      width={SCREEN_W - 72}
                      height={150}
                      color={baseColor}
                      thickness={2}
                      dataPointsColor={baseColor}
                      dataPointsRadius={5}
                      startFillColor={baseColor}
                      startOpacity={0.15}
                      endOpacity={0}
                      areaChart
                      curved
                      hideRules={false}
                      rulesColor="#111"
                      xAxisThickness={0}
                      yAxisThickness={0}
                      yAxisTextStyle={{ color: '#333', fontSize: 10 }}
                      xAxisLabelTextStyle={{ color: '#333', fontSize: 9 }}
                      noOfSections={3}
                      textShiftY={-8}
                      textShiftX={-4}
                      textColor={baseColor}
                      textFontSize={10}
                    />
                  )}
                </View>
              );
            })}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </ErrorBoundary>
  );
}

const tt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  box: {
    backgroundColor: '#0d0d18', borderRadius: 16, padding: 20,
    minWidth: 160, alignItems: 'center',
    borderWidth: 1, borderColor: '#1a1a2a',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  date:  { color: '#555', fontSize: 12, marginBottom: 6 },
  value: { color: '#e8e8ff', fontSize: 24, fontWeight: '800' },
  hint:  { color: '#333', fontSize: 11, marginTop: 10 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  tabBar:     { height: 52, flexShrink: 0, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#111' },
  tabContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52, gap: 8 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#1a1a2a',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tabActive:     { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  tabText:       { color: '#444', fontWeight: '600', fontSize: 13 },
  tabTextActive: { color: '#fff' },

  modeBar:           { flexDirection: 'row', padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#111', backgroundColor: '#000' },
  modeBtn:           { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  modeBtnActive:     { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  modeBtnText:       { color: '#444', fontWeight: '600', fontSize: 13 },
  modeBtnTextActive: { color: '#fff' },

  scroll:     { padding: 12, paddingBottom: 40 },
  card:       { backgroundColor: '#0a0a0a', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dot:        { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  cardTitle:  { flex: 1, color: '#e8e8ff', fontSize: 14, fontWeight: '700' },
  cardPeak:   { fontSize: 13, fontWeight: '700', flexShrink: 0 },

  bwBadge:     { backgroundColor: '#6C63FF20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#6C63FF40' },
  bwBadgeText: { color: '#6C63FF', fontSize: 10, fontWeight: '700' },

  legend:     { flexDirection: 'row', gap: 14, marginBottom: 10, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:  { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: '#444', fontSize: 11 },

  noData:     { padding: 20, alignItems: 'center' },
  noDataText: { color: '#333', fontSize: 13 },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 10 },
  emptyText:  { color: '#333', fontSize: 16 },
});
