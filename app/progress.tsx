import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { useTheme, FONT } from '@/src/theme';
import { formatDuration } from '@/src/utils';
import {
  getUniqueWorkoutNames, getHistoricalExerciseNames,
  getExerciseProgress, getExerciseProgressGlobal,
  getAllExerciseNames,
  getCardioProgress,
  ProgressPoint, CardioProgressPoint,
} from '@/src/db';

const SCREEN_W = Dimensions.get('window').width;
const COLORS   = ['#6C63FF','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#8b5cf6','#14b8a6'];

function isDurationExercise(points: ProgressPoint[]) {
  return points.some(p => (p.max_duration_seconds ?? 0) > 0);
}

function classifyExercise(points: ProgressPoint[]) {
  if (points.length === 0) return { isBW: false, isDuration: false, hasMixed: false };
  if (isDurationExercise(points)) return { isBW: false, isDuration: true, hasMixed: false };
  const bwCount = points.filter(p => p.weight === 0).length;
  const isBW    = bwCount >= points.length / 2;
  return { isBW, isDuration: false, hasMixed: isBW && points.some(p => p.weight > 0) };
}

export default function ProgressScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in Progress.">
      <ProgressScreenInner />
    </ErrorBoundary>
  );
}

function ProgressScreenInner() {
  const t = useTheme();

  // Tabs: workout names + a combined "All Exercises" + Cardio
  const [workoutTabs,   setWorkoutTabs]   = useState<string[]>([]);
  const [selectedTab,   setSelectedTab]   = useState<string | null>(null);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [progressData,  setProgressData]  = useState<Record<string, ProgressPoint[]>>({});
  const [cardioData,    setCardioData]    = useState<CardioProgressPoint[]>([]);
  const [viewMode,      setViewMode]      = useState<'weight' | 'volume'>('weight');
  const scrollRef  = useRef<ScrollView>(null);
  const isTabChange = useRef(false);
  const [tooltip, setTooltip] = useState<{ date: string; value: string } | null>(null);

  const CARDIO_TAB   = '🏃 Cardio';
  const ALL_TAB      = '🔍 All';

  // Load data fresh every time the tab is focused — fixes real-time update issue
  useFocusEffect(useCallback(() => {
    const names    = getUniqueWorkoutNames();
    const allTabs  = [ALL_TAB, ...names, CARDIO_TAB];
    setWorkoutTabs(allTabs);
    // Keep selected tab if it still exists, else default to first
    setSelectedTab(prev => (prev && allTabs.includes(prev)) ? prev : (allTabs[0] ?? null));
  }, []));

  // Reload exercise data whenever selectedTab changes (also on focus since selectedTab updates above)
  useFocusEffect(useCallback(() => {
    if (!selectedTab) return;
    if (selectedTab === CARDIO_TAB) {
      setCardioData(getCardioProgress());
      setExerciseNames([]);
      setProgressData({});
    } else if (selectedTab === ALL_TAB) {
      // Cross-workout: all distinct exercise names globally
      const names = getAllExerciseNames();
      setExerciseNames(names);
      const pd: Record<string, ProgressPoint[]> = {};
      names.forEach(n => { pd[n] = getExerciseProgressGlobal(n); });
      setProgressData(pd);
      setCardioData([]);
    } else {
      const exNames = getHistoricalExerciseNames(selectedTab);
      setExerciseNames(exNames);
      const pd: Record<string, ProgressPoint[]> = {};
      // Use global progress (by name) so exercises shared across workouts are combined
      exNames.forEach(n => { pd[n] = getExerciseProgressGlobal(n); });
      setProgressData(pd);
      setCardioData([]);
    }
    if (isTabChange.current) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      isTabChange.current = false;
    }
  }, [selectedTab]));

  function selectTab(name: string) {
    if (name === selectedTab) return;
    isTabChange.current = true;
    setSelectedTab(name);
  }

  function buildChartPoints(points: ProgressPoint[], isBW: boolean, isDuration: boolean, baseColor: string, mixedColor: string) {
    return points.map(p => {
      const isWeighted = p.weight > 0;
      let yVal: number;
      if (isDuration)      yVal = p.max_duration_seconds ?? 0;
      else if (isBW)       yVal = p.max_reps ?? 1;
      else                 yVal = viewMode === 'weight' ? p.weight : p.volume;
      const dotColor = (isBW && isWeighted) ? mixedColor : baseColor;
      return {
        value: yVal,
        label: p.date.slice(5),
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

  function renderCardioCharts() {
    const byType: Record<string, CardioProgressPoint[]> = {};
    cardioData.forEach(pt => {
      if (!byType[pt.cardio_type_name]) byType[pt.cardio_type_name] = [];
      byType[pt.cardio_type_name].push(pt);
    });
    const types = Object.keys(byType);
    if (types.length === 0) {
      return (
        <View style={[styles.empty, { marginTop: 60 }]}>
          <Ionicons name="bicycle-outline" size={48} color={t.textDead} />
          <Text style={[styles.emptyText, { color: t.textFaint }]}>No cardio logged yet</Text>
        </View>
      );
    }
    return types.map((typeName, i) => {
      const pts   = byType[typeName];
      const color = COLORS[i % COLORS.length];
      const withCalories = pts.filter(p => p.calories_per_min != null);
      const peakCpm = withCalories.length > 0
        ? Math.max(...withCalories.map(p => p.calories_per_min!)) : null;
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
        <View key={typeName} style={[styles.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={[styles.cardTitle, { color: t.textPrimary }]}>{typeName}</Text>
            {peakCpm != null && <Text style={[styles.cardPeak, { color }]}>{peakCpm} kcal/min</Text>}
          </View>
          {withCalories.length < 2 ? (
            <View style={styles.noData}>
              <Text style={[styles.noDataText, { color: t.textFaint }]}>
                {withCalories.length === 0 ? 'No calorie data' : 'One more session to show chart'}
              </Text>
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
              rulesColor={t.border}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: t.textFaint, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: t.textFaint, fontSize: 9 }}
              noOfSections={3}
            />
          )}
          {pts.map((p, j) => (
            <Text key={j} style={[styles.cardioRow, { color: t.textFaint }]}>
              {p.date.slice(5)}  ·  {p.duration_minutes} min{p.distance_km ? `  ·  ${p.distance_km} km` : ''}
            </Text>
          ))}
        </View>
      );
    });
  }

  function renderExerciseCharts() {
    if (exerciseNames.length === 0) {
      return (
        <View style={[styles.empty, { marginTop: 60 }]}>
          <Text style={[styles.emptyText, { color: t.textFaint }]}>No sets logged yet</Text>
        </View>
      );
    }
    return exerciseNames.map((name, i) => {
      const rawPoints = progressData[name] ?? [];
      if (rawPoints.length === 0) return null;
      const { isBW, isDuration, hasMixed } = classifyExercise(rawPoints);
      const baseColor  = COLORS[i % COLORS.length];
      const mixedColor = t.orange;
      const points     = buildChartPoints(rawPoints, isBW, isDuration, baseColor, mixedColor);

      const peakReps   = isBW       ? Math.max(0, ...rawPoints.map(p => p.max_reps ?? 0)) : 0;
      const peakDur    = isDuration ? Math.max(0, ...rawPoints.map(p => p.max_duration_seconds ?? 0)) : 0;
      const peakWeight = !isBW && !isDuration ? Math.max(0, ...rawPoints.filter(p => p.weight > 0).map(p => p.weight)) : 0;
      const peakVol    = !isBW && !isDuration ? Math.max(0, ...rawPoints.map(p => p.volume)) : 0;

      return (
        <View key={name} style={[styles.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.dot, { backgroundColor: baseColor }]} />
            <Text style={[styles.cardTitle, { color: t.textPrimary }]} numberOfLines={1}>{name}</Text>
            {(isBW || isDuration) && (
              <View style={[styles.bwBadge, { backgroundColor: t.purpleBg, borderColor: t.purple + '40' }]}>
                <Text style={[styles.bwBadgeText, { color: t.purple }]}>{isDuration ? '⏱' : 'BW'}</Text>
              </View>
            )}
            {isBW       && peakReps   > 0 && <Text style={[styles.cardPeak, { color: baseColor }]}>{peakReps} reps</Text>}
            {isDuration && peakDur    > 0 && <Text style={[styles.cardPeak, { color: baseColor }]}>{formatDuration(peakDur)}</Text>}
            {!isBW && !isDuration && peakWeight > 0 && (
              <Text style={[styles.cardPeak, { color: baseColor }]}>
                {viewMode === 'weight' ? `${peakWeight} kg` : `${Math.round(peakVol)} vol`}
              </Text>
            )}
          </View>

          {hasMixed && (
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: baseColor }]} />
                <Text style={[styles.legendText, { color: t.textFaint }]}>Bodyweight</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: mixedColor }]} />
                <Text style={[styles.legendText, { color: t.textFaint }]}>+ added weight</Text>
              </View>
            </View>
          )}

          {points.length < 2 ? (
            <View style={styles.noData}>
              <Text style={[styles.noDataText, { color: t.textFaint }]}>
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
              dataPointsRadius={5}
              startFillColor={baseColor}
              startOpacity={0.15}
              endOpacity={0}
              areaChart curved
              hideRules={false}
              rulesColor={t.border}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: t.textFaint, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: t.textFaint, fontSize: 9 }}
              noOfSections={3}
            />
          )}
        </View>
      );
    });
  }

  const isCardioTab = selectedTab === CARDIO_TAB;
  const isAllTab    = selectedTab === ALL_TAB;

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <AppHeader title="Progress" />

      <Modal visible={!!tooltip} transparent animationType="fade">
        <TouchableOpacity style={tt.overlay} activeOpacity={1} onPress={() => setTooltip(null)}>
          <View style={[tt.box, { backgroundColor: t.bgSheet, borderColor: t.border }]}>
            <Text style={[tt.date,  { color: t.textMuted }]}>{tooltip?.date}</Text>
            <Text style={[tt.value, { color: t.textPrimary }]}>{tooltip?.value}</Text>
            <Text style={[tt.hint,  { color: t.textFaint }]}>Tap to close</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Tab strip */}
      {workoutTabs.length > 0 && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={[styles.tabBar, { backgroundColor: t.bg, borderBottomColor: t.border }]}
          contentContainerStyle={styles.tabContent}
        >
          {workoutTabs.map(name => {
            const isCardio = name === CARDIO_TAB;
            const isAll    = name === ALL_TAB;
            const isActive = selectedTab === name;
            return (
              <TouchableOpacity
                key={name}
                style={[
                  styles.tab,
                  { borderColor: t.border },
                  isActive && (isCardio ? { backgroundColor: t.green, borderColor: t.green }
                             : isAll    ? { backgroundColor: t.orange, borderColor: t.orange }
                             :            { backgroundColor: t.purple, borderColor: t.purple }),
                ]}
                onPress={() => selectTab(name)}
              >
                <Text style={[styles.tabText, { color: isActive ? '#fff' : t.textFaint }]}>{name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Weight / Volume toggle */}
      {!isCardioTab && workoutTabs.length > 0 && (
        <View style={[styles.modeBar, { backgroundColor: t.bg, borderBottomColor: t.border }]}>
          {(['weight', 'volume'] as const).map(m => (
            <TouchableOpacity
              key={m}
              style={[
                styles.modeBtn,
                { backgroundColor: t.bgCard, borderColor: t.border },
                viewMode === m && { backgroundColor: t.purple, borderColor: t.purple },
              ]}
              onPress={() => setViewMode(m)}
            >
              <Text style={[styles.modeBtnText, { color: viewMode === m ? '#fff' : t.textMuted }]}>
                {m === 'weight' ? 'Max Weight' : 'Volume'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {workoutTabs.length === 0 ? (
        <View style={[styles.empty, { marginTop: 80 }]}>
          <Ionicons name="trending-up-outline" size={56} color={t.textDead} />
          <Text style={[styles.emptyText, { color: t.textFaint }]}>No workouts yet</Text>
        </View>
      ) : (
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
          {isCardioTab ? renderCardioCharts() : renderExerciseCharts()}
          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

const tt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center' },
  box:     { borderRadius: 16, padding: 20, minWidth: 180, alignItems: 'center', borderWidth: 1, elevation: 20 },
  date:    { fontSize: 12, marginBottom: 6 },
  value:   { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  hint:    { fontSize: 11, marginTop: 10 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabBar:    { height: 52, flexShrink: 0, borderBottomWidth: 1 },
  tabContent:{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 52, gap: 8 },
  tab:       { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  tabText:   { fontWeight: '600', fontSize: FONT.base },
  modeBar:   { flexDirection: 'row', padding: 10, gap: 8, borderBottomWidth: 1 },
  modeBtn:   { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  modeBtnText:{ fontWeight: '600', fontSize: FONT.base },
  scroll:    { padding: 12, paddingBottom: 40 },
  card:      { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardHeader:{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dot:       { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  cardTitle: { flex: 1, fontSize: FONT.md, fontWeight: '700' },
  cardPeak:  { fontSize: FONT.base, fontWeight: '700', flexShrink: 0 },
  bwBadge:   { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1 },
  bwBadgeText:{ fontSize: 10, fontWeight: '700' },
  legend:    { flexDirection: 'row', gap: 14, marginBottom: 10, flexWrap: 'wrap' },
  legendItem:{ flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText:{ fontSize: 11 },
  noData:    { padding: 20, alignItems: 'center' },
  noDataText:{ fontSize: FONT.base },
  cardioRow: { fontSize: 12, paddingVertical: 3 },
  empty:     { alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 16 },
});
