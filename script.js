const LOCAL_STORAGE_ID = "saved-source";
const MAX_VOLUME = -5;

const DEFAULT_STEP_DURATION = 100;

const defaultSource = {
	"stepLength": 100,
	"instruments": {
		"lead": {
			"input": "midi-device-name",
			"inputChannel": 1,
			"volume": 0.1,
			"noteLength": 0.5,
			"oscillators": [
				{
					"type": "square",
					"length": 0.5,
					"volume": 0.1,
					"attack": 10,
					"decay": 20,
					"sustain": 0.1,
					"release": 50,
					"pan": -0.5
				},
				{
					"type": "sine",
					"volume": 0.1,
					"attack": 100,
					"decay": 0,
					"sustain": 1,
					"release": 500,
					"detune": 0.5,
					"pan": 0.5
				}
			],
			"sequences": [
				{
					"pattern": ["C4", "D4", "E4", "F4"],
					"repeat": 4
				},
				{
					"pattern": [600, 1200, 1500, 1400],
					"repeat": 4
				}
			]
		},
		"bass": {
			"subdivision": 4,
			"volume": 1,
			"oscillators": [
				{
					"attack": 100,
					"decay": 0,
					"sustain": 0.5,
					"release": 500
				}
			],
			"sequences": [
				{
					"pattern": [400, 400, 400, 600]
				},
				{
					"pattern": [300, 300, 300, 300]
				}
			]
		}
	}
};

let isPlaying = false;
let metronomeInterval = null;
let parsedSource = null;
const state = { instruments: {} };

const context = new AudioContext();

// Global limiter to keep the levels under control
const limiter = context.createDynamicsCompressor();
limiter.threshold.value = MAX_VOLUME;
limiter.knee.value = 0;
limiter.ratio.value = 20;
limiter.attack.value = 0;
limiter.release.value = 0.2;
limiter.connect(context.destination);

$(() => {
  $("#source-textarea").on("change keyup", sourceChangeHandler);

  $("#source-textarea").val(
    localStorage.getItem(LOCAL_STORAGE_ID) ??
      JSON.stringify(defaultSource, null, 2)
  );
  $("#source-textarea").trigger("change");

  $("#play-stop-button").on("mousedown", playStopHandler);
});

const sourceChangeHandler = (ev) => {
  const $textArea = $(ev.target);
  const source = $textArea.val();

  try {
    sourceObject = JSON.parse(source);

    if (!sourceObject.instruments) {
      throw new Error("Source needs to have an 'instruments' object.");
    }

    parsedSource = sourceObject;

		if (parsedSource !== null) {
			$("#code-has-error").hide();
			localStorage.setItem(LOCAL_STORAGE_ID, source);
		}
  } catch (e) {
    $("#code-has-error").text(e.message);
    $("#code-has-error").show();
  }
};

const playStopHandler = (ev) => {
	if (isPlaying) {
		clearInterval(metronomeInterval);
	} else {
		state.instruments = {};

		const scheduleNext = () => {
			metronomeInterval = setTimeout(() => {
				scheduleNext();
				playLoop();
			}, parsedSource.stepLength ?? DEFAULT_STEP_DURATION);
		}

		scheduleNext();
	}

	isPlaying = !isPlaying;

	$(ev.target).text(isPlaying ? "Stop" : "Play");
	$(ev.target).blur();
}

