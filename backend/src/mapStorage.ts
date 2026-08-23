import type { Env, MapData, MapListResponse, MapMetadataResponse, MapResponse } from './types';

/**
 * Cap for the percent-encoded title stored as R2 custom metadata. R2 allows
 * roughly 2 KB across all custom metadata, so one field stays well under it.
 */
const MAX_TITLE_METADATA_LENGTH = 512;

export class MapStorageService {
  constructor(private env: Env) {}

  private getMapKey(userId: string, mapId: string): string {
    // Allow nested paths in mapId; ensure no leading slash and append .md
    const clean = (mapId || '').replace(/^\/+/, '').replace(/\.+$/, '');
    return `maps/${userId}/${clean}.md`;
  }

  /**
   * The title shown in listings has always been the document's first level-1
   * heading. Deriving it here (rather than trusting the client's `title` field)
   * keeps the value stored as metadata identical to what listMaps used to
   * compute by reading the body back.
   */
  private extractTitle(content: string): string {
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch ? titleMatch[1] : 'Untitled';
  }

  /**
   * R2 custom metadata travels as HTTP header values, which must be US-ASCII
   * and are size-bounded. Mindoodle titles are routinely Japanese, so the value
   * is percent-encoded and truncated; listMaps decodes it again.
   */
  private encodeTitleMetadata(title: string): string {
    const encoded = encodeURIComponent(title);
    return encoded.length > MAX_TITLE_METADATA_LENGTH
      ? encoded.slice(0, MAX_TITLE_METADATA_LENGTH)
      : encoded;
  }

  private decodeTitleMetadata(value: string): string | null {
    try {
      const decoded = decodeURIComponent(value);
      return decoded.trim() ? decoded : null;
    } catch {
      // A truncated value can end mid-escape; fall back to the body read.
      return null;
    }
  }

  private generateMapId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return `${timestamp}_${randomPart}`;
  }

  async saveMap(userId: string, mapId: string | null, title: string, content: string, expectedUpdatedAt?: string): Promise<MapResponse> {
    try {
      const id = mapId || this.generateMapId();
      const key = this.getMapKey(userId, id);

      if (expectedUpdatedAt) {
        // head() answers the version question without transferring the body.
        const currentObject = await this.env.MAPS_BUCKET.head(key);
        const currentUpdatedAt = currentObject?.uploaded.toISOString() || null;
        if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
          return {
            success: false,
            error: 'Map has been modified by another user',
            conflict: { currentUpdatedAt }
          };
        }
      }

      // Save markdown file. The title is stored alongside it so that listMaps
      // does not have to download every document just to read its heading.
      const written = await this.env.MAPS_BUCKET.put(key, content, {
        httpMetadata: {
          contentType: 'text/markdown',
        },
        customMetadata: {
          title: this.encodeTitleMetadata(this.extractTitle(content))
        }
      });

      const timestamp = written?.uploaded.toISOString() || new Date().toISOString();

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

  /**
   * Answers "when did this map last change?" without transferring the body.
   *
   * The group workspace polls this every few seconds to detect remote edits.
   * Routing that through getMap() downloaded the whole document each time just
   * to read one timestamp; head() returns the same `uploaded` value and no body.
   */
  async getMapMetadata(userId: string, mapId: string): Promise<MapMetadataResponse> {
    try {
      const key = this.getMapKey(userId, mapId);
      const object = await this.env.MAPS_BUCKET.head(key);

      if (!object) {
        return {
          success: false,
          error: 'Map not found'
        };
      }

      const timestamp = object.uploaded.toISOString();

      return {
        success: true,
        map: {
          id: mapId,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      };
    } catch (error) {
      console.error('Error getting map metadata:', error);
      return {
        success: false,
        error: 'Failed to retrieve map metadata'
      };
    }
  }
  async listMaps(userId: string): Promise<MapListResponse> {
    try {
      const prefix = `maps/${userId}/`;
      const maps = [] as Array<{ id: string; title: string; createdAt: string; updatedAt: string }>;
      const pendingTitleReads = [] as Array<{ key: string; mapId: string; timestamp: string }>;

      // The listing carries the key, the upload timestamp and the stored title,
      // so a workspace of N maps costs one listing rather than N object reads.
      let cursor: string | undefined;
      do {
        const listed = await this.env.MAPS_BUCKET.list({
          prefix,
          cursor,
          include: ['customMetadata']
        });

        for (const object of listed.objects) {
          // Only process .md files
          if (!object.key.endsWith('.md')) {
            continue;
          }

          // Map id is the full path relative to maps/{userId}/, without .md
          const rel = object.key.startsWith(prefix) ? object.key.substring(prefix.length) : object.key;
          const mapId = rel.replace(/\.md$/i, '');
          const timestamp = object.uploaded.toISOString();

          const encodedTitle = object.customMetadata?.title;
          const title = encodedTitle ? this.decodeTitleMetadata(encodedTitle) : null;

          if (title) {
            maps.push({ id: mapId, title, createdAt: timestamp, updatedAt: timestamp });
          } else {
            // Written before titles were stored as metadata: read the body, as
            // before. These resolve to the fast path on their next save.
            pendingTitleReads.push({ key: object.key, mapId, timestamp });
          }
        }

        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);

      for (const pending of pendingTitleReads) {
        let title = pending.mapId.split('/').pop() || pending.mapId;
        try {
          const object = await this.env.MAPS_BUCKET.get(pending.key);
          if (object) title = this.extractTitle(await object.text());
        } catch (error) {
          console.error('Error reading legacy map title:', pending.key, error);
        }
        maps.push({ id: pending.mapId, title, createdAt: pending.timestamp, updatedAt: pending.timestamp });
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

      // Check if map exists (head(), so the body is never transferred)
      const object = await this.env.MAPS_BUCKET.head(key);
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
