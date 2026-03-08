import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { C, FONT } from '@/src/theme';
import { formatDuration } from '@/src/utils';
import {
  getUniqueWorkoutNames, getHistoricalExerciseNames,
  getExerciseProgress, getCardioProgress,
  ProgressPoint, CardioProgressPoint,
} from '@/src/db';

const SCREEN_W        = Dimensions.get('window').width;
const COLORS          = ['#6C63FF','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6'];
const BW_WEIGHTED_CLR = C.orange;

// ── Classifiers ────────────────────────────────────────────────────────────────

function isDurationExercise(points: ProgressPoint[]) {
  return points.some(p => (p.max_duration_seconds ?? 0) > 0);
}

function classifyExercise(points: ProgressPoint[]) {
  if (points.length === 0) return { isBW: false, isDuration: false, hasMixed: false };
  if (isDurationExercise(points)) return { isBW: false, isDuration: true, hasMixed: false };
  const bwCount  = points.filter(p => p.weight === 0).length;
  const isBW     = bwCount >= points.length / 2;
  const hasMixed = isBW && points.some(p => p.weight > 0);
  return { isBW, isDuration: false, hasMixed };
}

// ── Progress screen ─────────────────────────────────────────────────────────────

export default function ProgressScreen() {
  const [workoutNames,  setWorkoutNames]  = useState<string[]>([]);
  const [selectedName,  setSelectedName]  = useState<string | null>(null);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [progressData,  setProgressData]  = useState<Record<string, ProgressPoint[]>>({});
  const [cardioData,    setCardioData]    = useState<CardioProgressPoint[]>([]);
  const [viewMode,      setViewMode]      = useState<'weight' | 'volume'>('weight');
  const isTabChange = useRef(false);
  const scrollRef   = useRef<ScrollView>(null);
  const [tooltip, setTooltip] = useState<{ date: string; value: string } | null>(null);

  const CARDIO_TAB = '🏃 Cardio';

  useFocusEffect(useCallback(() => {
    const names = getUniqueWorkoutNames();
    const allTabs = [...names, CARDIO_TAB];
    setWorkoutNames(allTabs);
    setSelectedName(prev => (prev && allTabs.includes(prev)) ? prev : (allTabs[0] ?? null));
  }, []));

  useEffect(() => {
    if (!selectedName) return;
    if (selectedName === CARDIO_TAB) {
      setCardioData(getCardioProgress());
      setExerciseNames([]);
      setProgressData({});
    } else {
      const exNames = getHistoricalExerciseNames(selectedName);
      setExerciseNames(exNames);
      const pd: Record<string, ProgressPoint[]> = {};
      exNames.forEach(n => { pd[n] = getExerciseProgress(n); });
      setProgressData(pd);
      setCardioData([]);
    }
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

  // ── Build chart points for strength/BW/duration exercises ──────────────────

  function buildChartPoints(points: ProgressPoint[], isBW: boolean, isDuration: boolean, baseColor: string) {
    return points.map(p => {
      const isWeighted = p.weight > 0;
      let yVal: number;
      if (isDuration) {
        yVal = p.max_duration_seconds ?? 0;
      } else if (isBW) {
        yVal = p.max_reps ?? 1;
      } else {
        yVal = viewMode === 'weight' ? p.weight : p.volume;
      }
      const dotColor = (isBW && isWeighted) ? BW_WEIGHTED_CLR : baseColor;
      return {
        value: yVal,
        label: p.date.slice(5),
        // dataPointColor per-point is respected when chart-level dataPointsColor is NOT set
        dataPointColor: dotColor,
        onPress: () => {
          let label: string;
          if (isDuration) {
            label = formatDuration(p.max_duration_seconds ?? 0);
            if (isWeighted) label += ` + ${p.weight} kg`;
          } else if (isBW && isWeighted) {
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

  // ── Cardio chart: calories/min per machine ─────────────────────────────────

  function renderCardioCharts() {
    // Group by type name
    const byType: Record<string, CardioProgressPoint[]> = {};
    cardioData.forEach(pt => {
      if (!byType[pt.cardio_type_name]) byType[pt.cardio_type_name] = [];
      byType[pt.cardio_type_name].push(pt);
    });
    const types = Object.keys(byType);
    if (types.length === 0) {
      return (
        <View style={styles.empty}>
          <Ionicons name="bicycle-outline" size={48} color="#1a1a1a" />
          <Text style={styles.emptyText}>No cardio logged yet</Text>
        </View>
      );
    }
    return types.map((typeName, i) => {
      const pts   = byType[typeName];
      const color = COLORS[i % COLORS.length];
      const withCalories = pts.filter(p => p.calories_per_min != null);
      const peakCpm = withCalories.length > 0
        ? Math.max(...withCalories.map(p => p.calories_per_min!))
        : null;
      const chartPts = withCalories.map(p => ({
        value: p.calories_per_min!,
        label: p.date.slice(5),
        dataPointColor: color,
        onPress: () => setTooltip({
          date: p.date,
          value: `${p.calories_per_min} kcal/min\n${p.duration_minutes} min · ${p.calories} kcal${p.distance_km ? ` · ${p.distance_km} km` : ''}`,
        }),
      }));
      return (
        <View key={typeName} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.cardTitle}>{typeName}</Text>
            {peakCpm != null && (
              <Text style={[styles.cardPeak, { color }]}>{peakCpm} kcal/min</Text>
            )}
          </View>
          {withCalories.length === 0 ? (
            <Text style={styles.noDataText}>No sessions with calorie data</Text>
          ) : withCalories.length < 2 ? (
            <View style={styles.noData}>
              <Text style={styles.noDataText}>One more session to show chart</Text>
            </View>
          ) : (
            <LineChart
              data={chartPts}
              width={SCREEN_W - 72}
              height={150}
              color={color}
              thickness={2}
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
            />
          )}
          {/* All sessions list for types without calorie data */}
          {withCalories.length === 0 && pts.map((p, j) => (
            <Text key={j} style={styles.cardioRow}>
              {p.date.slice(5)}  ·  {p.duration_minutes} min{p.distance_km ? `  ·  ${p.distance_km} km` : ''}
            </Text>
          ))}
        </View>
      );
    });
  }

  // ── Strength / BW / duration charts ────────────────────────────────────────

  function renderExerciseCharts() {
    if (exerciseNames.length === 0) {
      return (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No sets logged for this workout yet</Text>
        </View>
      );
    }
    return exerciseNames.map((name, i) => {
      const rawPoints              = progressData[name] ?? [];
      const { isBW, isDuration, hasMixed } = classifyExercise(rawPoints);
      const baseColor              = COLORS[i % COLORS.length];
      const points                 = buildChartPoints(rawPoints, isBW, isDuration, baseColor);

      const peakReps     = isBW      ? Math.max(0, ...rawPoints.map(p => p.max_reps ?? 0)) : 0;
      const peakDur      = isDuration ? Math.max(0, ...rawPoints.map(p => p.max_duration_seconds ?? 0)) : 0;
      const peakWeight   = !isBW && !isDuration ? Math.max(0, ...rawPoints.filter(p => p.weight > 0).map(p => p.weight)) : 0;
      const peakVol      = !isBW && !isDuration ? Math.max(0, ...rawPoints.map(p => p.volume)) : 0;

      const yAxisLabel = isDuration ? 's' : (isBW ? 'reps' : (viewMode === 'weight' ? 'kg' : 'vol'));

      return (
        <View key={name} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: baseColor }]} />
            <Text style={styles.cardTitle}>{name}</Text>
            {(isBW || isDuration) && (
              <View style={styles.bwBadge}>
                <Text style={styles.bwBadgeText}>{isDuration ? '⏱' : 'BW'}</Text>
              </View>
            )}
            {isBW      && peakReps > 0  && <Text style={[styles.cardPeak, { color: baseColor }]}>{peakReps} reps</Text>}
            {isDuration && peakDur  > 0  && <Text style={[styles.cardPeak, { color: baseColor }]}>{formatDuration(peakDur)}</Text>}
            {!isBW && !isDuration && peakWeight > 0 && (
              <Text style={[styles.cardPeak, { color: baseColor }]}>
                {viewMode === 'weight' ? `${peakWeight} kg` : `${Math.round(peakVol)} vol`}
              </Text>
            )}
          </View>

          {/* Mixed legend */}
          {hasMixed && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: baseColor }]} />
                <Text style={styles.legendText}>Bodyweight</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: BW_WEIGHTED_CLR }]} />
                <Text style={styles.legendText}>+ added weight (tap for kg)</Text>
              </View>
            </View>
          )}
          {isDuration && rawPoints.some(p => p.weight > 0) && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: baseColor }]} />
                <Text style={styles.legendText}>Bodyweight</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: BW_WEIGHTED_CLR }]} />
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
              // Do NOT pass dataPointsColor — lets individual dataPointColor per point take effect
              dataPointsRadius={5}
              startFillColor={baseColor}
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
            />
          )}
        </View>
      );
    });
  }

  const isCardioTab = selectedName === CARDIO_TAB;

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

        {/* Tab strip */}
        {workoutNames.length > 0 && (
          <ScrollView
            horizontal showsHorizontalScrollIndicator={false}
            style={styles.tabBar} contentContainerStyle={styles.tabContent}
          >
            {workoutNames.map(name => {
              const isCardio = name === CARDIO_TAB;
              return (
                <TouchableOpacity
                  key={name}
                  style={[styles.tab, selectedName === name && (isCardio ? styles.tabActiveCardio : styles.tabActive)]}
                  onPress={() => selectName(name)}
                >
                  <Text style={[styles.tabText, selectedName === name && styles.tabTextActive]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Weight / Volume toggle — hidden for cardio or pure BW tabs */}
        {!isCardioTab && workoutNames.length > 0 && (
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
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
            {isCardioTab ? renderCardioCharts() : renderExerciseCharts()}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </ErrorBoundary>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const tt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  box: {
    backgroundColor: '#0d0d18', borderRadius: 16, padding: 20,
    minWidth: 180, alignItems: 'center',
    borderWidth: 1, borderColor: '#1a1a2a',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20,
  },
  date:  { color: '#555', fontSize: 12, marginBottom: 6 },
  value: { color: '#e8e8ff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  hint:  { color: '#333', fontSize: 11, marginTop: 10 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  tabBar:          { height: 52, flexShrink: 0, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#111' },
  tabContent:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52, gap: 8 },
  tab:             { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#1a1a2a', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tabActive:       { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  tabActiveCardio: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  tabText:         { color: '#444', fontWeight: '600', fontSize: 13 },
  tabTextActive:   { color: '#fff' },

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

  noData:      { padding: 20, alignItems: 'center' },
  noDataText:  { color: '#333', fontSize: 13 },
  cardioRow:   { color: '#444', fontSize: 12, paddingVertical: 3 },

  empty:     { alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 10 },
  emptyText: { color: '#333', fontSize: 16 },
});
