import type { Env, MapData, MapListResponse, MapResponse } from './types';

export class MapStorageService {
  constructor(private env: Env) {}

  private getMapKey(userId: string, mapId: string): string {
    return `maps/${userId}/${mapId}.json`;
  }

  private generateMapId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${randomPart}`;
  }

  async saveMap(userId: string, mapId: string | null, title: string, content: string): Promise<MapResponse> {
    try {
      const id = mapId || this.generateMapId();
      const now = new Date().toISOString();

      const mapData: MapData = {
        id,
        userId,
        title,
        content,
        createdAt: mapId ? await this.getMapCreatedAt(userId, id) || now : now,
        updatedAt: now
      };

      const key = this.getMapKey(userId, id);
      await this.env.MAPS_BUCKET.put(key, JSON.stringify(mapData));

      return {
        success: true,
        map: mapData
      };
    } catch (error) {
      console.error('Error saving map:', error);
      return {
        success: false,
        error: 'Failed to save map'
      };
    }
  }

  async getMap(userId: string, mapId: string): Promise<MapResponse> {
    try {
      const key = this.getMapKey(userId, mapId);
      const object = await this.env.MAPS_BUCKET.get(key);

      if (!object) {
        return {
          success: false,
          error: 'Map not found'
        };
      }

      const mapData: MapData = JSON.parse(await object.text());

      // Check if map belongs to user
      if (mapData.userId !== userId) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      return {
        success: true,
        map: mapData
      };
    } catch (error) {
      console.error('Error getting map:', error);
      return {
        success: false,
        error: 'Failed to retrieve map'
      };
    }
  }

  async listMaps(userId: string): Promise<MapListResponse> {
    try {
      const prefix = `maps/${userId}/`;
      const listed = await this.env.MAPS_BUCKET.list({ prefix });

      const maps = [];
      for (const object of listed.objects) {
        try {
          const mapObject = await this.env.MAPS_BUCKET.get(object.key);
          if (mapObject) {
            const mapData: MapData = JSON.parse(await mapObject.text());
            if (!mapData.isDeleted) {
              maps.push({
                id: mapData.id,
                title: mapData.title,
                createdAt: mapData.createdAt,
                updatedAt: mapData.updatedAt
              });
            }
          }
        } catch (error) {
          console.error('Error parsing map:', object.key, error);
        }
      }

      // Sort by updated date (newest first)
      maps.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return {
        success: true,
        maps
      };
    } catch (error) {
      console.error('Error listing maps:', error);
      return {
        success: false,
        error: 'Failed to list maps'
      };
    }
  }

  async deleteMap(userId: string, mapId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const key = this.getMapKey(userId, mapId);

      // First check if map exists and belongs to user
      const object = await this.env.MAPS_BUCKET.get(key);
      if (!object) {
        return {
          success: false,
          error: 'Map not found'
        };
      }

      const mapData: MapData = JSON.parse(await object.text());
      if (mapData.userId !== userId) {
        return {
          success: false,
          error: 'Access denied'
        };
      }

      // Mark as deleted instead of actually deleting
      mapData.isDeleted = true;
      mapData.updatedAt = new Date().toISOString();

      await this.env.MAPS_BUCKET.put(key, JSON.stringify(mapData));

      return {
        success: true
      };
    } catch (error) {
      console.error('Error deleting map:', error);
      return {
        success: false,
        error: 'Failed to delete map'
      };
    }
  }

  private async getMapCreatedAt(userId: string, mapId: string): Promise<string | null> {
    try {
      const key = this.getMapKey(userId, mapId);
      const object = await this.env.MAPS_BUCKET.get(key);
      if (object) {
        const mapData: MapData = JSON.parse(await object.text());
        return mapData.createdAt;
      }
    } catch (error) {
      console.error('Error getting map createdAt:', error);
    }
    return null;
  }
}