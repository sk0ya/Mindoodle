/**
 * ViewportService
 *
 * Centralized viewport information management.
 * Eliminates scattered window.innerWidth/innerHeight usage across codebase.
 *
 * Benefits:
 * - Single source of truth for viewport dimensions
 * - Easier to test and mock
 * - Consistent responsive behavior
 * - Future-proof for viewport changes (e.g., mobile, multi-window)
 */

export interface ViewportSize {
  width: number;
  height: number;
}

export interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * ViewportService - Singleton service for viewport management
 */
export class ViewportService {
  private static instance: ViewportService;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ViewportService {
    if (!ViewportService.instance) {
      ViewportService.instance = new ViewportService();
    }
    return ViewportService.instance;
  }

  /**
   * Get current viewport size
   */
  getSize(): ViewportSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  /**
   * Get viewport width
   */
  getWidth(): number {
    return window.innerWidth;
  }

  /**
   * Get viewport height
   */
  getHeight(): number {
    return window.innerHeight;
  }

  /**
   * Get default note panel height (30% of viewport)
   * Used by note panels and navigation commands
   */
  getDefaultNoteHeight(): number {
    return Math.round(window.innerHeight * 0.3);
  }

  /**
   * Get maximum note panel height (80% of viewport)
   * Used to constrain resizable panels
   */
  getMaxNoteHeight(): number {
    return Math.round(window.innerHeight * 0.8);
  }

  /**
   * Get maximum allowed note panel height (90% of viewport)
   * Used during resize operations
   */
  getMaxAllowedNoteHeight(): number {
    return Math.round(window.innerHeight * 0.9);
  }

  /**
   * Calculate bounded position to keep element within viewport
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param elementWidth - Width of element
   * @param elementHeight - Height of element
   * @returns Adjusted coordinates that keep element visible
   */
  getBoundedPosition(
    x: number,
    y: number,
    elementWidth: number,
    elementHeight: number
  ): { x: number; y: number } {
    const { width: viewportWidth, height: viewportHeight } = this.getSize();

    const boundedX = Math.max(0, Math.min(x, viewportWidth - elementWidth));
    const boundedY = Math.max(0, Math.min(y, viewportHeight - elementHeight));

    return { x: boundedX, y: boundedY };
  }

  /**
   * Check if coordinates are within viewport
   */
  isInViewport(x: number, y: number): boolean {
    const { width, height } = this.getSize();
    return x >= 0 && x <= width && y >= 0 && y <= height;
  }

  /**
   * Get viewport center point
   */
  getCenter(): { x: number; y: number } {
    const { width, height } = this.getSize();
    return {
      x: width / 2,
      y: height / 2
    };
  }

  /**
   * Calculate if element fits in viewport
   */
  fitsInViewport(width: number, height: number): boolean {
    const viewport = this.getSize();
    return width <= viewport.width && height <= viewport.height;
  }
}

// Export singleton instance for easy import
export const viewportService = ViewportService.getInstance();
