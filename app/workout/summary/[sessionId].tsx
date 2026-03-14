import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTheme } from '@/src/theme';
import { FONT } from '@/src/theme';
import { formatDuration } from '@/src/utils';
import {
  getSessionExerciseSummary, getSessionCardioSummary,
  ExerciseSummaryRow, CardioSummaryRow,
} from '@/src/db';

const STATUS_H = Platform.OS === 'android' ? (Constants.statusBarHeight ?? 24) : 44;

// ── Motivational headline logic ────────────────────────────────────────────────

function getHeadline(rows: ExerciseSummaryRow[]): { emoji: string; text: string; sub: string } {
  if (!rows.length) return { emoji: '✅', text: 'Session complete!', sub: 'Great work getting it done.' };

  let improved = 0, declined = 0;
  rows.forEach(r => {
    if (r.is_duration) {
      if (r.prev_duration != null) {
        if ((r.cur_duration ?? 0) > r.prev_duration) improved++;
        else if ((r.cur_duration ?? 0) < r.prev_duration) declined++;
      }
    } else if (r.is_bw) {
      if (r.prev_reps != null) {
        if (r.cur_reps > r.prev_reps) improved++;
        else if (r.cur_reps < r.prev_reps) declined++;
      }
    } else {
      if (r.prev_weight != null) {
        if (r.cur_weight > r.prev_weight) improved++;
        else if (r.cur_weight < r.prev_weight) declined++;
      }
    }
  });

  const newPBs = rows.filter(r => {
    if (r.is_duration) return (r.cur_duration ?? 0) > (r.prev_duration ?? 0);
    if (r.is_bw)       return r.cur_reps > (r.prev_reps ?? 0);
    return r.cur_weight > (r.prev_weight ?? 0);
  }).length;

  if (newPBs >= 2)   return { emoji: '🏆', text: `${newPBs} new personal bests!`, sub: "You're crushing it — keep this momentum." };
  if (newPBs === 1)  return { emoji: '⭐', text: 'New personal best!', sub: 'One step better than before.' };
  if (improved > declined) return { emoji: '📈', text: 'Stronger than last time', sub: 'Solid progress — consistency is key.' };
  if (declined > improved) return { emoji: '💪', text: 'Keep pushing', sub: "Some days are tougher — you still showed up." };
  return { emoji: '➡️', text: 'Staying steady', sub: 'Consistent effort builds long-term gains.' };
}

