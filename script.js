const LOCAL_STORAGE_ID = "saved-source";
const DEFAULT_NOTE_LENGTH = 200;
const DEFAULT_STEP_DURATION = 500;

const context = new AudioContext();

const defaultSource = {
	"instruments": {
		"lead": {
			"volume": 0.1,
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
			"length": 4,
			"volume": 1,
			"attack": 100,
			"decay": 0,
			"sustain": 0.5,
			"release": 500,
			"sequences": [
				{
					"pattern": [400, 400, 400, 600],
					"repeat": 1
				},
				{
					"pattern": [300, 300, 300, 300],
					"repeat": 1
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
		const attack = instrument.attack ?? 0;
		const decay = instrument.decay ?? 0;
		const sustain = instrument.sustain ?? 1;
		const release = instrument.release ?? 0;
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

        playNote({
					freq: noteFreq,
					noteLength: DEFAULT_NOTE_LENGTH * length,
					attackTime: attack,
					decayTime: decay,
					sustainLevel: sustain,
					releaseTime: release,
					loudness: volume
				});

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

const playNote = ({
  freq,
  noteLength,
  attackTime = 0,
  decayTime = 0,
  sustainLevel = 1,
  releaseTime = 0,
  loudness = 1,
}) => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.frequency.value = freq;

  const now = context.currentTime;
  const attackEnd = now + attackTime / 1000; // convert attackTime to seconds
  const decayEnd = attackEnd + decayTime / 1000; // convert decayTime to seconds
	const sustainEnd = decayEnd + noteLength - attackTime - decayTime / 1000; // convert sustainTime to seconds
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
  }, noteLength + releaseTime + 1000);
};
