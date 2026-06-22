const TILE_DISPLAY_NAMES = {
  WAN_1: '\u4e00\u4e07',
  WAN_2: '\u4e8c\u4e07',
  WAN_3: '\u4e09\u4e07',
  WAN_4: '\u56db\u4e07',
  WAN_5: '\u4e94\u4e07',
  DOT_1: '\u4e00\u7b52',
  DOT_2: '\u4e8c\u7b52',
  DOT_3: '\u4e09\u7b52',
  DOT_4: '\u56db\u7b52',
  DOT_5: '\u4e94\u7b52',
  BAM_1: '\u4e00\u6761',
  BAM_2: '\u4e8c\u6761',
  BAM_3: '\u4e09\u6761',
  BAM_4: '\u56db\u6761',
  BAM_5: '\u4e94\u6761',
  EAST: '\u4e1c',
  SOUTH: '\u5357',
  WEST: '\u897f',
  NORTH: '\u5317',
  RED: '\u4e2d',
} as const;

export type KnownTileType = keyof typeof TILE_DISPLAY_NAMES;

const loggedUnknownTypes = new Set<string>();

export function getTileDisplayName(tileType: string): string {
  if (isKnownTileType(tileType)) {
    return TILE_DISPLAY_NAMES[tileType];
  }

  if (!loggedUnknownTypes.has(tileType)) {
    loggedUnknownTypes.add(tileType);
    console.error(`[TileDisplayConfig] Unknown tile type: ${tileType}`);
  }

  return '?';
}

export function getAllTileDisplayNames(): Readonly<Record<KnownTileType, string>> {
  return TILE_DISPLAY_NAMES;
}

function isKnownTileType(tileType: string): tileType is KnownTileType {
  return Object.prototype.hasOwnProperty.call(TILE_DISPLAY_NAMES, tileType);
}
