let audio_context = null;

const init = async () => {
  audio_context = new (window.AudioContext || window.webkitAudioContext)();
};

const create_osc = async () => {
  await audio_context.audioWorklet.addModule(URL.createObjectURL(new Blob([`
    class OscProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.keys = [
          // { phase: 0..Infinity, key: 0..127, velocity: 0.0..1.0 }, ...
        ];
        this.port.onmessage = (event) => {
          if (event.data.operation === "press") {
            this.keys = this.keys.filter(key => (key.key !== event.data.key));
            this.keys.push({
              phase: 0,
              key: event.data.key,
              velocity: event.data.velocity ?? 1.0
            })
          }
          if (event.data.operation === "release") {
            this.keys = this.keys.filter(key => (key.key !== event.data.key));
          }
          if (event.data.operation === "reset") {
            this.keys = [];
          }
        };
      }
      process(inputs, outputs, parameters) {
        if (outputs.length === 0) {
          return true;
        }
        const output = outputs[0];
        for(let channel = 0; channel < output.length; channel++) {
          for(let index = 0; index < output[channel].length; index++) {
            output[channel][index] = 0;
            this.keys.forEach(key => {
              key.phase += 1;
              const hz = 440 * Math.pow(2, (key.key - 69) / 12);
              output[channel][index] +=
                Math.sin(hz * 2 * Math.PI * key.phase / sampleRate) *
                key.velocity *
                (1 - Math.exp(-200 * key.phase / sampleRate));
            });
          };
        };
        return true;
      }
    }
    registerProcessor("osc-processor", OscProcessor);
  `], { type: "text/javascript" })));
  const osc = new AudioWorkletNode(audio_context, "osc-processor");
  osc.connect(audio_context.destination);
  const press = (keys) => {
    keys.forEach(key => {
      osc.port.postMessage({ operation: "press", key: key, velocity: 0.5 / keys.length });
    });
  };
  const release = (keys) => {
    keys.forEach(key => {
      osc.port.postMessage({ operation: "release", key: key, velocity: 0.5 / keys.length });
    });
  };
  return { press, release };
};

const microphone = async (callback) => {
  const stream = await navigator.mediaDevices.getUserMedia({audio: true});
  const input = audio_context.createMediaStreamSource(stream);
  await audio_context.audioWorklet.addModule(URL.createObjectURL(new Blob([`
    class InputProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
      }
      process(inputs, outputs, parameters) {
        if (inputs.length === 0) {
          return true;
        }
        const input = inputs[0];
        const samples = input.reduce((min, ch) => (min === null || ch.length < min) ? ch.length : min, null) ?? 0;
        const mono = new Float32Array(samples);
        for(let channel = 0; channel < input.length; channel++) {
          for(let index = 0; index < mono.length; index++) {
            mono[index] += input[channel][index] / samples;
          };
        };
        this.port.postMessage({
          input: mono,
          sample_rate: sampleRate
        });
        return true;
      }
    }
    registerProcessor("input-processor", InputProcessor);
  `], { type: "text/javascript" })));
  const mic = new AudioWorkletNode(audio_context, "input-processor");
  mic.port.onmessage = (event) => {
    callback({
      input: event.data.input,
      sample_rate: event.data.sample_rate
    });
  };
  input.connect(mic);
};

export default {
  init,
  create_osc,
  microphone
};
