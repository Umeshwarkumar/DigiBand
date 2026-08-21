import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyserRef }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const render = () => {
      const analyser = analyserRef.current;
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear the canvas
      ctx.clearRect(0, 0, width, height);

      // Resolve CSS variables for canvas fill
      const computedStyle = window.getComputedStyle(document.documentElement);
      const accent = computedStyle.getPropertyValue('--accent').trim() || '#66fcf1';
      const accentDim = computedStyle.getPropertyValue('--accent-dim').trim() || 'rgba(102, 252, 241, 0.1)';

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

      // If no analyser or no data, simulate idle state or draw a quiet line
      const barCount = 32;
      const barWidth = (width / barCount) - 2;
      
      // Check if there is active audio
      let sum = 0;
      if (dataArray && bufferLength > 0) {
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
      }
      const isActive = sum > 5;

      ctx.fillStyle = accent;

      // Draw equalizer bars
      for (let i = 0; i < barCount; i++) {
        let val = 0;

        if (isActive && dataArray && bufferLength > 0) {
          // Map index to a logarithmic/frequency-scaled distribution
          const dataIndex = Math.floor((i / barCount) * (bufferLength * 0.6));
          val = dataArray[dataIndex] || 0;
        } else {
          // Idle state subtle wave animation
          const time = Date.now() * 0.003;
          val = (Math.sin(time + i * 0.3) + 1) * 3 + 2;
        }

        // Draw bar
        const barHeight = (val / 255) * (height - 10) + 2;
        const x = i * (barWidth + 2);
        const y = height - barHeight;

        // Custom gradient for visual flair
        const gradient = ctx.createLinearGradient(x, y, x, height);
        gradient.addColorStop(0, accent);
        gradient.addColorStop(1, accentDim);
        
        ctx.fillStyle = gradient;

        
        // Draw rounded rectangle bars
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
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
  }, [analyserRef]);

  return (
    <div className="visualizer-wrapper">
      <canvas ref={canvasRef} className="visualizer-canvas" />
    </div>
  );
};
