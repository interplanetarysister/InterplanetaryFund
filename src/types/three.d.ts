/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL. Do not copy, distribute, or modify without
 * express written permission. See LICENSE file for full terms.
 *
 * Narrow declaration for the Three.js symbols consumed by Globe.tsx.
 * The application intentionally lazy-loads Three.js at runtime, while the
 * installed package does not currently expose declarations to this TypeScript
 * configuration. Keep this declaration limited to the API IF actually uses.
 */

declare module "three" {
  export class Color {
    constructor(color?: string | number);
  }

  export class DirectionalLight {
    constructor(color?: number, intensity?: number);
    position: {
      set(x: number, y: number, z: number): unknown;
    };
  }
}
