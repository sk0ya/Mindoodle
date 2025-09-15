// Mindoodle: stubbed cloud IndexedDB utilities (no-op)
export type CloudCachedMindMap = any;

export async function initCloudIndexedDB(): Promise<void> {
  // no-op
}

export async function saveMindMapToCloudIndexedDB(_map: CloudCachedMindMap): Promise<void> {
  // no-op
}

export async function getAllMindMapsFromCloudIndexedDB(): Promise<CloudCachedMindMap[]> {
  return [];
}

export async function removeMindMapFromCloudIndexedDB(_id: string): Promise<void> {
  // no-op
}

export async function getUserMapsFromCloudIndexedDB(_userId: string): Promise<CloudCachedMindMap[]> {
  return [];
}

