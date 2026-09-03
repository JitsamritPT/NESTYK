/**
 * Cross-platform Elevation & Shadow Helper
 * iOS: shadowOffset / shadowRadius / shadowOpacity
 * Android: elevation
 * Web: boxShadow
 */
export function getCardElevation(level: 1 | 2 | 3 = 1) {
  const depths = {
    1: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 2,
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    },
    2: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 4,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    },
    3: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 15,
      elevation: 8,
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    },
  };

  return depths[level];
}
