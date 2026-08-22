export interface Chord {
  trigger: string;
  name: string;
  displayName: string;
  notes: string[];
  octaveOffset?: number;
}

export const CHORDS: Chord[] = [
  { trigger: 'A', name: 'C Major', displayName: 'C', notes: ['C', 'E', 'G'] },
  { trigger: 'S', name: 'D Minor', displayName: 'Dm', notes: ['D', 'F', 'A'] },
  { trigger: 'D', name: 'E Minor', displayName: 'Em', notes: ['E', 'G', 'B'] },
  { trigger: 'F', name: 'F Major', displayName: 'F', notes: ['F', 'A', 'C'] },
  { trigger: 'G', name: 'G Major', displayName: 'G', notes: ['G', 'B', 'D'] },
  { trigger: 'H', name: 'A Minor', displayName: 'Am', notes: ['A', 'C', 'E'] },
  { trigger: 'J', name: 'B Diminished', displayName: 'Bdim', notes: ['B', 'D', 'F'] },
  { trigger: 'K', name: 'C Major', displayName: 'C', notes: ['C', 'E', 'G'], octaveOffset: 1 }
];

