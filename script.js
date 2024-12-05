const LOCAL_STORAGE_ID = "saved-source";

const context = new AudioContext();

const defaultSource = {
	"instruments": {
		"lead": {
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
		}
	}
};

let isPlaying = false;
let metronomeInterval = null;
let parsedSource = null;
const state = {};

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
		metronomeInterval = setInterval(() => {
			if (note >= notes.length) note = 0;
			beep(notes[note]);
			note++;
		}, 200);
	}

	isPlaying = !isPlaying;
}

const playLoop = () => {
	parsedSource.instruments
}


const beep = (freq) => {
  var oscillator = context.createOscillator();
  oscillator.type = "sine";
  oscillator.connect(context.destination);
  oscillator.frequency.value = freq;
  oscillator.start();
  // Beep for 500 milliseconds
  setTimeout(function () {
    oscillator.stop();
  }, 100);
}

let notes = [800, 1200, 1500, 1600];
let note = 0;

window.addEventListener("keydown", (e) => {
  switch (e.key) {
    case "q":
      notes = [400, 400, 400, 1200, 1500, 1600, 0, 0];
      break;

    case "w":
      notes = [500, 500, 500, 1200, 1500, 1600, 0, 0];
      break;

    case "e":
      notes = [600, 600, 600, 1200, 1500, 1600, 0, 0];
      break;
  }
});
