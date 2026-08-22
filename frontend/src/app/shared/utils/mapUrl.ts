import type { MapIdentifier } from '@shared/types';

export type MapUrlTarget = {
  mapId: string;
  workspaceId?: string;
};

type MapUrlLocation = Pick<Location, 'origin' | 'pathname' | 'search' | 'hash'>;

const MAP_PARAM = 'map';
const LEGACY_MAP_PARAM = 'mapId';
const WORKSPACE_PARAM = 'workspace';
const LEGACY_WORKSPACE_PARAM = 'workspaceId';
const HASH_MAP_PATTERN = /^#\/?map\/([^?]+)(?:\?(.*))?$/;

const normalizeMapId = (value: string | null): string | null => {
  const trimmed = (value || '').trim().replace(/\.md$/i, '');
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeWorkspaceId = (value: string | null): string | undefined => {
  const trimmed = (value || '').trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export function getMapTargetFromUrl(location: MapUrlLocation): MapUrlTarget | null {
  const params = new URLSearchParams(location.search);
  const mapFromQuery = normalizeMapId(params.get(MAP_PARAM) || params.get(LEGACY_MAP_PARAM));

  if (mapFromQuery) {
    return {
      mapId: mapFromQuery,
      workspaceId: normalizeWorkspaceId(params.get(WORKSPACE_PARAM) || params.get(LEGACY_WORKSPACE_PARAM)),
    };
  }

  const hashMatch = HASH_MAP_PATTERN.exec(location.hash);
  if (!hashMatch) return null;

  let rawMapId = '';
  try {
    rawMapId = hashMatch[1] ? decodeURIComponent(hashMatch[1]) : '';
  } catch {
    return null;
  }
  const mapId = normalizeMapId(rawMapId);
  if (!mapId) return null;

  const hashParams = new URLSearchParams(hashMatch[2] || '');
  return {
    mapId,
    workspaceId: normalizeWorkspaceId(hashParams.get(WORKSPACE_PARAM) || hashParams.get(LEGACY_WORKSPACE_PARAM)),
  };
}

export function buildMapUrl(location: MapUrlLocation, identifier: MapIdentifier): string {
  const url = new URL(`${location.pathname}${location.search}${location.hash}`, location.origin);
  url.searchParams.set(MAP_PARAM, identifier.mapId);
  url.searchParams.delete(LEGACY_MAP_PARAM);

  if (identifier.workspaceId) {
    url.searchParams.set(WORKSPACE_PARAM, identifier.workspaceId);
  } else {
    url.searchParams.delete(WORKSPACE_PARAM);
  }

  url.searchParams.delete(LEGACY_WORKSPACE_PARAM);
  url.hash = '';

  return `${url.pathname}${url.search}${url.hash}`;
}
