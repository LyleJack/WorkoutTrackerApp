// WorkoutIcons.tsx
// All icons as inline SVG via react-native-svg
// Usage: <WorkoutIcon name="bench" size={56} color="#6C63FF" />

import React, { FC } from 'react';
import Svg, { Path, Circle, Rect, Line, Ellipse, G } from 'react-native-svg';

type IconProps = { size?: number; color?: string; bg?: string };

// ── Bench Press ───────────────────────────────────────────────────────────────
export function BenchPressIcon({ size = 56, color = '#6C63FF', bg = 'transparent' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bench */}
      <Rect x="10" y="34" width="36" height="6" rx="3" fill={color} opacity={0.25} />
      <Rect x="14" y="40" width="4" height="10" rx="2" fill={color} opacity={0.3} />
      <Rect x="38" y="40" width="4" height="10" rx="2" fill={color} opacity={0.3} />
      {/* Bar */}
      <Rect x="4" y="20" width="48" height="4" rx="2" fill={color} />
      {/* Left weight */}
      <Rect x="2" y="16" width="6" height="12" rx="2" fill={color} opacity={0.7} />
      {/* Right weight */}
      <Rect x="48" y="16" width="6" height="12" rx="2" fill={color} opacity={0.7} />
      {/* Person hands up */}
      <Circle cx="28" cy="14" r="5" fill={color} opacity={0.5} />
      <Path d="M22 22 L28 18 L34 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ── Squat ─────────────────────────────────────────────────────────────────────
export function SquatIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bar across shoulders */}
      <Rect x="6" y="14" width="44" height="4" rx="2" fill={color} />
      <Rect x="4" y="11" width="6" height="10" rx="2" fill={color} opacity={0.7} />
      <Rect x="46" y="11" width="6" height="10" rx="2" fill={color} opacity={0.7} />
      {/* Body squatting down */}
      <Circle cx="28" cy="9" r="5" fill={color} opacity={0.5} />
      {/* Torso */}
      <Path d="M24 14 L22 26 L20 38" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M32 14 L34 26 L36 38" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Thighs */}
      <Path d="M22 26 L14 32" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M34 26 L42 32" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Shins */}
      <Path d="M14 32 L20 44" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M42 32 L36 44" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ── Deadlift ──────────────────────────────────────────────────────────────────
export function DeadliftIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bar on floor */}
      <Rect x="8" y="36" width="40" height="4" rx="2" fill={color} />
      {/* Weights */}
      <Ellipse cx="10" cy="38" rx="6" ry="10" fill={color} opacity={0.6} />
      <Ellipse cx="46" cy="38" rx="6" ry="10" fill={color} opacity={0.6} />
      <Ellipse cx="10" cy="38" rx="3.5" ry="7" fill={color} opacity={0.3} />
      <Ellipse cx="46" cy="38" rx="3.5" ry="7" fill={color} opacity={0.3} />
      {/* Person hinging */}
      <Circle cx="28" cy="8" r="5" fill={color} opacity={0.5} />
      <Path d="M28 13 L28 26" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Arms reaching down */}
      <Path d="M26 18 L18 34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M30 18 L38 34" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Legs */}
      <Path d="M26 26 L22 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M30 26 L34 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

// ── Pull Up ───────────────────────────────────────────────────────────────────
export function PullUpIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bar */}
      <Rect x="6" y="6" width="44" height="5" rx="2.5" fill={color} />
      {/* Arms up */}
      <Path d="M20 11 L22 24" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M36 11 L34 24" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Body */}
      <Circle cx="28" cy="22" r="5" fill={color} opacity={0.5} />
      <Path d="M28 27 L28 40" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Legs bent */}
      <Path d="M28 38 L22 48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M28 38 L34 48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

// ── Push Up ───────────────────────────────────────────────────────────────────
export function PushUpIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Floor */}
      <Rect x="4" y="46" width="48" height="3" rx="1.5" fill={color} opacity={0.2} />
      {/* Body horizontal */}
      <Path d="M10 36 L46 28" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {/* Head */}
      <Circle cx="46" cy="25" r="5" fill={color} opacity={0.5} />
      {/* Arms pushing */}
      <Path d="M18 34 L14 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M28 32 L24 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Feet */}
      <Path d="M10 36 L8 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

