import { ensureAgentSession } from './agent-session';
import { apiGet } from './api';
import type { PlaceDetails, PlaceSuggestion } from '@nestyk/feature-listing';

export async function searchPlaces(
  query: string,
  language = 'th',
): Promise<PlaceSuggestion[]> {
  await ensureAgentSession();
  const params = new URLSearchParams({ q: query, language });
  const result = await apiGet<{ suggestions: PlaceSuggestion[] }>(
    `/agent/places/autocomplete?${params.toString()}`,
  );
  return result.suggestions ?? [];
}

export async function getPlaceDetails(
  placeId: string,
  language = 'th',
): Promise<PlaceDetails> {
  await ensureAgentSession();
  const params = new URLSearchParams({ placeId, language });
  return apiGet<PlaceDetails>(`/agent/places/details?${params.toString()}`);
}

export async function searchNearbyPlaces(latitude: number, longitude: number, language = 'th'): Promise<import('@nestyk/types').NearbyPlace[]> {
  await ensureAgentSession();
  const params = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), language });
  const result = await apiGet<{ places: import('@nestyk/types').NearbyPlace[] }>(`/agent/places/nearby?${params}`);
  return result.places;
}

export async function reverseMapLocation(latitude: number, longitude: number): Promise<PlaceDetails> {
  await ensureAgentSession();
  return apiGet(`/agent/places/reverse?${new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })}`);
}
