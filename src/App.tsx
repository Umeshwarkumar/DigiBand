import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Music, Speaker, Drum, Sun, Moon, Zap } from 'lucide-react';
import * as Tone from 'tone';
import { CHORDS } from './chords';
import type { Chord } from './chords';
import './App.css';
import { generateChordColors } from './utils/colorUtils';
import { AudioVisualizer } from './components/AudioVisualizer';
import { BeastModeBackground } from './components/BeastModeBackground';

interface InstrumentState {
  piano: boolean;
  guitar: boolean;
  drums: boolean;
}

export type RecordedEvent = {
  type: 'chord' | 'drum';
  instrument: 'piano' | 'guitar' | 'drums';
  chord?: Chord;
  drumKey?: string;
  time: number;
};

export type RecordingLayer = {
  id: number;
  duration: number;
  events: RecordedEvent[];
};

// Map root-position notes (e.g. ['C', 'E', 'G']) to the 4th/5th octaves progressively (Piano voicing)
const getVoicedNotes = (notes: string[], octaveOffset: number = 0): string[] => {
  let currentOctave = 4 + octaveOffset;
  let prevVal = -1;
  const noteValues: Record<string, number> = {
    C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11
  };

  return notes.map((note) => {
    const val = noteValues[note];
    if (prevVal !== -1 && val < prevVal) {
      currentOctave++;
    }
    prevVal = val;
    return `${note}${currentOctave}`;
  });
};

// Map root-position notes to the 3rd/4th octaves progressively (Guitar voicing)
const getGuitarVoicedNotes = (notes: string[], octaveOffset: number = 0): string[] => {
  let currentOctave = 5 + octaveOffset;
  let prevVal = -1;
  const noteValues: Record<string, number> = {
    C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11
  };

  return notes.map((note) => {
    const val = noteValues[note];
    if (prevVal !== -1 && val < prevVal) {
      currentOctave++;
    }
    prevVal = val;
    return `${note}${currentOctave}`;
  });
};

