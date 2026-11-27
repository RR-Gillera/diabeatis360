import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { homeColors } from '@/features/home/home-ui';

import { niceAxis } from './chart-axis';

const HEIGHT = 190;
const LEFT = 38; // room for the y-axis numbers
const RIGHT = 12;
const TOP = 10;
const BOTTOM = 24; // room for the day labels

/**
 * The 7-day line charts on the doctor's "Blood Sugar Insights" (mg/dL) and "Consultation History → Earnings" (₱)
 * frames. One point per day, oldest on the left; a day with no value (null) has no dot and the line joins the days
 * around it. `curved` gives the insights frame's soft line (the same S-curve as the dashboard's EarningsSparkline,
 * which never bends past its two points). Drawn with react-native-svg, which the other charts already use; the screen
 * reader hears `label`.
 */
export function WeekLineChart({ values, dayLabels, label, fromZero = false, curved = false }: {
  values: (number | null)[]; dayLabels: string[]; label: string; fromZero?: boolean; curved?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const known = values.map((value, index) => ({ index, value })).filter((point): point is { index: number; value: number } => point.value !== null);
  const { bottom, top, ticks } = niceAxis(known.map((point) => point.value), fromZero);
  const plotWidth = Math.max(0, width - LEFT - RIGHT);
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const x = (index: number) => LEFT + (values.length > 1 ? (index / (values.length - 1)) * plotWidth : plotWidth / 2);
  const y = (value: number) => TOP + (1 - (value - bottom) / (top - bottom)) * plotHeight;

  let line = '';
  known.forEach((point, order) => {
    if (order === 0) {
      line = `M ${x(point.index)} ${y(point.value)}`;
    } else if (curved) {
      const before = known[order - 1];
      const midX = (x(before.index) + x(point.index)) / 2;
      line += ` C ${midX} ${y(before.value)} ${midX} ${y(point.value)} ${x(point.index)} ${y(point.value)}`;
    } else {
      line += ` L ${x(point.index)} ${y(point.value)}`;
    }
  });
  const baseY = TOP + plotHeight;
  const area = known.length > 1 ? `${line} L ${x(known[known.length - 1].index)} ${baseY} L ${x(known[0].index)} ${baseY} Z` : '';

  return (
    <View accessible accessibilityLabel={label} style={{ height: HEIGHT }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={LEFT} x2={LEFT + plotWidth} y1={y(tick)} y2={y(tick)} stroke={tick === bottom ? '#CBD5E1' : '#EEF2F6'} strokeWidth={1} />
          ))}
          {ticks.map((tick) => (
            <SvgText key={`t${tick}`} x={LEFT - 8} y={y(tick) + 4} fontSize={11} fill="#64748B" textAnchor="end">{tick}</SvgText>
          ))}
          {area ? <Path d={area} fill={homeColors.greenBright} fillOpacity={0.12} /> : null}
          {line ? <Path d={line} fill="none" stroke={homeColors.greenBright} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" /> : null}
          {known.map((point) => <Circle key={`c${point.index}`} cx={x(point.index)} cy={y(point.value)} r={3.5} fill={homeColors.green} />)}
          {dayLabels.map((day, index) => (
            <SvgText key={`d${index}`} x={x(index)} y={HEIGHT - 6} fontSize={11} fill="#64748B" textAnchor="middle">{day}</SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
