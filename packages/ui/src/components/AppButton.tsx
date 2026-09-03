import React from 'react';
import { ButtonVariant, tokens } from '../theme/tokens';

export interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
  children,
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const baseStyles: React.CSSProperties = {
    padding: '9px 18px',
    borderRadius: '8px',
    fontWeight: 500,
    fontSize: '14px',
    lineHeight: 1.5,
    fontFamily: 'var(--font-mitr), "Mitr", sans-serif',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: fullWidth ? '100%' : 'auto',
    transition: 'all 0.15s ease-in-out',
    border: '1px solid transparent',
  };

  let variantStyles: React.CSSProperties = {};

  if (variant === 'primary') {
    variantStyles = disabled
      ? { backgroundColor: '#FEF3C7', color: '#D1D5DB' }
      : { backgroundColor: tokens.colors.brand[500], color: tokens.colors.primary };
  } else if (variant === 'secondary' || variant === 'outline') {
    variantStyles = disabled
      ? { backgroundColor: '#FFFFFF', borderColor: '#F3F4F6', color: '#E5E7EB' }
      : { backgroundColor: '#FFFFFF', borderColor: tokens.colors.brand[500], color: tokens.colors.primary };
  } else if (variant === 'ghost') {
    variantStyles = { backgroundColor: 'transparent', color: tokens.colors.textSecondary };
  }

  return (
    <button
      style={{ ...baseStyles, ...variantStyles, ...style }}
      disabled={disabled || isLoading}
      className={`app-button ${className}`}
      {...props}
    >
      {isLoading ? 'กำลังโหลด...' : children}
    </button>
  );
};
