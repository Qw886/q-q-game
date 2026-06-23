import { Color } from 'cc';
import { NORMAL_TILE_TYPES } from './TileTypeConfig';
import type { ConfiguredTileType } from './TileTypeConfig';

export type TileFaceCategory = 'wan' | 'dot' | 'bam' | 'honor';

export interface TileDisplayInfo {
  readonly displayName: string;
  readonly facePath: string;
  readonly category: TileFaceCategory;
  readonly fallbackColor: Color;
}

export const TILE_BACKGROUND_PATH = 'tiles/backgrounds/tile_bg';

const TILE_DISPLAY_INFOS = {
  WAN_1: { displayName: '\u4e00\u4e07', facePath: 'tiles/faces/wan_1', category: 'wan', fallbackColor: new Color(148, 44, 40, 255) },
  WAN_2: { displayName: '\u4e8c\u4e07', facePath: 'tiles/faces/wan_2', category: 'wan', fallbackColor: new Color(148, 44, 40, 255) },
  WAN_3: { displayName: '\u4e09\u4e07', facePath: 'tiles/faces/wan_3', category: 'wan', fallbackColor: new Color(148, 44, 40, 255) },
  WAN_4: { displayName: '\u56db\u4e07', facePath: 'tiles/faces/wan_4', category: 'wan', fallbackColor: new Color(148, 44, 40, 255) },
  WAN_5: { displayName: '\u4e94\u4e07', facePath: 'tiles/faces/wan_5', category: 'wan', fallbackColor: new Color(148, 44, 40, 255) },
  DOT_1: { displayName: '\u4e00\u7b52', facePath: 'tiles/faces/dot_1', category: 'dot', fallbackColor: new Color(40, 94, 156, 255) },
  DOT_2: { displayName: '\u4e8c\u7b52', facePath: 'tiles/faces/dot_2', category: 'dot', fallbackColor: new Color(40, 94, 156, 255) },
  DOT_3: { displayName: '\u4e09\u7b52', facePath: 'tiles/faces/dot_3', category: 'dot', fallbackColor: new Color(40, 94, 156, 255) },
  DOT_4: { displayName: '\u56db\u7b52', facePath: 'tiles/faces/dot_4', category: 'dot', fallbackColor: new Color(40, 94, 156, 255) },
  DOT_5: { displayName: '\u4e94\u7b52', facePath: 'tiles/faces/dot_5', category: 'dot', fallbackColor: new Color(40, 94, 156, 255) },
  BAM_1: { displayName: '\u4e00\u6761', facePath: 'tiles/faces/bam_1', category: 'bam', fallbackColor: new Color(38, 122, 68, 255) },
  BAM_2: { displayName: '\u4e8c\u6761', facePath: 'tiles/faces/bam_2', category: 'bam', fallbackColor: new Color(38, 122, 68, 255) },
  BAM_3: { displayName: '\u4e09\u6761', facePath: 'tiles/faces/bam_3', category: 'bam', fallbackColor: new Color(38, 122, 68, 255) },
  BAM_4: { displayName: '\u56db\u6761', facePath: 'tiles/faces/bam_4', category: 'bam', fallbackColor: new Color(38, 122, 68, 255) },
  BAM_5: { displayName: '\u4e94\u6761', facePath: 'tiles/faces/bam_5', category: 'bam', fallbackColor: new Color(38, 122, 68, 255) },
  EAST: { displayName: '\u4e1c', facePath: 'tiles/faces/east', category: 'honor', fallbackColor: new Color(55, 55, 55, 255) },
  SOUTH: { displayName: '\u5357', facePath: 'tiles/faces/south', category: 'honor', fallbackColor: new Color(55, 55, 55, 255) },
  WEST: { displayName: '\u897f', facePath: 'tiles/faces/west', category: 'honor', fallbackColor: new Color(55, 55, 55, 255) },
  NORTH: { displayName: '\u5317', facePath: 'tiles/faces/north', category: 'honor', fallbackColor: new Color(55, 55, 55, 255) },
  RED: { displayName: '\u4e2d', facePath: 'tiles/faces/red', category: 'honor', fallbackColor: new Color(190, 44, 40, 255) },
} as const satisfies Readonly<Record<ConfiguredTileType, TileDisplayInfo>>;

export type KnownTileType = keyof typeof TILE_DISPLAY_INFOS;

const loggedUnknownTypes = new Set<string>();
let missingMappingLogged = false;

export function getTileDisplayName(tileType: string): string {
  if (isKnownTileType(tileType)) {
    return TILE_DISPLAY_INFOS[tileType].displayName;
  }

  if (!loggedUnknownTypes.has(tileType)) {
    loggedUnknownTypes.add(tileType);
    console.error(`[TileDisplayConfig] Unknown tile type: ${tileType}`);
  }

  return '?';
}

export function getTileDisplayInfo(tileType: string): TileDisplayInfo {
  if (isKnownTileType(tileType)) {
    return TILE_DISPLAY_INFOS[tileType];
  }

  if (!loggedUnknownTypes.has(tileType)) {
    loggedUnknownTypes.add(tileType);
    console.error(`[TileDisplayConfig] Unknown tile type: ${tileType}`);
  }

  return {
    displayName: '?',
    facePath: 'tiles/faces/unknown',
    category: 'honor',
    fallbackColor: new Color(64, 50, 32, 255),
  };
}

export function getAllTileDisplayInfos(): Readonly<Record<KnownTileType, TileDisplayInfo>> {
  return TILE_DISPLAY_INFOS;
}

function isKnownTileType(tileType: string): tileType is KnownTileType {
  return Object.prototype.hasOwnProperty.call(TILE_DISPLAY_INFOS, tileType);
}

export function validateTileDisplayMappings(): void {
  if (missingMappingLogged) {
    return;
  }

  const missingTypes = NORMAL_TILE_TYPES.filter((tileType) => !isKnownTileType(tileType));

  if (missingTypes.length > 0) {
    missingMappingLogged = true;
    console.error(`[TileDisplayConfig] Missing tile display mappings: ${missingTypes.join(', ')}`);
  }
}
