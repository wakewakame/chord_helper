const key_name = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const scales = {
  "major": [0, 2, 4, 5, 7, 9, 11],
  "minor": [0, 2, 3, 5, 7, 8, 10]
};
const chords = {
  "": [0, 4, 7],
  "m": [0, 3, 7],
  "dim": [0, 3, 6],
  "sus4": [0, 5, 7],
  "aug": [0, 4, 8],
  "7": [0, 4, 7, 10],
  "M7": [0, 4, 7, 11],
  "m7": [0, 3, 7, 10],
  "dim7": [0, 3, 6, 9],
  "7sus4": [0, 5, 7, 10],
  "aug7": [0, 4, 8, 10],
  "augM7": [0, 4, 8, 11],
  "9": [0, 4, 7, 10, 14],
  "M9": [0, 4, 7, 11, 14],
  "m9": [0, 3, 7, 10, 14],
  "aug9": [0, 4, 8, 10, 14]
  //"11": [0, 4, 7, 10, 14, 17],
  //"m11": [0, 3, 7, 10, 14, 17],
  //"13": [0, 4, 7, 10, 14, 17, 21],
  //"m13": [0, 3, 7, 10, 14, 17, 21],
  //"-5": [0, 4, 6],
  //"6": [0, 4, 7, 9],
  //"69": [0, 4, 7, 9, 14],
  //"7-5": [0, 4, 6, 10],
  //"7-9": [0, 4, 7, 10, 13],
  //"7+9": [0, 4, 7, 10, 15],
  //"7+11": [0, 4, 7, 10, 18],
  //"7+13": [0, 4, 10, 21],
  //"add9": [0, 4, 7, 14],
  //"9-5": [0, 4, 6, 10, 14],
  //"-9": [0, 4, 7, 10, 13],
  //"-9+5": [0, 4, 8, 10, 13],
  //"aug7-9": [0, 3, 8, 10, 13],
  //"m69": [0, 3, 7, 9, 14],
  //"mM7": [0, 3, 7, 11],
  //"m6": [0, 3, 7, 9],
  //"m7-5": [0, 3, 6, 10],
  //"add2": [0, 2, 4, 7],
  //"add4": [0, 4, 5, 7]
};

const candidate = (pressed_keys) => {
  let result = {
    "scale": [],
    "chord": []
  };
  if (pressed_keys.length === 0) {
    return result;
  }
  for(let scale_name of Object.keys(scales)) {
    for(let key = 0; key < 12; key++) {
      const match = pressed_keys.every(x => scales[scale_name].some(y => {
        return (x % 12) === ((y + key) % 12);
      }));
      if (match) {
        result["scale"].push([`${key_name[key]}${scale_name}`, scales[scale_name].map(x => (x + key))]);
      }
    }
  }
  const order = ["", "m", "dim", "sus4", "aug", "7", "M7", "m7", "dim7", "7sus4", "aug7", "augM7", "9", "M9", "m9", "aug9"];
  for(let chord_name of Object.keys(chords).sort((a, b) => (order.findIndex(x => (x === a)) - order.findIndex(x => (x === b))))) {
    for(let key = 0; key < 12; key++) {
      const match = pressed_keys.every(x => chords[chord_name].some(y => {
        return (x % 12) === ((y + key) % 12);
      }));
      if (match) {
        const chord = chords[chord_name].map(x => (x + key));
        const top_note = Math.max(...pressed_keys) % 12;
        // 押されているキーの一番上とマッチしたコードの一番上が一致するように回転する
        const top_note_index = chord.findIndex(note => (note === top_note));
        const rotate_count = (top_note_index >= 0) ? (top_note_index - (chord.length - 1)) : 0;
        let rotated_chord = rotate(chord, rotate_count);
        // コードの一番下が (0 <= note <12) に収まるように平行移動する
        rotated_chord = rotated_chord.map(x => (x - Math.floor(rotated_chord[0] / 12) * 12));
        result["chord"].push([`${key_name[key]}${chord_name}`, rotated_chord]);
      }
    }
  }
  return result;
};

const rotate = (chord, shift) => {
  const result = chord.sort((a, b) => (a - b));
  const range = Math.max(...result) - Math.min(...result);
  const move = Math.sign(range) * (1 + Math.floor(Math.abs(range) / 12)) * 12;
  for(let i = 0; i < result.length; i++) {
    const times = Math.floor(((result.length - 1 - i) + shift) / result.length);
    result[i] += move * times;
  }
  return result;
};

const from_name = (chord_name) => {
  //                                     +- rotate (普通のコード表記にはない独自の記法)
  //                                     |          +- key
  //                                     |          |     +- sharp / flat
  //                                     |          |     |     +- chord
  //                                 ____V_____   __V__  _V__   V_
  const result = chord_name.match(/^([\-+][1-9])?([A-G])([#b])?(.*)$/);
  if (result === null) {
    return [];
  }
  const rot = Number(result[1] ?? "0");
  const key = key_name.indexOf(result[2]);
  const sharp = {"b": -1, "": 0, "#": 1}[result[3] ?? ""];
  let chord = chords[result[4]];
  if (key === -1 || chord === undefined) {
    return [];
  }
  chord = chord.map(note => (note + key + sharp));
  chord = rotate(chord, rot);
  return chord;
};

export default {
  candidate,
  from_name
};
