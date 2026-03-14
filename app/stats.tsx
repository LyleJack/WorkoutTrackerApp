import { useState, useCallback, useContext } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Dimensions, Modal, FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppHeader } from '@/app/_layout';
import { ErrorBoundary } from '@/src/ErrorBoundary';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme, FONT } from '@/src/theme';
import { formatVolume, formatDuration } from '@/src/utils';
import {
  getMostPopularWorkouts, getTotalWorkouts, getTotalSets,
  getTotalVolume, getThisWeekSessions, getPersonalBests,
  getStreakWithOffset, WorkoutCount,
  getAllExerciseNames, getWorkoutNamesForStats,
  getExerciseBest, getExerciseTotalVolume, getBestWorkoutDayVolume,
  getPref, setPref,
} from '@/src/db';

const SCREEN_W = Dimensions.get('window').width;

// ── Tile type definitions ─────────────────────────────────────────────────────

type TileType =
  | 'total_sessions'
  | 'total_sets'
  | 'total_volume'
  | 'this_week'
  | 'exercise_best'
  | 'exercise_total_volume'
  | 'best_day_volume';

interface TileConfig {
  type: TileType;
  exerciseName?: string;
  workoutName?: string;
}

const TILE_LABELS: Record<TileType, string> = {
  total_sessions:       'Sessions',
  total_sets:           'Total Sets',
  total_volume:         'kg Lifted',
  this_week:            'This Week',
  exercise_best:        'Exercise Best',
  exercise_total_volume:'Exercise Volume',
  best_day_volume:      'Best Day Vol.',
};

const TILE_EMOJIS: Record<TileType, string> = {
  total_sessions:       '🏋️',
  total_sets:           '📦',
  total_volume:         '⚖️',
  this_week:            '📅',
  exercise_best:        '🏆',
  exercise_total_volume:'📊',
  best_day_volume:      '⚡',
};

const DEFAULT_TILES: TileConfig[] = [
  { type: 'total_sessions' },
  { type: 'total_sets' },
  { type: 'total_volume' },
  { type: 'this_week' },
];

