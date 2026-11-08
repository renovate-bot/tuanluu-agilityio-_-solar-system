/** Locales shipped in this phase: UI, body content, tour script and narration are complete for each. */
export const SUPPORTED_LANGS = ['vi', 'en', 'ja', 'de'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (SUPPORTED_LANGS as readonly string[]).includes(value);
}

export const BODY_IDS = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'moon',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;
export type BodyId = (typeof BODY_IDS)[number];
export type ContentId = BodyId | 'asteroid-belt';
export type BodyKind = 'star' | 'terrestrial' | 'gas-giant' | 'ice-giant' | 'dwarf-planet' | 'moon';

export interface PhysicalData {
  diameterKm: number;
  massEarths: number;
  surfaceGravity: number; // m/s²
  rotationPeriodHours: number; // negative = retrograde
  axialTiltDeg: number;
  meanTempC: number;
  distanceFromParentMkm?: number; // million km (Moon: from Earth)
  orbitalPeriodDays?: number;
  knownMoons?: number;
}

export interface OrbitalElements {
  semiMajorAxisAu: number;
  eccentricity: number;
  inclinationDeg: number;
  longitudeOfAscendingNodeDeg: number;
  argumentOfPerihelionDeg: number;
  meanAnomalyAtEpochDeg: number;
}

export interface BodyDef {
  id: BodyId;
  kind: BodyKind;
  parent: BodyId | null;
  orderFromSun: number | null;
  physical: PhysicalData;
  orbit?: OrbitalElements;
  /** Hex tint of the orbit ribbon; planets and Pluto only (the Sun and the Moon draw none). */
  orbitColor?: string;
}

export interface BodyContent {
  name: string;
  kindLabel: string;
  description: string;
  facts: string[];
}

export type TourStopId = 'intro' | ContentId | 'outro';

export interface TourStopDef {
  id: TourStopId;
  focus: ContentId | 'overview';
}
