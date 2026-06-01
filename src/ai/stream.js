// src/ai/stream.js — NarrationExtractor: streaming JSON → plain narration text.
//
// DeepSeek streams the narrator response as a JSON object. This class watches
// the incoming token stream and emits only the text inside `"narration":"..."`.

export class NarrationExtractor {
  constructor() {
    this._buf    = '';
    this._active = false;  // entered the narration value
    this._done   = false;  // closing quote seen
  }

  feed(raw) {
    if (this._done) return '';
    this._buf += raw;

    if (!this._active) {
      const marker = '"narration":"';
      const idx = this._buf.indexOf(marker);
      if (idx === -1) {
        // Keep enough tail to detect a marker that spans two chunks.
        if (this._buf.length > marker.length) {
          this._buf = this._buf.slice(-(marker.length - 1));
        }
        return '';
      }
      this._active = true;
      this._buf = this._buf.slice(idx + marker.length);
    }

    // Decode content until an unescaped closing quote.
    let out = '';
    let i   = 0;
    while (i < this._buf.length) {
      const ch = this._buf[i];
      if (ch === '\\') {
        if (i + 1 >= this._buf.length) break; // incomplete escape — wait
        const esc = this._buf[i + 1];
        out += esc === '"' ? '"' : esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '' : esc;
        i += 2;
      } else if (ch === '"') {
        this._done = true;
        i++;
        break;
      } else {
        out += ch;
        i++;
      }
    }
    this._buf = this._buf.slice(i);
    return out;
  }
}
