import React from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import { MobileButton, tokens } from '@nestyk/ui/native';

export type WizardSheetFooterProps = {
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  secondaryDanger?: boolean;
  style?: ViewStyle;
};

/** Shared sheet footer: primary CTA (+ optional secondary outline). */
export function WizardSheetFooter({
  primaryLabel,
  onPrimary,
  primaryDisabled,
  secondaryLabel,
  onSecondary,
  secondaryDisabled,
  secondaryDanger,
  style,
}: WizardSheetFooterProps) {
  const secondaryText: TextStyle | undefined = secondaryDanger
    ? { color: tokens.colors.error }
    : undefined;
  return (
    <View style={[styles.footer, style]}>
      <MobileButton
        onPress={onPrimary}
        disabled={primaryDisabled}
        style={styles.primary}
      >
        {primaryLabel}
      </MobileButton>
      {secondaryLabel && onSecondary ? (
        <MobileButton
          variant="outline"
          onPress={onSecondary}
          disabled={secondaryDisabled}
          style={styles.secondary}
          textStyle={secondaryText}
        >
          {secondaryLabel}
        </MobileButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: tokens.colors.border,
  },
  primary: {
    width: '100%',
  },
  secondary: {
    width: '100%',
  },
});
