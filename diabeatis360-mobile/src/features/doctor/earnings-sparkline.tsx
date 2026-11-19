import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { homeColors } from '@/features/home/home-ui';

const HEIGHT = 36;
/** Room above and below the line so its 2px stroke is never cut off. */
const PAD = 3;

/**
 * The small line under "Total Earnings" on the doctor's dashboard (frame "Dashboard"): one point per day from
 * dailyEarnings (doctor-stats.ts), oldest on the left. It shows the shape of the week only, so it has no axes; the
 * screen reader hears `label`. Drawn with react-native-svg, which the glucose charts already use.
 *
 * Each pair of points is joined by an S-shaped curve (both control points sit halfway between them), which gives the
 * frame's soft wave without ever bending above the higher point or below the lower one.
 */
export function EarningsSparkline({ values, label }: { values: number[]; label: string }) {
  const [width, setWidth] = useState(0);
  const max = Math.max(...values, 0);
  // A week with no earnings is a flat line along the bottom, not a made-up wave.
  const y = (value: number) => (max > 0 ? PAD + (1 - value / max) * (HEIGHT - PAD * 2) : HEIGHT - PAD);
  const x = (index: number) => (values.length > 1 ? (index / (values.length - 1)) * width : 0);

  let line = '';
  values.forEach((value, index) => {
    if (index === 0) {
      line = `M ${x(0)} ${y(value)}`;
      return;
    }
    const midX = (x(index - 1) + x(index)) / 2;
    line += ` C ${midX} ${y(values[index - 1])} ${midX} ${y(value)} ${x(index)} ${y(value)}`;
  });
  const area = `${line} L ${width} ${HEIGHT} L 0 ${HEIGHT} Z`;

  return (
    <View accessible accessibilityLabel={label} style={{ height: HEIGHT, marginTop: 8 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={HEIGHT}>
          <Path d={area} fill={homeColors.greenBright} fillOpacity={0.12} />
          <Path d={line} fill="none" stroke={homeColors.greenBright} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      ) : null}
    </View>
  );
}
