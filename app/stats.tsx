import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import {
  getStreak, getMostPopularWorkouts, getTotalWorkouts, getTotalSets,
  getTotalVolume, getThisWeekSessions, getPersonalBests,
  getStreakWithOffset, WorkoutCount,
} from '@/src/db';

const SCREEN_W = Dimensions.get('window').width;

function formatVolume(kg: number): string {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)}M`;
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(1)}k`;
  return String(kg);
}

export default function StatsScreen() {
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalSets, setTotalSets] = useState(0);
  const [totalVolume, setTotalVolume] = useState(0);
  const [weekSessions, setWeekSessions] = useState(0);
  const [pbs, setPbs] = useState<{ exercise_name: string; weight: number; reps: number }[]>([]);
  const [period, setPeriod] = useState<'month' | 'year'>('month');
  const [popular, setPopular] = useState<WorkoutCount[]>([]);

  const load = useCallback(async () => {
    const s = await getStreakWithOffset();
    setStreak(s);
    setTotalWorkouts(getTotalWorkouts());
    setTotalSets(getTotalSets());
    setTotalVolume(getTotalVolume());
    setWeekSessions(getThisWeekSessions());
    setPbs(getPersonalBests());
    setPopular(getMostPopularWorkouts(period));
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chartData = popular.map((w, i) => ({
    value: w.count,
    label: w.name.length > 7 ? w.name.slice(0, 7) + '…' : w.name,
    frontColor: i === 0 ? '#6C63FF' : '#2a2a4a',
    gradientColor: i === 0 ? '#9d97ff' : '#3a3a6a',
  }));

  const maxBarVal = chartData.length ? Math.max(...chartData.map(d => d.value)) + 1 : 5;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>

      {/* Streak hero */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <Text style={styles.streakFire}>🔥</Text>
          <View>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>day streak</Text>
          </View>
        </View>
        <View style={styles.weekDots}>
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={i} style={[styles.weekDot, i < weekSessions && styles.weekDotFilled]} />
          ))}
          <Text style={styles.weekLabel}>this week</Text>
        </View>
      </View>

      {/* Stat grid */}
      <View style={styles.grid}>
        <View style={[styles.statCard, styles.statCardPurple]}>
          <Text style={styles.statIcon}>🏋️</Text>
          <Text style={styles.statNum}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Sessions</Text>
        </View>
        <View style={[styles.statCard, styles.statCardGreen]}>
          <Text style={styles.statIcon}>📦</Text>
          <Text style={styles.statNum}>{totalSets}</Text>
          <Text style={styles.statLabel}>Total Sets</Text>
        </View>
        <View style={[styles.statCard, styles.statCardOrange]}>
          <Text style={styles.statIcon}>⚖️</Text>
          <Text style={styles.statNum}>{formatVolume(totalVolume)}</Text>
          <Text style={styles.statLabel}>kg Lifted</Text>
        </View>
        <View style={[styles.statCard, styles.statCardBlue]}>
          <Text style={styles.statIcon}>📅</Text>
          <Text style={styles.statNum}>{weekSessions}/7</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
      </View>

      {/* Personal bests */}
      {pbs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🏆 Personal Bests</Text>
          {pbs.map((pb, i) => (
            <View key={i} style={styles.pbRow}>
              <View style={styles.pbRank}>
                <Text style={styles.pbRankText}>{i + 1}</Text>
              </View>
              <Text style={styles.pbName}>{pb.exercise_name}</Text>
              <Text style={styles.pbVal}>{pb.weight} kg</Text>
            </View>
          ))}
        </View>
      )}

      {/* Popular workouts chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Most Popular</Text>
        <View style={styles.toggle}>
          {(['month', 'year'] as const).map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.toggleBtn, period === p && styles.toggleActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
                {p === 'month' ? 'This Month' : 'This Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {chartData.length > 0 ? (
          <BarChart
            data={chartData}
            width={SCREEN_W - 80}
            height={180}
            barWidth={36}
            spacing={16}
            roundedTop
            hideRules
            xAxisThickness={0}
            yAxisThickness={0}
            yAxisTextStyle={{ color: '#444', fontSize: 11 }}
            xAxisLabelTextStyle={{ color: '#555', fontSize: 10 }}
            noOfSections={4}
            maxValue={maxBarVal}
            isAnimated
          />
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>No workouts {period === 'month' ? 'this month' : 'this year'}</Text>
          </View>
        )}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a12' },
  scroll: { padding: 16, paddingBottom: 50 },

  // Streak
  streakCard: {
    backgroundColor: '#13131f', borderRadius: 20, padding: 20, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#1e1e32',
  },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streakFire: { fontSize: 44 },
  streakNum: { color: '#fff', fontSize: 56, fontWeight: '900', lineHeight: 60 },
  streakLabel: { color: '#555', fontSize: 15 },
  weekDots: { alignItems: 'center', gap: 6 },
  weekDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1e1e32' },
  weekDotFilled: { backgroundColor: '#6C63FF' },
  weekLabel: { color: '#444', fontSize: 11, marginTop: 4 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: {
    width: (SCREEN_W - 52) / 2, borderRadius: 16, padding: 16, gap: 4,
    borderWidth: 1,
  },
  statCardPurple: { backgroundColor: '#110d1f', borderColor: '#2a1f4a' },
  statCardGreen: { backgroundColor: '#0d1f12', borderColor: '#1a3a22' },
  statCardOrange: { backgroundColor: '#1f150a', borderColor: '#3a2a12' },
  statCardBlue: { backgroundColor: '#0a121f', borderColor: '#12223a' },
  statIcon: { fontSize: 22 },
  statNum: { color: '#e8e8ff', fontSize: 30, fontWeight: '800', marginTop: 4 },
  statLabel: { color: '#555', fontSize: 13 },

  // Section
  section: {
    backgroundColor: '#13131f', borderRadius: 18, padding: 18,
    marginBottom: 14, borderWidth: 1, borderColor: '#1e1e32',
  },
  sectionTitle: { color: '#e8e8ff', fontSize: 16, fontWeight: '700', marginBottom: 14 },

  // PBs
  pbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#1e1e32',
  },
  pbRank: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#1e1e32',
    alignItems: 'center', justifyContent: 'center',
  },
  pbRankText: { color: '#6C63FF', fontSize: 13, fontWeight: '700' },
  pbName: { flex: 1, color: '#ccc', fontSize: 14 },
  pbVal: { color: '#e8e8ff', fontSize: 15, fontWeight: '700' },

  // Toggle
  toggle: {
    flexDirection: 'row', backgroundColor: '#0a0a12', borderRadius: 10,
    padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#1e1e32',
  },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  toggleActive: { backgroundColor: '#6C63FF' },
  toggleText: { color: '#555', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff' },

  noData: { alignItems: 'center', padding: 24 },
  noDataText: { color: '#444', fontSize: 14 },
});
