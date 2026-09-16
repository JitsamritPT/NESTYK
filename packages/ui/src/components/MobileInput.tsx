import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import { tokens } from '../theme/tokens';
import { MobileIcon } from '../icons/MobileIcon';
import type { AppIconName } from '../icons/types';

// Keep Safari's read-only text color override on the web only.
const readOnlyWebStyle: TextStyle & Pick<React.CSSProperties, 'WebkitTextFillColor'> = {
  WebkitTextFillColor: tokens.colors.primary,
};

export interface MobileInputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: ViewStyle;
  containerRef?: React.Ref<View>;
  required?: boolean;
  leadingIcon?: AppIconName;
  trailingText?: string;
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
      leadingIcon,
      trailingText,
      ...props
    },
    ref,
  ) => {
    const hasChrome = !!leadingIcon || !!trailingText;

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
        {hasChrome ? (
          <View
            style={[
              styles.inputShell,
              !editable ? styles.inputReadOnly : null,
              error ? { borderColor: tokens.colors.error } : null,
            ]}
          >
            {leadingIcon ? (
              <MobileIcon
                name={leadingIcon}
                size={18}
                color={tokens.colors.textSecondary}
              />
            ) : null}
            <TextInput
              ref={ref}
              editable={editable}
              style={[
                styles.inputInner,
                !editable && Platform.OS === 'web' ? readOnlyWebStyle : null,
                style,
              ]}
              placeholderTextColor={tokens.colors.placeholder}
              {...props}
            />
            {trailingText ? (
              <Text style={styles.trailingText}>{trailingText}</Text>
            ) : null}
          </View>
        ) : (
          <TextInput
            ref={ref}
            editable={editable}
            style={[
              styles.input,
              !editable ? styles.inputReadOnly : null,
              !editable && Platform.OS === 'web' ? readOnlyWebStyle : null,
              error ? { borderColor: tokens.colors.error } : null,
              style,
            ]}
            placeholderTextColor={tokens.colors.placeholder}
            {...props}
          />
        )}
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
  inputShell: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  inputInner: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontFamily: tokens.typography.native.body,
    fontSize: 14,
    color: tokens.colors.primary,
    padding: 0,
  },
  trailingText: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
  },
  inputReadOnly: {
    backgroundColor: tokens.colors.background,
    color: tokens.colors.primary,
    opacity: 1,
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
