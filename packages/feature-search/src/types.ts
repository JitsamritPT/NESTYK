export type StationLine = 'Sukhumvit' | 'Silom' | 'Blue' | 'Purple' | 'Yellow' | 'Pink' | 'Gold';

export interface TransitStation {
  code: string;
  nameTh: string;
  nameEn: string;
  type: 'BTS' | 'MRT';
  line: StationLine;
  latitude: number;
  longitude: number;
}
