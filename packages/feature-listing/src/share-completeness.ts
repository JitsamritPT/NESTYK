import type { AgentRoomDetail } from './agent-room-detail';

/** Edit-hub categories (same 8 as EDIT_STEPS order). */
export const SHARE_CATEGORY_IDS = [
  'property',
  'layout',
  'pricing',
  'photos',
  'facilities',
  'nearby',
  'details',
] as const;

export type ShareCategoryId = (typeof SHARE_CATEGORY_IDS)[number];

export type ShareCategoryStatus = {
  id: ShareCategoryId;
  complete: boolean;
};

export type ShareCompleteness = {
  done: number;
  total: number;
  percent: number;
  categories: ShareCategoryStatus[];
};

function hasLayout(room: AgentRoomDetail) {
  if (room.listingTitle?.trim()) return true;
  if (room.roomTypeCode) return true;
  return room.layout.some((item) => item.code === 'bedroom' && String(item.value).trim().length > 0);
}

function hasPhotos(room: AgentRoomDetail) {
  return room.medias.some((m) => m.mediaType === 'image' && !!m.mediaUrl);
}

function hasFacilities(room: AgentRoomDetail) {
  if ((room.facilityItems?.length ?? 0) > 0) return true;
  if ((room.facilities?.length ?? 0) > 0) return true;
  return (room.customFacilities?.length ?? 0) > 0;
}

/**
 * Share-readiness from saved room data (edit-hub sections minus listing contact —
 * contact is optional for private share links).
 */
export function computeShareCompleteness(room: AgentRoomDetail): ShareCompleteness {
  const categories: ShareCategoryStatus[] = [
    { id: 'property', complete: !!room.property?.name?.trim() },
    { id: 'layout', complete: hasLayout(room) },
    { id: 'pricing', complete: room.prices.length > 0 },
    { id: 'photos', complete: hasPhotos(room) },
    { id: 'facilities', complete: hasFacilities(room) },
    { id: 'nearby', complete: (room.nearbyPlaces?.length ?? 0) > 0 },
    {
      id: 'details',
      complete: !!(room.promoTitle?.trim() || room.description?.trim()),
    },
  ];
  const done = categories.filter((c) => c.complete).length;
  const total = categories.length;
  return {
    done,
    total,
    percent: total > 0 ? Math.round((done / total) * 100) : 0,
    categories,
  };
}

export type RoomShareVisibility = {
  photos: boolean;
  price: boolean;
  facilities: boolean;
  location: boolean;
  contact: boolean;
};

export const DEFAULT_ROOM_SHARE_VISIBILITY: RoomShareVisibility = {
  photos: true,
  price: true,
  facilities: true,
  location: true,
  contact: false,
};

/** Build public share URL from raw token (creator only). */
export function roomShareUrl(token: string, webBase?: string) {
  const base = (webBase || 'https://nestyk.com').replace(/\/$/, '');
  return `${base}/s/${token}`;
}
