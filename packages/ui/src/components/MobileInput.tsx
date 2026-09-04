import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { tokens } from '../theme/tokens';

export interface MobileInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  containerRef?: React.Ref<View>;
  required?: boolean;
}

export const MobileInput = React.forwardRef<TextInput, MobileInputProps>(
  (
    {
      label,
      error,
      helperText,
      containerStyle,
      containerRef,
      style,
      editable = true,
      required = false,
      ...props
    },
    ref,
  ) => {
    return (
      <View
        ref={containerRef}
        collapsable={false}
        style={[{ width: '100%', gap: 6 }, containerStyle]}
      >
        {label && (
          <Text style={styles.label}>
            {label}
            {required ? <Text style={styles.requiredMark}> *</Text> : null}
          </Text>
        )}
        <TextInput
          ref={ref}
          editable={editable}
          style={[
            styles.input,
            !editable ? styles.inputReadOnly : null,
            error ? { borderColor: tokens.colors.error } : null,
            style,
          ]}
          placeholderTextColor={tokens.colors.placeholder}
          {...props}
        />
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}
      </View>
    );
  },
);

MobileInput.displayName = 'MobileInput';

const styles = StyleSheet.create({
  label: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: tokens.colors.textHeading,
  },
  requiredMark: {
    color: tokens.colors.error,
    fontWeight: '700',
  },
  input: {
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    color: tokens.colors.primary,
  },
  inputReadOnly: {
    backgroundColor: tokens.colors.background,
    color: tokens.colors.primary,
    opacity: 1,
    WebkitTextFillColor: tokens.colors.primary,
  } as const,
  errorText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.error,
  },
  helperText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
  },
});
