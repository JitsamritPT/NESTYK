export type PhotoLoadState = { attempt: number; status: 'loading' | 'loaded' | 'failed' };
export type PhotoLoadEvent = { type: 'loaded' | 'failed'; attempt: number } | { type: 'retry' };
export const initialPhotoLoad: PhotoLoadState = { attempt: 0, status: 'loading' };

export function photoLoadReducer(state: PhotoLoadState, event: PhotoLoadEvent): PhotoLoadState {
  if (event.type === 'retry') return { attempt: state.attempt + 1, status: 'loading' };
  // Native callbacks from a replaced request must not overwrite the current photo.
  if (event.attempt !== state.attempt || state.status !== 'loading') return state;
  if (event.type === 'loaded') return { ...state, status: 'loaded' };
  // Retry one transient failure automatically; persistent failures stay actionable.
  return state.attempt === 0 ? { attempt: 1, status: 'loading' } : { ...state, status: 'failed' };
}
