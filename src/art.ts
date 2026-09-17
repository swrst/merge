/* ART - all game graphics as inline SVG. Soft-3D casual mobile style:
   gradient volume + rim highlight + contact shadow, no flat web-ish icons. */
export const ART = (function () {
  const cache: Record<string, string> = {};

  const lg = (id: string, a: string, b: string, x1?: number, y1?: number, x2?: number, y2?: number) =>
    `<linearGradient id="${id}" x1="${x1 ?? 0}" y1="${y1 ?? 0}" x2="${x2 ?? 0}" y2="${y2 ?? 1}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  const rg = (id: string, a: string, b: string, cx?: number, cy?: number, r?: number) =>
    `<radialGradient id="${id}" cx="${cx ?? 0.34}" cy="${cy ?? 0.28}" r="${r ?? 0.85}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;

  const SHADOW = '<ellipse cx="50" cy="88" rx="25" ry="6" fill="#3a2a16" opacity=".17"/>';
  const glint = (x: number, y: number, r: number, o?: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.62}" fill="#fff" opacity="${o ?? 0.55}" transform="rotate(-28 ${x} ${y})"/>`;
  const spark = (x: number, y: number, s: number, c?: string) =>
    `<path d="M${x} ${y - s} Q${x + s * 0.22} ${y - s * 0.22} ${x + s} ${y} Q${x + s * 0.22} ${y + s * 0.22} ${x} ${y + s} Q${x - s * 0.22} ${y + s * 0.22} ${x - s} ${y} Q${x - s * 0.22} ${y - s * 0.22} ${x} ${y - s}Z" fill="${c || '#fff8c8'}"/>`;

  function svg(defs: string, body: string, opt?: { cls?: string; noShadow?: boolean }) {
    const o = opt || {};
    return `<svg viewBox="0 0 100 100" class="art${o.cls ? ' ' + o.cls : ''}">${defs ? `<defs>${defs}</defs>` : ''}${o.noShadow ? '' : SHADOW}${body}</svg>`;
  }

  /* ---------------------------------------------------------------- ITEMS */
  const ITEM = {
    /* --- Woodworks --- */
    twig: () => svg(
      lg('twA', '#cf9a5b', '#8d5c2a') + lg('lfA', '#9ade63', '#4ea53b'),
      `<path d="M36 78 L63 36" stroke="url(#twA)" stroke-width="10" stroke-linecap="round" fill="none"/>
       <path d="M50 57 L36 49" stroke="url(#twA)" stroke-width="8" stroke-linecap="round" fill="none"/>
       <ellipse cx="72" cy="30" rx="14" ry="9.5" fill="url(#lfA)" transform="rotate(-30 72 30)"/>
       <path d="M60 37 L83 24" stroke="#3f8f31" stroke-width="2.2" opacity=".55"/>
       <ellipse cx="30" cy="44" rx="11" ry="7.5" fill="url(#lfA)" transform="rotate(22 30 44)"/>
       ${glint(68, 26, 4, 0.5)}`),

    branch: () => svg(
      lg('brA', '#d2a066', '#8a5729') + lg('lfB', '#9ade63', '#3f9a33'),
      `<path d="M30 82 L66 30" stroke="url(#brA)" stroke-width="12" stroke-linecap="round" fill="none"/>
       <path d="M52 52 L28 40 M56 46 L80 42" stroke="url(#brA)" stroke-width="9" stroke-linecap="round" fill="none"/>
       <ellipse cx="22" cy="34" rx="14" ry="9" fill="url(#lfB)" transform="rotate(-24 22 34)"/>
       <ellipse cx="84" cy="34" rx="14" ry="9" fill="url(#lfB)" transform="rotate(20 84 34)"/>
       <ellipse cx="70" cy="20" rx="13" ry="9" fill="url(#lfB)" transform="rotate(-38 70 20)"/>
       <path d="M12 30 L32 38 M96 30 L76 38" stroke="#3a8c2d" stroke-width="2" opacity=".5"/>
       ${glint(64, 24, 4.5, 0.45)}`),

    log: () => svg(
      lg('lgA', '#d6a469', '#9a6531') + rg('lgB', '#f3d3a6', '#c08a4c'),
      `<rect x="16" y="38" width="68" height="36" rx="18" fill="url(#lgA)"/>
       <ellipse cx="22" cy="56" rx="9" ry="18" fill="url(#lgB)"/>
       <ellipse cx="22" cy="56" rx="5.5" ry="11" fill="none" stroke="#a8713c" stroke-width="2.4"/>
       <ellipse cx="22" cy="56" rx="2" ry="4" fill="#a8713c" opacity=".8"/>
       <path d="M40 44 q12 4 26 0 M42 66 q14 4 28 -1" stroke="#8a5a2a" stroke-width="2.6" opacity=".5" fill="none" stroke-linecap="round"/>
       <rect x="30" y="41" width="48" height="7" rx="3.5" fill="#fff" opacity=".22"/>`),

    lumber: () => svg(
      lg('lmA', '#f0cf9c', '#c6924f') + lg('lmB', '#e3bd84', '#ab7639') + lg('rope', '#e07b3d', '#b1531f'),
      `<rect x="14" y="58" width="72" height="18" rx="7" fill="url(#lmB)"/>
       <rect x="18" y="42" width="64" height="18" rx="7" fill="url(#lmA)"/>
       <rect x="24" y="26" width="52" height="18" rx="7" fill="url(#lmA)"/>
       <path d="M30 34 h40 M26 50 h48 M22 66 h56" stroke="#a9773c" stroke-width="2" opacity=".35"/>
       <rect x="44" y="22" width="12" height="58" rx="5" fill="url(#rope)"/>
       <rect x="41" y="44" width="18" height="9" rx="4" fill="#f09551"/>
       ${glint(34, 31, 5, 0.4)}`),

    /* --- Rockworks --- */
    pebble: () => svg(
      rg('pbA', '#d9dce6', '#8e94a8'),
      `<path d="M28 66 q-6 -20 14 -26 q20 -6 28 8 q8 14 -6 22 q-20 10 -36 -4Z" fill="url(#pbA)"/>
       ${glint(40, 48, 7, 0.6)}
       <ellipse cx="62" cy="64" rx="7" ry="4" fill="#6e7488" opacity=".25"/>`),

    rock: () => svg(
      rg('rkA', '#dfe2ec', '#7f8599') + lg('rkB', '#b9bfd0', '#8d93a6'),
      `<path d="M18 72 q-4 -26 18 -34 q26 -10 38 6 q12 18 -4 30 q-26 14 -52 -2Z" fill="url(#rkA)"/>
       <path d="M50 38 L70 50 L58 74 L36 70Z" fill="url(#rkB)" opacity=".55"/>
       ${glint(38, 46, 9, 0.55)}
       <path d="M24 66 q16 8 34 2" stroke="#6b7186" stroke-width="2.4" opacity=".3" fill="none"/>`),

    geode: () => svg(
      rg('gdA', '#d6d9e4', '#7f8599') + lg('gdC', '#e79bff', '#8348e0'),
      `<path d="M14 62 q0 -24 22 -30 q22 -6 30 8 q10 18 -6 28 q-24 12 -46 -6Z" fill="url(#gdA)"/>
       <ellipse cx="52" cy="54" rx="24" ry="20" fill="#3b2a5e"/>
       <polygon points="40,58 46,38 53,58" fill="url(#gdC)"/>
       <polygon points="50,60 58,34 66,60" fill="#d08cff"/>
       <polygon points="60,60 68,44 74,60" fill="url(#gdC)"/>
       <ellipse cx="52" cy="62" rx="22" ry="7" fill="#2a1c46" opacity=".5"/>
       ${spark(74, 30, 8, '#ffe9ff')}${glint(28, 44, 7, 0.5)}`),

    gem: () => svg(
      lg('gmA', '#ffa8e6', '#c13ec0') + lg('gmB', '#ffd9f6', '#ff79d4'),
      `<polygon points="50,14 78,38 64,80 36,80 22,38" fill="url(#gmA)"/>
       <polygon points="50,14 64,38 50,52 36,38" fill="url(#gmB)"/>
       <polygon points="36,38 50,52 36,80 22,38" fill="#fff" opacity=".22"/>
       <polygon points="64,38 78,38 64,80 50,52" fill="#8e2295" opacity=".35"/>
       <path d="M22 38 h56" stroke="#fff" stroke-width="2.4" opacity=".45"/>
       ${spark(78, 22, 10, '#fff6ff')}${spark(24, 66, 6, '#fff6ff')}`),

    /* --- Berry farm --- */
    berry: () => svg(
      rg('byA', '#ff8fa6', '#c8123c') + lg('byL', '#8ada5f', '#3f9a33'),
      `<circle cx="38" cy="62" r="17" fill="url(#byA)"/>
       <circle cx="62" cy="58" r="20" fill="url(#byA)"/>
       ${glint(56, 48, 6.5, 0.7)}${glint(33, 55, 4.5, 0.6)}
       <path d="M62 38 q-2 -14 8 -20" stroke="#4e9a35" stroke-width="4.5" fill="none" stroke-linecap="round"/>
       <ellipse cx="80" cy="26" rx="13" ry="8" fill="url(#byL)" transform="rotate(-24 80 26)"/>`),

    berries: () => svg(
      rg('bbA', '#ff8fa6', '#b60f38') + lg('bbL', '#8ada5f', '#3f9a33'),
      `<circle cx="32" cy="64" r="14" fill="url(#bbA)"/><circle cx="58" cy="70" r="15" fill="url(#bbA)"/>
       <circle cx="46" cy="48" r="15" fill="url(#bbA)"/><circle cx="72" cy="50" r="14" fill="url(#bbA)"/>
       <circle cx="60" cy="32" r="12" fill="url(#bbA)"/>
       ${glint(42, 41, 5, 0.7)}${glint(68, 44, 4.5, 0.65)}${glint(28, 58, 4, 0.6)}
       <ellipse cx="30" cy="26" rx="14" ry="8" fill="url(#bbL)" transform="rotate(-26 30 26)"/>
       <ellipse cx="50" cy="18" rx="12" ry="7" fill="url(#bbL)" transform="rotate(14 50 18)"/>`),

    jam: () => svg(
      lg('jmG', '#eaf6ff', '#b9d8ea') + lg('jmJ', '#ff5f7e', '#b0113c') + lg('jmL', '#ffd05c', '#f2a000'),
      `<rect x="26" y="34" width="48" height="48" rx="12" fill="url(#jmG)"/>
       <rect x="30" y="46" width="40" height="32" rx="9" fill="url(#jmJ)"/>
       <rect x="24" y="24" width="52" height="16" rx="8" fill="url(#jmL)"/>
       <path d="M24 32 q13 6 26 0 q13 -6 26 0" stroke="#e0a21c" stroke-width="2.4" fill="none" opacity=".6"/>
       <circle cx="36" cy="30" r="2.6" fill="#fff" opacity=".7"/><circle cx="50" cy="33" r="2.6" fill="#fff" opacity=".7"/><circle cx="64" cy="30" r="2.6" fill="#fff" opacity=".7"/>
       <rect x="38" y="56" width="24" height="15" rx="5" fill="#fff6e2"/>
       <path d="M50 68 q-7 -5 -7 -9 a4 4 0 0 1 7 -2 a4 4 0 0 1 7 2 q0 4 -7 9Z" fill="#e4344f"/>
       <rect x="31" y="38" width="7" height="40" rx="3.5" fill="#fff" opacity=".35"/>`),

    pie: () => svg(
      lg('pieC', '#ffd88f', '#d99031') + lg('pieF', '#ff5f7e', '#a80f3c') + lg('pieT', '#ffe4ab', '#e0a852'),
      `<ellipse cx="50" cy="66" rx="40" ry="20" fill="url(#pieC)"/>
       <ellipse cx="50" cy="60" rx="40" ry="20" fill="#f5bf6b"/>
       <ellipse cx="50" cy="58" rx="32" ry="15" fill="url(#pieF)"/>
       <path d="M24 56 q26 -12 52 0 M30 66 q20 -10 40 0" stroke="url(#pieT)" stroke-width="6" fill="none" stroke-linecap="round"/>
       <path d="M40 46 q6 22 6 26 M58 46 q-4 22 -4 26" stroke="url(#pieT)" stroke-width="6" fill="none" stroke-linecap="round"/>
       <ellipse cx="50" cy="60" rx="40" ry="20" fill="none" stroke="#d99031" stroke-width="4"/>
       <circle cx="50" cy="42" r="7" fill="#e4344f"/><circle cx="50" cy="42" r="2.6" fill="#fff" opacity=".6"/>
       <path d="M42 30 q4 -6 0 -11 M58 30 q4 -6 0 -11" stroke="#fff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>`),

    /* --- Meteor finds --- */
    scrap: () => svg(
      rg('scA', '#ffd27a', '#c2540f') + rg('scB', '#8be7ff', '#2a86c9'),
      `<path d="M22 66 q-6 -22 16 -30 q24 -8 34 8 q10 18 -8 28 q-24 12 -42 -6Z" fill="url(#scA)"/>
       <path d="M44 40 L62 46 L56 66 L38 60Z" fill="url(#scB)" opacity=".85"/>
       <circle cx="66" cy="60" r="5" fill="#7a3a0c" opacity=".5"/>
       ${glint(36, 46, 7, 0.55)}${spark(78, 26, 10, '#ffe9a8')}${spark(22, 34, 6, '#ffe9a8')}`),

    starcore: () => svg(
      rg('stA', '#fff6b0', '#ff9b2f') + rg('stB', '#ffffff', '#ffd466'),
      `<circle cx="50" cy="52" r="30" fill="url(#stA)" opacity=".35"/>
       <polygon points="50,14 60,42 90,44 66,62 74,90 50,72 26,90 34,62 10,44 40,42" fill="url(#stA)"/>
       <polygon points="50,28 56,45 74,46 60,56 65,74 50,63 35,74 40,56 26,46 44,45" fill="url(#stB)"/>
       ${glint(44, 40, 7, 0.75)}${spark(84, 22, 8, '#fffbe0')}`),

    /* --- Ship: hull (bolts) --- */
    bolt: () => svg(
      lg('boA', '#dfe6f2', '#8d9bb4') + lg('boB', '#b9c4d8', '#6f7c94'),
      `<polygon points="50,24 72,36 72,60 50,72 28,60 28,36" fill="url(#boA)"/>
       <polygon points="50,34 63,41 63,55 50,62 37,55 37,41" fill="url(#boB)"/>
       <circle cx="50" cy="48" r="8" fill="#6d7a92"/>
       ${glint(40, 36, 6, 0.65)}`),

    boltpack: () => svg(
      lg('bpA', '#e6ecf7', '#8d9bb4') + lg('bpR', '#ff9d4d', '#d9631a'),
      `<polygon points="32,36 48,45 48,63 32,72 16,63 16,45" fill="url(#bpA)"/>
       <polygon points="68,36 84,45 84,63 68,72 52,63 52,45" fill="url(#bpA)"/>
       <polygon points="50,18 66,27 66,45 50,54 34,45 34,27" fill="url(#bpA)"/>
       <circle cx="32" cy="54" r="5.5" fill="#6d7a92"/><circle cx="68" cy="54" r="5.5" fill="#6d7a92"/><circle cx="50" cy="36" r="5.5" fill="#6d7a92"/>
       <rect x="12" y="58" width="76" height="12" rx="6" fill="url(#bpR)"/>
       ${glint(40, 28, 6, 0.6)}`),

    hullplate: () => svg(
      lg('hpA', '#eaf3ff', '#8fb4d8') + lg('hpB', '#ffffff', '#cfe4f7'),
      `<path d="M22 74 q-4 -40 28 -54 q32 14 28 54Z" fill="url(#hpA)"/>
       <path d="M34 70 q-2 -30 16 -42 q18 12 16 42Z" fill="url(#hpB)" opacity=".75"/>
       <circle cx="32" cy="64" r="3.4" fill="#7f9dbd"/><circle cx="68" cy="64" r="3.4" fill="#7f9dbd"/>
       <circle cx="50" cy="32" r="3.4" fill="#7f9dbd"/><circle cx="38" cy="48" r="3" fill="#7f9dbd"/><circle cx="62" cy="48" r="3" fill="#7f9dbd"/>
       <path d="M22 74 h56" stroke="#7f9dbd" stroke-width="4" stroke-linecap="round"/>
       ${glint(40, 36, 7, 0.7)}`),

    /* --- Ship: engine (springs) --- */
    spring: () => svg(
      lg('spA', '#cfd8e8', '#7d89a2'),
      `<path d="M34 70 q16 -8 32 -4 M32 60 q16 -8 32 -4 M34 50 q16 -8 32 -4 M36 40 q16 -8 32 -4 M38 30 q14 -7 28 -3"
        stroke="url(#spA)" stroke-width="8" fill="none" stroke-linecap="round"/>
       ${glint(44, 34, 5, 0.5)}`),

    coil: () => svg(
      lg('coA', '#ffbe72', '#c96a1c') + lg('coB', '#cfd8e8', '#7d89a2'),
      `<rect x="26" y="70" width="48" height="10" rx="5" fill="url(#coB)"/>
       <path d="M30 68 q20 -10 40 -5 M28 56 q20 -10 40 -5 M30 44 q20 -10 40 -5 M32 32 q18 -9 36 -4"
        stroke="url(#coA)" stroke-width="9" fill="none" stroke-linecap="round"/>
       <rect x="30" y="20" width="40" height="9" rx="4.5" fill="url(#coB)"/>
       ${glint(42, 28, 5, 0.5)}`),

    enginecore: () => svg(
      lg('enA', '#b9c6da', '#69768f') + lg('enB', '#ffd166', '#f0862a') + lg('enC', '#eaf1fb', '#9fb0c9'),
      `<rect x="34" y="18" width="32" height="30" rx="10" fill="url(#enC)"/>
       <path d="M30 48 h40 l14 30 h-68Z" fill="url(#enA)"/>
       <ellipse cx="50" cy="78" rx="34" ry="8" fill="url(#enB)"/>
       <ellipse cx="50" cy="76" rx="26" ry="5.5" fill="#ffe7a8"/>
       <rect x="24" y="44" width="52" height="8" rx="4" fill="#8d9bb4"/>
       <circle cx="50" cy="32" r="8" fill="#6fd4ff"/><circle cx="50" cy="32" r="4" fill="#d7f4ff"/>
       ${glint(40, 26, 5, 0.6)}`),

    /* --- Ship: nav (wires) --- */
    wire: () => svg(
      lg('wrA', '#8ce07a', '#2f9a52') + lg('wrB', '#ffd166', '#e0a021'),
      `<path d="M24 68 q10 -26 26 -20 q16 6 26 -18" stroke="url(#wrA)" stroke-width="9" fill="none" stroke-linecap="round"/>
       <rect x="14" y="60" width="16" height="14" rx="5" fill="url(#wrB)"/>
       <rect x="70" y="22" width="16" height="14" rx="5" fill="url(#wrB)"/>
       ${glint(36, 48, 5, 0.45)}`),

    circuit: () => svg(
      lg('ciA', '#5fd08a', '#1f8a4d') + lg('ciB', '#3a3f55', '#20232f') + lg('ciC', '#ffd166', '#e0a021'),
      `<rect x="16" y="26" width="68" height="50" rx="10" fill="url(#ciA)"/>
       <rect x="30" y="38" width="26" height="22" rx="5" fill="url(#ciB)"/>
       <rect x="62" y="38" width="14" height="14" rx="4" fill="url(#ciB)"/>
       <path d="M24 66 h52 M24 32 h16 M60 66 v-8" stroke="url(#ciC)" stroke-width="3.4" stroke-linecap="round"/>
       <circle cx="24" cy="44" r="3" fill="#ffe9a8"/><circle cx="76" cy="66" r="3" fill="#ffe9a8"/>
       ${glint(34, 32, 6, 0.4)}`),

    navdish: () => svg(
      lg('ndA', '#eaf3ff', '#9db6d4') + lg('ndB', '#c9d8ea', '#7e8ea8'),
      `<rect x="44" y="52" width="12" height="28" rx="5" fill="url(#ndB)"/>
       <rect x="32" y="76" width="36" height="9" rx="4.5" fill="url(#ndB)"/>
       <ellipse cx="50" cy="38" rx="32" ry="22" fill="url(#ndA)" transform="rotate(-16 50 38)"/>
       <ellipse cx="50" cy="38" rx="21" ry="14" fill="#fff" opacity=".55" transform="rotate(-16 50 38)"/>
       <circle cx="50" cy="38" r="6" fill="#6fd4ff"/>
       <path d="M50 38 L64 16" stroke="#8d9bb4" stroke-width="4" stroke-linecap="round"/>
       ${glint(36, 28, 6, 0.6)}`),

    /* --- Ship: tank (glass) --- */
    glass: () => svg(
      lg('glA', '#bdf0ff', '#59b9e0'),
      `<polygon points="46,20 72,50 52,78 28,58" fill="url(#glA)" opacity=".92"/>
       <polygon points="46,20 58,44 40,58 34,40" fill="#fff" opacity=".45"/>
       ${spark(74, 26, 7, '#e9fbff')}`),

    tankglass: () => svg(
      lg('tgA', '#c9f3ff', '#54b6df') + lg('tgB', '#e9fbff', '#9fe0f5'),
      `<rect x="24" y="24" width="52" height="56" rx="20" fill="url(#tgA)" opacity=".92"/>
       <rect x="32" y="32" width="18" height="40" rx="9" fill="url(#tgB)" opacity=".8"/>
       <rect x="24" y="24" width="52" height="56" rx="20" fill="none" stroke="#8fd9f0" stroke-width="3"/>
       ${spark(78, 28, 7, '#e9fbff')}`),

    fueltank: () => svg(
      lg('ftA', '#e9f3fb', '#9fb2c9') + lg('ftB', '#7fe6a0', '#1f9e57'),
      `<rect x="26" y="20" width="48" height="60" rx="22" fill="url(#ftA)"/>
       <rect x="33" y="40" width="34" height="34" rx="15" fill="url(#ftB)"/>
       <path d="M33 46 q9 6 17 0 q8 -6 17 0 v22 a15 15 0 0 1 -34 0Z" fill="#8ef0b4" opacity=".55"/>
       <rect x="38" y="12" width="24" height="12" rx="6" fill="#8d9bb4"/>
       <circle cx="66" cy="32" r="7" fill="#fff"/><path d="M66 32 L69 28" stroke="#4a5568" stroke-width="2.4" stroke-linecap="round"/>
       <rect x="31" y="26" width="7" height="46" rx="3.5" fill="#fff" opacity=".4"/>`),

    /* --- Fuel --- */
    fuelore: () => svg(
      rg('foA', '#b8ffcf', '#1f9e57'),
      `<path d="M24 66 q-4 -22 16 -28 q22 -6 32 8 q10 16 -8 26 q-22 10 -40 -6Z" fill="url(#foA)"/>
       <polygon points="46,36 58,46 50,62 38,54" fill="#e6ffef" opacity=".7"/>
       ${glint(38, 44, 6, 0.5)}${spark(76, 30, 7, '#ccffdd')}`),

    fuelcan: () => svg(
      lg('fcA', '#9ef0bd', '#1c9a58') + lg('fcB', '#cfe0f0', '#8493a8'),
      `<rect x="26" y="30" width="48" height="50" rx="12" fill="url(#fcA)"/>
       <rect x="32" y="38" width="12" height="34" rx="6" fill="#dcffe9" opacity=".6"/>
       <rect x="38" y="18" width="24" height="14" rx="6" fill="url(#fcB)"/>
       <rect x="62" y="34" width="12" height="10" rx="4" fill="url(#fcB)"/>
       <path d="M50 44 L44 58 h6 l-4 12 12 -16 h-6Z" fill="#fff8b0"/>
       ${glint(36, 36, 5, 0.5)}`),

    rocketfuel: () => svg(
      lg('rfA', '#d9f7ff', '#8fb6cc') + lg('rfB', '#87ffb6', '#0f9b52'),
      `<rect x="30" y="16" width="40" height="66" rx="18" fill="url(#rfA)"/>
       <rect x="36" y="30" width="28" height="46" rx="13" fill="url(#rfB)"/>
       <path d="M36 40 q7 6 14 0 q7 -6 14 0 v23 a13 13 0 0 1 -28 0Z" fill="#b6ffd2" opacity=".6"/>
       <rect x="38" y="8" width="24" height="12" rx="6" fill="#6f7c94"/>
       <path d="M52 40 L44 58 h7 l-5 14 14 -19 h-7Z" fill="#fff9c0"/>
       <rect x="34" y="22" width="6" height="52" rx="3" fill="#fff" opacity=".45"/>
       ${spark(80, 24, 8, '#ccffe2')}`),

    /* --- Luna: moon rocks --- */
    mrock: () => svg(
      rg('mrA', '#e6e2f5', '#8f89ad'),
      `<path d="M24 68 q-6 -24 16 -30 q24 -6 34 8 q10 16 -8 26 q-24 12 -42 -4Z" fill="url(#mrA)"/>
       <circle cx="42" cy="52" r="6" fill="#7e779c" opacity=".45"/><circle cx="62" cy="62" r="4.5" fill="#7e779c" opacity=".4"/>
       ${glint(38, 44, 6, 0.55)}`),

    mcrystal: () => svg(
      lg('mcA', '#b8f4ff', '#3ba7d8') + lg('mcB', '#eaffff', '#8fe2f7'),
      `<polygon points="34,74 30,40 44,18 54,42 48,74" fill="url(#mcA)"/>
       <polygon points="52,74 54,34 68,22 74,50 68,74" fill="url(#mcB)"/>
       <polygon points="34,74 30,40 44,18 40,44" fill="#fff" opacity=".35"/>
       ${spark(80, 24, 8, '#e6ffff')}`),

    mcore: () => svg(
      rg('moA', '#ded9f2', '#7f7aa0') + rg('moB', '#c8f8ff', '#2ea9dd'),
      `<path d="M18 62 q0 -26 24 -32 q26 -6 36 10 q10 18 -8 28 q-28 12 -52 -6Z" fill="url(#moA)"/>
       <circle cx="52" cy="52" r="20" fill="#2b2452"/>
       <circle cx="52" cy="52" r="15" fill="url(#moB)"/>
       <circle cx="52" cy="52" r="24" fill="none" stroke="#8ee9ff" stroke-width="2.5" opacity=".5"/>
       ${glint(45, 45, 6, 0.65)}${spark(82, 28, 7, '#dffaff')}`),

    mstar: () => svg(
      rg('msA', '#e9fbff', '#49b9e8') + rg('msB', '#ffffff', '#b6ecff'),
      `<circle cx="50" cy="50" r="32" fill="#7fd9ff" opacity=".25"/>
       <polygon points="50,10 61,40 92,44 68,63 76,92 50,74 24,92 32,63 8,44 39,40" fill="url(#msA)"/>
       <polygon points="50,26 57,44 74,46 60,57 65,75 50,64 35,75 40,57 26,46 43,44" fill="url(#msB)"/>
       ${spark(86, 20, 9, '#ffffff')}${glint(44, 40, 6, 0.8)}`),

    /* --- Luna: glow garden --- */
    spore: () => svg(
      rg('spB', '#e3b7ff', '#8a3fd8') + lg('spS', '#f4e9ff', '#c6a6e6'),
      `<rect x="44" y="52" width="12" height="26" rx="6" fill="url(#spS)"/>
       <path d="M22 54 q4 -26 28 -26 q24 0 28 26Z" fill="url(#spB)"/>
       <circle cx="38" cy="42" r="5" fill="#fff" opacity=".7"/><circle cx="60" cy="38" r="4" fill="#fff" opacity=".6"/>
       ${spark(80, 26, 6, '#f0d9ff')}`),

    bulb: () => svg(
      rg('bgA', '#c6ffe9', '#1fa87f') + lg('bgS', '#8fe0a8', '#3d9a62'),
      `<path d="M50 80 q-3 -18 0 -26" stroke="url(#bgS)" stroke-width="7" fill="none" stroke-linecap="round"/>
       <ellipse cx="50" cy="42" rx="26" ry="28" fill="url(#bgA)"/>
       <ellipse cx="42" cy="34" rx="8" ry="10" fill="#fff" opacity=".55"/>
       <ellipse cx="50" cy="70" rx="16" ry="6" fill="#57c99a" opacity=".5"/>
       ${spark(80, 22, 7, '#d8fff1')}`),

    glowflower: () => svg(
      rg('gfA', '#ffd0f2', '#d63bb4') + rg('gfB', '#fffbc8', '#ffc93c') + lg('gfS', '#8fe0a8', '#3d9a62'),
      `<path d="M50 84 q-4 -20 0 -30" stroke="url(#gfS)" stroke-width="7" fill="none" stroke-linecap="round"/>
       <ellipse cx="34" cy="70" rx="12" ry="7" fill="#5fc47f" transform="rotate(-20 34 70)"/>
       ${[0, 72, 144, 216, 288].map(a => `<ellipse cx="50" cy="26" rx="12" ry="18" fill="url(#gfA)" transform="rotate(${a} 50 46)"/>`).join('')}
       <circle cx="50" cy="46" r="12" fill="url(#gfB)"/>
       ${glint(45, 40, 5, 0.7)}`),

    starbloom: () => svg(
      rg('sbA', '#cfe4ff', '#5a7fe0') + rg('sbB', '#fff6c0', '#ffc93c') + lg('sbS', '#8fe0a8', '#3d9a62'),
      `<path d="M50 86 q-4 -18 0 -26" stroke="url(#sbS)" stroke-width="7" fill="none" stroke-linecap="round"/>
       <circle cx="50" cy="46" r="34" fill="#9fc0ff" opacity=".22"/>
       ${[0, 60, 120, 180, 240, 300].map(a => `<path d="M50 12 q10 20 0 34 q-10 -14 0 -34Z" fill="url(#sbA)" transform="rotate(${a} 50 46)"/>`).join('')}
       <circle cx="50" cy="46" r="14" fill="url(#sbB)"/>
       ${spark(84, 20, 8, '#fffce8')}${glint(45, 40, 5, 0.75)}`),

    /* --- Tier 5 masterpieces --- */
    cart: () => svg(
      lg('ctA', '#f0cf9c', '#b8853f') + lg('ctB', '#d6a469', '#8a5729') + rg('ctW', '#8a5f31', '#523618'),
      `<path d="M18 40 h58 l-6 26 h-46Z" fill="url(#ctA)"/>
       <rect x="16" y="34" width="62" height="10" rx="5" fill="url(#ctB)"/>
       <path d="M26 44 v20 M40 44 v20 M54 44 v20 M68 44 v20" stroke="#a9773c" stroke-width="2" opacity=".45"/>
       <rect x="30" y="22" width="34" height="13" rx="6" fill="#d6a469"/>
       <rect x="36" y="14" width="24" height="12" rx="6" fill="#f0cf9c"/>
       <circle cx="30" cy="74" r="11" fill="url(#ctW)"/><circle cx="30" cy="74" r="4" fill="#e0b57a"/>
       <circle cx="66" cy="74" r="11" fill="url(#ctW)"/><circle cx="66" cy="74" r="4" fill="#e0b57a"/>
       <rect x="72" y="36" width="16" height="6" rx="3" fill="#b8853f"/>
       ${glint(34, 38, 6, 0.45)}`),

    statue: () => svg(
      lg('stA', '#eaf6ff', '#7fa8d6') + lg('stB', '#d9dce6', '#9aa0b4') + rg('stC', '#ffffff', '#b9dcff'),
      `<rect x="24" y="74" width="52" height="12" rx="6" fill="url(#stB)"/>
       <rect x="32" y="64" width="36" height="12" rx="5" fill="#c9cede"/>
       <polygon points="50,10 66,34 62,64 38,64 34,34" fill="url(#stA)"/>
       <polygon points="50,10 58,34 50,64 42,34" fill="url(#stC)" opacity=".85"/>
       <polygon points="34,34 50,44 66,34 62,48 38,48" fill="#fff" opacity=".35"/>
       ${spark(82, 24, 8, '#eaffff')}${glint(43, 30, 6, 0.8)}`),

    cake: () => svg(
      lg('ckA', '#fff3dc', '#e8c088') + lg('ckB', '#ff9ec4', '#e0407f') + rg('ckC', '#ff7fa8', '#c81f57'),
      `<rect x="20" y="56" width="60" height="24" rx="10" fill="url(#ckA)"/>
       <rect x="27" y="36" width="46" height="24" rx="10" fill="url(#ckA)"/>
       <path d="M20 58 q8 10 16 0 q8 10 16 0 q8 10 16 0 q6 8 12 0 v6 a8 8 0 0 1 -8 8 h-44 a8 8 0 0 1 -8 -8Z" fill="url(#ckB)"/>
       <path d="M27 38 q7 9 14 0 q7 9 14 0 q7 9 14 0 v5 a8 8 0 0 1 -8 8 h-26 a8 8 0 0 1 -8 -8Z" fill="url(#ckB)"/>
       <circle cx="38" cy="34" r="6" fill="url(#ckC)"/><circle cx="50" cy="30" r="7" fill="url(#ckC)"/><circle cx="62" cy="34" r="6" fill="url(#ckC)"/>
       <circle cx="36" cy="32" r="2" fill="#fff" opacity=".7"/><circle cx="48" cy="28" r="2.2" fill="#fff" opacity=".7"/>
       <rect x="47" y="10" width="6" height="14" rx="3" fill="#fff"/>
       <path d="M50 4 q5 5 0 8 q-5 -3 0 -8Z" fill="#ffd45e"/>
       ${glint(32, 62, 6, 0.4)}`),

    moonorb: () => svg(
      rg('moA2', '#ffffff', '#8f86c4') + rg('moB2', '#e9e2ff', '#6f63b8') + lg('moR', '#ffe9a0', '#e0a52a'),
      `<circle cx="50" cy="48" r="38" fill="#cdc4ff" opacity=".28"/>
       <circle cx="50" cy="48" r="28" fill="url(#moB2)"/>
       <circle cx="42" cy="40" r="6" fill="#fff" opacity=".35"/><circle cx="60" cy="56" r="4.5" fill="#fff" opacity=".25"/>
       <ellipse cx="50" cy="52" rx="42" ry="12" fill="none" stroke="url(#moR)" stroke-width="5" opacity=".9" transform="rotate(-16 50 52)"/>
       <ellipse cx="50" cy="52" rx="42" ry="12" fill="none" stroke="#fff6cc" stroke-width="1.6" opacity=".7" transform="rotate(-16 50 52)"/>
       ${spark(84, 18, 9, '#ffffff')}${glint(40, 36, 7, 0.8)}`),

    glowtree: () => svg(
      lg('gtT', '#9d7bd6', '#5b3f96') + rg('gtC', '#b6ffe6', '#18a88a') + rg('gtC2', '#ffe4ff', '#c65fd6'),
      `<path d="M46 84 L46 50 q0 -6 8 -6 v40Z" fill="url(#gtT)"/>
       <path d="M50 62 q-12 -4 -18 -14 M50 56 q12 -5 18 -14" stroke="url(#gtT)" stroke-width="6" fill="none" stroke-linecap="round"/>
       <circle cx="50" cy="34" r="24" fill="url(#gtC)"/>
       <circle cx="30" cy="42" r="13" fill="url(#gtC2)" opacity=".92"/>
       <circle cx="70" cy="42" r="13" fill="url(#gtC2)" opacity=".92"/>
       <circle cx="38" cy="26" r="4" fill="#fff" opacity=".8"/><circle cx="58" cy="22" r="3" fill="#fff" opacity=".7"/>
       <circle cx="66" cy="38" r="3" fill="#fff" opacity=".6"/>
       ${spark(84, 20, 8, '#ccfff0')}${glint(42, 28, 6, 0.65)}`),

    /* --- Relics (research lab) --- */
    relic1: () => svg(
      rg('r1A', '#fffbe0', '#f0a91e') + rg('r1B', '#e9fbff', '#49b9e8'),
      `<circle cx="50" cy="48" r="36" fill="#ffd45e" opacity=".22"/>
       <polygon points="50,8 60,38 92,44 68,62 75,92 50,75 25,92 32,62 8,44 40,38" fill="url(#r1A)"/>
       <polygon points="50,24 56,42 72,46 58,56 62,74 50,63 38,74 42,56 28,46 44,42" fill="url(#r1B)"/>
       <polygon points="50,24 54,42 50,63 46,42" fill="#fff" opacity=".6"/>
       ${spark(86, 18, 9, '#ffffff')}${glint(43, 36, 6, 0.85)}`),

    relic2: () => svg(
      rg('r2A', '#ffe9a8', '#e07a10') + rg('r2B', '#fff8d0', '#ffb02e') + lg('r2C', '#fff3c8', '#e8a020'),
      `<circle cx="50" cy="52" r="38" fill="#ffb02e" opacity=".2"/>
       <path d="M50 8 q26 26 26 48 a26 26 0 0 1 -52 0 q0 -22 26 -48Z" fill="url(#r2A)"/>
       <circle cx="50" cy="58" r="17" fill="url(#r2B)"/>
       ${[0, 45, 90, 135].map(a => `<rect x="47" y="34" width="6" height="48" rx="3" fill="#fff8d0" opacity=".55" transform="rotate(${a} 50 58)"/>`).join('')}
       <circle cx="50" cy="58" r="9" fill="#fffdf0"/>
       <path d="M36 32 q10 -12 18 -16" stroke="#fff" stroke-width="5" opacity=".5" fill="none" stroke-linecap="round"/>
       ${spark(84, 20, 8, '#fff6d8')}`),

    relic3: () => svg(
      lg('r3A', '#ff8fd0', '#8a3fd8') + lg('r3B', '#9be8ff', '#2f7ed6') + rg('r3C', '#ffffff', '#ffe9ff'),
      `<circle cx="50" cy="50" r="40" fill="#c78fff" opacity=".22"/>
       <path d="M50 86 C18 62 12 42 26 28 C38 16 50 26 50 34 C50 26 62 16 74 28 C88 42 82 62 50 86Z" fill="url(#r3A)"/>
       <path d="M50 86 C18 62 12 42 26 28 C38 16 50 26 50 34Z" fill="url(#r3B)" opacity=".85"/>
       <path d="M50 34 C50 26 62 16 74 28 C82 36 82 48 72 60Z" fill="url(#r3C)" opacity=".45"/>
       <polygon points="50,38 60,54 50,70 40,54" fill="#fffdf6" opacity=".9"/>
       ${spark(82, 20, 9, '#ffffff')}${spark(22, 30, 6, '#ffe6ff')}${glint(38, 38, 6, 0.6)}`),
  };

  /* ------------------------------------------------------------ PRODUCERS */
  const PROD = {
    tree: () => svg(
      lg('trT', '#c68c4f', '#8a5729') + rg('trC', '#93e06a', '#2f8f3e') + rg('trC2', '#b6ef8a', '#4aa84c'),
      `<rect x="42" y="52" width="16" height="32" rx="7" fill="url(#trT)"/>
       <path d="M44 66 q-10 4 -14 12 M56 60 q10 4 14 12" stroke="url(#trT)" stroke-width="6" fill="none" stroke-linecap="round"/>
       <circle cx="34" cy="44" r="20" fill="url(#trC)"/><circle cx="66" cy="44" r="20" fill="url(#trC)"/>
       <circle cx="50" cy="30" r="23" fill="url(#trC2)"/>
       <circle cx="42" cy="26" r="7" fill="#fff" opacity=".28"/>
       <circle cx="36" cy="48" r="5" fill="#ff5f6d"/><circle cx="66" cy="38" r="5" fill="#ff5f6d"/>
       <circle cx="35" cy="46.5" r="1.7" fill="#fff" opacity=".7"/>`),

    rocks: () => svg(
      rg('prA', '#e2e5ef', '#868da2') + rg('prB', '#cfd4e2', '#6f7689'),
      `<path d="M14 76 q-2 -18 14 -22 q16 -4 22 6 q6 12 -6 18Z" fill="url(#prB)"/>
       <path d="M44 78 q-4 -26 18 -32 q22 -6 26 10 q6 16 -10 24Z" fill="url(#prA)"/>
       ${glint(58, 50, 9, 0.5)}${glint(24, 62, 5, 0.45)}
       ${spark(82, 26, 8, '#fff')}`),

    bush: () => svg(
      rg('bsA', '#7fd463', '#2c8a3b') + rg('bsB', '#a4e87f', '#43a44c'),
      `<circle cx="30" cy="58" r="20" fill="url(#bsA)"/><circle cx="70" cy="58" r="20" fill="url(#bsA)"/>
       <circle cx="50" cy="44" r="24" fill="url(#bsB)"/>
       <circle cx="38" cy="40" r="7" fill="#fff" opacity=".25"/>
       <circle cx="34" cy="62" r="6" fill="#e4344f"/><circle cx="62" cy="52" r="6" fill="#e4344f"/><circle cx="52" cy="68" r="6" fill="#e4344f"/>
       <circle cx="32.5" cy="60" r="2" fill="#fff" opacity=".7"/><circle cx="60.5" cy="50" r="2" fill="#fff" opacity=".7"/>`),

    scrapwreck: () => svg(
      lg('swA', '#e8eefb', '#93a3bd') + lg('swB', '#ff7a5c', '#c8372c') + rg('swS', '#c9cfe0', '#8b93a8'),
      `<ellipse cx="50" cy="80" rx="38" ry="10" fill="#8a7350" opacity=".45"/>
       <path d="M30 78 q-4 -34 22 -52 q26 18 20 52Z" fill="url(#swA)" transform="rotate(14 50 60)"/>
       <circle cx="53" cy="44" r="9" fill="#6fd4ff" transform="rotate(14 50 60)"/>
       <path d="M26 74 l-14 8 M74 70 l14 10" stroke="url(#swB)" stroke-width="8" stroke-linecap="round"/>
       <path d="M40 26 q6 -12 -2 -18 M58 22 q8 -10 2 -18" stroke="#cfd6e4" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
       ${glint(44, 40, 6, 0.6)}`),

    fuelpod: () => svg(
      lg('fpA', '#cfe0f0', '#7d8ba1') + rg('fpB', '#8fffc0', '#12a05c'),
      `<rect x="28" y="30" width="44" height="50" rx="20" fill="url(#fpA)"/>
       <ellipse cx="50" cy="52" rx="16" ry="20" fill="url(#fpB)"/>
       <rect x="38" y="16" width="24" height="16" rx="8" fill="#8d9bb4"/>
       <rect x="22" y="72" width="56" height="10" rx="5" fill="#6f7c94"/>
       ${spark(78, 26, 8, '#c8ffe0')}${glint(38, 40, 5, 0.5)}`),

    geyser: () => svg(
      rg('gyA', '#ded9f2', '#7c769c') + rg('gyP', '#ffffff', '#b9b3d6'),
      `<path d="M18 80 q4 -22 32 -24 q28 2 32 24Z" fill="url(#gyA)"/>
       <ellipse cx="50" cy="52" rx="14" ry="6" fill="#4b4470"/>
       <circle cx="50" cy="34" r="12" fill="url(#gyP)" opacity=".85"/>
       <circle cx="36" cy="24" r="8" fill="url(#gyP)" opacity=".7"/>
       <circle cx="64" cy="22" r="9" fill="url(#gyP)" opacity=".6"/>
       ${glint(34, 66, 7, 0.4)}`),

    crater: () => svg(
      rg('crA', '#6b5a4a', '#2e2620') + rg('crB', '#ffd27a', '#c2540f') + lg('crR', '#c9a678', '#8a6a42'),
      `<ellipse cx="50" cy="66" rx="42" ry="22" fill="url(#crR)"/>
       <ellipse cx="50" cy="64" rx="32" ry="16" fill="url(#crA)"/>
       <ellipse cx="50" cy="60" rx="22" ry="11" fill="#1b1612"/>
       <path d="M36 56 q-4 -16 12 -20 q18 -4 22 8 q6 12 -6 16 q-16 6 -28 -4Z" fill="url(#crB)"/>
       ${glint(44, 46, 6, 0.5)}
       <path d="M14 62 l-8 -6 M86 62 l8 -6 M50 40 l0 -10" stroke="#ffb03c" stroke-width="3" opacity=".55" stroke-linecap="round"/>
       ${spark(80, 28, 8, '#ffe9a8')}${spark(20, 34, 6, '#ffe9a8')}`),

    glowpod: () => svg(
      rg('gpA', '#ffd6f6', '#b03fb0') + rg('gpB', '#d8fff0', '#2bb98c') + lg('gpS', '#8fe0a8', '#3d9a62'),
      `<path d="M50 84 q-5 -22 0 -32" stroke="url(#gpS)" stroke-width="8" fill="none" stroke-linecap="round"/>
       <ellipse cx="50" cy="42" rx="26" ry="30" fill="url(#gpA)"/>
       <ellipse cx="50" cy="44" rx="14" ry="17" fill="url(#gpB)" opacity=".85"/>
       <ellipse cx="40" cy="30" rx="7" ry="9" fill="#fff" opacity=".5"/>
       ${spark(82, 24, 8, '#ffe4fb')}`),
  };

  /* ----------------------------------------------------------- CHARACTERS */
  const CHAR = {
    pip: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('pkS', '#ffd9b8', '#e8a97c')}${lg('pkH', '#ff9f4d', '#e0641e')}</defs>
      <circle cx="50" cy="52" r="40" fill="#ffe9c9"/>
      <path d="M14 46 q6 -34 36 -34 q30 0 36 34 q-10 -14 -36 -14 q-26 0 -36 14Z" fill="url(#pkH)"/>
      <circle cx="50" cy="56" r="30" fill="url(#pkS)"/>
      <circle cx="40" cy="52" r="5.5" fill="#3c2a1c"/><circle cx="62" cy="52" r="5.5" fill="#3c2a1c"/>
      <circle cx="42" cy="50" r="2" fill="#fff"/><circle cx="64" cy="50" r="2" fill="#fff"/>
      <path d="M42 66 q9 8 18 0" stroke="#b5562f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="30" cy="62" r="5" fill="#ff9aa6" opacity=".7"/><circle cx="72" cy="62" r="5" fill="#ff9aa6" opacity=".7"/></svg>`,

    grandma: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('gmS', '#ffe0c4', '#e6b189')}</defs>
      <circle cx="50" cy="52" r="40" fill="#ffeef6"/>
      <circle cx="50" cy="26" r="16" fill="#e4e0ea"/><circle cx="50" cy="54" r="30" fill="url(#gmS)"/>
      <path d="M16 46 q10 -22 34 -22 q24 0 34 22 q-12 -10 -34 -10 q-22 0 -34 10Z" fill="#e4e0ea"/>
      <circle cx="39" cy="54" r="10" fill="none" stroke="#9b7bd4" stroke-width="3"/><circle cx="63" cy="54" r="10" fill="none" stroke="#9b7bd4" stroke-width="3"/>
      <path d="M49 54 h4" stroke="#9b7bd4" stroke-width="3"/>
      <circle cx="39" cy="54" r="4" fill="#3c2a1c"/><circle cx="63" cy="54" r="4" fill="#3c2a1c"/>
      <path d="M42 70 q8 7 16 0" stroke="#b5562f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="28" cy="64" r="5" fill="#ff9aa6" opacity=".65"/><circle cx="74" cy="64" r="5" fill="#ff9aa6" opacity=".65"/></svg>`,

    timmy: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('tmS', '#ffdcb5', '#e3a877')}${lg('tmC', '#4fb8ff', '#1f7fd0')}</defs>
      <circle cx="50" cy="52" r="40" fill="#e3f4ff"/>
      <circle cx="50" cy="58" r="30" fill="url(#tmS)"/>
      <path d="M18 44 q6 -26 32 -26 q26 0 32 26Z" fill="url(#tmC)"/><path d="M18 44 h40 q-4 10 -18 10 q-16 0 -22 -10Z" fill="#2f95e0"/>
      <circle cx="40" cy="56" r="5.5" fill="#3c2a1c"/><circle cx="62" cy="56" r="5.5" fill="#3c2a1c"/>
      <circle cx="42" cy="54" r="2" fill="#fff"/><circle cx="64" cy="54" r="2" fill="#fff"/>
      <path d="M40 70 q10 9 20 -1" stroke="#b5562f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="30" cy="66" r="5" fill="#ff9aa6" opacity=".6"/><circle cx="72" cy="66" r="5" fill="#ff9aa6" opacity=".6"/></svg>`,

    gigi: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('ggS', '#ffdcc0', '#dfa87d')}</defs>
      <circle cx="50" cy="52" r="40" fill="#fff3e0"/>
      <circle cx="50" cy="58" r="29" fill="url(#ggS)"/>
      <path d="M26 40 q-10 -4 -8 -14 q2 -10 12 -8 q2 -10 20 -10 q18 0 20 10 q10 -2 12 8 q2 10 -8 14Z" fill="#fff"/>
      <rect x="24" y="38" width="52" height="10" rx="5" fill="#f2f2f2"/>
      <circle cx="40" cy="58" r="5" fill="#3c2a1c"/><circle cx="62" cy="58" r="5" fill="#3c2a1c"/>
      <circle cx="42" cy="56" r="1.8" fill="#fff"/><circle cx="64" cy="56" r="1.8" fill="#fff"/>
      <path d="M43 70 q7 7 14 0" stroke="#b5562f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="31" cy="66" r="4.5" fill="#ff9aa6" opacity=".6"/><circle cx="71" cy="66" r="4.5" fill="#ff9aa6" opacity=".6"/></svg>`,

    biscuit: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('bqS', '#f7c98a', '#cf9046')}</defs>
      <circle cx="50" cy="52" r="40" fill="#fdf0d8"/>
      <ellipse cx="22" cy="46" rx="11" ry="20" fill="#b9762f" transform="rotate(-14 22 46)"/>
      <ellipse cx="78" cy="46" rx="11" ry="20" fill="#b9762f" transform="rotate(14 78 46)"/>
      <circle cx="50" cy="54" r="30" fill="url(#bqS)"/>
      <ellipse cx="50" cy="68" rx="17" ry="13" fill="#ffe9c9"/>
      <ellipse cx="50" cy="61" rx="7" ry="5.5" fill="#43301f"/>
      <path d="M50 66 v5 M50 71 q-6 5 -10 1 M50 71 q6 5 10 1" stroke="#43301f" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="38" cy="47" r="5.5" fill="#3c2a1c"/><circle cx="62" cy="47" r="5.5" fill="#3c2a1c"/>
      <circle cx="40" cy="45" r="2" fill="#fff"/><circle cx="64" cy="45" r="2" fill="#fff"/></svg>`,

    bloop: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('blS', '#b6f79b', '#3ea656')}</defs>
      <circle cx="50" cy="52" r="40" fill="#e8ffe4"/>
      <path d="M36 22 q-6 -12 2 -16 M64 22 q6 -12 -2 -16" stroke="#3ea656" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="36" cy="6" r="5" fill="#ffd166"/><circle cx="64" cy="6" r="5" fill="#ffd166"/>
      <ellipse cx="50" cy="56" rx="32" ry="30" fill="url(#blS)"/>
      <ellipse cx="39" cy="52" rx="10" ry="12" fill="#fff"/><ellipse cx="63" cy="52" rx="10" ry="12" fill="#fff"/>
      <circle cx="40" cy="54" r="5" fill="#25324a"/><circle cx="64" cy="54" r="5" fill="#25324a"/>
      <circle cx="42" cy="51" r="2" fill="#fff"/><circle cx="66" cy="51" r="2" fill="#fff"/>
      <path d="M42 72 q9 8 18 0" stroke="#256b36" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,

    zib: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('zbS', '#9ff3c8', '#26a273')}</defs>
      <circle cx="50" cy="52" r="40" fill="#e0fff2"/>
      <ellipse cx="50" cy="54" rx="33" ry="31" fill="url(#zbS)"/>
      <circle cx="34" cy="48" r="9" fill="#fff"/><circle cx="50" cy="42" r="9" fill="#fff"/><circle cx="66" cy="48" r="9" fill="#fff"/>
      <circle cx="34" cy="49" r="4" fill="#20303f"/><circle cx="50" cy="43" r="4" fill="#20303f"/><circle cx="66" cy="49" r="4" fill="#20303f"/>
      <path d="M38 70 q12 10 24 0" stroke="#177a52" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg>`,

    luma: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('lmS', '#ffb4dd', '#e0479f')}</defs>
      <circle cx="50" cy="52" r="40" fill="#ffeaf6"/>
      <path d="M22 30 q-8 -16 4 -20 M78 30 q8 -16 -4 -20" stroke="#e0479f" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="24" cy="8" r="5" fill="#ffd166"/><circle cx="76" cy="8" r="5" fill="#ffd166"/>
      <ellipse cx="50" cy="56" rx="32" ry="30" fill="url(#lmS)"/>
      <ellipse cx="38" cy="52" rx="11" ry="13" fill="#fff"/><ellipse cx="62" cy="52" rx="11" ry="13" fill="#fff"/>
      <circle cx="39" cy="54" r="5.5" fill="#3a2040"/><circle cx="63" cy="54" r="5.5" fill="#3a2040"/>
      <circle cx="41" cy="51" r="2" fill="#fff"/><circle cx="65" cy="51" r="2" fill="#fff"/>
      <path d="M43 72 q7 6 14 0" stroke="#a82670" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,

    rokk: () => `<svg viewBox="0 0 100 100" class="face"><defs>${lg('rkS', '#dbe6f5', '#8b9bb5')}</defs>
      <circle cx="50" cy="52" r="40" fill="#e8f1ff"/>
      <rect x="20" y="28" width="60" height="54" rx="18" fill="url(#rkS)"/>
      <rect x="30" y="44" width="40" height="20" rx="10" fill="#26374f"/>
      <circle cx="41" cy="54" r="5.5" fill="#6fd4ff"/><circle cx="59" cy="54" r="5.5" fill="#6fd4ff"/>
      <rect x="40" y="70" width="20" height="5" rx="2.5" fill="#26374f"/>
      <path d="M50 28 v-12" stroke="#8b9bb5" stroke-width="4"/><circle cx="50" cy="12" r="6" fill="#ff6b5e"/>
      <rect x="24" y="35" width="52" height="5" rx="2.5" fill="#fff" opacity=".5"/></svg>`,

    nix: () => `<svg viewBox="0 0 100 100" class="face"><defs>${rg('nxS', '#d6bcff', '#7c46d8')}</defs>
      <circle cx="50" cy="52" r="40" fill="#f2eaff"/>
      <polygon points="50,18 82,54 50,88 18,54" fill="url(#nxS)"/>
      <ellipse cx="40" cy="52" rx="9" ry="11" fill="#fff"/><ellipse cx="60" cy="52" rx="9" ry="11" fill="#fff"/>
      <circle cx="41" cy="54" r="4.5" fill="#2b1a45"/><circle cx="61" cy="54" r="4.5" fill="#2b1a45"/>
      <path d="M43 70 q7 6 14 0" stroke="#4b2a85" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  };

  /* ---------------------------------------------------------------- MISC */
  function weed(world: string) {
    if (world === 'luna')
      return `<svg viewBox="0 0 100 100" class="art"><defs>${rg('wdM', '#cfc9e6', '#6f6990')}</defs>
        <path d="M14 78 q2 -22 22 -26 q22 -4 30 8 q10 14 -4 24Z" fill="url(#wdM)"/>
        <circle cx="70" cy="40" r="14" fill="#8d86ab"/><circle cx="66" cy="36" r="4" fill="#fff" opacity=".35"/></svg>`;
    return `<svg viewBox="0 0 100 100" class="art"><defs>${lg('wdG', '#7fd463', '#2f8a3f')}</defs>
      <path d="M50 82 q-16 -6 -20 -30 q14 6 20 30Z" fill="url(#wdG)"/>
      <path d="M50 82 q16 -8 20 -32 q-14 8 -20 32Z" fill="#5cb94e"/>
      <path d="M50 84 q-4 -22 0 -40 q6 20 0 40Z" fill="#6fc857"/>
      <circle cx="34" cy="70" r="6" fill="#ffd166"/><circle cx="70" cy="64" r="5" fill="#ff9ec4"/></svg>`;
  }

  function rocket(inst: Record<string, any>, opts?: { flame?: boolean }) {
    const o = opts || {};
    const on = k => !!(inst && inst[k]);
    const ghost = 'fill="none" stroke="#ffffff" stroke-opacity=".5" stroke-width="3" stroke-dasharray="7 6"';
    return `<svg viewBox="0 0 200 260" class="rocketArt">
      <defs>
        ${lg('rkBody', '#ffffff', '#c4d6ea')}${lg('rkFin', '#ff8264', '#d63a25')}
        ${lg('rkEng', '#b9c6da', '#69768f')}${lg('rkFl', '#ffd166', '#f0862a')}
        ${rg('rkWin', '#bff0ff', '#2f9ed6')}${lg('rkTank', '#9ef0bd', '#1c9a58')}
      </defs>
      ${o.flame ? `<g class="flameG"><path d="M100 236 q-26 22 0 60 q26 -38 0 -60Z" fill="url(#rkFl)" opacity=".95"/>
        <path d="M100 240 q-14 16 0 40 q14 -24 0 -40Z" fill="#fff3b0"/></g>` : ''}
      ${on('hull')
        ? `<path d="M100 14 q46 44 44 118 l-6 44 h-76 l-6 -44 q-2 -74 44 -118Z" fill="url(#rkBody)" stroke="#9db4cd" stroke-width="3"/>
           <path d="M100 14 q-30 44 -30 118 l4 44 h-14 l-6 -44 q-2 -74 46 -118Z" fill="#e8f1fb"/>
           <circle cx="100" cy="92" r="26" fill="#9db4cd"/><circle cx="100" cy="92" r="21" fill="url(#rkWin)"/>
           <ellipse cx="92" cy="84" rx="7" ry="5" fill="#fff" opacity=".7"/>`
        : `<path d="M100 14 q46 44 44 118 l-6 44 h-76 l-6 -44 q-2 -74 44 -118Z" ${ghost}/>`}
      ${on('tank')
        ? `<rect x="66" y="150" width="68" height="40" rx="16" fill="url(#rkTank)" stroke="#158a4c" stroke-width="3"/>
           <rect x="74" y="158" width="14" height="24" rx="7" fill="#d8ffe9" opacity=".7"/>`
        : `<rect x="66" y="150" width="68" height="40" rx="16" ${ghost}/>`}
      ${on('nav')
        ? `<rect x="138" y="70" width="8" height="26" rx="4" fill="#8d9bb4"/>
           <ellipse cx="164" cy="56" rx="24" ry="17" fill="#eaf3ff" stroke="#9db4cd" stroke-width="3" transform="rotate(-18 164 56)"/>
           <circle cx="164" cy="56" r="5" fill="#6fd4ff"/>`
        : `<ellipse cx="164" cy="56" rx="24" ry="17" ${ghost} transform="rotate(-18 164 56)"/>`}
      ${on('engine')
        ? `<path d="M74 190 h52 l16 46 h-84Z" fill="url(#rkEng)" stroke="#5d6a82" stroke-width="3"/>
           <ellipse cx="100" cy="236" rx="42" ry="9" fill="#8d9bb4"/><ellipse cx="100" cy="234" rx="32" ry="6" fill="#42506a"/>`
        : `<path d="M74 190 h52 l16 46 h-84Z" ${ghost}/>`}
      ${on('hull')
        ? `<path d="M62 150 q-30 24 -28 60 l30 -14Z" fill="url(#rkFin)"/><path d="M138 150 q30 24 28 60 l-30 -14Z" fill="url(#rkFin)"/>`
        : ''}
    </svg>`;
  }

  function planet(kind: string) {
    if (kind === 'luna')
      return `<svg viewBox="0 0 100 100" class="planetArt"><defs>${rg('plL', '#efeaff', '#8a83ae')}</defs>
        <circle cx="50" cy="50" r="42" fill="url(#plL)"/>
        <circle cx="36" cy="40" r="9" fill="#a79fc4" opacity=".7"/><circle cx="62" cy="62" r="12" fill="#a79fc4" opacity=".6"/>
        <circle cx="66" cy="32" r="6" fill="#a79fc4" opacity=".5"/>
        ${glint(36, 30, 10, 0.35)}</svg>`;
    if (kind === 'mystery')
      return `<svg viewBox="0 0 100 100" class="planetArt"><defs>${rg('plX', '#6f7a99', '#3a4260')}</defs>
        <circle cx="50" cy="50" r="42" fill="url(#plX)"/>
        <text x="50" y="66" text-anchor="middle" font-size="46" font-weight="800" fill="#cfd8ea" opacity=".8">?</text></svg>`;
    return `<svg viewBox="0 0 100 100" class="planetArt"><defs>${rg('plE', '#8fd9ff', '#2b7fc4')}</defs>
      <circle cx="50" cy="50" r="42" fill="url(#plE)"/>
      <path d="M20 40 q14 -10 26 -2 q12 8 22 0 q8 -6 14 2 q-6 16 -26 18 q-24 2 -36 -18Z" fill="#6cc65a"/>
      <path d="M30 70 q16 -8 30 0 q12 6 20 -2 q-8 18 -30 18 q-16 0 -20 -16Z" fill="#5cb94e"/>
      ${glint(34, 30, 11, 0.4)}</svg>`;
  }

  /* --------------------------------------------------------- FULL FIGURES
     Order cards show the whole customer, not a floating head. Each character
     reuses its portrait as a nested <svg> and gets a body in its own palette. */
  const FIG: Record<string, { body: string; trim: string; kind?: string }> = {
    pip: { body: '#ff9f4d', trim: '#d9581a' },
    grandma: { body: '#b493e6', trim: '#7c5ec4', kind: 'dress' },
    timmy: { body: '#4fb8ff', trim: '#1f7fd0' },
    gigi: { body: '#ffd166', trim: '#dc9a0c', kind: 'dress' },
    biscuit: { body: '#e8a55a', trim: '#b9762f', kind: 'dog' },
    bloop: { body: '#7fd88f', trim: '#3ea656', kind: 'blob' },
    zib: { body: '#57d3a0', trim: '#1c8a63', kind: 'blob' },
    luma: { body: '#ff9ccc', trim: '#d63a92', kind: 'blob' },
    rokk: { body: '#b7c4da', trim: '#7d8ba1', kind: 'robot' },
    nix: { body: '#b99aff', trim: '#7c46d8', kind: 'blob' },
  };
  /** drop a portrait into a figure as a nested svg at the given box */
  const head = (k: string, x: number, y: number, s: number) =>
    get(CHAR, k).replace('<svg viewBox="0 0 100 100" class="face"',
      `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 100 100"`);

  function figure(k: string) {
    const f = FIG[k] || { body: '#9bd0ff', trim: '#4f8ad0' };
    const shadow = '<ellipse cx="50" cy="143" rx="27" ry="6" fill="#3a2a16" opacity=".16"/>';
    const arm = (x: number, rot: number) =>
      `<rect x="${x}" y="80" width="13" height="36" rx="6.5" fill="${f.body}" transform="rotate(${rot} ${x + 6.5} 86)"/>
       <circle cx="${x + 6.5 + (rot > 0 ? 8 : -8)}" cy="114" r="7.5" fill="#ffdcb5"/>`;
    let body: string;
    if (f.kind === 'blob') {
      body = `${arm(14, 22)}${arm(73, -22)}
        <path d="M50 58 q30 0 30 40 q0 26 -30 26 q-30 0 -30 -26 q0 -40 30 -40Z" fill="${f.body}"/>
        <path d="M50 124 q-16 0 -22 -10 q10 6 22 6 q12 0 22 -6 q-6 10 -22 10Z" fill="${f.trim}" opacity=".55"/>
        <ellipse cx="38" cy="78" rx="9" ry="6" fill="#fff" opacity=".28" transform="rotate(-22 38 78)"/>`;
    } else if (f.kind === 'dog') {
      body = `<ellipse cx="52" cy="104" rx="34" ry="24" fill="${f.body}"/>
        <ellipse cx="40" cy="98" rx="20" ry="14" fill="#ffe0bb" opacity=".6"/>
        <rect x="26" y="118" width="12" height="24" rx="6" fill="${f.trim}"/>
        <rect x="44" y="120" width="12" height="22" rx="6" fill="${f.body}"/>
        <rect x="66" y="118" width="12" height="24" rx="6" fill="${f.trim}"/>
        <path d="M84 96 q16 -10 10 -24" stroke="${f.trim}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    } else if (f.kind === 'robot') {
      body = `${arm(12, 16)}${arm(75, -16)}
        <rect x="24" y="60" width="52" height="58" rx="14" fill="${f.body}" stroke="${f.trim}" stroke-width="3"/>
        <rect x="34" y="72" width="32" height="20" rx="7" fill="#26374f"/>
        <circle cx="45" cy="82" r="4" fill="#6fd4ff"/><circle cx="57" cy="82" r="4" fill="#ff8a6d"/>
        <rect x="36" y="100" width="28" height="7" rx="3.5" fill="${f.trim}"/>
        <rect x="32" y="118" width="14" height="24" rx="6" fill="${f.trim}"/>
        <rect x="54" y="118" width="14" height="24" rx="6" fill="${f.trim}"/>`;
    } else if (f.kind === 'dress') {
      body = `${arm(14, 20)}${arm(73, -20)}
        <path d="M36 60 h28 l18 58 h-64Z" fill="${f.body}"/>
        <path d="M18 118 q16 8 32 0 q16 8 32 0 v6 h-64Z" fill="${f.trim}" opacity=".6"/>
        <rect x="42" y="60" width="16" height="16" rx="6" fill="#fff" opacity=".45"/>
        <rect x="36" y="126" width="12" height="16" rx="5" fill="#6b5236"/>
        <rect x="52" y="126" width="12" height="16" rx="5" fill="#6b5236"/>`;
    } else {
      body = `${arm(14, 20)}${arm(73, -20)}
        <rect x="28" y="60" width="44" height="60" rx="18" fill="${f.body}"/>
        <path d="M28 92 h44 v10 h-44Z" fill="${f.trim}" opacity=".45"/>
        <rect x="34" y="118" width="13" height="24" rx="6" fill="${f.trim}"/>
        <rect x="53" y="118" width="13" height="24" rx="6" fill="${f.trim}"/>
        <ellipse cx="40" cy="142" rx="10" ry="5.5" fill="#6b5236"/>
        <ellipse cx="60" cy="142" rx="10" ry="5.5" fill="#6b5236"/>`;
    }
    return `<svg viewBox="0 0 100 150" class="fig">${shadow}${body}${head(k, 21, 0, 58)}</svg>`;
  }

  const ICON = {
    coin: `<svg viewBox="0 0 100 100" class="ic"><defs>${rg('icC', '#ffe680', '#e09c16')}</defs><circle cx="50" cy="50" r="42" fill="url(#icC)"/><circle cx="50" cy="50" r="31" fill="#ffd84d"/><text x="50" y="68" text-anchor="middle" font-size="46" font-weight="800" fill="#c47f08">$</text></svg>`,
    energy: `<svg viewBox="0 0 100 100" class="ic"><defs>${lg('icE', '#9be8ff', '#2f9ed6')}</defs><circle cx="50" cy="50" r="42" fill="url(#icE)"/><path d="M56 12 L28 56 h18 l-6 34 32 -48 h-20Z" fill="#fff6b0"/></svg>`,
    star: `<svg viewBox="0 0 100 100" class="ic"><defs>${rg('icS', '#fff3a8', '#f0a91e')}</defs><polygon points="50,8 62,38 94,42 70,63 77,94 50,77 23,94 30,63 6,42 38,38" fill="url(#icS)"/></svg>`,
    fuel: `<svg viewBox="0 0 100 100" class="ic"><defs>${rg('icF', '#9ef0bd', '#12a05c')}</defs><circle cx="50" cy="50" r="42" fill="url(#icF)"/><path d="M56 16 L30 58 h16 l-6 28 30 -42 h-18Z" fill="#eafff2"/></svg>`,

    /* shop + lab */
    speed: `<svg viewBox="0 0 100 100" class="ic"><defs>${rg('icSp', '#c8ffd8', '#2f9e5c')}</defs><circle cx="50" cy="50" r="42" fill="url(#icSp)"/><path d="M28 62 q6 -26 24 -30 q-4 10 -2 16 q10 -2 18 2 q-10 20 -30 24Z" fill="#fff"/><path d="M24 74 q10 -8 18 -10" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/></svg>`,
    orders: `<svg viewBox="0 0 100 100" class="ic"><defs>${lg('icOr', '#ffd98a', '#e08a12')}</defs><circle cx="50" cy="50" r="42" fill="url(#icOr)"/><rect x="26" y="20" width="48" height="60" rx="9" fill="#fffaf0"/><rect x="34" y="32" width="32" height="6" rx="3" fill="#e0a52a"/><rect x="34" y="46" width="32" height="6" rx="3" fill="#e0a52a"/><rect x="34" y="60" width="20" height="6" rx="3" fill="#e0a52a"/></svg>`,
    snack: `<svg viewBox="0 0 100 100" class="ic"><defs>${rg('icSn', '#f0c078', '#b06e22')}</defs><circle cx="50" cy="50" r="40" fill="url(#icSn)"/><circle cx="38" cy="40" r="6" fill="#6a3f16"/><circle cx="60" cy="36" r="5" fill="#6a3f16"/><circle cx="56" cy="60" r="6" fill="#6a3f16"/><circle cx="34" cy="62" r="4.5" fill="#6a3f16"/><ellipse cx="38" cy="30" rx="10" ry="6" fill="#fff" opacity=".28" transform="rotate(-25 38 30)"/></svg>`,
    crate: `<svg viewBox="0 0 100 100" class="ic"><defs>${lg('icCr', '#e8b273', '#a3661f')}</defs><rect x="14" y="26" width="72" height="56" rx="10" fill="url(#icCr)"/><rect x="14" y="26" width="72" height="14" rx="7" fill="#f3cb96"/><path d="M42 40 v42 M58 40 v42" stroke="#8a5320" stroke-width="5" opacity=".55"/><rect x="40" y="46" width="20" height="14" rx="5" fill="#ffd45e"/></svg>`,
    blueprint: `<svg viewBox="0 0 100 100" class="ic"><defs>${lg('icBp', '#7fc9ff', '#1d63ad')}</defs><rect x="14" y="20" width="72" height="62" rx="11" fill="url(#icBp)"/><path d="M26 34 h48 M26 48 h30 M26 62 h38" stroke="#ddf1ff" stroke-width="5" stroke-linecap="round" opacity=".85"/><path d="M62 52 l12 12 l-12 12" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/></svg>`,
    flask: `<svg viewBox="0 0 100 100" class="ic"><defs>${lg('icFl', '#c8f6ff', '#4fb6e0')}${rg('icFl2', '#ffb3f0', '#a63fd0')}</defs><path d="M40 14 h20 v26 l18 32 a10 10 0 0 1 -9 15 h-38 a10 10 0 0 1 -9 -15 l18 -32Z" fill="url(#icFl)"/><path d="M33 60 h34 l10 18 a8 8 0 0 1 -7 9 h-40 a8 8 0 0 1 -7 -9Z" fill="url(#icFl2)"/><rect x="36" y="10" width="28" height="9" rx="4.5" fill="#fff"/><circle cx="44" cy="74" r="4" fill="#fff" opacity=".7"/><circle cx="58" cy="68" r="3" fill="#fff" opacity=".6"/></svg>`,
  };

  function get(map: Record<string, () => string>, k: string) {
    const key = map === ITEM ? 'i' + k : map === PROD ? 'p' + k : 'c' + k;
    if (!cache[key]) cache[key] = (map[k] || (() => '<svg viewBox="0 0 100 100" class="art"></svg>'))();
    return cache[key];
  }

  return {
    item: (k: string) => get(ITEM, k),
    producer: (k: string) => get(PROD, k),
    char: (k: string) => get(CHAR, k),
    figure: (k: string) => { const key = 'f' + k; if (!cache[key]) cache[key] = figure(k); return cache[key]; },
    icon: (k: string) => (ICON as Record<string, string>)[k] || '',
    weed, rocket, planet,
    hasItem: (k: string) => !!ITEM[k],
  };
})();
