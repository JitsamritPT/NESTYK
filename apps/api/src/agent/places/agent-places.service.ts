import type { NearbyPlace } from '@nestyk/types';
import {
  NEARBY_TYPES,
  validCoordinates,
  distanceMeters,
  formatTransitPlaceName,
  mergeNearbyPlaces,
  isMinorTransitPlace,
} from './nearby-places';
import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export type PlaceSuggestion = {
  placeId: string;
  name: string;
  address: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  address: string;
  district: string;
  province: string;
  subdistrict: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

type GooglePrediction = {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{ placePrediction?: GooglePrediction }>;
};

type GoogleTextSearchResponse = {
  places?: Array<{
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
  }>;
};

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: GoogleAddressComponent[];
};

type GoogleErrorBody = {
  error?: { message?: string; status?: string };
};

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const NEARBY_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

type LegacyNearbyResult = {
  place_id?: string;
  name?: string;
  vicinity?: string;
  business_status?: string;
  user_ratings_total?: number;
  geometry?: { location?: { lat?: number; lng?: number } };
};

type LegacyNearbyResponse = {
  status?: string;
  error_message?: string;
  results?: LegacyNearbyResult[];
};

function componentAll(components: GoogleAddressComponent[], type: string): string {
  const match = components.find((item) => item.types?.includes(type));
  return (match?.longText || match?.shortText || '').trim();
}

function componentOf(components: GoogleAddressComponent[], type: string): string {
  return componentAll(components, type);
}

