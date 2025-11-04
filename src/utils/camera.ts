import type { Vec2, Camera } from '../types';

/**
 * Camera controller for panning and zooming
 */
export class CameraController {
  private camera: Camera;

  constructor(camera: Camera) {
    this.camera = camera;
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  getWorldFromScreen(screenX: number, screenY: number): Vec2 {
    return {
      x: screenX / this.camera.zoom + this.camera.x,
      y: screenY / this.camera.zoom + this.camera.y,
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  getScreenFromWorld(worldX: number, worldY: number): Vec2 {
    return {
      x: (worldX - this.camera.x) * this.camera.zoom,
      y: (worldY - this.camera.y) * this.camera.zoom,
    };
  }

  /**
   * Pan the camera
   */
  pan(dx: number, dy: number): void {
    this.camera.x += dx / this.camera.zoom;
    this.camera.y += dy / this.camera.zoom;
  }

  /**
   * Zoom the camera at a specific point
   */
  zoom(factor: number, screenX: number, screenY: number): void {
    const worldBefore = this.getWorldFromScreen(screenX, screenY);
    this.camera.zoom *= factor;
    this.camera.zoom = Math.max(0.1, Math.min(5, this.camera.zoom));
    const worldAfter = this.getWorldFromScreen(screenX, screenY);
    
    this.camera.x += worldBefore.x - worldAfter.x;
    this.camera.y += worldBefore.y - worldAfter.y;
  }

  /**
   * Reset camera to default position
   */
  reset(): void {
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.zoom = 1;
  }
}