// ── Dumbbell ──────────────────────────────────────────────────────────────────
export function DumbbellIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Rect x="14" y="25" width="28" height="6" rx="3" fill={color} />
      {/* Left bell */}
      <Rect x="4" y="18" width="12" height="20" rx="4" fill={color} opacity={0.8} />
      <Rect x="2" y="22" width="5" height="12" rx="2.5" fill={color} />
      {/* Right bell */}
      <Rect x="40" y="18" width="12" height="20" rx="4" fill={color} opacity={0.8} />
      <Rect x="49" y="22" width="5" height="12" rx="2.5" fill={color} />
    </Svg>
  );
}

// ── Barbell ───────────────────────────────────────────────────────────────────
export function BarbellIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      <Rect x="8" y="25" width="40" height="6" rx="3" fill={color} />
      {/* Left plates */}
      <Rect x="4" y="19" width="8" height="18" rx="3" fill={color} opacity={0.75} />
      <Rect x="2" y="23" width="4" height="10" rx="2" fill={color} />
      {/* Right plates */}
      <Rect x="44" y="19" width="8" height="18" rx="3" fill={color} opacity={0.75} />
      <Rect x="50" y="23" width="4" height="10" rx="2" fill={color} />
    </Svg>
  );
}

// ── Cardio / Running ──────────────────────────────────────────────────────────
export function CardioIcon({ size = 56, color = '#22c55e' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Runner */}
      <Circle cx="36" cy="10" r="5" fill={color} opacity={0.6} />
      {/* Body leaning forward */}
      <Path d="M34 15 L28 28" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Arms */}
      <Path d="M32 20 L40 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M30 22 L20 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Legs stride */}
      <Path d="M28 28 L20 40" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M28 28 L38 36" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M20 40 L16 48" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M38 36 L44 44" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Motion lines */}
      <Line x1="6" y1="24" x2="14" y2="24" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.4} />
      <Line x1="4" y1="30" x2="10" y2="30" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.3} />
      <Line x1="8" y1="36" x2="14" y2="36" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.2} />
    </Svg>
  );
}

// ── Shoulder Press ────────────────────────────────────────────────────────────
export function ShoulderPressIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bar overhead */}
      <Rect x="6" y="10" width="44" height="4" rx="2" fill={color} />
      <Rect x="4" y="7" width="6" height="10" rx="2" fill={color} opacity={0.7} />
      <Rect x="46" y="7" width="6" height="10" rx="2" fill={color} opacity={0.7} />
      {/* Person sitting/standing pressing up */}
      <Circle cx="28" cy="26" r="5" fill={color} opacity={0.5} />
      {/* Arms fully extended */}
      <Path d="M22 14 L22 22" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M34 14 L34 22" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Torso + legs */}
      <Path d="M28 31 L28 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M28 40 L20 52" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M28 40 L36 52" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
export function RowIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bar being pulled */}
      <Rect x="6" y="27" width="28" height="4" rx="2" fill={color} />
      <Rect x="4" y="23" width="6" height="12" rx="2" fill={color} opacity={0.7} />
      {/* Person rowing - hinge position */}
      <Circle cx="44" cy="18" r="5" fill={color} opacity={0.5} />
      {/* Torso angled */}
      <Path d="M42 22 L36 32" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Arms pulling to hip */}
      <Path d="M34 29 L42 26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Legs */}
      <Path d="M36 32 L32 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M36 32 L44 42" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

// ── Leg Press ─────────────────────────────────────────────────────────────────
export function LegPressIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Seat/machine */}
      <Rect x="6" y="36" width="20" height="8" rx="3" fill={color} opacity={0.3} />
      {/* Plate */}
      <Rect x="38" y="10" width="8" height="34" rx="3" fill={color} opacity={0.6} />
      <Rect x="42" y="14" width="6" height="26" rx="2" fill={color} opacity={0.3} />
      {/* Sled bar */}
      <Rect x="16" y="26" width="26" height="3" rx="1.5" fill={color} />
      {/* Person seated, legs pushing */}
      <Circle cx="14" cy="30" r="5" fill={color} opacity={0.5} />
      <Path d="M14 35 L14 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Legs bent then extended */}
      <Path d="M14 34 L20 28" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M20 28 L36 26" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