const playLoop = () => {
	Object.keys(parsedSource.instruments).forEach((instrumentName) => {
		if (!state.instruments[instrumentName]) {
			state.instruments[instrumentName] = {
				currentSequence: 0,
				currentNoteIndex: 0,
				currentRepetition: 0,
				clock: 0,
			}
		}

		const instrument = parsedSource.instruments[instrumentName];
		const subdivision = instrument.subdivision ?? 1;
		const instrumentState = state.instruments[instrumentName];

		if (instrument.sequences?.length > 0 && instrumentState.clock % subdivision == 0) {
			if (instrumentState.currentSequence >= instrument.sequences.length) {
				instrumentState.currentSequence = 0;
				instrumentState.currentNoteIndex = 0;
			}
			const sequence = instrument.sequences[instrumentState.currentSequence];
			const repeat = sequence.repeat ?? 1;

			if (sequence.pattern) {
				if (instrumentState.currentNoteIndex >= sequence.pattern.length) {
					instrumentState.currentNoteIndex = 0;
					instrumentState.currentRepetition++;
					instrumentState.clock = 0;
				}

				const note = sequence.pattern[instrumentState.currentNoteIndex];

				const frequency = typeof note === "number" ? note : getFrequency(note);

				playInstrument({ instrument, frequency });

				instrumentState.currentNoteIndex ++;
			}

			if (instrumentState.currentNoteIndex >= sequence.pattern.length && instrumentState.currentRepetition >= repeat - 1) {
				instrumentState.currentRepetition = 0;
				instrumentState.currentNoteIndex = 0;
				instrumentState.currentSequence++;
			}
		}

		instrumentState.clock++;
	});
}

/**
 * If doNotStopNote is true, the note will not be stopped and this function will return a callback that stops the note.
 */
const playInstrument = ({ instrument, frequency, doNotStopNote = false, velocity = 1 }) => {
  const stopCallbacks = [];

  instrument.oscillators.forEach((oscillator) => {
    const subdivision = instrument.subdivision ?? 1;
    const volume = instrument.volume ?? 1;
    const oscillatorVolume = volume * (oscillator.volume ?? 1);
    const type = oscillator.type;
    const attack = oscillator.attack ?? 0;
    const decay = oscillator.decay ?? 0;
    const sustain = oscillator.sustain ?? 1;
    const release = oscillator.release ?? 0;
    const detune = oscillator.detune ?? 1;
    const noteLength = oscillator.noteLength ?? instrument.noteLength ?? 1;
    const pan = oscillator.pan ?? 0;

    stopCallbacks.push(
      playNote({
        frequency: frequency * detune,
        type,
        noteLength: !doNotStopNote
          ? noteLength * subdivision * DEFAULT_STEP_DURATION
          : undefined,
        attackTime: attack,
        decayTime: decay,
        sustainLevel: sustain,
        releaseTime: release,
        loudness: oscillatorVolume,
        pan,
      })
    );
  });

  return () => stopCallbacks.forEach((cb) => cb());
};

/**
 * If noteLength is provided, it plays the note for that amount of time, otherwise this function
 * returns a callback that stops the note.
 */
const playNote = ({
	frequency,
	type = "sine", // sine, square, sawtooth, triangle
	noteLength, // in milliseconds
	attackTime = 0, // in milliseconds
	decayTime = 0, // in milliseconds
	sustainLevel = 1, // in milliseconds
	releaseTime = 0, // in milliseconds
	loudness = 1, // 0-1
	pan = 0, // -1 to 1
}) => {
	const oscillator = context.createOscillator();
	const gainNode = context.createGain();
	const panNode = context.createStereoPanner();

	oscillator.type = type;
	oscillator.connect(gainNode);
	gainNode.connect(panNode);
	panNode.connect(limiter);
	oscillator.frequency.value = frequency;

	const now = context.currentTime;
	const attackEnd = now + attackTime / 1000; // convert attackTime to seconds
	const decayEnd = attackEnd + decayTime / 1000; // convert decayTime to seconds
	
	gainNode.gain.setValueAtTime(0, now);
	gainNode.gain.linearRampToValueAtTime(loudness, attackEnd);
	gainNode.gain.linearRampToValueAtTime(sustainLevel * loudness, decayEnd); // Adjust the sustain level based on loudness

	oscillator.start();

	if (noteLength !== undefined) {
		const sustainEnd = decayEnd + (noteLength - attackTime - decayTime) / 1000; // convert sustainTime to seconds
		const releaseEnd = sustainEnd + releaseTime / 1000; // convert releaseTime to seconds

		gainNode.gain.setValueAtTime(sustainLevel * loudness, sustainEnd); // Adjust the sustain level based on loudness
		gainNode.gain.linearRampToValueAtTime(0, releaseEnd + 0.01);

		panNode.pan.setValueAtTime(pan, now); // Set the pan value

		// Stop the oscillator after the release time
		setTimeout(function () {
			oscillator.stop();
		}, noteLength + releaseTime);
	} else {
		return () => {
			const now = context.currentTime;
			const releaseEnd = now + releaseTime / 1000; // convert releaseTime to seconds

			gainNode.gain.linearRampToValueAtTime(0, releaseEnd + 0.01);

			// Stop the oscillator after the release time
			setTimeout(function () {
				oscillator.stop();
			}, releaseTime);
		}
	}
};

