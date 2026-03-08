import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { BarChart } from 'react-native-gifted-charts';
import { C, FONT } from '@/src/theme';
import { formatVolume } from '@/src/utils';
import {
  getMostPopularWorkouts, getTotalWorkouts, getTotalSets,
  getTotalVolume, getThisWeekSessions, getPersonalBests,
  getStreakWithOffset, WorkoutCount,
} from '@/src/db';

const SCREEN_W = Dimensions.get('window').width;

export default function StatsScreen() {
  const [streak,        setStreak]        = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalSets,     setTotalSets]     = useState(0);
  const [totalVolume,   setTotalVolume]   = useState(0);
  const [weekSessions,  setWeekSessions]  = useState(0);
  const [pbs,           setPbs]           = useState<{ exercise_name: string; weight: number; reps: number }[]>([]);
  const [period,        setPeriod]        = useState<'month' | 'year'>('month');
  const [popular,       setPopular]       = useState<WorkoutCount[]>([]);

  const load = useCallback(async () => {
    setStreak(await getStreakWithOffset());
    setTotalWorkouts(getTotalWorkouts());
    setTotalSets(getTotalSets());
    setTotalVolume(getTotalVolume());
    setWeekSessions(getThisWeekSessions());
    setPbs(getPersonalBests());
    setPopular(getMostPopularWorkouts(period));
  }, [period]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chartData = popular.map((w, i) => ({
    value:         w.count,
    label:         w.name.length > 7 ? w.name.slice(0, 7) + '…' : w.name,
    frontColor:    i === 0 ? C.purple : '#1a1a2a',
    gradientColor: i === 0 ? '#9d97ff' : '#3a3a6a',
  }));

  const maxBarVal = chartData.length ? Math.max(...chartData.map(d => d.value)) + 1 : 5;

  return (
    <ErrorBoundary fallbackLabel="Something went wrong in Stats.">
      <View style={s.container}>
        <AppHeader title="Stats" />
        <ScrollView contentContainerStyle={s.scroll}>

          {/* Streak hero card */}
          <View style={s.streakCard}>
            <View style={s.streakLeft}>
              <Text style={s.streakFire}>🔥</Text>
              <View>
                <Text style={s.streakNum}>{streak}</Text>
                <Text style={s.streakLabel}>day streak</Text>
              </View>
            </View>
            <View style={s.weekDots}>
              {Array.from({ length: 7 }).map((_, i) => (
                <View key={i} style={[s.weekDot, i < weekSessions && s.weekDotFilled]} />
              ))}
              <Text style={s.weekLabel}>this week</Text>
            </View>
          </View>

          {/* Stat grid */}
          <View style={s.grid}>
            <StatCard emoji="🏋️" value={String(totalWorkouts)}       label="Sessions"   tint="#110d1f" border="#2a1f4a" />
            <StatCard emoji="📦" value={String(totalSets)}           label="Total Sets"  tint="#0d1f12" border="#1a3a22" />
            <StatCard emoji="⚖️" value={formatVolume(totalVolume)}   label="kg Lifted"  tint="#1f150a" border="#3a2a12" />
            <StatCard emoji="📅" value={`${weekSessions}/7`}         label="This Week"  tint="#0a121f" border="#12223a" />
          </View>

          {/* Personal bests */}
          {pbs.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>🏆 Personal Bests</Text>
              {pbs.map((pb, i) => (
                <View key={i} style={s.pbRow}>
                  <View style={s.pbRank}>
                    <Text style={s.pbRankText}>{i + 1}</Text>
                  </View>
                  <Text style={s.pbName}>{pb.exercise_name}</Text>
                  <Text style={s.pbVal}>{pb.weight} kg</Text>
                </View>
              ))}
            </View>
          )}

          {/* Popular workouts */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>📊 Most Popular</Text>
            <View style={s.toggle}>
              {(['month', 'year'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[s.toggleBtn, period === p && s.toggleActive]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[s.toggleText, period === p && s.toggleTextActive]}>
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
                yAxisTextStyle={{ color: C.textFaint, fontSize: FONT.sm }}
                xAxisLabelTextStyle={{ color: C.textMuted, fontSize: FONT.xs }}
                noOfSections={4}
                maxValue={maxBarVal}
                isAnimated
              />
            ) : (
              <View style={s.noData}>
                <Text style={s.noDataText}>
                  No workouts {period === 'month' ? 'this month' : 'this year'}
                </Text>
              </View>
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </ErrorBoundary>
  );
}

function StatCard({ emoji, value, label, tint, border }: {
  emoji: string; value: string; label: string; tint: string; border: string;
}) {
  return (
    <View style={[s.statCard, { backgroundColor: tint, borderColor: border }]}>
      <Text style={s.statIcon}>{emoji}</Text>
      <Text style={s.statNum}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll:    { padding: 16, paddingBottom: 50 },

  streakCard:  {
    backgroundColor: C.bgCard, borderRadius: 20, padding: 20, marginBottom: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: C.border,
  },
  streakLeft:  { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streakFire:  { fontSize: 44 },
  streakNum:   { color: C.white, fontSize: 56, fontWeight: '900', lineHeight: 60 },
  streakLabel: { color: C.textMuted, fontSize: 15 },
  weekDots:    { alignItems: 'center', gap: 6 },
  weekDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#111' },
  weekDotFilled: { backgroundColor: C.purple },
  weekLabel:   { color: C.textFaint, fontSize: FONT.sm, marginTop: 4 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: (SCREEN_W - 52) / 2, borderRadius: 16, padding: 16, gap: 4, borderWidth: 1 },
  statIcon: { fontSize: 22 },
  statNum:  { color: C.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 4 },
  statLabel:{ color: C.textMuted, fontSize: FONT.base },

  section:      { backgroundColor: C.bgCard, borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  sectionTitle: { color: C.textPrimary, fontSize: FONT.xl, fontWeight: '700', marginBottom: 14 },

  pbRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border },
  pbRank:    { width: 28, height: 28, borderRadius: 14, backgroundColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pbRankText:{ color: C.purple, fontSize: FONT.base, fontWeight: '700' },
  pbName:    { flex: 1, color: '#ccc', fontSize: FONT.md },
  pbVal:     { color: C.textPrimary, fontSize: FONT.lg, fontWeight: '700' },

  toggle:          { flexDirection: 'row', backgroundColor: C.bg, borderRadius: 10, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border },
  toggleBtn:       { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  toggleActive:    { backgroundColor: C.purple },
  toggleText:      { color: C.textMuted, fontWeight: '600', fontSize: FONT.base },
  toggleTextActive:{ color: C.white },

  noData:    { alignItems: 'center', padding: 24 },
  noDataText:{ color: C.textFaint, fontSize: FONT.md },
});
