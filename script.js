// Constants
const ROWS = 6; // Increase to 6 (5 playable + 1 indicator)
const COLS = 16; // Changed from 10 to 16
const SLICERS = 5;
const DEFAULT_DURATION = 30; // Default duration in milliseconds

// DOM Elements
const sequencer = document.getElementById('sequencer');
const waveform = document.getElementById('waveform');
const slicers = document.getElementById('slicers');
const playButton = document.getElementById('playButton');
const bpmSlider = document.getElementById('bpmSlider');
const bpmValue = document.getElementById('bpmValue');
const clearButton = document.getElementById('clearButton');
const randomizeButton = document.getElementById('randomizeButton');
const uploadButton = document.getElementById('uploadButton');
const sampleUpload = document.getElementById('sampleUpload');

// State
let isPlaying = false;
let currentStep = 0;
let bpm = 120;
let intervalId = null;
let audioContext;
let audioBuffer;
let waveformIndicators;

// Add these new variables
let audioSource;
let analyser;

// Initialize sequencer
function initSequencer() {
    sequencer.innerHTML = ''; // Clear existing content
    for (let i = 0; i < ROWS; i++) {
        for (let j = 0; j < COLS; j++) {
            const step = document.createElement('div');
            step.classList.add('step');
            if (i === 0) {
                step.classList.add('indicator');
            }
            step.dataset.row = i;
            step.dataset.col = j;
            step.addEventListener('click', toggleStep);
            sequencer.appendChild(step);
        }
    }
}

// Toggle step active state
function toggleStep(e) {
    if (e.target.classList.contains('indicator') || e.target.dataset.row === '0') return;
    e.target.classList.toggle('active');
}

// Initialize waveform
function initWaveform() {
    for (let i = 0; i < 5; i++) {
        const indicator = document.createElement('div');
        indicator.classList.add('waveform-indicator');
        indicator.style.left = '0%';
        indicator.textContent = i + 1;
        waveform.appendChild(indicator);
    }
    waveformIndicators = document.querySelectorAll('.waveform-indicator');
}

// Initialize sample slicers
function initSlicers() {
    for (let i = 0; i < SLICERS; i++) {
        const slicer = document.createElement('div');
        slicer.classList.add('slicer');
        
        const startSlider = document.createElement('input');
        startSlider.type = 'range';
        startSlider.classList.add('slider', 'start-slider');
        startSlider.min = 0;
        startSlider.max = 100;
        startSlider.value = 0;
        startSlider.addEventListener('input', updateWaveformIndicators);
        
        const durationSlider = document.createElement('input');
        durationSlider.type = 'range';
        durationSlider.classList.add('slider', 'duration-slider');
        durationSlider.min = 1;
        durationSlider.max = (60 / bpm) * 1000; // Max duration is one full sequence
        durationSlider.value = DEFAULT_DURATION;
        durationSlider.addEventListener('input', updateWaveformIndicators);
        
        slicer.appendChild(startSlider);
        slicer.appendChild(durationSlider);
        slicers.appendChild(slicer);
    }
}

// Update waveform indicators based on slider positions
function updateWaveformIndicators() {
    const startSliders = document.querySelectorAll('.start-slider');
    const durationSliders = document.querySelectorAll('.duration-slider');
    
    waveformIndicators.forEach((indicator, index) => {
        const startValue = parseFloat(startSliders[index].value);
        const durationValue = parseFloat(durationSliders[index].value);
        
        indicator.style.left = `${startValue}%`;
        indicator.style.width = `${durationValue / ((60 / bpm) * 10)}%`; // Width based on duration
    });
}

// Handle sample upload
function handleSampleUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const arrayBuffer = e.target.result;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.decodeAudioData(arrayBuffer, (buffer) => {
            audioBuffer = buffer;
            console.log('Sample loaded successfully');
            createWaveform(buffer);
        }, (error) => {
            console.error('Error decoding audio data', error);
        });
    };

    reader.readAsArrayBuffer(file);
}

// Add this new function to create a basic waveform
function createWaveform(buffer) {
    const canvas = document.createElement('canvas');
    canvas.width = waveform.clientWidth;
    canvas.height = waveform.clientHeight;
    waveform.innerHTML = '';
    waveform.appendChild(canvas);

    const context = canvas.getContext('2d');
    const data = buffer.getChannelData(0);
    const step = Math.ceil(data.length / canvas.width);
    const amp = canvas.height / 2;

    context.beginPath();
    context.moveTo(0, amp);

    for (let i = 0; i < canvas.width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        context.lineTo(i, (1 + min) * amp);
        context.lineTo(i, (1 + max) * amp);
    }

    context.strokeStyle = '#000000';
    context.stroke();

    // Add start point lines
    for (let i = 0; i < SLICERS; i++) {
        const line = document.createElement('div');
        line.classList.add('waveform-indicator');
        line.style.left = '0%';
        line.textContent = i + 1; // Keep the number
        waveform.appendChild(line);
    }

    waveformIndicators = document.querySelectorAll('.waveform-indicator');
    updateWaveformIndicators();
}

