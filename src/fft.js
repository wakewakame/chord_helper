// スペクトル解析を行う
//   - array: 入力波形 (1秒程度を推奨)
//   - sampling_rate: 入力波形のサンプリングレート
//
// MEMO:
//   ここでは大雑把な基本周波数が可視化できればよいので、精度より計算速度を優先している。
const midi_spectrum = (array, sampling_rate) => {
  const notes = 128;
  const spectrum_re = new Float32Array(notes);
  const spectrum_im = new Float32Array(notes);
  for(let note = 0; note < notes; note++) {
    const hz = 440 * (2 ** ((note - 69) / 12));
    const wavelength = sampling_rate / hz;

    // 計算量を抑えるため、波長の 32 倍のサンプル数のみを使ってスペクトルを求める
    const need_samples = Math.ceil(32 * wavelength);

    // 計算量を抑えるため、波長に合わせてサンプルを飛ばし読みするようにする
    const delta = Math.max(1, Math.floor(wavelength / 32));

    // スペクトルを求める
    for(let x = Math.max(0, array.length - need_samples); x < array.length; x += delta) {
      const theta = -2 * Math.PI * hz * x / sampling_rate;
      const [omega_re, omega_im] = exp_i(theta);
      spectrum_re[note] += array[x] * omega_re;
      spectrum_im[note] += array[x] * omega_im;
    }
  }
  for(let note = 0; note < notes; note++) {
    spectrum_re[note] = Math.sqrt(spectrum_re[note] ** 2 + spectrum_im[note] ** 2);
  }
  return spectrum_re;
};

// Cooley-Tukey FFT を行う
// 入力する配列の長さは必ず 2^N である必要がある
const fft = (array) => {
  const spectrum_re = Float32Array.from(array);
  const spectrum_im = new Float32Array(array.length);
  for(let N = array.length; N > 1; N >>= 1) {
    for(let offset = 0; offset < array.length; offset += N) {
      const N_half = N >> 1;
      for(let x = offset; x < offset + N_half; x++) {
        const [omega_re, omega_im] = exp_i(-2 * Math.PI * x / N);
        const left_re = spectrum_re[x];
        const left_im = spectrum_im[x];
        const right_re = spectrum_re[x + N_half];
        const right_im = spectrum_im[x + N_half];
        spectrum_re[x] = left_re + right_re;
        spectrum_im[x] = left_im + right_im;
        spectrum_re[x + N_half] = (left_re - right_re) * omega_re - (left_im - right_im) * omega_im;
        spectrum_im[x + N_half] = (left_re - right_re) * omega_im + (left_im - right_im) * omega_re;
      }
    }
  }
  bitrevorder(spectrum_re);
  bitrevorder(spectrum_im);
  return [spectrum_re, spectrum_im];
};

// Cooley-Tukey iFFT を行う
// 入力する配列の長さは必ず 2^N である必要がある
const ifft = (spectrum) => {
  const [spectrum_re, spectrum_im] = spectrum;
  const array_re = Float32Array.from(spectrum_re);
  const array_im = Float32Array.from(spectrum_im);
  bitrevorder(array_re);
  bitrevorder(array_im);
  for(let N = 2; N <= array_re.length; N <<= 1) {
    for(let offset = 0; offset < array_re.length; offset += N) {
      const N_half = N >> 1;
      for(let x = offset; x < offset + N_half; x++) {
        const [omega_re, omega_im] = exp_i(2 * Math.PI * x / N);
        const left_re  = array_re[x];
        const left_im  = array_im[x];
        const right_re = array_re[x + N_half] * omega_re - array_im[x + N_half] * omega_im;
        const right_im = array_re[x + N_half] * omega_im + array_im[x + N_half] * omega_re;
        array_re[x] = left_re + right_re;
        array_im[x] = left_im + right_im;
        array_re[x + N_half] = left_re - right_re;
        array_im[x + N_half] = left_im - right_im;
      }
    }
  }
  for(let x = 0; x <= array_re.length; x++) {
    array_re[x] /= array_re.length;
  }
  return array_re;
};

// exp_i(x) = exp(i * x)
const exp_i = (x) => {
  return [Math.cos(x), Math.sin(x)];
};

// データをビット反転順序に並べ替える
// 入力する配列の長さは必ず 2^N である必要がある
//
// e.g.
// | index  | index(bit) |
// | ====== | ========== |
// | 0 -> 0 | 000 -> 000 |
// | 1 -> 4 | 001 -> 100 |
// | 2 -> 2 | 010 -> 010 |
// | 3 -> 6 | 011 -> 110 |
// | 4 -> 1 | 100 -> 001 |
// | 5 -> 5 | 101 -> 101 |
// | 6 -> 3 | 110 -> 011 |
// | 7 -> 7 | 111 -> 111 |
const bitrevorder = (array) => {
  let bit_len = 0;
  for(let last_bit = array.length - 1; last_bit > 0; last_bit >>= 1) {
    bit_len++;
  }
  for(let bit = 0; bit < array.length; bit++) {
    let bitrev = 0;
    for(let i = 0; i < bit_len; i++) {
      bitrev = (bitrev << 1) + ((bit >> i) & 0b1);
    }
    if (bit < bitrev) {
      [array[bit], array[bitrev]] = [array[bitrev], array[bit]];
    }
  }
};

const note_to_hz = (note) => (440 * (2 ** ((note - 69) / 12)));
const hz_to_note = (hz) => (69 + 12 * Math.log2(hz / 440));

const autocorrelate = (spectrum) => {
  const [spectrum_re, spectrum_im] = spectrum;
  const spectrum_abs = new Float32Array(spectrum_re.length);
  for(let i = 0; i < spectrum_re.length; i++) {
    spectrum_abs[i] = spectrum_re[i] * spectrum_re[i] + spectrum_im[i] * spectrum_im[i];
  }
  const correlate = ifft([spectrum_abs, new Float32Array(spectrum_abs.length)]);
  let peak = 0;
  for(let i = 1; i < correlate.length - 1; i++) {
    if (correlate[i - 1] <= correlate[i] && correlate[i] > correlate[i + 1]) {
      if (peak === 0 || correlate[peak] < correlate[i]) {
        peak = i;
      }
    }
  }
  if (1 <= peak && peak < correlate.length - 1) {
    let [p0, p1, p2] = correlate.slice(peak - 1, peak + 2);
    peak += (p0 > p2) ? (-p0 / (p0 + p1)) : (p2 / (p1 + p2));
  }
  return spectrum_abs.length / peak;
};

export default {
  midi_spectrum,
  fft,
  ifft,
  note_to_hz,
  hz_to_note,
  autocorrelate
};
