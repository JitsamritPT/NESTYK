import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, View } from 'react-native';
import { SelectionChip, tokens, useMobileTheme } from '@nestyk/ui/native';
import { useLocale } from '@nestyk/i18n';
import {
  formatPriceInput,
  isPriceBeyondScale,
  matchesPreset,
  movePrice,
  nearestPriceThumb,
  parsePriceInput,
  pricePosition,
  PRICE_LIMIT,
  PRICE_PRESETS,
  PRICE_STEP,
  validPriceRange,
  type PriceRange,
  type PriceThumb,
} from './room-price-range';

export function RoomPriceFilter({
  value,
  onChange,
  onDragging,
}: {
  value: PriceRange;
  onChange: (range: PriceRange) => void;
  onDragging?: (dragging: boolean) => void;
}) {
  const { t, locale } = useLocale();
  const copy = t.agent.listings;
  const { theme } = useMobileTheme();
  const [width, setWidth] = useState(0);
  const activeThumb = useRef<PriceThumb>('min');
  const grantX = useRef(0);
  const latest = useRef({ value, onChange, onDragging, width });
  latest.current = { value, onChange, onDragging, width };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const p = latest.current;
          if (p.width <= 0) return;
          const x = Math.max(0, Math.min(p.width, evt.nativeEvent.locationX));
          grantX.current = x;
          const trackValue = (x / p.width) * PRICE_LIMIT;
          activeThumb.current = nearestPriceThumb(p.value, trackValue);
          p.onChange(movePrice(p.value, activeThumb.current, trackValue));
          p.onDragging?.(true);
        },
        onPanResponderMove: (_, gesture) => {
          const p = latest.current;
          if (p.width <= 0) return;
          const x = Math.max(0, Math.min(p.width, grantX.current + gesture.dx));
          p.onChange(
            movePrice(p.value, activeThumb.current, (x / p.width) * PRICE_LIMIT),
          );
        },
        onPanResponderRelease: () => latest.current.onDragging?.(false),
        onPanResponderTerminate: () => latest.current.onDragging?.(false),
      }),
    [],
  );

  const low = pricePosition(value.minPrice, 0);
  const high = pricePosition(value.maxPrice, PRICE_LIMIT);
  const invalid = !validPriceRange(value);
  const beyondScale = isPriceBeyondScale(value);

  return (
    <View style={styles.root}>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>{copy.filterPriceHint}</Text>
      <View style={styles.presets}>
        {PRICE_PRESETS.map(([minPrice, maxPrice], index) => (
          <SelectionChip
            key={index}
            label={
              index === 0
                ? copy.filterAny
                : index === 1
                  ? copy.filterPriceUnder.replace('{amount}', '10,000')
                  : index === 5
                    ? '50,000+'
                    : `${Number(minPrice).toLocaleString(locale)}–${Number(maxPrice).toLocaleString(locale)}`
            }
            selected={matchesPreset(value, minPrice, maxPrice)}
            style={styles.preset}
            showCheck={false}
            onPress={() => onChange({ minPrice, maxPrice })}
          />
        ))}
      </View>
      <View style={styles.inputs}>
        {(['minPrice', 'maxPrice'] as const).map((key) => (
          <View key={key} style={styles.inputColumn}>
            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
              {key === 'minPrice' ? copy.filterMinPrice : copy.filterMaxPrice}
            </Text>
            <TextInput
              value={formatPriceInput(value[key], locale)}
              keyboardType="decimal-pad"
              placeholder={key === 'maxPrice' ? copy.filterUnlimited : '0'}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={key === 'minPrice' ? copy.filterMinPrice : copy.filterMaxPrice}
              onChangeText={(raw) =>
                onChange({ ...value, [key]: parsePriceInput(raw) })
              }
              style={[
                styles.input,
                {
                  color: theme.textHeading,
                  backgroundColor: theme.surface,
                  borderColor: invalid ? tokens.colors.danger : theme.border,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={styles.slider}
        {...responder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={copy.filterPriceRange}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const thumb = activeThumb.current;
          const now = thumb === 'min' ? low : high;
          onChange(
            movePrice(
              value,
              thumb,
              now + (e.nativeEvent.actionName === 'increment' ? PRICE_STEP : -PRICE_STEP),
            ),
          );
        }}
      >
        <View style={styles.trackArea}>
          <View style={styles.track} />
          <View
            style={[
              styles.fill,
              {
                left: `${(low / PRICE_LIMIT) * 100}%`,
                width: `${(Math.max(0, high - low) / PRICE_LIMIT) * 100}%`,
              },
            ]}
          />
          {(['min', 'max'] as const).map((thumb) => {
            const position = thumb === 'min' ? low : high;
            return (
              <View
                key={thumb}
                pointerEvents="none"
                style={[
                  styles.thumbWrap,
                  { left: `${(position / PRICE_LIMIT) * 100}%` },
                ]}
              >
                <View style={styles.thumb} />
              </View>
            );
          })}
        </View>
        <View style={styles.axis}>
          <Text style={styles.axisText}>0</Text>
          <Text style={styles.axisText}>50,000</Text>
          <Text style={styles.axisText}>{copy.filterUnlimited}</Text>
        </View>
      </View>
      {beyondScale ? (
        <Text style={[styles.beyondHint, { color: theme.textSecondary }]}>
          {copy.filterPriceBeyondScale}
        </Text>
      ) : null}
      {invalid ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {copy.filterPriceError}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 4 },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  preset: { width: '48%', flexGrow: 1, minHeight: 44, borderRadius: 10 },
  inputs: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  inputColumn: { flex: 1, gap: 6 },
  inputLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: tokens.typography.native.body,
  },
  slider: {
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  trackArea: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.subtle.track,
  },
  fill: {
    position: 'absolute',
    top: 19,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.brand[500],
  },
  thumbWrap: {
    position: 'absolute',
    marginLeft: -14,
    width: 28,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: tokens.colors.brand[500],
    backgroundColor: tokens.colors.white,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  axisText: {
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    fontFamily: tokens.typography.native.body,
  },
  beyondHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  error: {
    color: tokens.colors.danger,
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
});