// Trigger file input when upload button is clicked
function triggerFileInput() {
    sampleUpload.click();
}

// Play/Pause sequencer
function togglePlay() {
    isPlaying = !isPlaying;
    const playImg = playButton.querySelector('img');
    playImg.src = isPlaying ? 'stop.svg' : 'play.svg';
    playImg.alt = isPlaying ? 'Stop' : 'Play';
    
    if (isPlaying) {
        playSequence();
    } else {
        clearInterval(intervalId);
    }
}

// Play sequence
function playSequence() {
    clearInterval(intervalId); // Clear any existing interval
    currentStep = 0; // Reset to the beginning of the sequence
    
    const stepDuration = (60 / bpm) * 1000 / 4; // Duration of each step in milliseconds
    
    intervalId = setInterval(() => {
        // Clear previous step
        document.querySelectorAll('.step.indicator').forEach(step => step.classList.remove('active'));
        
        // Activate current step
        const currentIndicator = document.querySelector(`.step.indicator[data-col="${currentStep}"]`);
        currentIndicator.classList.add('active');
        
        // Play active samples for each row
        for (let row = 1; row < ROWS; row++) { // Start from 1 to skip the indicator row
            const step = document.querySelector(`.step[data-row="${row}"][data-col="${currentStep}"]`);
            if (step && step.classList.contains('active')) {
                playSample(row - 1); // Subtract 1 to match the slicer index
            }
        }
        
        currentStep = (currentStep + 1) % COLS;
    }, stepDuration);
}

// Play a sample
function playSample(row) {
    if (!audioBuffer) return;

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;

    const startSlider = document.querySelectorAll('.start-slider')[row];
    const durationSlider = document.querySelectorAll('.duration-slider')[row];
    let startTime = (parseFloat(startSlider.value) / 100) * audioBuffer.duration;
    let duration = parseFloat(durationSlider.value) / 1000; // Convert to seconds

    // Ensure we don't exceed the buffer duration
    const endTime = Math.min(startTime + duration, audioBuffer.duration);
    startTime = Math.min(startTime, audioBuffer.duration - 0.01); // Ensure start time is within the buffer
    duration = endTime - startTime;

    source.connect(audioContext.destination);
    source.start(0, startTime, duration);
}

// Update BPM
function updateBPM() {
    bpm = bpmSlider.value;
    
    // Update max duration for all duration sliders
    const maxDuration = (60 / bpm) * 1000;
    document.querySelectorAll('.duration-slider').forEach(slider => {
        slider.max = maxDuration;
        if (parseFloat(slider.value) > maxDuration) {
            slider.value = maxDuration;
        }
    });
    
    updateWaveformIndicators();
    
    if (isPlaying) {
        // Stop the current sequence and restart with new BPM
        clearInterval(intervalId);
        playSequence();
    }
}

// Clear sequencer
function clearSequencer() {
    document.querySelectorAll('.step.active').forEach(step => step.classList.remove('active'));
}

// Randomize sequencer
function randomizeSequencer() {
    document.querySelectorAll('.step:not(.indicator)').forEach(step => {
        step.classList.toggle('active', Math.random() > 0.85);
    });
    
    document.querySelectorAll('.slider').forEach(slider => {
        slider.value = Math.floor(Math.random() * 85);
    });

    updateWaveformIndicators();
}

// Event listeners
playButton.addEventListener('click', togglePlay);
bpmSlider.addEventListener('input', updateBPM);
clearButton.addEventListener('click', clearSequencer);
randomizeButton.addEventListener('click', randomizeSequencer);
uploadButton.addEventListener('click', triggerFileInput);
sampleUpload.addEventListener('change', handleSampleUpload);

// Load default sample
function loadDefaultSample() {
    fetch('sample.wav')
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            return audioContext.decodeAudioData(arrayBuffer);
        })
        .then(buffer => {
            audioBuffer = buffer;
            console.log('Default sample loaded successfully');
            createWaveform(buffer);
        })
        .catch(error => {
            console.error('Error loading default sample:', error);
        });
}

// Initialize application
function initApplication() {
    initSequencer();
    initWaveform();
    initSlicers();
    loadDefaultSample();
    
    // Apply randomization at the start
    randomizeSequencer();
}

// Call initApplication when the page loads
window.addEventListener('load', initApplication);