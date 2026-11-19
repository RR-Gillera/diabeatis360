import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { homeColors } from '@/features/home/home-ui';
import { shortDay, type Language } from '@/i18n/translate';
import { manilaWallClock } from '@/features/booking/manila-time';

import type { TrendPoint } from './glucose-trend';

const WIDTH = 210;
const HEIGHT = 130;
const LEFT = 30; // room for the mg/dL labels
const RIGHT = 18; // room so the last day's label is not cut off
const TOP = 10;
const BOTTOM = 22; // room for the day labels

/** A round top for the y axis and its step: 0-150 by 50 like the frame, larger readings by 100 or 200. */
function axis(max: number) {
  const step = max <= 150 ? 50 : max <= 300 ? 100 : 200;
  const top = Math.max(150, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let value = 0; value <= top; value += step) ticks.push(value);
  return { top, ticks };
}

/**
 * The small chart inside a chat message (frame "Consultation Chat"): one point per day, the day's average in mg/dL.
 * A day with no readings has no dot, and the line joins the days that have one. Drawn with react-native-svg, which
 * the other charts already use. The days are dates rather than the frame's "Day 1/2/3", so the record says when.
 */
export function TrendChart({ points, language, label }: { points: TrendPoint[]; language: Language; label: string }) {
  const values = points.map((point) => point.averageMgdl).filter((value): value is number => value !== null);
  const { top, ticks } = axis(Math.max(...values, 0));
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const x = (index: number) => LEFT + (points.length > 1 ? (index / (points.length - 1)) * plotWidth : plotWidth / 2);
  const y = (value: number) => TOP + (1 - value / top) * plotHeight;

  const known = points.map((point, index) => ({ index, value: point.averageMgdl })).filter((point): point is { index: number; value: number } => point.value !== null);
  const line = known.map((point, order) => `${order === 0 ? 'M' : 'L'} ${x(point.index)} ${y(point.value)}`).join(' ');
  const area = known.length > 1 ? `${line} L ${x(known[known.length - 1].index)} ${TOP + plotHeight} L ${x(known[0].index)} ${TOP + plotHeight} Z` : '';

  return (
    <View accessible accessibilityLabel={label} style={styles.card}>
      <Svg width={WIDTH} height={HEIGHT}>
        {ticks.map((tick) => (
          <Line key={`g${tick}`} x1={LEFT} x2={LEFT + plotWidth} y1={y(tick)} y2={y(tick)} stroke={tick === 0 ? '#334155' : '#E5E7EB'} strokeWidth={1} />
        ))}
        {ticks.map((tick) => (
          <SvgText key={`t${tick}`} x={LEFT - 6} y={y(tick) + 3} fontSize={9} fill="#475569" textAnchor="end">{tick}</SvgText>
        ))}
        {area ? <Path d={area} fill={homeColors.greenBright} fillOpacity={0.12} /> : null}
        {line ? <Path d={line} fill="none" stroke={homeColors.greenBright} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" /> : null}
        {known.map((point) => <Circle key={`c${point.index}`} cx={x(point.index)} cy={y(point.value)} r={3.5} fill={homeColors.green} />)}
        {points.map((point, index) => (
          <SvgText key={`d${index}`} x={x(index)} y={HEIGHT - 6} fontSize={9} fill="#475569" textAnchor="middle">
            {shortDay(manilaWallClock(point.day), language)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 14, borderWidth: 1, marginTop: 10, padding: 6 },
});