function App() {
  // Theme and Beast Mode States
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [beastMode, setBeastMode] = useState<boolean>(false);

  // Stable random colors mapping generated once per session
  const chordColorMap = useMemo(() => {
    return generateChordColors(CHORDS.map((c) => c.name));
  }, []);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Instrument Toggles
  const [instruments, setInstruments] = useState<InstrumentState>({
    piano: true,
    guitar: true,
    drums: true,
  });


  // Current Chord State (Default is C Major)
  const [currentChord, setCurrentChord] = useState<Chord>(CHORDS[0]);

  // Track which keyboard keys are currently held down
  const [pressedKeys, setPressedKeys] = useState<Record<string, boolean>>({});

  // Status Bar State
  const [status, setStatus] = useState<string>('Ready');

  // Controls State
  const [bpm, setBpm] = useState<number>(100);
  const [volume, setVolume] = useState<number>(70);

  // Recording Layers State
  const [recordingLayers, setRecordingLayers] = useState<RecordingLayer[]>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);

  // Metronome State
  const [metronomeEnabled, setMetronomeEnabled] = useState<boolean>(false);

  // Keep references to avoid stale closures in setTimeout recursion
  const recordingLayersRef = useRef<RecordingLayer[]>([]);
  const activeLayerEventsRef = useRef<RecordedEvent[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  
  const isRecordingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const isLoopingRef = useRef<boolean>(false);
  const bpmRef = useRef<number>(100);

  const volumeRef = useRef<number>(70);

  // Sync refs with state changes
  useEffect(() => {
    recordingLayersRef.current = recordingLayers;
  }, [recordingLayers]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isLoopingRef.current = isLooping;
  }, [isLooping]);

  useEffect(() => {
    bpmRef.current = bpm;
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const [activePattern, setActivePattern] = useState<'Rock' | 'Pop' | 'Ballad'>('Rock');
  const [isPatternPlaying, setIsPatternPlaying] = useState<boolean>(false);
  const [patternStepIndex, setPatternStepIndex] = useState<number | null>(null);

  const isPatternPlayingRef = useRef<boolean>(false);
  const activePatternRef = useRef<'Rock' | 'Pop' | 'Ballad'>('Rock');

  // Sync refs with state changes
  useEffect(() => {
    isPatternPlayingRef.current = isPatternPlaying;
  }, [isPatternPlaying]);

  useEffect(() => {
    activePatternRef.current = activePattern;
    if (isPatternPlaying) {
      startPatternPlayback();
    }
  }, [activePattern]);

  useEffect(() => {
    if (!instruments.drums && isPatternPlaying) {
      stopPatternPlayback();
    }
  }, [instruments.drums, isPatternPlaying]);

  // Clean up timers and audio nodes on unmount
  useEffect(() => {
    return () => {
      Tone.Transport.cancel(0);
      if (guitarSamplerRef.current) {
        guitarSamplerRef.current.dispose();
      }
      if (drumPatternPlayerRef.current) {
        drumPatternPlayerRef.current.dispose();
      }
      if (metronomeLoopRef.current) {
        metronomeLoopRef.current.dispose();
      }
      if (metronomeFilterRef.current) {
        metronomeFilterRef.current.dispose();
      }
      if (metronomeSynthRef.current) {
        metronomeSynthRef.current.dispose();
      }
      if (drumBusRef.current) {
        drumBusRef.current.dispose();
      }
      Tone.Transport.stop();
    };
  }, []);

  // Audio nodes refs
  const pianoSynthRef = useRef<Tone.PolySynth | null>(null);
  const guitarSamplerRef = useRef<Tone.Sampler | null>(null);
  const drumPatternPlayerRef = useRef<Tone.Player | null>(null);
  const kickSynthRef = useRef<Tone.MembraneSynth | null>(null);
  const snareSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const hihatSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const openHihatSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const volumeNodeRef = useRef<Tone.Volume | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const metronomeSynthRef = useRef<Tone.NoiseSynth | null>(null);
  const metronomeFilterRef = useRef<Tone.Filter | null>(null);
  const metronomeBeatRef = useRef<number>(0);
  const metronomeLoopRef = useRef<Tone.Loop | null>(null);
  const drumBusRef = useRef<Tone.Channel | null>(null);

  // Initialize Tone.js audio engine on user interaction
  const initAudio = useCallback(async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    if (!analyserRef.current) {
      const ctx = Tone.getContext().rawContext;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
    }

    if (!volumeNodeRef.current) {
      // Create master volume node and connect to destination
      const volNode = new Tone.Volume(Tone.gainToDb(volumeRef.current / 100)).toDestination();
      volNode.connect(analyserRef.current);
      volumeNodeRef.current = volNode;
    }

    const volNode = volumeNodeRef.current;

    if (!pianoSynthRef.current) {
      // Polyphonic Synth with piano-like decay settings
      const pianoSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'triangle',
        },
        envelope: {
          attack: 0.02,
          decay: 1.2,
          sustain: 0.9,
          release: 0.8,
        },
      }).connect(volNode);

      pianoSynthRef.current = pianoSynth;
    }

    if (!drumBusRef.current) {
      // Drum Bus with Compressor and EQ for punch
      const drumCompressor = new Tone.Compressor({
        threshold: -12,
        ratio: 4,
        attack: 0.01,
        release: 0.1
      }).connect(volNode);

      const drumEQ = new Tone.EQ3({
        low: 4,
        mid: 1,
        high: 2
      }).connect(drumCompressor);

      drumBusRef.current = new Tone.Channel({ volume: 4 }).connect(drumEQ);
    }

    if (!metronomeSynthRef.current) {
      metronomeFilterRef.current = new Tone.Filter({
        type: 'bandpass',
        frequency: 2000,
        Q: 1
      }).connect(volNode);

      metronomeSynthRef.current = new Tone.NoiseSynth({
        noise: { type: 'pink' },
        envelope: {
          sustain: 0,
          attack: 0.001,
          decay: 0.02,
        },
        volume: 20// highly audible
      }).connect(metronomeFilterRef.current);
    }

    if (!guitarSamplerRef.current) {
      guitarSamplerRef.current = new Tone.Sampler({
        urls: {
          'F4': 'F4.mp3',
          'F#2': 'Fs2.mp3',
          'F#3': 'Fs3.mp3',
          'F#4': 'Fs4.mp3',
          'G2': 'G2.mp3',
          'G3': 'G3.mp3',
          'G4': 'G4.mp3',
          'G#2': 'Gs2.mp3',
          'G#3': 'Gs3.mp3',
          'G#4': 'Gs4.mp3',
          'A2': 'A2.mp3',
          'A3': 'A3.mp3',
          'A4': 'A4.mp3',
          'A#2': 'As2.mp3',
          'A#3': 'As3.mp3',
          'A#4': 'As4.mp3',
          'B2': 'B2.mp3',
          'B3': 'B3.mp3',
          'B4': 'B4.mp3',
          'C3': 'C3.mp3',
          'C4': 'C4.mp3',
          'C5': 'C5.mp3',
          'C#3': 'Cs3.mp3',
          'C#4': 'Cs4.mp3',
          'C#5': 'Cs5.mp3',
          'D2': 'D2.mp3',
          'D3': 'D3.mp3',
          'D4': 'D4.mp3',
          'D5': 'D5.mp3',
          'D#2': 'Ds2.mp3',
          'D#3': 'Ds3.mp3',
          'D#4': 'Ds3.mp3',
          'E2': 'E2.mp3',
          'E3': 'E3.mp3',
          'E4': 'E4.mp3',
          'F2': 'F2.mp3',
          'F3': 'F3.mp3'
        },
        baseUrl: 'https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-acoustic/',
      }).connect(volNode);
    }

    if (!kickSynthRef.current) {
      kickSynthRef.current = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: {
          sustain: 0,
          attack: 0.001, // Faster attack for punch
          decay: 0.4,
          release: 0.4
        },
        volume: 40 // Heavy boost for kick volume
      }).connect(drumBusRef.current);
    }

    if (!snareSynthRef.current) {
      snareSynthRef.current = new Tone.NoiseSynth({
        noise: {
          type: 'white',
        },
        envelope: {
          attack: 0.001,
          decay: 0.25,
          sustain: 0,
        },
        volume: 5 // Boost snare
      }).connect(drumBusRef.current);
    }

    if (!hihatSynthRef.current) {
      hihatSynthRef.current = new Tone.NoiseSynth({
        noise: {
          type: 'pink',
        },
        envelope: {
          attack: 0.001,
          decay: 0.05,
          sustain: 0,
        },
        volume: 25 // Noticeable boost for closed hi-hat
      }).connect(drumBusRef.current);
    }

    if (!openHihatSynthRef.current) {
      openHihatSynthRef.current = new Tone.NoiseSynth({
        noise: {
          type: 'pink',
        },
        envelope: {
          attack: 0.005,
          decay: 0.3,
          sustain: 0,
        },
        volume: 20 // Noticeable boost for open hi-hat
      }).connect(drumBusRef.current);
    }

    if (!drumPatternPlayerRef.current) {
      drumPatternPlayerRef.current = new Tone.Player({
        loop: true,
      }).connect(drumBusRef.current);
    }
  }, []);

  // Adjust volume dynamically when slider changes
  useEffect(() => {
    if (volumeNodeRef.current) {
      volumeNodeRef.current.volume.value = Tone.gainToDb(volume / 100);
    }
  }, [volume]);

  const toggleMetronome = async () => {
    await initAudio();
    setMetronomeEnabled((prev) => !prev);
  };

  useEffect(() => {
    const synth = metronomeSynthRef.current;
    if (!synth) return;

    if (metronomeEnabled) {
      if (Tone.context.state !== 'running') {
        Tone.start();
      }

      if (!metronomeLoopRef.current) {
        metronomeLoopRef.current = new Tone.Loop((time) => {
          const isFirstBeat = metronomeBeatRef.current % 4 === 0;

          if (metronomeFilterRef.current) {
            metronomeFilterRef.current.frequency.setValueAtTime(isFirstBeat ? 1500 : 2500, time);
            metronomeFilterRef.current.Q.setValueAtTime(isFirstBeat ? 2 : 1, time);
          }

          synth.volume.setValueAtTime(isFirstBeat ? 16 : 10, time);
          synth.triggerAttackRelease('32n', time);

          metronomeBeatRef.current++;
        }, '4n');
      }

      metronomeBeatRef.current = 0; // Reset beat count on start
      metronomeLoopRef.current.start(0);

      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
    } else {
      if (metronomeLoopRef.current) {
        metronomeLoopRef.current.stop();
      }
    }
  }, [metronomeEnabled]);

  const toggleInstrument = useCallback((key: keyof InstrumentState) => {
    setInstruments((prev) => {
      const nextVal = !prev[key];
      const nameMap: Record<keyof InstrumentState, string> = {
        piano: 'Piano',
        guitar: 'Guitar',
        drums: 'Drums',
      };
      setStatus(`${nameMap[key]} ${nextVal ? 'ON' : 'OFF'}`);
      return {
        ...prev,
        [key]: nextVal,
      };
    });
  }, []);

  const stopRecording = () => {
    if (!isRecordingRef.current) return;
    setIsRecording(false);
    
    const duration = Tone.now() - recordingStartTimeRef.current;
    if (activeLayerEventsRef.current.length > 0) {
      const newLayer: RecordingLayer = {
        id: Date.now(),
        duration,
        events: [...activeLayerEventsRef.current]
      };
      setRecordingLayers(prev => [...prev, newLayer]);
    }
    activeLayerEventsRef.current = [];
  };

  const startPlayback = () => {
    if (recordingLayersRef.current.length === 0) return;

    if (isRecording) {
      stopRecording();
    }

    Tone.Transport.cancel(0);
    setIsPlaying(true);

    // Make sure Tone is started
    if (Tone.context.state !== 'running') {
      Tone.start();
    }

    recordingLayersRef.current.forEach(layer => {
      layer.events.forEach(event => {
        Tone.Transport.schedule((time) => {
          if (event.type === 'chord' && event.chord) {
            handleChordSelect(event.chord, true, event.instrument as 'piano' | 'guitar', time);
          } else if (event.type === 'drum' && event.drumKey) {
            handleDrumSelect(event.drumKey, true, time);
          }
        }, event.time);
      });
    });

    Tone.Transport.position = 0;
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
  };

  const clearRecording = () => {
    stopPlayback();
    if (isRecording) stopRecording();
    setRecordingLayers([]);
    activeLayerEventsRef.current = [];
  };

  const startPatternPlayback = async () => {
    await initAudio();
    if (!instruments.drums || !drumPatternPlayerRef.current) return;

    if (drumPatternPlayerRef.current.state === 'started') {
      drumPatternPlayerRef.current.stop();
    }

    const fileMap: Record<'Rock' | 'Pop' | 'Ballad', string> = {
      Rock: '/audio/drum-patterns/rock.mp3',
      Pop: '/audio/drum-patterns/pop.mp3',
      Ballad: '/audio/drum-patterns/ballad.mp3',
    };

    const filePath = fileMap[activePatternRef.current];

    setIsPatternPlaying(true);
    isPatternPlayingRef.current = true;

    try {
      await drumPatternPlayerRef.current.load(filePath);
      if (isPatternPlayingRef.current && instruments.drums) {
        drumPatternPlayerRef.current.start();
      }
    } catch (err) {
      console.error('Failed to load drum pattern track:', err);
    }
  };

  const stopPatternPlayback = () => {
    setIsPatternPlaying(false);
    isPatternPlayingRef.current = false;
    setPatternStepIndex(null);
    if (drumPatternPlayerRef.current) {
      drumPatternPlayerRef.current.stop();
    }
  };

  const handleReset = () => {
    stopPlayback();
    if (isRecording) stopRecording();
    stopPatternPlayback();
    setRecordingLayers([]);
    activeLayerEventsRef.current = [];
    setCurrentChord(CHORDS[0]);
    setBpm(100);
    setVolume(70);
    setInstruments({
      piano: true,
      guitar: true,
      drums: true,
    });
    setMetronomeEnabled(false);
    setStatus('Ready');
  };

  // Chord selection logic
  const handleChordSelect = useCallback(async (chord: Chord, fromPlayback: boolean = false, overrideInstrument?: 'piano' | 'guitar', scheduledTime?: number) => {
    if (!fromPlayback) await initAudio();
    if (!fromPlayback) {
      setCurrentChord(chord);
      setStatus(`${chord.name} selected`);
    }

    if (isRecordingRef.current && !fromPlayback) {
      const time = Tone.now() - recordingStartTimeRef.current;
      if (instruments.piano) {
        activeLayerEventsRef.current.push({ type: 'chord', instrument: 'piano', chord, time });
      }
      if (instruments.guitar) {
        activeLayerEventsRef.current.push({ type: 'chord', instrument: 'guitar', chord, time });
      }
    }

    // Trigger Piano
    if ((!fromPlayback && instruments.piano) || (fromPlayback && overrideInstrument === 'piano')) {
      if (pianoSynthRef.current) {
        const voicedNotes = getVoicedNotes(chord.notes, chord.octaveOffset);
        if (scheduledTime !== undefined) {
          pianoSynthRef.current.triggerAttackRelease(voicedNotes, '2n', scheduledTime);
        } else {
          pianoSynthRef.current.triggerAttackRelease(voicedNotes, '2n');
        }
      }
    }

    // Trigger Guitar
    if ((!fromPlayback && instruments.guitar) || (fromPlayback && overrideInstrument === 'guitar')) {
      if (guitarSamplerRef.current) {
        const voicedNotes = getGuitarVoicedNotes(chord.notes, chord.octaveOffset);
        const baseTime = scheduledTime !== undefined ? scheduledTime : Tone.now();
        voicedNotes.forEach((note, idx) => {
          const timeOffset = idx * 0.03;
          guitarSamplerRef.current?.triggerAttack(note, baseTime + timeOffset);
        });
      }
    }

  }, [initAudio, instruments.piano, instruments.guitar]);

  // Drum trigger logic
  const handleDrumSelect = useCallback(async (drumKey: string, fromPlayback: boolean = false, scheduledTime?: number) => {
    if (!fromPlayback) await initAudio();
    if (!fromPlayback && !instruments.drums) return;

    if (isRecordingRef.current && !fromPlayback) {
      const time = Tone.now() - recordingStartTimeRef.current;
      activeLayerEventsRef.current.push({ type: 'drum', instrument: 'drums', drumKey, time });
    }

    if (drumKey === 'Z' && kickSynthRef.current) {
      if (scheduledTime !== undefined) {
        kickSynthRef.current.triggerAttackRelease('C1', '8n', scheduledTime);
      } else {
        kickSynthRef.current.triggerAttackRelease('C1', '8n');
      }
      if (!fromPlayback) setStatus('Kick played');
    } else if (drumKey === 'X' && snareSynthRef.current) {
      if (scheduledTime !== undefined) {
        snareSynthRef.current.triggerAttackRelease('16n', scheduledTime);
      } else {
        snareSynthRef.current.triggerAttackRelease('16n');
      }
      if (!fromPlayback) setStatus('Snare played');
    } else if (drumKey === 'C' && hihatSynthRef.current) {
      if (scheduledTime !== undefined) {
        hihatSynthRef.current.triggerAttackRelease('32n', scheduledTime);
      } else {
        hihatSynthRef.current.triggerAttackRelease('32n');
      }
      if (!fromPlayback) setStatus('Closed Hi-Hat played');
    } else if (drumKey === 'V' && openHihatSynthRef.current) {
      if (scheduledTime !== undefined) {
        openHihatSynthRef.current.triggerAttackRelease('8n', scheduledTime);
      } else {
        openHihatSynthRef.current.triggerAttackRelease('8n');
      }
      if (!fromPlayback) setStatus('Open Hi-Hat played');
    }
  }, [initAudio, instruments.drums]);

  // Setup keyboard event listeners
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.repeat) return;

      const keyChar = e.key.toUpperCase();
      const matchedChord = CHORDS.find((c) => c.trigger === keyChar);

      if (matchedChord) {
        // Mark as pressed
        setPressedKeys((prev) => ({ ...prev, [keyChar]: true }));
        // Select chord, update status, and play audio
        await handleChordSelect(matchedChord);
      } else if (keyChar === 'Z' || keyChar === 'X' || keyChar === 'C' || keyChar === 'V') {
        // Mark drum key as pressed
        setPressedKeys((prev) => ({ ...prev, [keyChar]: true }));
        // Trigger drum sound
        await handleDrumSelect(keyChar);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const keyChar = e.key.toUpperCase();
      const matchedChord = CHORDS.find((c) => c.trigger === keyChar);

      if (matchedChord) {
        // Remove pressed state
        setPressedKeys((prev) => ({ ...prev, [keyChar]: false }));
      } else if (keyChar === 'Z' || keyChar === 'X' || keyChar === 'C' || keyChar === 'V') {
        // Remove pressed state for drum key
        setPressedKeys((prev) => ({ ...prev, [keyChar]: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleChordSelect, handleDrumSelect]); // Re-bind listeners when toggle states change

  // Drum keyboard configurations (Z X C V -> Kick Snare Closed Hi-Hat Open Hi-Hat)
  const drumKeys = [
    { trigger: 'Z', display: 'Kick' },
    { trigger: 'X', display: 'Snare' },
    { trigger: 'C', display: 'Closed Hi-Hat' },
    { trigger: 'V', display: 'Open Hi-Hat' },
  ];

  return (
    <div className="app-container">
      {/* Beast Mode Background Layer */}
      <BeastModeBackground
        analyserRef={analyserRef}
        currentChordName={currentChord.name}
        chordColorMap={chordColorMap}
        isActive={beastMode}
      />

      {/* 1. HEADER with toggles inside it */}
      <header className="app-header">
        <div className="header-left">
          <h1>Virtual Band</h1>
          <p className="app-subtitle">Play. Sing. Create.</p>
        </div>
        <div className="header-right">
          <button
            className="toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
          <button
            className={`toggle-btn beast-mode-btn ${beastMode ? 'active' : ''}`}
            onClick={() => setBeastMode(!beastMode)}
            aria-label="Toggle Beast Mode"
          >
            <Zap size={16} aria-hidden="true" />
            BEAST MODE
          </button>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <div className="main-layout">
        {/* LEFT COLUMN: Instruments, Current Chord, Visualizer, BPM/Volume controls, Action/Status */}
        <div className="layout-column left-column">
          {/* 2. INSTRUMENT PANEL */}
          <section className="layout-section">
            <h2 className="section-title">Instruments</h2>
            <div className="instruments-grid">
              {/* Piano */}
              <div className={`instrument-card ${!instruments.piano ? 'disabled' : ''}`}>
                <div className="instrument-info">
                  <span className="instrument-icon"><Music size={20} /></span>
                  <span className="instrument-name">Piano</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={instruments.piano}
                    onChange={() => toggleInstrument('piano')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* Guitar */}
              <div className={`instrument-card ${!instruments.guitar ? 'disabled' : ''}`}>
                <div className="instrument-info">
                  <span className="instrument-icon"><Speaker size={20} /></span>
                  <span className="instrument-name">Guitar</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={instruments.guitar}
                    onChange={() => toggleInstrument('guitar')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* Drums */}
              <div className={`instrument-card ${!instruments.drums ? 'disabled' : ''}`}>
                <div className="instrument-info">
                  <span className="instrument-icon"><Drum size={20} /></span>
                  <span className="instrument-name">Drums</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={instruments.drums}
                    onChange={() => toggleInstrument('drums')}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          </section>

          {/* 3. CURRENT CHORD */}
          <section className="layout-section current-chord-container">
            <div className="current-chord-label">Current Chord</div>
            <div className="current-chord-value">{currentChord.name}</div>
            <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.85rem', letterSpacing: '2px', fontFamily: 'var(--mono)' }}>
              Notes: {currentChord.notes.join(' - ')}
            </div>
          </section>

          {/* Audio Visualizer */}
          <AudioVisualizer analyserRef={analyserRef} />

          {/* 6. CONTROLS */}
          <section className="layout-section controls-grid">
            <div className="control-item">
              <div className="control-label-row">
                <span className="control-label">BPM</span>
                <span className="control-value">{bpm}</span>
              </div>
              <input
                type="range"
                min="60"
                max="200"
                value={bpm}
                onChange={(e) => setBpm(Number(e.target.value))}
              />
              <div className="control-label-row" style={{ marginTop: '15px' }}>
                <span className="control-label">Metronome</span>
                <div
                  className={`metronome-toggle ${metronomeEnabled ? 'active' : ''}`}
                  onClick={toggleMetronome}
                >
                  <span className="metronome-toggle-text">{metronomeEnabled ? 'ON' : 'OFF'}</span>
                  <div className="metronome-toggle-switch"></div>
                </div>
              </div>
            </div>

            <div className="control-item">
              <div className="control-label-row">
                <span className="control-label">Volume</span>
                <span className="control-value">{volume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
              />
            </div>
          </section>

          {/* Action Row & Status Bar combined horizontally */}
          <div className="actions-status-row">
            <button className="reset-btn" onClick={handleReset}>
              Reset Band
            </button>
            <footer className="status-bar">
              <span className="status-label">Status</span>
              <span className="status-value">
                <span className="status-indicator"></span>
                {status}
              </span>
            </footer>
          </div>
        </div>

        {/* RIGHT COLUMN: Chord Keyboard, Drum Keyboard, Chord Progression, Predefined Drum Patterns */}
        <div className="layout-column right-column">
          {/* 4. CHORD KEYBOARD */}
          <section className="layout-section keyboard-section">
            <h2 className="section-title">Chord Keyboard</h2>
            <div className="keyboard-grid">
              {CHORDS.map((k) => (
                <div
                  key={k.trigger}
                  className={`music-key ${pressedKeys[k.trigger] ? 'active' : ''}`}
                  onClick={() => handleChordSelect(k)}
                >
                  <span className="key-trigger">{k.trigger}</span>
                  <span className="key-label">{k.displayName}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5. DRUM KEYBOARD */}
          <section className="layout-section keyboard-section">
            <h2 className="section-title">Drum Keyboard</h2>
            <div className="keyboard-grid">
              {drumKeys.map((k) => (
                <div
                  key={k.trigger}
                  className={`music-key drum-key ${pressedKeys[k.trigger] ? 'active' : ''}`}
                  onClick={() => handleDrumSelect(k.trigger)}
                >
                  <span className="key-trigger">{k.trigger}</span>
                  <span className="key-label">{k.display}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 5.5 RECORDING LAYERS */}
          <section className="layout-section progression-section">
            <h2 className="section-title">Recording Layers</h2>
            <div className="progression-display">
              {recordingLayers.length === 0 && !isRecording ? (
                <span className="progression-empty">No layers recorded. Press Record to start.</span>
              ) : (
                <div className="progression-steps-list">
                  {recordingLayers.map((layer, idx) => (
                    <span key={layer.id} className="progression-step active">
                      Layer {idx + 1} ({layer.events.length} events)
                    </span>
                  ))}
                  {isRecording && (
                    <span className="progression-step active" style={{ animation: 'pulse 1.5s infinite' }}>
                      Recording Layer {recordingLayers.length + 1}...
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="progression-controls">
              <button
                className={`prog-btn record-btn ${isRecording ? 'recording' : ''}`}
                onClick={async () => {
                  if (isRecording) {
                    stopRecording();
                    setStatus('Recording stopped');
                  } else {
                    stopPlayback();
                    await initAudio();
                    if (Tone.context.state !== 'running') await Tone.start();
                    recordingStartTimeRef.current = Tone.now();
                    setIsRecording(true);
                    setStatus('Recording new layer...');
                  }
                }}
              >
                {isRecording ? 'STOP RECORDING' : 'RECORD'}
              </button>
              <button
                className="prog-btn stop-btn"
                onClick={() => {
                  if (isRecording) stopRecording();
                  stopPlayback();
                  setStatus('Stopped');
                }}
              >
                Stop
              </button>
              <button
                className={`prog-btn play-btn ${isPlaying ? 'playing' : ''}`}
                onClick={() => {
                  if (recordingLayers.length > 0) {
                    startPlayback();
                    setStatus('Playing layers...');
                  }
                }}
                disabled={recordingLayers.length === 0}
              >
                Play
              </button>
              <button
                className="prog-btn clear-btn"
                onClick={() => {
                  clearRecording();
                  setStatus('Recordings cleared');
                }}
                disabled={recordingLayers.length === 0 && !isRecording}
              >
                Clear
              </button>
              <button
                className={`prog-btn loop-btn ${isLooping ? 'loop-active' : ''}`}
                onClick={() => {
                  setIsLooping(!isLooping);
                  setStatus(`Loop ${!isLooping ? 'ON' : 'OFF'}`);
                }}
              >
                Loop: {isLooping ? 'ON' : 'OFF'}
              </button>
            </div>
          </section>

          {/* 5.6 PREDEFINED DRUM PATTERNS */}
          <section className="layout-section patterns-section">
            <h2 className="section-title">Drum Patterns</h2>
            <div className="patterns-controls-row">
              <div className="pattern-selector">
                <button
                  className={`prog-btn ${activePattern === 'Rock' ? 'selected-pattern' : ''}`}
                  onClick={() => {
                    setActivePattern('Rock');
                    setStatus('Rock selected');
                  }}
                >
                  Rock
                </button>
                <button
                  className={`prog-btn ${activePattern === 'Pop' ? 'selected-pattern' : ''}`}
                  onClick={() => {
                    setActivePattern('Pop');
                    setStatus('Pop selected');
                  }}
                >
                  Pop
                </button>
                <button
                  className={`prog-btn ${activePattern === 'Ballad' ? 'selected-pattern' : ''}`}
                  onClick={() => {
                    setActivePattern('Ballad');
                    setStatus('Ballad selected');
                  }}
                >
                  Ballad
                </button>
              </div>
              <div className="pattern-playback">
                <button
                  className={`prog-btn play-btn ${isPatternPlaying ? 'playing' : ''}`}
                  onClick={startPatternPlayback}
                >
                  Play
                </button>
                <button
                  className="prog-btn stop-btn"
                  onClick={() => {
                    stopPatternPlayback();
                    setStatus('Pattern stopped');
                  }}
                >
                  Stop
                </button>
              </div>
            </div>
            {isPatternPlaying && patternStepIndex !== null && (
              <div className="pattern-tracker">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`tracker-dot ${patternStepIndex === idx ? 'active' : ''}`}
                  >
                    {idx + 1}
                  </span>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}



export default App;