// ── Delta display ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta, unit }: { delta: number; unit: string }) {
  const t = useTheme();
  if (delta === 0) return <Text style={[sd.delta, { color: t.textMuted }]}>—</Text>;
  const pos   = delta > 0;
  const color = pos ? t.green : t.red;
  return (
    <Text style={[sd.delta, { color }]}>
      {pos ? '+' : ''}{delta}{unit}
    </Text>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SummaryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const t = useTheme();
  const [exerciseRows, setExerciseRows] = useState<ExerciseSummaryRow[]>([]);
  const [cardioRows,   setCardioRows]   = useState<CardioSummaryRow[]>([]);

  useEffect(() => {
    const sid = Number(sessionId);
    setExerciseRows(getSessionExerciseSummary(sid));
    setCardioRows(getSessionCardioSummary(sid));
  }, [sessionId]);

  const headline = getHeadline(exerciseRows);
  const isCardio = exerciseRows.length === 0 && cardioRows.length > 0;

  function done() {
    router.replace('/');
  }

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <View style={[s.header, { paddingTop: STATUS_H + 10, backgroundColor: t.bg, borderBottomColor: t.border }]}>
        <Text style={[s.headerTitle, { color: t.textPrimary }]}>Session Summary</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {/* Headline card */}
        <View style={[s.heroCard, { backgroundColor: t.bgCard, borderColor: t.border }]}>
          <Text style={s.heroEmoji}>{headline.emoji}</Text>
          <Text style={[s.heroText, { color: t.textPrimary }]}>{headline.text}</Text>
          <Text style={[s.heroSub, { color: t.textMuted }]}>{headline.sub}</Text>
        </View>

        {/* Exercise comparison table */}
        {exerciseRows.length > 0 && (
          <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Text style={[s.cardTitle, { color: t.purple }]}>Exercise Breakdown</Text>
            {exerciseRows.map((row, i) => {
              let delta = 0, unit = '';
              if (row.is_duration) {
                delta = (row.cur_duration ?? 0) - (row.prev_duration ?? row.cur_duration ?? 0);
                unit  = 's';
              } else if (row.is_bw) {
                delta = row.cur_reps - (row.prev_reps ?? row.cur_reps);
                unit  = ' reps';
              } else {
                delta = row.cur_weight - (row.prev_weight ?? row.cur_weight);
                unit  = ' kg';
              }

              const curLabel = row.is_duration
                ? formatDuration(row.cur_duration ?? 0)
                : row.is_bw
                  ? `${row.cur_reps} reps`
                  : `${row.cur_weight} kg`;
              const hasPrev = row.prev_weight != null || row.prev_reps != null || row.prev_duration != null;

              return (
                <View key={i} style={[s.exRow, { borderTopColor: t.border }]}>
                  <Text style={[s.exName, { color: t.textSecondary }]}>{row.exercise_name}</Text>
                  <Text style={[s.exVal, { color: t.textPrimary }]}>{curLabel}</Text>
                  {hasPrev ? <DeltaBadge delta={delta} unit={unit} /> : <Text style={[sd.delta, { color: t.textMuted }]}>first</Text>}
                </View>
              );
            })}
          </View>
        )}

        {/* Cardio comparison */}
        {cardioRows.length > 0 && (
          <View style={[s.card, { backgroundColor: t.bgCard, borderColor: t.border }]}>
            <Text style={[s.cardTitle, { color: t.green }]}>Cardio</Text>
            {cardioRows.map((row, i) => {
              const calDelta = (row.cur_calories ?? 0) - (row.prev_calories ?? row.cur_calories ?? 0);
              const hasPrev  = row.prev_duration != null;
              return (
                <View key={i} style={[s.exRow, { borderTopColor: t.border }]}>
                  <Text style={[s.exName, { color: t.textSecondary }]}>{row.cardio_type_name}</Text>
                  <Text style={[s.exVal, { color: t.textPrimary }]}>
                    {row.cur_duration} min{row.cur_calories ? `  ·  ${row.cur_calories} kcal` : ''}
                  </Text>
                  {hasPrev && row.cur_calories != null
                    ? <DeltaBadge delta={calDelta} unit=" kcal" />
                    : <Text style={[sd.delta, { color: t.textMuted }]}>{hasPrev ? '—' : 'first'}</Text>
                  }
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity style={[s.doneBtn, { backgroundColor: t.purple }]} onPress={done}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingBottom: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, flexDirection: 'row', alignItems: 'flex-end',
  },
  headerTitle: { fontSize: FONT['4xl'], fontWeight: '800', letterSpacing: -0.5 },
  scroll: { padding: 16, paddingBottom: 40 },

  heroCard: {
    borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 14,
    borderWidth: 1, gap: 6,
  },
  heroEmoji: { fontSize: 52 },
  heroText:  { fontSize: FONT['3xl'], fontWeight: '800', textAlign: 'center' },
  heroSub:   { fontSize: FONT.lg, textAlign: 'center', lineHeight: 22 },

  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1 },
  cardTitle: { fontSize: FONT.md, fontWeight: '700', letterSpacing: 0.3, marginBottom: 10 },

  exRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, borderTopWidth: 1, gap: 8,
  },
  exName: { flex: 1, fontSize: FONT.md },
  exVal:  { fontSize: FONT.md, fontWeight: '700', flexShrink: 0 },

  doneBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, padding: 17, borderRadius: 16, marginTop: 8,
  },
  doneBtnText: { color: '#fff', fontSize: FONT.xl, fontWeight: '700' },
});

const sd = StyleSheet.create({
  delta: { fontSize: FONT.base, fontWeight: '700', flexShrink: 0, minWidth: 48, textAlign: 'right' },
});
