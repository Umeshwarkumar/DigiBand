import React, { useEffect, useRef } from 'react';
import type { ColorHSL } from '../utils/colorUtils';

interface BeastModeBackgroundProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  currentChordName: string;
  chordColorMap: Record<string, ColorHSL>;
  isActive: boolean;
}

export const BeastModeBackground: React.FC<BeastModeBackgroundProps> = ({
  analyserRef,
  currentChordName,
  chordColorMap,
  isActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const currentHueRef = useRef<number>(200); // Start with a default blue hue
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track phase for wave animation
    let phase = 0;

    const render = () => {
      if (!isActive) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const width = canvas.width;
      const height = canvas.height;

      // Clear the canvas completely to ensure empty areas are fully transparent
      ctx.clearRect(0, 0, width, height);


      const analyser = analyserRef.current;
      let dataArray = dataArrayRef.current;
      let bufferLength = 0;

      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        if (!dataArray || dataArray.length !== bufferLength) {
          dataArray = new Uint8Array(bufferLength);
          dataArrayRef.current = dataArray;
        }
        analyser.getByteFrequencyData(dataArray as any);
      }

      // Calculate audio amplitude (overall intensity)
      let volumeSum = 0;
      if (dataArray && bufferLength > 0) {
        for (let i = 0; i < bufferLength; i++) {
          volumeSum += dataArray[i];
        }
      }
      const rawIntensity = bufferLength > 0 ? volumeSum / (bufferLength * 255) : 0;
      // Exponential scaling for better visual response to softer tones
      const intensity = Math.min(Math.pow(rawIntensity * 5, 1.5), 1.0);

      // Smoothly transition the current Hue towards target chord color's Hue
      const targetColor = chordColorMap[currentChordName];
      if (targetColor) {
        const targetHue = targetColor.hue;
        // Circular interpolation to find the shortest path around the 360 color wheel
        let diff = targetHue - currentHueRef.current;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        // Easing factor (0.05 for smooth transition)
        currentHueRef.current = (currentHueRef.current + diff * 0.05 + 360) % 360;
      }

      const currentHue = currentHueRef.current;
      
      // Calculate dynamic lightness and opacity based on audio intensity
      // Low intensity: L=40, Opacity=0.15
      // High intensity: L=65, Opacity=0.45
      const lightness = 40 + intensity * 20;
      const opacity = 0.15 + intensity * 0.35;
      
      // Update wave phase speed based on audio intensity
      phase += 0.02 + intensity * 0.08;

      // Draw multi-layered sine waves at the bottom of the screen
      const waveCount = 3;
      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        
        // Vary parameters per wave layer
        const waveOffset = w * Math.PI * 0.5;
        const amplitude = (height * 0.08 + intensity * height * 0.18) * (1 - w * 0.25);
        const frequency = 0.002 + w * 0.001;
        const midY = height * 0.65 + w * 30;

        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 10) {
          const y = midY + Math.sin(x * frequency + phase + waveOffset) * amplitude 
                         + Math.cos(x * 0.001 - phase * 0.5) * (amplitude * 0.3);
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        // Create gradient fill for the waves
        const gradient = ctx.createLinearGradient(0, height - amplitude * 2, 0, height);
        gradient.addColorStop(0, `hsla(${currentHue}, 90%, ${lightness}%, ${opacity})`);
        gradient.addColorStop(0.5, `hsla(${currentHue}, 90%, ${lightness - 10}%, ${opacity * 0.5})`);
        gradient.addColorStop(1, `hsla(${currentHue}, 90%, 20%, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // If audio is very intense, add background glow flares at top left / top right
      if (intensity > 0.05) {
        const glowRadius = intensity * width * 0.4;
        const radialGlow = ctx.createRadialGradient(
          width / 2, height * 0.4, 10,
          width / 2, height * 0.4, glowRadius
        );
        radialGlow.addColorStop(0, `hsla(${currentHue}, 90%, ${lightness}%, ${intensity * 0.15})`);
        radialGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radialGlow;
        ctx.fillRect(0, 0, width, height);
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserRef, currentChordName, chordColorMap, isActive]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 20,
        opacity: 0.7,
        pointerEvents: 'none',
      }}

    />
  );
};
