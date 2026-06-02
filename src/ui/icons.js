// src/ui/icons.js — Lucide icon SVG strings for inline use.
//
// Each function returns an SVG string sized for its context.
// Icons use stroke="currentColor" so they inherit the parent's text color.
// Source: https://lucide.dev (MIT license)

const A = 'xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

function svg(size, ...paths) {
  return `<svg ${A} width="${size}" height="${size}" viewBox="0 0 24 24">${paths.join('')}</svg>`;
}

// ─── Icon catalog ────────────────────────────────────────────────────────────

export const icon = {
  // Actions
  swords:    (s = 16) => svg(s, '<path d="m11 19-6-6"/><path d="m5 21-2-2"/><path d="m8 16-4 4"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/><path d="m13 19 6-6"/><path d="m19 21 2-2"/><path d="m16 16 4 4"/><path d="M14.5 17.5 3 6V3h3l11.5 11.5"/>'),
  sword:     (s = 16) => svg(s, '<path d="m11 19-6-6"/><path d="m5 21-2-2"/><path d="m8 16-4 4"/><path d="M9.5 17.5 21 6V3h-3L6.5 14.5"/>'),
  eye:       (s = 16) => svg(s, '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>'),
  message:   (s = 16) => svg(s, '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  hourglass: (s = 16) => svg(s, '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>'),
  lock:      (s = 16) => svg(s, '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  lockOpen:  (s = 16) => svg(s, '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
  key:       (s = 16) => svg(s, '<path d="M15.75 5a3.5 3.5 0 0 0-3.5 3.5c0 .642.177 1.242.483 1.76L6 17l-.5 2.5L8 19l.5-1.5L10 17l1-1 1.5.5L14 15l-1-1 .257-.257A3.5 3.5 0 1 0 15.75 5"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>'),

  // Audio
  volumeOn:  (s = 16) => svg(s, '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>'),
  volumeOff: (s = 16) => svg(s, '<path d="M16 9a5 5 0 0 1 .95 2.293"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="m7 7-2.187 2.187A1.4 1.4 0 0 1 3.816 9.6H2a1 1 0 0 0-1 1v4.8a1 1 0 0 0 1 1h1.815a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 9.4 19.702V15"/><path d="M9.4 4.702a.705.705 0 0 1 1.203-.498L13 6.6"/>'),

  // UI chrome
  settings:  (s = 16) => svg(s, '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/>'),
  x:         (s = 16) => svg(s, '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  check:     (s = 16) => svg(s, '<path d="M20 6 9 17l-5-5"/>'),
  drama:     (s = 16) => svg(s, '<path d="M10 11h.01"/><path d="M14 6h.01"/><path d="M18 6h.01"/><path d="M6.5 13.1h.01"/><path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3"/><path d="M17.4 9.9c-.8.8-2 .8-2.8 0"/><path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7"/><path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4"/>'),
  refresh:   (s = 16) => svg(s, '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
  retry:     (s = 16) => svg(s, '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  image:     (s = 16) => svg(s, '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>'),
  bookOpen:  (s = 16) => svg(s, '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'),
  bot:       (s = 16) => svg(s, '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>'),

  // Sketch view
  minimize:  (s = 16) => svg(s, '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/>'),
  maximize:  (s = 16) => svg(s, '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/>'),
  windowed:  (s = 16) => svg(s, '<rect width="18" height="18" x="3" y="3" rx="2"/>'),

  // Chevrons
  chevronUp:   (s = 16) => svg(s, '<path d="m18 15-6-6-6 6"/>'),
  chevronDown: (s = 16) => svg(s, '<path d="m6 9 6 6 6-6"/>'),
};
