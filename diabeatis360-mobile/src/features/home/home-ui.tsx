import { useRouter, type Href } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import Svg, { Circle, Line, Polygon, Polyline } from 'react-native-svg';

import { Fonts } from '@/constants/theme';

// Distinct palette for the dashboard/log screens — matches the Figma spec's exact
// values rather than reusing authColors/bookingColors, which run a slightly
// different green (#5D9F27 vs #629C2C here) for their own screens.
export const homeColors = {
  background: '#F5F5F5',
  card: '#FFFFFF',
  textDark: '#111827',
  textMuted: '#6B7280',
  textFaint: '#9CA3AF',
  green: '#629C2C',
  greenTint: 'rgba(220, 242, 169, 0.2)',
  border: '#F1F5F9',
  borderSoft: '#F3F4F6',
  orange: '#FB923C',
  orangeTrack: '#F3F4F6',
  blue: '#60A5FA',
  blueTint: '#EFF6FF',
  red: '#EF4444',
  avatarRing: 'rgba(17, 120, 100, 0.1)',
};

type NavTarget = 'home' | 'log' | 'doctors' | 'profile';

const navItems = [
  { key: 'home', label: 'Home', href: '/user-home', icon: 'house.fill', iconAndroid: 'home' },
  { key: 'log', label: 'Log', href: '/glucose-log', icon: 'drop.fill', iconAndroid: 'water_drop' },
  { key: 'doctors', label: 'Doctors', href: '/booking/find-doctor', icon: 'stethoscope', iconAndroid: 'medical_services' },
  { key: 'profile', label: 'Profile', href: '/profile', icon: 'person.fill', iconAndroid: 'person' },
] as const satisfies { key: NavTarget; label: string; href: Href; icon: string; iconAndroid: string }[];

// Shared bottom tab bar for the dashboard/log/doctors/profile screens, with a
// raised center action for the (not yet built) AI nutrition-scan camera flow.
export function BottomNav({ active }: { active: NavTarget }) {
  const router = useRouter();
  const [before, after] = [navItems.slice(0, 2), navItems.slice(2)];

  // dismissTo, not push: a tab bar is not a history. push stacked a fresh copy
  // of every tab you touched, so bouncing Home → Profile → Home → Notifications
  // left a pile of screens that each needed their own back press to unwind.
  // dismissTo pops back to the tab if it is already on the stack and otherwise
  // replaces the current screen, so the stack never grows from tab switching.
  // Not skipped when the tab is already active, because leaf screens such as
  // Notifications and Rewards render this bar with active="home" — a guard
  // there would leave the tab bar dead on exactly the screens that need it.
  const renderItem = (item: (typeof navItems)[number]) => {
    const isActive = item.key === active;
    const color = isActive ? homeColors.green : homeColors.textMuted;
    return (
      <Pressable key={item.key} onPress={() => router.dismissTo(item.href)} style={styles.navItem}>
        <SymbolView name={{ ios: item.icon, android: item.iconAndroid, web: item.iconAndroid }} size={20} tintColor={color} />
        <Text style={[styles.navLabel, { color }]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.nav}>
      {before.map(renderItem)}
      <Pressable onPress={() => Alert.alert('Coming Soon', 'AI nutrition-label scanning is on the way.')} style={styles.fab}>
        <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={24} tintColor="#FFF" />
      </Pressable>
      {after.map(renderItem)}
    </View>
  );
}

// Minimal SVG line chart for a week of readings — no smoothing, just straight
// segments between points, which is all react-native-svg needs here.
export function Sparkline({ values, width = 262, height = 96 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <Text style={styles.sparklineEmpty}>Log a few more readings to see your trend.</Text>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((value, index) => {
    const x = index * stepX;
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return { x, y };
  });
  return (
    <Svg width={width} height={height}>
      <Polyline points={points.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={homeColors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={4} fill={homeColors.green} />)}
    </Svg>
  );
}

// Weekly trend chart for the Glucose Log screen — 7 fixed day slots (gridlines,
// left-hand mg/dL scale, day-of-week labels) with the line/area only drawn
// across whichever days actually have a reading, rather than fabricating a
// value for days with no logged data.
export function WeeklyChart({ days, width = 264, height = 140 }: { days: { label: string; value: number | null }[]; width?: number; height?: number }) {
  const present = days.map((day, index) => ({ ...day, index })).filter((day): day is typeof day & { value: number } => day.value !== null);
  if (present.length < 2) return <Text style={styles.sparklineEmpty}>Log a few more readings this week to see your trend.</Text>;

  const values = present.map((day) => day.value);
  const niceMin = Math.floor(Math.min(...values) / 20) * 20;
  const niceMax = Math.max(niceMin + 60, Math.ceil(Math.max(...values) / 20) * 20);
  const gridValues = [niceMax, niceMax - (niceMax - niceMin) / 3, niceMax - ((niceMax - niceMin) * 2) / 3, niceMin];

  const plotX = (index: number) => (index / (days.length - 1)) * width;
  const plotY = (value: number) => ((niceMax - value) / (niceMax - niceMin)) * height;
  const points = present.map((day) => ({ x: plotX(day.index), y: plotY(day.value) }));
  const pointsAttr = points.map((point) => `${point.x},${point.y}`).join(' ');
  const areaAttr = `${pointsAttr} ${points[points.length - 1].x},${height} ${points[0].x},${height}`;

  return (
    <View>
      <View style={styles.chartRow}>
        <View style={[styles.chartAxis, { height }]}>
          {gridValues.map((value) => <Text key={value} style={styles.chartAxisLabel}>{Math.round(value)}</Text>)}
        </View>
        <Svg width={width} height={height}>
          {gridValues.map((value) => <Line key={value} x1={0} y1={plotY(value)} x2={width} y2={plotY(value)} stroke={homeColors.borderSoft} strokeWidth={1} />)}
          <Polygon points={areaAttr} fill={homeColors.green} fillOpacity={0.08} />
          <Polyline points={pointsAttr} fill="none" stroke={homeColors.green} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={4} fill={homeColors.green} />)}
        </Svg>
      </View>
      <View style={[styles.chartDayRow, { paddingLeft: styles.chartAxis.width }]}>
        {days.map((day) => <Text key={day.label} style={styles.chartDayLabel}>{day.label}</Text>)}
      </View>
    </View>
  );
}

// Simple ring progress indicator (Exercise/Hydration cards) built from SVG
// stroke-dasharray rather than an installed gauge library.
export function RingProgress({ progress, color, trackColor, size = 45, strokeWidth = 4 }: { progress: number; color: string; trackColor: string; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * Math.min(Math.max(progress, 0), 1);
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${filled} ${circumference}`} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  nav: { alignItems: 'center', backgroundColor: homeColors.card, borderTopColor: homeColors.borderSoft, borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', left: 0, paddingBottom: 24, paddingTop: 10, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', gap: 4, minWidth: 56 },
  navLabel: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  fab: { alignItems: 'center', backgroundColor: homeColors.green, borderColor: '#FFF', borderRadius: 32, borderWidth: 4, elevation: 4, height: 64, justifyContent: 'center', marginTop: -32, shadowColor: homeColors.green, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.3, shadowRadius: 10, width: 64 },
  sparklineEmpty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, paddingVertical: 30, textAlign: 'center' },
  chartRow: { flexDirection: 'row' },
  chartAxis: { justifyContent: 'space-between', paddingBottom: 2, paddingRight: 8, width: 28 },
  chartAxisLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 10, textAlign: 'right' },
  chartDayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  chartDayLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 10, textAlign: 'center' },
});
