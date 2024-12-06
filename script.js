const LOCAL_STORAGE_ID = "saved-source";
const MAX_VOLUME = -5;

const DEFAULT_NOTE_LENGTH = 200;
const DEFAULT_STEP_DURATION = 500;

const defaultSource = {
	"instruments": {
		"lead": {
			"volume": 0.1,
			"oscillators": [
				{
					"type": "square",
					"length": 0.5,
					"volume": 0.1,
					"attack": 10,
					"decay": 20,
					"sustain": 0.1,
					"release": 50
				},
				{
					"type": "sine",
					"volume": 0.1,
					"attack": 100,
					"decay": 0,
					"sustain": 1,
					"release": 500,
					"detune": 0.5
				}
			],
			"sequences": [
				{
					"pattern": [800, 1200, 1500, 1600],
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

  $("#play-stop-button").on("keydown mousedown", playStopHandler);
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

const playStopHandler = () => {
	if (isPlaying) {
		clearInterval(metronomeInterval);
	} else {
		state.instruments = {};
		metronomeInterval = setInterval(playLoop, DEFAULT_STEP_DURATION);
	}

	isPlaying = !isPlaying;
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
		const volume = instrument.volume ?? 1;
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

				const noteFreq = sequence.pattern[instrumentState.currentNoteIndex];

				instrument.oscillators.forEach((oscillator) => {
					const oscillatorVolume = volume * (oscillator.volume ?? 1);
					const type = oscillator.type;
					const attack = oscillator.attack ?? 0;
					const decay = oscillator.decay ?? 0;
					const sustain = oscillator.sustain ?? 1;
					const release = oscillator.release ?? 0;
					const detune = oscillator.detune ?? 1;

					playNote({
						freq: noteFreq * detune,
						type,
						noteLength: DEFAULT_NOTE_LENGTH * subdivision,
						attackTime: attack,
						decayTime: decay,
						sustainLevel: sustain,
						releaseTime: release,
						loudness: oscillatorVolume
					});
				});

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

const playNote = ({
  freq,
	type = "sine", // sine, square, sawtooth, triangle
  noteLength, // in milliseconds
  attackTime = 0, // in milliseconds
  decayTime = 0, // in milliseconds
  sustainLevel = 1, // in milliseconds
  releaseTime = 0, // in milliseconds
  loudness = 1, // 0-1
}) => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.connect(gainNode);
  gainNode.connect(limiter);
  oscillator.frequency.value = freq;

  const now = context.currentTime;
  const attackEnd = now + attackTime / 1000; // convert attackTime to seconds
  const decayEnd = attackEnd + decayTime / 1000; // convert decayTime to seconds
	const sustainEnd = decayEnd + (noteLength - attackTime - decayTime) / 1000; // convert sustainTime to seconds
  const releaseEnd = sustainEnd + releaseTime / 1000; // convert releaseTime to seconds

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(loudness, attackEnd);
  gainNode.gain.linearRampToValueAtTime(sustainLevel * loudness, decayEnd); // Adjust the sustain level based on loudness
  gainNode.gain.setValueAtTime(sustainLevel * loudness, sustainEnd); // Adjust the sustain level based on loudness
  gainNode.gain.linearRampToValueAtTime(0, releaseEnd + 0.01);

  oscillator.start();

  // Stop the oscillator after the release time
  setTimeout(function () {
    oscillator.stop();
  }, noteLength + releaseTime);
};