const getFrequency = (note) => {
	const noteMap = {
		"C": 261.63,
		"C#": 277.18,
		"Db": 277.18,
		"D": 293.66,
		"D#": 311.13,
		"Eb": 311.13,
		"E": 329.63,
		"F": 349.23,
		"F#": 369.99,
		"Gb": 369.99,
		"G": 392.00,
		"G#": 415.30,
		"Ab": 415.30,
		"A": 440.00,
		"A#": 466.16,
		"Bb": 466.16,
		"B": 493.88,
	};

	const noteRegex = /^([A-G])([#b]?)(\d)?$/;
	const [, noteName, accidental, octave] = note.match(noteRegex);

	const baseFrequency = noteMap[noteName.toUpperCase()];
	const octaveOffset = octave ? (parseInt(octave) - 4) * 12 : 0;
	const accidentalOffset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;

	return baseFrequency * Math.pow(2, (octaveOffset + accidentalOffset) / 12);
};


// MIDI
const midiTest = {
	midiAcess: null,
	inputDevices: {},

	init: () => {
		const onMIDISuccess = (midiAccess) => {
			const midiInputDeviceNames = [];
			midiAccess.inputs.forEach((input) => {
				midiInputDeviceNames.push(input.name);
				input.onmidimessage = onMIDIMessage;
			});
			Object.keys(midiTest.inputDevices).forEach((deviceName) => {
				if (!midiInputDeviceNames.includes(deviceName)) {
					console.log(`Device ${deviceName} was removed`);
					midiTest.inputDevices[deviceName].currentNotes.forEach((note) => note.stopCallback());
					delete midiTest.inputDevices[deviceName];
				}
			});

			midiInputDeviceNames.forEach((deviceName) => {
				if (!midiTest.inputDevices[deviceName]) {
					console.log(`Device ${deviceName} was added`);
					midiTest.inputDevices[deviceName] = { name: deviceName, currentNotes: [] };
				}
			});

			$("#midi-devices-list").text("MIDI Input Devices: " + midiInputDeviceNames.join(", "));
		}
		const onMIDIFailure = (e) => {
			console.log('No access to MIDI devices' + e);
		}
		const onMIDIMessage = (event) => {
			const [status, midiNote, velocity] = event.data;
			const deviceName = event.target.name;
			const channel = (status & 0x0F) + 1; // Extract the channel from the status byte

			Object.keys(parsedSource.instruments).forEach((instrumentName) => {
				const instrument = parsedSource.instruments[instrumentName];
				if (
					instrument.input === deviceName &&
					instrument.inputChannel === channel
				) {
					if (status >= 128 || status <= 143 || velocity == 0) {
						// Note Off
						midiTest.inputDevices[deviceName].currentNotes[
							midiNote
						]?.stopCallback();
						delete midiTest.inputDevices[deviceName].currentNotes[midiNote];
					} else {
						// Note On
						midiTest.inputDevices[deviceName].currentNotes[
							midiNote
						]?.stopCallback();

						const frequency = midiNoteToFrequency(midiNote);
						midiTest.inputDevices[deviceName].currentNotes[midiNote] = {
							stopCallback: playInstrument({ instrument, frequency, doNotStopNote: true, velocity: velocity / 127 }),
						};
					}
				}
			});
		}
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess({ sysex: false }).then(onMIDISuccess, onMIDIFailure);
		}
	},
};

const midiNoteToFrequency = (note) => {
	const baseFrequency = 440; // A4 frequency
	const semitoneRatio = 2 ** (1 / 12);
	const distanceFromA4 = note - 69; // MIDI note number for A4 is 69
	const frequency = baseFrequency * (semitoneRatio ** distanceFromA4);
	return frequency;
};

midiTest.init();