function loadTileConfigs(): TileConfig[] {
  try {
    const raw = getPref('stat_tiles');
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_TILES;
}

function saveTileConfigs(tiles: TileConfig[]) {
  setPref('stat_tiles', JSON.stringify(tiles));
}

export default function StatsScreen() {
  return (
    <ErrorBoundary fallbackLabel="Something went wrong in Stats.">
      <StatsScreenInner />
    </ErrorBoundary>
  );
}

function StatsScreenInner() {
  const t = useTheme();

  const [streak,        setStreak]        = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [totalSets,     setTotalSets]     = useState(0);
  const [totalVolume,   setTotalVolume]   = useState(0);
  const [weekSessions,  setWeekSessions]  = useState(0);
  const [pbs,           setPbs]           = useState<ReturnType<typeof getPersonalBests>>([]);
  const [period,        setPeriod]        = useState<'month' | 'year'>('month');
  const [popular,       setPopular]       = useState<WorkoutCount[]>([]);

  // Customisable tiles
  const [tiles,         setTiles]         = useState<TileConfig[]>(loadTileConfigs);
  const [editingTileIdx,setEditingTileIdx]= useState<number | null>(null);
  const [pickerStep,    setPickerStep]    = useState<'type' | 'exercise' | 'workout'>('type');
  const [allExercises,  setAllExercises]  = useState<string[]>([]);
  const [allWorkouts,   setAllWorkouts]   = useState<string[]>([]);
  const [pendingType,   setPendingType]   = useState<TileType | null>(null);

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

  // ── Tile value resolver ──────────────────────────────────────────────────────

  function resolveTile(cfg: TileConfig): { emoji: string; value: string; label: string; sub?: string } {
    const emoji = TILE_EMOJIS[cfg.type];
    switch (cfg.type) {
      case 'total_sessions':
        return { emoji, value: String(totalWorkouts), label: 'Sessions' };
      case 'total_sets':
        return { emoji, value: String(totalSets), label: 'Total Sets' };
      case 'total_volume':
        return { emoji, value: formatVolume(totalVolume), label: 'kg Lifted' };
      case 'this_week':
        return { emoji, value: `${weekSessions}/7`, label: 'This Week' };
      case 'exercise_best': {
        const name = cfg.exerciseName;
        if (!name) return { emoji, value: '—', label: 'Exercise Best', sub: 'tap to configure' };
        const best = getExerciseBest(name);
        if (!best) return { emoji, value: '—', label: name };
        let val: string;
        if (best.is_duration && best.duration > 0) val = formatDuration(best.duration);
        else if (best.is_bw)                        val = `${best.reps} reps`;
        else                                        val = `${best.weight} kg`;
        return { emoji, value: val, label: name };
      }
      case 'exercise_total_volume': {
        const name = cfg.exerciseName;
        if (!name) return { emoji, value: '—', label: 'Exercise Volume', sub: 'tap to configure' };
        const vol = getExerciseTotalVolume(name);
        let val: string;
        if (vol.is_duration && vol.duration > 0) val = formatDuration(vol.duration);
        else if (vol.is_bw)                      val = `${vol.reps} reps`;
        else                                     val = formatVolume(vol.volume);
        return { emoji, value: val, label: name };
      }
      case 'best_day_volume': {
        const name = cfg.workoutName;
        if (!name) return { emoji, value: '—', label: 'Best Day Vol.', sub: 'tap to configure' };
        const best = getBestWorkoutDayVolume(name);
        if (!best) return { emoji, value: '—', label: name };
        return { emoji, value: formatVolume(best.volume), label: name, sub: best.date };
      }
    }
  }

  // ── Tile picker ──────────────────────────────────────────────────────────────

  function openTilePicker(idx: number) {
    setEditingTileIdx(idx);
    setPickerStep('type');
    setPendingType(null);
    setAllExercises(getAllExerciseNames());
    setAllWorkouts(getWorkoutNamesForStats());
  }

  function selectTileType(type: TileType) {
    if (type === 'exercise_best' || type === 'exercise_total_volume') {
      setPendingType(type);
      setPickerStep('exercise');
    } else if (type === 'best_day_volume') {
      setPendingType(type);
      setPickerStep('workout');
    } else {
      commitTile({ type });
    }
  }

  function selectExercise(name: string) {
    commitTile({ type: pendingType!, exerciseName: name });
  }

  function selectWorkout(name: string) {
    commitTile({ type: pendingType!, workoutName: name });
  }

  function commitTile(cfg: TileConfig) {
    if (editingTileIdx === null) return;
    const next = tiles.map((t, i) => i === editingTileIdx ? cfg : t);
    setTiles(next);
    saveTileConfigs(next);
    setEditingTileIdx(null);
  }

  const chartData = popular.map((w, i) => ({
    value:         w.count,
    label:         w.name.length > 7 ? w.name.slice(0, 7) + '…' : w.name,
    frontColor:    i === 0 ? t.purple : t.borderMid,
    gradientColor: i === 0 ? t.purple + 'aa' : t.border,
  }));
  const maxBarVal = chartData.length ? Math.max(...chartData.map(d => d.value)) + 1 : 5;
  const showStreakHero = streak > 5;

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <AppHeader title="Stats" />
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Hero card */}
        <View style={[s.streakCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <View style={s.streakLeft}>
            <Text style={s.streakFire}>{showStreakHero ? '🔥' : '🏋️'}</Text>
            <View>
              {showStreakHero ? (
                <>
                  <Text style={[s.streakNum, { color: t.textPrimary }]}>{streak}</Text>
                  <Text style={[s.streakLabel, { color: t.textMuted }]}>day streak</Text>
                </>
              ) : (
                <>
                  <Text style={[s.streakNum, { color: t.textPrimary }]}>{totalWorkouts}</Text>
                  <Text style={[s.streakLabel, { color: t.textMuted }]}>workouts total</Text>
                  {streak > 0 && (
                    <Text style={[s.streakHint, { color: t.orange }]}>🔥 {streak} day streak</Text>
                  )}
                </>
              )}
            </View>
          </View>
          <View style={s.weekDots}>
            {Array.from({ length: 7 }).map((_, i) => (
              <View key={i} style={[s.weekDot, { backgroundColor: t.border }, i < weekSessions && { backgroundColor: t.purple }]} />
            ))}
            <Text style={[s.weekLabel, { color: t.textFaint }]}>this week</Text>
          </View>
        </View>

        {/* Customisable 2×2 tile grid */}
        <View style={s.grid}>
          {tiles.map((cfg, idx) => {
            const { emoji, value, label, sub } = resolveTile(cfg);
            return (
              <TouchableOpacity key={idx} onPress={() => openTilePicker(idx)}
                style={[s.statCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
                <Text style={s.statIcon}>{emoji}</Text>
                <Text style={[s.statNum, { color: t.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
                <Text style={[s.statLabel, { color: t.textMuted }]} numberOfLines={1}>{label}</Text>
                {sub ? <Text style={[s.statSub, { color: t.textFaint }]} numberOfLines={1}>{sub}</Text> : null}
                <View style={[s.editDot, { backgroundColor: t.borderMid }]}>
                  <Text style={{ fontSize: 8, color: t.textFaint }}>✏️</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Personal bests */}
        {pbs.length > 0 && (
          <View style={[s.section, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Text style={[s.sectionTitle, { color: t.textPrimary }]}>🏆 Personal Bests</Text>
            {pbs.map((pb, i) => {
              let valText: string;
              if (pb.max_duration > 0)   valText = formatDuration(pb.max_duration);
              else if (pb.is_bw)         valText = `${pb.max_reps} reps`;
              else                       valText = `${pb.weight} kg`;
              return (
                <View key={i} style={[s.pbRow, { borderTopColor: t.border }]}>
                  <View style={[s.pbRank, { backgroundColor: t.borderMid }]}>
                    <Text style={[s.pbRankText, { color: t.purple }]}>{i + 1}</Text>
                  </View>
                  <Text style={[s.pbName, { color: t.textSecondary }]}>{pb.exercise_name}</Text>
                  <Text style={[s.pbVal, { color: t.textPrimary }]}>{valText}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Most popular */}
        <View style={[s.section, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Text style={[s.sectionTitle, { color: t.textPrimary }]}>📊 Most Popular</Text>
          <View style={[s.toggle, { backgroundColor: t.bg, borderColor: t.border }]}>
            {(['month', 'year'] as const).map(p => (
              <TouchableOpacity key={p}
                style={[s.toggleBtn, period === p && { backgroundColor: t.purple }]}
                onPress={() => setPeriod(p)}>
                <Text style={[s.toggleText, { color: period === p ? '#fff' : t.textMuted }]}>
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
              yAxisTextStyle={{ color: t.textFaint, fontSize: FONT.sm }}
              xAxisLabelTextStyle={{ color: t.textMuted, fontSize: FONT.xs }}
              noOfSections={4}
              maxValue={maxBarVal}
              isAnimated
            />
          ) : (
            <View style={s.noData}>
              <Text style={[s.noDataText, { color: t.textFaint }]}>
                No workouts {period === 'month' ? 'this month' : 'this year'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Tile picker modal */}
      <Modal visible={editingTileIdx !== null} transparent animationType="slide" statusBarTranslucent>
        <View style={pm.overlay}>
          <TouchableOpacity style={pm.backdrop} activeOpacity={1} onPress={() => setEditingTileIdx(null)} />
          <View style={[pm.sheet, { backgroundColor: t.bgSheet }]}>
            <View style={[pm.handle, { backgroundColor: t.borderMid }]} />
            <Text style={[pm.title, { color: t.textPrimary }]}>
              {pickerStep === 'type'     ? 'Choose Tile'
               : pickerStep === 'exercise' ? 'Choose Exercise'
               :                            'Choose Workout'}
            </Text>
            {pickerStep === 'type' ? (
              <FlatList
                data={Object.keys(TILE_LABELS) as TileType[]}
                keyExtractor={k => k}
                style={{ maxHeight: 360 }}
                renderItem={({ item: type }) => (
                  <TouchableOpacity
                    style={[pm.item, { borderColor: t.border }]}
                    onPress={() => selectTileType(type)}
                  >
                    <Text style={pm.itemEmoji}>{TILE_EMOJIS[type]}</Text>
                    <Text style={[pm.itemText, { color: t.textPrimary }]}>{TILE_LABELS[type]}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : pickerStep === 'exercise' ? (
              <FlatList
                data={allExercises}
                keyExtractor={e => e}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[pm.item, { borderColor: t.border }]} onPress={() => selectExercise(item)}>
                    <Text style={[pm.itemText, { color: t.textPrimary }]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            ) : (
              <FlatList
                data={allWorkouts}
                keyExtractor={w => w}
                style={{ maxHeight: 360 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[pm.item, { borderColor: t.border }]} onPress={() => selectWorkout(item)}>
                    <Text style={[pm.itemText, { color: t.textPrimary }]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  scroll:    { padding: 16, paddingBottom: 50 },

  streakCard: { borderRadius: 20, padding: 20, marginBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  streakFire: { fontSize: 44 },
  streakNum:  { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  streakLabel:{ fontSize: 15 },
  streakHint: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  weekDots:   { alignItems: 'center', gap: 6 },
  weekDot:    { width: 10, height: 10, borderRadius: 5 },
  weekLabel:  { fontSize: FONT.sm, marginTop: 4 },

  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { width: (SCREEN_W - 52) / 2, borderRadius: 16, padding: 16, gap: 4, borderWidth: 1, position: 'relative' },
  statIcon: { fontSize: 22 },
  statNum:  { fontSize: 28, fontWeight: '800', marginTop: 4 },
  statLabel:{ fontSize: FONT.base },
  statSub:  { fontSize: FONT.xs },
  editDot:  { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },

  section:      { borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1 },
  sectionTitle: { fontSize: FONT.xl, fontWeight: '700', marginBottom: 14 },

  pbRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1 },
  pbRank:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pbRankText:{ fontSize: FONT.base, fontWeight: '700' },
  pbName:    { flex: 1, fontSize: FONT.md },
  pbVal:     { fontSize: FONT.lg, fontWeight: '700' },

  toggle:    { flexDirection: 'row', borderRadius: 10, padding: 4, marginBottom: 16, borderWidth: 1 },
  toggleBtn: { flex: 1, padding: 8, borderRadius: 8, alignItems: 'center' },
  toggleText:{ fontWeight: '600', fontSize: FONT.base },

  noData:    { alignItems: 'center', padding: 24 },
  noDataText:{ fontSize: FONT.md },
});

const pm = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet:    { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 },
  handle:   { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title:    { fontSize: FONT['2xl'], fontWeight: '700', marginBottom: 12 },
  item:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1 },
  itemEmoji:{ fontSize: 20, width: 28, textAlign: 'center' },
  itemText: { fontSize: FONT.lg, fontWeight: '500' },
});
