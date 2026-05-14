# VoiceGuard - Deepfake Voice Detection System For Phone Call Scams

Ameer Dani bin Amir Azhar (52215123160)
Final Year Project — Bachelor of Information Technology (Hons) in Computer System Security, Universiti Kuala Lumpur.

A fully client-side web application that detects deepfake / AI-synthesised
speech directly in the browser. Upload a `.wav` / `.mp3` file or record live
audio from the microphone; the app preprocesses the signal, runs a CNN
trained on ASVspoof 2019 LA via TensorFlow.js, and combines the model output
with signal-based heuristics (bandwidth, high-frequency energy, noise floor,
spectral flux) to flag synthetic voice artefacts.

## Local development

```bash
npm install
npm run dev
```
"#voiceguard" 
