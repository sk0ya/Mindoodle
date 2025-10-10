

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


export class ViewportService {
  private static instance: ViewportService;

  private constructor() {}

  
  static getInstance(): ViewportService {
    if (!ViewportService.instance) {
      ViewportService.instance = new ViewportService();
    }
    return ViewportService.instance;
  }

  
  getSize(): ViewportSize {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  
  getWidth(): number {
    return window.innerWidth;
  }

  
  getHeight(): number {
    return window.innerHeight;
  }

  
  getDefaultNoteHeight(): number {
    return Math.round(window.innerHeight * 0.3);
  }

  
  getMaxNoteHeight(): number {
    return Math.round(window.innerHeight * 0.8);
  }

  
  getMaxAllowedNoteHeight(): number {
    return Math.round(window.innerHeight * 0.9);
  }

  
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

  
  isInViewport(x: number, y: number): boolean {
    const { width, height } = this.getSize();
    return x >= 0 && x <= width && y >= 0 && y <= height;
  }

  
  getCenter(): { x: number; y: number } {
    const { width, height } = this.getSize();
    return {
      x: width / 2,
      y: height / 2
    };
  }

  
  fitsInViewport(width: number, height: number): boolean {
    const viewport = this.getSize();
    return width <= viewport.width && height <= viewport.height;
  }
}


export const viewportService = ViewportService.getInstance();
