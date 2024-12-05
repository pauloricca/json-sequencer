const LOCAL_STORAGE_ID = "saved-source";
const DEFAULT_NOTE_LENGTH = 100;
const DEFAULT_STEP_DURATION = 200;

const context = new AudioContext();

const defaultSource = {
	"instruments": {
		"lead": {
			"volume": 0.3,
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
		"lead": {
			"length": 4,
			"volume": 1,
			"sequences": [
				{
					"pattern": [400, 400, 400, 400],
					"repeat": 4
				},
				{
					"pattern": [300, 300, 300, 300],
					"repeat": 4
				}
			]
		}
	}
};

let isPlaying = false;
let metronomeInterval = null;
let parsedSource = null;
const state = { instruments: {} };

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
		const length = instrument.length ?? 1;
		const volume = instrument.volume ?? 1;
		const instrumentState = state.instruments[instrumentName];

		if (instrument.sequences?.length > 0 && instrumentState.clock % length == 0) {
			if (instrumentState.currentSequence >= instrument.sequences.length) {
				instrumentState.currentSequence = 0;
				instrumentState.currentNoteIndex = 0;
			}
			const sequence = instrument.sequences[instrumentState.currentSequence];

			if (sequence.pattern) {
				if (instrumentState.currentNoteIndex >= sequence.pattern.length) {
					instrumentState.currentNoteIndex = 0;
					instrumentState.currentRepetition++;
					instrumentState.clock = 0;
				}

				const noteFreq = sequence.pattern[instrumentState.currentNoteIndex];

        playNote(noteFreq, DEFAULT_NOTE_LENGTH * length, 20 * length, 10 * length, 0.5, 10 * length, volume);

				instrumentState.currentNoteIndex ++;
			}

			if (instrumentState.currentNoteIndex >= sequence.pattern.length && instrumentState.currentRepetition >= sequence.repeat - 1) {
				instrumentState.currentRepetition = 0;
				instrumentState.currentNoteIndex = 0;
				instrumentState.currentSequence++;
			}
		}

		instrumentState.clock++;
	});
}

const playNote = (freq, noteLength, attackTime, decayTime, sustainLevel, releaseTime, loudness) => {
	const oscillator = context.createOscillator();
	const gainNode = context.createGain();

	oscillator.type = "sine";
	oscillator.connect(gainNode);
	gainNode.connect(context.destination);
	oscillator.frequency.value = freq;

	const now = context.currentTime;
	const attackEnd = now + attackTime / 1000; // convert attackTime to seconds
	const decayEnd = attackEnd + decayTime / 1000; // convert decayTime to seconds
	const releaseEnd = decayEnd + releaseTime / 1000; // convert releaseTime to seconds

	gainNode.gain.setValueAtTime(0, now);
	gainNode.gain.linearRampToValueAtTime(loudness, attackEnd);
	gainNode.gain.linearRampToValueAtTime(sustainLevel * loudness, decayEnd); // Adjust the sustain level based on loudness

	oscillator.start();
	gainNode.gain.setValueAtTime(sustainLevel * loudness, releaseEnd); // Adjust the sustain level based on loudness
	gainNode.gain.linearRampToValueAtTime(0, releaseEnd + 0.01);

	// Stop the oscillator after the release time
	setTimeout(function () {
		oscillator.stop();
	}, releaseEnd + noteLength);
}
