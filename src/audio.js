let audio_context = null;

const init = async () => {
  if (audio_context !== null) {
    return;
  }
  audio_context = new (window.AudioContext || window.webkitAudioContext)();
};

const create_osc = async () => {
  await audio_context.audioWorklet.addModule(URL.createObjectURL(new Blob([`
    class OscProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.keys = [...Array(128)].map(_ => {
          return {
            target_verocity: 0.0,
            velocity: 0.0,
            phase: 0.0
          };
        });
        this.origin = 0;
        this.port.onmessage = (event) => {
          if (event.data.operation === "press") {
            this.keys[event.data.key].target_verocity = event.data.velocity ?? 1.0;
          }
          if (event.data.operation === "release") {
            this.keys[event.data.key].target_verocity = 0.0;
          }
          if (event.data.operation === "reset") {
            this.keys = this.keys.map(key => key.target_verocity = 0.0);
          }
          if (event.data.operation === "origin") {
            this.origin = event.data.origin;
          }
        };
      }
      process(inputs, outputs, parameters) {
        if (outputs.length === 0) {
          return true;
        }
        const output = outputs[0];
        const length = (output.length > 0) ? Math.min(...(output.map(channel => channel.length))) : 0;
        const EPSILON = 1e-4;
        const notes = this.keys
          .map((key, note) => (key.velocity > EPSILON || key.target_verocity > EPSILON) ? note : null)
          .filter(note => (note !== null));
        const velocity_sum = notes.reduce((acc, note) => (acc + this.keys[note].target_verocity), 0);
        for(let index = 0; index < length; index++) {
          let wave = 0;
          notes.forEach(note => {
            const key = this.keys[note];
            // 複数キー同時押しの音割れ対策
            const target_verocity = key.target_verocity / Math.max(1, velocity_sum);
            // 音の立ち上がりを滑らかにする
            key.velocity += (target_verocity - key.velocity) * (1e-2 ** (48000 / sampleRate));
            if (key.velocity <= EPSILON) {
              key.phase = 0;
              return;
            }
            const hz = 440 * Math.pow(2, (note - 69 + this.origin) / 12);
            wave += Math.sin(hz * 2 * Math.PI * (key.phase++) / sampleRate) * key.velocity;
          });
          for(let channel = 0; channel < output.length; channel++) {
            output[channel][index] = wave;
          };
        };
        return true;
      }
    }
    registerProcessor("osc-processor", OscProcessor);
  `], { type: "text/javascript" })));
  const osc = new AudioWorkletNode(audio_context, "osc-processor");
  osc.connect(audio_context.destination);
  const press = (keys, velocity) => {
    keys.filter(key => (0 <= key && key <= 127)).forEach(key => {
      osc.port.postMessage({ operation: "press", key: key, velocity: velocity ?? 0.3 });
    });
  };
  const release = (keys) => {
    keys.filter(key => (0 <= key && key <= 127)).forEach(key => {
      osc.port.postMessage({ operation: "release", key: key });
    });
  };
  const origin = (key) => {
    osc.port.postMessage({ operation: "origin", origin: key });
  };

  /// DEBUG
  window.navigator.requestMIDIAccess().then(midi => {
    [...Array.from(midi.inputs.values())].forEach(input => {
      input.onmidimessage = (e) => {
        if (e.data[0] === 144) {
          press([e.data[1]], e.data[2] / 127);
        }
        else if (e.data[0] === 128) {
          release([e.data[1]]);
        }
      };
    });
  });
  /// DEBUG

  return { press, release, origin };
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