function stripPrefix(value: string, prefixes: RegExp): string {
  return value.replace(prefixes, '').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isSameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function joinUnique(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const value = part.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out.join(' ');
}

function stripFromLine(line: string, fragments: string[]): string {
  let next = line;
  for (const fragment of fragments) {
    const value = fragment.trim();
    if (!value) continue;
    next = next.replace(new RegExp(`(,\\s*)?${escapeRegExp(value)}`, 'gi'), '');
  }
  return next
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/^,\s*|,\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitAddressComponents(
  components: GoogleAddressComponent[],
  displayName: string,
  formattedAddress: string,
  shortFormattedAddress: string,
): { address: string; district: string; province: string; subdistrict: string; postalCode: string } {
  const province = stripPrefix(
    componentOf(components, 'administrative_area_level_1'),
    /^(จังหวัด|Chang Wat|Changwat)\s+/i,
  );
  const admin2 = stripPrefix(
    componentOf(components, 'administrative_area_level_2'),
    /^(เขต|อำเภอ|Khet|Amphoe|Amphur)\s+/i,
  );
  const locality = stripPrefix(
    componentOf(components, 'locality'),
    /^(เขต|อำเภอ|Khet|Amphoe|Amphur)\s+/i,
  );
  const sub1 = stripPrefix(
    componentOf(components, 'sublocality_level_1') ||
      componentOf(components, 'sublocality'),
    /^(แขวง|ตำบล|เขต|Khwaeng|Tambon|Khet)\s+/i,
  );
  const sub2 = stripPrefix(
    componentOf(components, 'sublocality_level_2') ||
      componentOf(components, 'administrative_area_level_3'),
    /^(แขวง|ตำบล|Khwaeng|Tambon)\s+/i,
  );

  let district = admin2;
  let subdistrict = sub2 || sub1;
  if (!district && sub2 && sub1) {
    district = sub1;
    subdistrict = sub2;
  } else if (!district && locality && (!province || !isSameText(locality, province))) {
    district = locality;
  } else if (!district) {
    district = sub1;
    subdistrict = sub2;
  }
  if (subdistrict && district && isSameText(subdistrict, district)) {
    subdistrict = '';
  }
  const postalCode = componentOf(components, 'postal_code');

  const premise = componentOf(components, 'premise');
  const streetParts = [
    componentOf(components, 'street_number'),
    !premise || isSameText(premise, displayName) ? '' : premise,
    componentOf(components, 'subpremise'),
    componentOf(components, 'route'),
    componentOf(components, 'intersection'),
  ];
  let address = joinUnique(streetParts);
  if (!address) {
    address = stripFromLine(shortFormattedAddress || formattedAddress, [
      displayName,
      district,
      province,
      subdistrict,
      postalCode,
      locality,
      componentOf(components, 'country'),
      'Thailand',
      'ประเทศไทย',
    ]);
  }

  return { address, district, province, subdistrict, postalCode };
}

function normalizePlaceId(value?: string): string {
  return (value || '').trim().replace(/^places\//, '');
}

@Injectable()
export class AgentPlacesService {
  private readonly logger = new Logger(AgentPlacesService.name);

  async nearby(latitude: number, longitude: number, language: string): Promise<{ places: NearbyPlace[] }> {
    if (!validCoordinates(latitude, longitude)) throw new BadRequestException('Valid latitude and longitude required');
    const lang = (language || 'th').trim() || 'th';
    const results = await Promise.all(NEARBY_TYPES.map(async ({ type, radius, limit }) => {
      const params = new URLSearchParams({
        location: `${latitude},${longitude}`,
        radius: String(radius),
        type,
        language: lang,
        key: this.apiKey(),
      });
      const data = await this.googleLegacyNearby(`${NEARBY_SEARCH_URL}?${params}`);

      return (data.results ?? [])
        .filter((p) => {
          const placeId = p.place_id?.trim();
          const name = p.name?.trim();
          const lat = p.geometry?.location?.lat;
          const lng = p.geometry?.location?.lng;
          if (!placeId || !name || !validCoordinates(lat, lng)) return false;
          if (p.business_status === 'CLOSED_PERMANENTLY') return false;
          if (type === 'park' && (p.user_ratings_total ?? 0) < 120) return false;
          if (isMinorTransitPlace(name, p.vicinity)) return false;
          return true;
        })
        .map((p): NearbyPlace => {
          const lat = p.geometry!.location!.lat!;
          const lng = p.geometry!.location!.lng!;
          const rawName = p.name!.trim();
          const vicinity = p.vicinity?.trim() || undefined;
          return {
            placeId: p.place_id!.trim(),
            name: formatTransitPlaceName(rawName, type, vicinity),
            type,
            latitude: lat,
            longitude: lng,
            distanceMeters: distanceMeters(latitude, longitude, lat, lng),
            vicinity,
          };
        })
        .filter((p) => p.distanceMeters <= radius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, limit);
    }));
    return { places: mergeNearbyPlaces(results.flat()) };
  }

  async autocomplete(query: string, language: string): Promise<{ suggestions: PlaceSuggestion[] }> {
    const input = query.trim();
    if (input.length < 2) {
      return { suggestions: [] };
    }

    const fromAutocomplete = this.mapAutocomplete(
      await this.googlePost<GoogleAutocompleteResponse>(
        AUTOCOMPLETE_URL,
        {
          input,
          languageCode: language,
          regionCode: 'TH',
          includedRegionCodes: ['th'],
        },
        'suggestions.placePrediction',
      ),
    );

    if (fromAutocomplete.length) {
      return { suggestions: fromAutocomplete };
    }

    const fromText = this.mapTextSearch(
      await this.googlePost<GoogleTextSearchResponse>(
        TEXT_SEARCH_URL,
        {
          textQuery: input,
          languageCode: language,
          regionCode: 'TH',
          pageSize: 8,
        },
        'places.id,places.displayName,places.formattedAddress',
      ),
    );

    return { suggestions: fromText };
  }

  async details(placeId: string, language: string): Promise<PlaceDetails> {
    const id = normalizePlaceId(placeId);
    if (!id) {
      throw new BadRequestException('placeId required');
    }

    const data = await this.googleGet<GooglePlaceDetailsResponse>(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${encodeURIComponent(language)}&regionCode=TH`,
      'id,displayName,formattedAddress,shortFormattedAddress,location,addressComponents',
    );

    const components = data.addressComponents ?? [];
    const displayName = data.displayName?.text?.trim() || '';
    const split = splitAddressComponents(
      components,
      displayName,
      data.formattedAddress || '',
      data.shortFormattedAddress || '',
    );

    const latitude = data.location?.latitude;
    const longitude = data.location?.longitude;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new BadGatewayException('Place has no coordinates');
    }

    return {
      placeId: normalizePlaceId(data.id) || id,
      name: displayName,
      address: split.address,
      district: split.district,
      province: split.province,
      subdistrict: split.subdistrict,
      postalCode: split.postalCode,
      latitude,
      longitude,
    };
  }

  async reverse(latitude: number, longitude: number): Promise<PlaceDetails> {
    if (!validCoordinates(latitude, longitude)) throw new BadRequestException('Valid coordinates required');
    const params = new URLSearchParams({ latlng: `${latitude},${longitude}`, language: 'th', key: this.apiKey() });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new BadGatewayException('Unable to resolve map location');
    const data = await response.json() as { status: string; results?: Array<{ place_id: string; formatted_address: string; address_components: Array<{ long_name: string; short_name: string; types: string[] }> }> };
    if (data.status !== 'OK' || !data.results?.length) throw new BadGatewayException('Unable to resolve map location');
    const result = data.results[0];
    if (!result.address_components.some((c) => c.types.includes('country') && c.short_name === 'TH')) throw new BadRequestException('Please select a location in Thailand');
    const components = result.address_components.map((c) => ({ longText: c.long_name, shortText: c.short_name, types: c.types }));
    const split = splitAddressComponents(components, '', result.formatted_address, '');
    return { placeId: result.place_id, name: result.formatted_address, ...split, district: split.district.replace(/^(เขต|อำเภอ)\s*/, '').trim(), latitude, longitude };
  }

  private mapAutocomplete(data: GoogleAutocompleteResponse): PlaceSuggestion[] {
    return (data.suggestions ?? [])
      .map((row) => row.placePrediction)
      .filter((row): row is GooglePrediction => Boolean(normalizePlaceId(row?.placeId)))
      .map((row) => {
        const name =
          row.structuredFormat?.mainText?.text?.trim() || row.text?.text?.trim() || '';
        const address = row.structuredFormat?.secondaryText?.text?.trim() || '';
        return {
          placeId: normalizePlaceId(row.placeId),
          name: name || address,
          address,
        };
      })
      .filter((row) => row.placeId && row.name);
  }

  private mapTextSearch(data: GoogleTextSearchResponse): PlaceSuggestion[] {
    return (data.places ?? [])
      .map((place) => ({
        placeId: normalizePlaceId(place.id),
        name: place.displayName?.text?.trim() || '',
        address: place.formattedAddress?.trim() || '',
      }))
      .filter((row) => row.placeId && row.name);
  }

  private apiKey(): string {
    const key = (process.env.GOOGLE_MAPS_API_KEY || '')
      .trim()
      .replace(/^['"]|['"]$/g, '')
      .trim();
    if (!key) {
      throw new ServiceUnavailableException('GOOGLE_MAPS_API_KEY is not configured');
    }
    return key;
  }

  private async googleLegacyNearby(url: string): Promise<LegacyNearbyResponse> {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const payload = (await response.json().catch(() => ({}))) as LegacyNearbyResponse;
    if (!response.ok) {
      const message = payload.error_message?.trim() || 'Google Places nearby search failed';
      this.logger.warn(`Google Places Legacy nearby ${response.status}: ${message}`);
      throw new BadGatewayException(message);
    }
    const status = payload.status || '';
    if (status === 'OK' || status === 'ZERO_RESULTS') {
      return payload;
    }
    const message = payload.error_message?.trim() || `Google Places nearby search failed (${status || 'UNKNOWN'})`;
    this.logger.warn(`Google Places Legacy nearby status ${status}: ${message}`);
    throw new BadGatewayException(message);
  }

  private async googlePost<T>(url: string, body: unknown, fieldMask: string): Promise<T> {
    return this.parseGoogleResponse<T>(
      await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(10000),
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey(),
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(body),
      }),
    );
  }

  private async googleGet<T>(url: string, fieldMask: string): Promise<T> {
    return this.parseGoogleResponse<T>(
      await fetch(url, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': this.apiKey(),
          'X-Goog-FieldMask': fieldMask,
        },
      }),
    );
  }

  private async parseGoogleResponse<T>(res: Response): Promise<T> {
    const payload = (await res.json().catch(() => ({}))) as GoogleErrorBody & T;
    if (!res.ok) {
      const message =
        typeof payload.error?.message === 'string' && payload.error.message.trim()
          ? payload.error.message.trim()
          : 'Google Places request failed';
      this.logger.warn(`Google Places ${res.status} ${payload.error?.status || ''}: ${message}`);
      throw new BadGatewayException(message);
    }
    return payload;
  }
}
