import type { AppIconName } from '@nestyk/ui/native';

export const FACILITY_GROUP_ICONS: Record<string, AppIconName> = {
  furniture: 'bed',
  appliances: 'snowflake',
  room_features: 'home',
  parking: 'car',
  project_facilities: 'swimming-pool',
  security_services: 'shield',
  other: 'note',
};

export const FACILITY_ITEM_ICONS: Record<string, AppIconName> = {
  // furniture
  bed_mattress: 'bed',
  wardrobe: 'coat-hanger',
  sofa: 'couch',
  tv_stand: 'television',
  dining_table: 'fork-knife',
  desk: 'desk',
  vanity_mirror: 'sparkle',
  storage_cabinet: 'archive',
  curtains: 'wind',
  // appliances
  air_conditioning: 'snowflake',
  fan: 'fan',
  tv: 'television',
  smart_tv: 'television',
  refrigerator: 'wine',
  microwave: 'oven',
  washing_machine: 'washing-machine',
  dryer: 'wind',
  water_heater: 'drop',
  induction_stove: 'cooking-pot',
  gas_stove: 'flame',
  range_hood: 'wind',
  water_filter: 'drop',
  digital_door_lock: 'lock',
  smart_home: 'sparkle',
  // room_features
  open_kitchen: 'cooking-pot',
  closed_kitchen: 'cooking-pot',
  wet_dry_bathroom: 'shower',
  bathtub: 'bath',
  balcony: 'plant',
  mosquito_net: 'grid',
  drying_area: 'wind',
  storage_room: 'cube',
  private_garden: 'tree',
  private_pool: 'swimming-pool',
  // parking
  car_parking: 'car',
  motorcycle_parking: 'motorcycle',
  bicycle_parking: 'bicycle',
  fixed_parking_slot: 'garage',
  indoor_parking: 'garage',
  private_ev_charger: 'charging-station',
  // project_facilities
  shared_pool: 'swimming-pool',
  gym: 'barbell',
  sauna: 'thermometer',
  shared_garden: 'tree',
  coworking: 'desk',
  cokitchen: 'cooking-pot',
  playground: 'park',
  parcel_room: 'package',
  shared_laundry: 'washing-machine',
  shuttle: 'bus',
  shared_ev_charger: 'charging-station',
  // security_services
  security_24h: 'shield',
  keycard_access: 'key',
  cctv: 'camera',
  smoke_detector: 'warning',
  fire_extinguisher: 'fire-extinguisher',
  in_unit_internet: 'wifi',
  housekeeping: 'broom',
  pet_friendly: 'paw',
};

/** Same icon resolution as create/edit amenities. */
export function amenityIcon(code: string, groupCode?: string | null): AppIconName {
  return FACILITY_ITEM_ICONS[code] ?? FACILITY_GROUP_ICONS[groupCode ?? ''] ?? 'grid';
}
