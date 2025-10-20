import { useState, useEffect, useMemo } from 'react';
import type { FileAttachment } from '@shared/types';

interface UseRelativeImageLoaderProps {
  noteImageFiles: FileAttachment[];
  onLoadRelativeImage?: (relativePath: string) => Promise<string | null>;
}

export const useRelativeImageLoader = ({
  noteImageFiles,
  onLoadRelativeImage
}: UseRelativeImageLoaderProps) => {
  const [resolvedImageUrls, setResolvedImageUrls] = useState<Record<string, string>>({});

  // Stabilize image URLs key (prevent infinite loop)
  const imageUrlsKey = useMemo(() => {
    return noteImageFiles
      .map(f => (f as FileAttachment & { isRelativeLocal?: boolean }).isRelativeLocal ? f.downloadUrl : '')
      .filter(Boolean)
      .join('|');
  }, [noteImageFiles]);

  useEffect(() => {
    const loadRelativeImages = async () => {
      if (!onLoadRelativeImage) {
        return;
      }

      // Filter unresolved relative path images
      const pendingImages: FileAttachment[] = noteImageFiles
        .filter((imageFile): imageFile is FileAttachment => {
          const relativeFile = imageFile as FileAttachment & { isRelativeLocal?: boolean };
          return Boolean(relativeFile.isRelativeLocal &&
                 relativeFile.downloadUrl &&
                 !resolvedImageUrls[relativeFile.downloadUrl]);
        });

      if (pendingImages.length === 0) {
        return;
      }

      // Parallel loading
      const loadPromises = pendingImages.map(async (imageFile) => {
        const relativeFile = imageFile as FileAttachment & { isRelativeLocal?: boolean };
        if (!relativeFile.downloadUrl) return null;

        try {
          const dataURL = await onLoadRelativeImage(relativeFile.downloadUrl);
          if (dataURL) {
            return { path: relativeFile.downloadUrl, dataURL };
          }
        } catch (err) {
          console.warn(`Failed to load relative image: ${relativeFile.downloadUrl}`, err);
        }
        return null;
      });

      const results = await Promise.all(loadPromises);
      const newResolved: Record<string, string> = {};

      results.forEach(result => {
        if (result) {
          newResolved[result.path] = result.dataURL;
        }
      });

      if (Object.keys(newResolved).length > 0) {
        setResolvedImageUrls(prev => ({ ...prev, ...newResolved }));
      }
    };

    loadRelativeImages();
  }, [imageUrlsKey, onLoadRelativeImage, noteImageFiles, resolvedImageUrls]);

  return { resolvedImageUrls };
};
