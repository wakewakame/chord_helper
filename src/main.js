import audio from "./audio.js";
import fft from "./fft.js";
import chord from "./chord.js";
const micStore = { input: new Float32Array(48000), sample_rate: 1 };
const spectrum = () => {
  const canvas = document.createElement("canvas");
  canvas.style.display = "flex";
  canvas.width = 720;
  canvas.height = 40;
  canvas.style.width = "720px";
  canvas.style.height = "40px";
  const context = canvas.getContext("2d");
  const draw = () => {
    const fftGraph = fft.midi_spectrum(micStore.input, micStore.sample_rate);
    for(let i = 0; i < 36; i++) {
      for(let j = 36 + i; j < fftGraph.length; j += 36) {
        fftGraph[i] += fftGraph[j];
      }
    }
    const fftMax = Math.max(...fftGraph);

    context.clearRect(0, 0, canvas.width, canvas.height);

    for(let index = 0; index < 36; index++) {
      const isWhite = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1][index % 12];
      context.lineWeight = "2px";
      context.fillStyle = isWhite ? "#FFF7" : "#3337";
      context.strokeStyle = "#3337";
      context.beginPath();
      const sample = fftGraph[index];
      const x = canvas.width * (index % 36) / 36;
      const y = canvas.height * 0.9 * sample / fftMax;
      context.rect(x, 0, canvas.width / 36, y);
      context.fill();
      context.stroke();
    };

    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
	return canvas;
};
const keyboard = (keys, callback) => {
  const keysElem = document.createElement("div");
  keysElem.style.display = "flex";
  for (let key = 0; key < keys; key++) {
    const keyElem = document.createElement("div");
    const isWhite = [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1][key % 12];
    keyElem.style.width = "20px";
    keyElem.style.height = "80px";
    keyElem.style.boxSizing = "border-box";
    keyElem.style.border = "solid 1px #333";
    keyElem.style.background = isWhite ? "#FFF" : "#333";
		keyElem.style.borderRadius = "4px";
    keyElem.addEventListener("pointerdown", (e) => {
      callback(key, true);
      e.target.setPointerCapture(e.pointerId);
      e.target.addEventListener("pointerup", () => {
        callback(key, false);
        e.target.releasePointerCapture(e.pointerId);
      }, { once: true });
    });
    const flagElem = document.createElement("div");
    flagElem.style.width = "16px";
    flagElem.style.height = "8px";
    flagElem.style.margin = "auto";
    flagElem.style.boxSizing = "border-box";
    flagElem.style.border = "0px";
    flagElem.style.background = "#0003";
		flagElem.style.borderRadius = "4px";
		flagElem.style.bottom = "0px";
    flagElem.addEventListener("pointerdown", (_) => {
			const enable = !JSON.parse(keyElem.dataset.enable ?? "false");
			keyElem.dataset.enable = JSON.stringify(enable);
    	keyElem.style.background = enable ?
				(isWhite ? "#F77F" : "#B33F") :
				(isWhite ? "#FFFF" : "#333F");
			const enableKeys = [...Array.from(keysElem.children)]
				.map((elem, i) => elem.dataset.enable === "true" ? i : null)
				.filter(i => (i !== null));
			/// DEBUG
			const candidatesElem = document.getElementById("candidates");
      while (candidatesElem.firstChild) {
        candidatesElem.removeChild(candidatesElem.lastChild);
      }
			chord.candidate(enableKeys).forEach(candidate => {
				const button = document.createElement("button");
				button.textContent = candidate[0];
				button.style.margin = "2px";
				button.addEventListener("click", () => {
					for(let i = 0; i < candidate[1].length + 1; i++) {
						const lastOffset = (i === candidate[1].length) ? 12 : 0;
						setTimeout(() => { callback(candidate[1][i % candidate[1].length] + lastOffset, true ); }, 200 * (i + 0));
						setTimeout(() => { callback(candidate[1][i % candidate[1].length] + lastOffset, false); }, 200 * (i + 1));
					};
				});
        candidatesElem.appendChild(button);
			});
			/// DEBUG
    });
    keyElem.appendChild(flagElem);
    keysElem.appendChild(keyElem);
  }
	return keysElem;
};

let osc = null;
document.getElementById("keyboard").appendChild(
	keyboard(36, async (key, flag) => {
		if (osc === null) {
			await audio.init();
			osc = await audio.create_osc();
			await audio.microphone((msg) => {
				const recvInput = msg.input;
				micStore.sample_rate = msg.sample_rate;
				const storeInput = micStore.input;
				for(let micIndex = 0; micIndex < storeInput.length; micIndex++) {
					const monoIndex = micIndex - (storeInput.length - recvInput.length);
					storeInput[micIndex] = (monoIndex < 0) ? storeInput[micIndex + recvInput.length] : recvInput[monoIndex];
				}
			});
		}
		osc[flag ? "press" : "release"]([key + (12 * 6)]);
	})
);
document.getElementById("spectrum").appendChild(spectrum());
