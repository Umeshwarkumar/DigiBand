# 🎸 Virtual Band

An interactive, web-based digital band built with **React**, **TypeScript**, **Vite**, and **Tone.js**. Play chords, program drum patterns, adjust tempo, and compose your own progressions directly from your browser!

---

## ✨ Features

- **🎹 Multi-Instrument Ensemble**: Toggle individual tracks on or off:
  - **Piano**: Rich, polyphonic triangle-wave synth voicing.
  - **Guitar**: Strummed physical modeling via `PluckSynth`.
  - **Drums**: Built-in synthesizers simulating Kick, Snare, and Hi-Hats.
- **🎼 Chord Progression Recorder**: Record your chord play sessions, loop them, adjust playback tempo, or clear the progression to start fresh.
- **🥁 Predefined Drum Patterns**: Instantly launch **Rock**, **Pop**, or **Ballad** rhythm tracks with real-time visual step-tracking.
- **🎛️ Live Performance Controls**:
  - Fine-tune global volume.
  - Dynamically control BPM (Tempo) from 60 to 200.
  - Interactive status bar to track chord selections and instrument states.
- **⌨️ Keyboard Mapping**: Full physical keyboard support for seamless live performances.

---

## ⌨️ How to Use & Keyboard Controls

### 🎼 Chord Keyboard
Press the following keys on your keyboard (or click the buttons on screen) to play chords:

| Key | Chord Name | Display | Notes |
| :---: | :--- | :---: | :--- |
| **A** | C Major | `C` | C - E - G |
| **S** | D Minor | `Dm` | D - F - A |
| **D** | E Minor | `Em` | E - G - B |
| **F** | F Major | `F` | F - A - C |
| **G** | G Major | `G` | G - B - D |
| **H** | A Minor | `Am` | A - C - E |
| **J** | B Diminished | `Bdim` | B - D - F |

### 🥁 Drum Pads
Trigger live drum sounds using the bottom row of your keyboard:

| Key | Drum Instrument |
| :---: | :--- |
| **Z** | Kick Drum |
| **X** | Snare Drum |
| **C** | Closed Hi-Hat |
| **V** | Open Hi-Hat |

---

## 🚀 Quick Start & Installation

Follow these steps to get your local environment set up:

### 1. Clone the Repository
```bash
git clone https://github.com/SanMaria28/DigiBand.git
cd DigiBand
```

### 2. Install Dependencies
Make sure you have [Node.js](https://nodejs.org/) installed.
```bash
npm install
```

### 3. Start the Development Server
```bash
npm run dev
```
Open **[http://localhost:5173/](http://localhost:5173/)** in your browser to start playing!

### 4. Build for Production
```bash
npm run build
```

---

## 🛠️ Technology Stack
- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **Audio Engine**: Tone.js 15
- **Icons**: Lucide React
