import { ViewStyle } from 'react-native';
import { tokens } from './tokens';

/** Shared selected-surface language: cream fill + brand border. */
export function getSelectionSurfaceStyle(
  selected: boolean,
  accentColor: string = tokens.colors.brand[500],
): ViewStyle {
  return {
    borderColor: selected ? accentColor : tokens.colors.border,
    backgroundColor: selected ? tokens.colors.brand[50] : tokens.colors.white,
  };
}