// ── Bicep Curl ────────────────────────────────────────────────────────────────
export function BicepIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Arm raised */}
      <Path d="M28 44 L28 30" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {/* Forearm curled */}
      <Path d="M28 30 L18 22" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {/* Dumbbell */}
      <Rect x="8" y="19" width="14" height="6" rx="3" fill={color} />
      <Rect x="6" y="17" width="5" height="10" rx="2.5" fill={color} opacity={0.8} />
      <Rect x="17" y="17" width="5" height="10" rx="2.5" fill={color} opacity={0.8} />
      {/* Bicep bulge */}
      <Ellipse cx="28" cy="30" rx="7" ry="5" fill={color} opacity={0.25} />
      {/* Shoulder/torso hint */}
      <Path d="M28 44 L28 52" stroke={color} strokeWidth="3" strokeLinecap="round" opacity={0.4} />
      <Path d="M20 46 L36 46" stroke={color} strokeWidth="3" strokeLinecap="round" opacity={0.3} />
    </Svg>
  );
}

// ── Tricep ────────────────────────────────────────────────────────────────────
export function TricepIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Cable/rope overhead */}
      <Line x1="28" y1="4" x2="28" y2="16" stroke={color} strokeWidth="2.5" strokeLinecap="round" opacity={0.5} />
      {/* Rope split */}
      <Path d="M28 16 L22 22 M28 16 L34 22" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Upper arm vertical */}
      <Path d="M28 16 L28 30" stroke={color} strokeWidth="4" strokeLinecap="round" />
      {/* Forearms pushing down */}
      <Path d="M24 24 L20 38" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M32 24 L36 38" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Handles */}
      <Rect x="17" y="37" width="8" height="4" rx="2" fill={color} opacity={0.7} />
      <Rect x="31" y="37" width="8" height="4" rx="2" fill={color} opacity={0.7} />
      {/* Tricep bulge */}
      <Ellipse cx="28" cy="26" rx="6" ry="4" fill={color} opacity={0.2} />
    </Svg>
  );
}

// ── Core / Abs ────────────────────────────────────────────────────────────────
export function CoreIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Person doing crunch */}
      {/* Floor */}
      <Rect x="4" y="48" width="48" height="3" rx="1.5" fill={color} opacity={0.15} />
      {/* Legs bent on floor */}
      <Path d="M28 36 L20 48" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M28 36 L36 48" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Lower torso */}
      <Path d="M22 30 L34 30 L28 36 Z" fill={color} opacity={0.25} />
      {/* Upper torso raised */}
      <Path d="M22 30 L20 18" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M34 30 L36 18" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Head */}
      <Circle cx="28" cy="14" r="5" fill={color} opacity={0.5} />
      {/* Hands behind head */}
      <Path d="M20 18 L23 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M36 18 L33 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
      {/* Abs lines */}
      <Line x1="26" y1="22" x2="24" y2="30" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.5} />
      <Line x1="30" y1="22" x2="32" y2="30" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.5} />
      <Line x1="25" y1="26" x2="31" y2="26" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity={0.5} />
    </Svg>
  );
}

// ── Default / Generic Workout ─────────────────────────────────────────────────
export function DefaultWorkoutIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Simple barbell - universal gym symbol */}
      <Rect x="10" y="24" width="36" height="8" rx="4" fill={color} />
      {/* Left side */}
      <Rect x="4" y="18" width="10" height="20" rx="4" fill={color} opacity={0.75} />
      <Rect x="2" y="22" width="4" height="12" rx="2" fill={color} />
      {/* Right side */}
      <Rect x="42" y="18" width="10" height="20" rx="4" fill={color} opacity={0.75} />
      <Rect x="50" y="22" width="4" height="12" rx="2" fill={color} />
    </Svg>
  );
}

// ── Chest specific ────────────────────────────────────────────────────────────
export function ChestIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Bench */}
      <Rect x="10" y="36" width="36" height="5" rx="2.5" fill={color} opacity={0.2} />
      <Rect x="14" y="41" width="4" height="8" rx="2" fill={color} opacity={0.2} />
      <Rect x="38" y="41" width="4" height="8" rx="2" fill={color} opacity={0.2} />
      {/* Bar */}
      <Rect x="4" y="18" width="48" height="4" rx="2" fill={color} />
      {/* Weights */}
      <Rect x="2" y="13" width="6" height="14" rx="2" fill={color} opacity={0.7} />
      <Rect x="48" y="13" width="6" height="14" rx="2" fill={color} opacity={0.7} />
      {/* Person lying, arms up */}
      <Circle cx="28" cy="30" r="5" fill={color} opacity={0.45} />
      <Path d="M22 22 L18 19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M34 22 L38 19" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* Chest muscle hint */}
      <Path d="M22 28 Q28 24 34 28" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" opacity={0.5} />
    </Svg>
  );
}

