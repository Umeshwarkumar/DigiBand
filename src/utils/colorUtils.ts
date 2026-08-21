export interface ColorHSL {
  hue: number;
  saturation: number;
  lightness: number;
  hslString: string;
}

/**
 * Generates a random vibrant HSL color.
 * It tries to keep the generated hue reasonably distant from already generated hues
 * to provide visual uniqueness.
 */
export function generateVibrantColor(existingHues: number[]): ColorHSL {
  const minDistance = 35; // Minimum difference in hue degrees
  const maxRetries = 100;
  let hue = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    hue = Math.floor(Math.random() * 360);
    
    // Check distance to all existing hues
    let isFarEnough = true;
    for (const existing of existingHues) {
      // Calculate circular distance in degrees
      const diff = Math.min(
        Math.abs(hue - existing),
        360 - Math.abs(hue - existing)
      );
      if (diff < minDistance) {
        isFarEnough = false;
        break;
      }
    }

    if (isFarEnough || attempt === maxRetries - 1) {
      break;
    }
  }

  // Saturation: 75% to 100%
  const saturation = Math.floor(Math.random() * 26) + 75;
  // Lightness: 45% to 65%
  const lightness = Math.floor(Math.random() * 21) + 45;

  return {
    hue,
    saturation,
    lightness,
    hslString: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
  };
}

/**
 * Generates a stable mapping of chord names to vibrant HSL colors.
 */
export function generateChordColors(chordNames: string[]): Record<string, ColorHSL> {
  const mapping: Record<string, ColorHSL> = {};
  const hues: number[] = [];

  for (const name of chordNames) {
    const color = generateVibrantColor(hues);
    hues.push(color.hue);
    mapping[name] = color;
  }

  return mapping;
}
