import React from 'react';
import { tokens } from '../theme/tokens';

export interface AppInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const AppInput: React.FC<AppInputProps> = ({
  label,
  error,
  helperText,
  className = '',
  style,
  disabled,
  ...props
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          style={{
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: 1.5,
            color: tokens.colors.textHeading,
            fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
          }}
        >
          {label}
        </label>
      )}
      <input
        style={{
          height: '42px',
          padding: '0 12px',
          borderRadius: '8px',
          border: `1px solid ${error ? tokens.colors.error : tokens.colors.border}`,
          backgroundColor: disabled ? '#F8FAFC' : tokens.colors.white,
          fontSize: '14px',
          color: tokens.colors.primary,
          outline: 'none',
          fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif',
          ...style,
        }}
        disabled={disabled}
        className={`app-input ${className}`}
        {...props}
      />
      {error ? (
        <span style={{ fontSize: '12px', color: tokens.colors.error, fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif' }}>
          {error}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '12px', color: tokens.colors.textSecondary, fontFamily: 'var(--font-noto-sans-thai), "Noto Sans Thai", sans-serif' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
