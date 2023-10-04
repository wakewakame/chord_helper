const candidate = (enable_keys) => {
  const key_name = ["c", "c#", "d", "d#", "e", "f", "f#", "g", "g#", "a", "a#", "b"];
  const scales = {
    "diatonic": [0, 2, 4, 5, 7, 9, 11]
  };
  let result = [];
  for(let scale_name of Object.keys(scales)) {
    for(let key = 0; key < 12; key++) {
      const match = enable_keys.every(x => scales[scale_name].some(y => {
        return (x % 12) === ((y + key) % 12);
      }));
      if (match) {
        result.push([`${key_name[key]}_${scale_name}`, scales[scale_name].map(x => (x + key))]);
      }
    }
  }
  return result;
};

export default {
  candidate
};