// ── Back ──────────────────────────────────────────────────────────────────────
export function BackIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Lat pulldown bar */}
      <Rect x="6" y="8" width="44" height="4" rx="2" fill={color} />
      {/* Cable down from centre */}
      <Line x1="28" y1="12" x2="28" y2="22" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.5} />
      {/* Person from back - V taper */}
      <Circle cx="28" cy="18" r="5" fill={color} opacity={0.4} />
      {/* Wide shoulders */}
      <Path d="M14 24 L42 24" stroke={color} strokeWidth="4" strokeLinecap="round" opacity={0.5} />
      {/* Arms gripping bar */}
      <Path d="M14 24 L10 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M42 24 L46 12" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      {/* V taper torso to waist */}
      <Path d="M14 24 L22 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M42 24 L34 44" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Spine */}
      <Path d="M28 23 L28 44" stroke={color} strokeWidth="2" strokeLinecap="round" opacity={0.3} />
      {/* Back muscle lines */}
      <Path d="M22 28 Q28 26 34 28" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.5} />
      <Path d="M21 34 Q28 31 35 34" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity={0.4} />
    </Svg>
  );
}

// ── Full Body / Lightning ─────────────────────────────────────────────────────
export function FullBodyIcon({ size = 56, color = '#6C63FF' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56">
      {/* Stick person dynamic pose */}
      <Circle cx="28" cy="8" r="6" fill={color} opacity={0.5} />
      <Path d="M28 14 L28 30" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Arms wide */}
      <Path d="M28 20 L10 16" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <Path d="M28 20 L46 16" stroke={color} strokeWidth="3" strokeLinecap="round" />
      {/* Legs stride */}
      <Path d="M28 30 L16 46" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <Path d="M28 30 L40 46" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      {/* Lightning bolt overlay */}
      <Path d="M32 4 L26 18 L30 18 L24 32 L38 16 L33 16 Z" fill={color} opacity={0.3} />
    </Svg>
  );
}

// ── Icon matcher ──────────────────────────────────────────────────────────────

type IconComponent = FC<IconProps>;

const ICON_MAP: { keywords: string[]; icon: IconComponent; color: string }[] = [
  { keywords: ['chest', 'pec', 'bench press', 'fly', 'push'],        icon: ChestIcon,         color: '#ef4444' },
  { keywords: ['back', 'lat', 'pulldown', 'row', 'pull up', 'deadlift'], icon: BackIcon,       color: '#3b82f6' },
  { keywords: ['leg', 'squat', 'lunge', 'quad', 'hamstring', 'glute', 'calf'], icon: SquatIcon, color: '#f59e0b' },
  { keywords: ['shoulder', 'delt', 'press', 'overhead', 'lateral'],   icon: ShoulderPressIcon, color: '#8b5cf6' },
  { keywords: ['arm', 'bicep', 'curl', 'hammer'],                     icon: BicepIcon,         color: '#6C63FF' },
  { keywords: ['tricep', 'dip', 'pushdown', 'extension'],             icon: TricepIcon,        color: '#a78bfa' },
  { keywords: ['core', 'ab', 'crunch', 'plank', 'sit up'],           icon: CoreIcon,           color: '#f97316' },
  { keywords: ['cardio', 'run', 'treadmill', 'cycle', 'cycling', 'swim', 'rowing', 'elliptical', 'stair'], icon: CardioIcon, color: '#22c55e' },
  { keywords: ['full body', 'fullbody', 'compound', 'hiit', 'circuit'], icon: FullBodyIcon,    color: '#ec4899' },
  { keywords: ['pull', 'pull-up', 'pullup'],                          icon: PullUpIcon,        color: '#06b6d4' },
  { keywords: ['push'],                                                icon: PushUpIcon,        color: '#84cc16' },
];

export function getWorkoutIcon(name: string): { Icon: IconComponent; color: string } {
  const lower = name.toLowerCase();
  for (const { keywords, icon, color } of ICON_MAP) {
    if (keywords.some(k => lower.includes(k))) {
      return { Icon: icon, color };
    }
  }
  return { Icon: DefaultWorkoutIcon, color: '#6C63FF' };
}

// ── WorkoutIcon convenience component ─────────────────────────────────────────

export function WorkoutIcon({ name, size = 56 }: { name: string; size?: number }) {
  const { Icon, color } = getWorkoutIcon(name);
  return <Icon size={size} color={color} />;
}
