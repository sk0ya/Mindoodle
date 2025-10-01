import type { Env, MapData, MapListResponse, MapResponse } from './types';

export class MapStorageService {
  constructor(private env: Env) {}

  private getMapKey(userId: string, mapId: string): string {
    return `maps/${userId}/${mapId}.md`;
  }

  private generateMapId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${randomPart}`;
  }

  async saveMap(userId: string, mapId: string | null, title: string, content: string): Promise<MapResponse> {
    try {
      const id = mapId || this.generateMapId();
      const key = this.getMapKey(userId, id);

      // Save markdown file
      await this.env.MAPS_BUCKET.put(key, content, {
        httpMetadata: {
          contentType: 'text/markdown',
        }
      });

      // Get uploaded timestamp
      const object = await this.env.MAPS_BUCKET.get(key);
      const timestamp = object?.uploaded.toISOString() || new Date().toISOString();

      const mapData: MapData = {
        id,
        userId,
        title,
        content,
        createdAt: timestamp,
        updatedAt: timestamp
      };

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

      const content = await object.text();
      const timestamp = object.uploaded.toISOString();

      // Extract title from markdown (first line starting with #)
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : 'Untitled';

      const mapData: MapData = {
        id: mapId,
        userId,
        title,
        content,
        createdAt: timestamp,
        updatedAt: timestamp
      };

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
        // Only process .md files
        if (!object.key.endsWith('.md')) {
          continue;
        }

        try {
          const fullObject = await this.env.MAPS_BUCKET.get(object.key);
          if (fullObject) {
            const content = await fullObject.text();
            const timestamp = fullObject.uploaded.toISOString();

            // Extract title from markdown
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : 'Untitled';

            const mapId = object.key.split('/').pop()?.replace('.md', '') || '';
            maps.push({
              id: mapId,
              title,
              createdAt: timestamp,
              updatedAt: timestamp
            });
          }
        } catch (error) {
          console.error('Error processing map:', object.key, error);
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

      // Check if map exists
      const object = await this.env.MAPS_BUCKET.get(key);
      if (!object) {
        return {
          success: false,
          error: 'Map not found'
        };
      }

      // Actually delete the file
      await this.env.MAPS_BUCKET.delete(key);

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

}