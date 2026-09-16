import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MobileIcon, tokens } from '@nestyk/ui/native';

export type WizardSheetChromeProps = {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
};

/** Shared sheet header: title (+ optional subtitle) and close (X). */
export function WizardSheetChrome({
  title,
  subtitle,
  closeLabel,
  onClose,
}: WizardSheetChromeProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
        hitSlop={8}
        style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
      >
        <MobileIcon name="close" size={22} color={tokens.colors.textHeading} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 8,
    gap: 8,
  },
  titleBlock: {
    flexShrink: 0,
    flex: 1,
    minWidth: 0,
    paddingTop: 4,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 20,
    lineHeight: 30,
    fontWeight: '500',
    color: tokens.colors.textHeading,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 20,
    color: tokens.colors.textSecondary,
    marginTop: -2,
    marginBottom: 2,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
