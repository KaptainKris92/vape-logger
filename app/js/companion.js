// ⚠️ SPOILERS ⚠️
// This file holds every form the companion grows into and every item in the
// shop. Don't read it if you want them to stay a surprise.

export const STAGES = [
  { level: 1, name: 'Seedling' },
  { level: 5, name: 'Sprout' },
  { level: 10, name: 'Sapling' },
  { level: 18, name: 'Blossom' },
  { level: 30, name: 'Grove Guardian' },
  { level: 50, name: 'Elder Spirit' },
];

export function stageFor(level) {
  let s = 0;
  STAGES.forEach((st, i) => { if (level >= st.level) s = i; });
  return s;
}

export const ITEMS = [
  { id: 'party_hat', slot: 'head', name: 'Party hat', cost: 60, level: 2 },
  { id: 'sunglasses', slot: 'face', name: 'Sunglasses', cost: 90, level: 3 },
  { id: 'scarf', slot: 'neck', name: 'Cosy scarf', cost: 120, level: 4 },
  { id: 'bowtie', slot: 'neck', name: 'Bow tie', cost: 150, level: 6 },
  { id: 'beanie', slot: 'head', name: 'Beanie', cost: 180, level: 8 },
  { id: 'heart_glasses', slot: 'face', name: 'Heart glasses', cost: 250, level: 11 },
  { id: 'top_hat', slot: 'head', name: 'Top hat', cost: 350, level: 14 },
  { id: 'monocle', slot: 'face', name: 'Monocle', cost: 400, level: 17 },
  { id: 'flower_crown', slot: 'head', name: 'Flower crown', cost: 500, level: 21 },
  { id: 'cape', slot: 'back', name: 'Hero cape', cost: 700, level: 26 },
  { id: 'wizard_hat', slot: 'head', name: 'Wizard hat', cost: 900, level: 32 },
  { id: 'star_glasses', slot: 'face', name: 'Star glasses', cost: 1100, level: 38 },
  { id: 'golden_crown', slot: 'head', name: 'Golden crown', cost: 2000, level: 45 },
];

export const SLOTS = ['head', 'face', 'neck', 'back'];

// Where attire sits on each form: top of the head, eye line, neck line, and
// how wide the head is.
const ANCHORS = [
  { top: 104, eyeY: 136, neckY: 166, width: 70 },
  { top: 92, eyeY: 130, neckY: 164, width: 74 },
  { top: 74, eyeY: 135, neckY: 168, width: 80 },
  { top: 74, eyeY: 135, neckY: 168, width: 80 },
  { top: 44, eyeY: 146, neckY: 172, width: 96 },
  { top: 40, eyeY: 146, neckY: 172, width: 100 },
];

function face(eyeY, sleeping) {
  const eye = (x) => sleeping
    ? `<path d="M${x - 7} ${eyeY} q7 6 14 0" fill="none" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>`
    : `<circle cx="${x}" cy="${eyeY}" r="6.5" fill="#2b2b2b"/><circle cx="${x + 2.2}" cy="${eyeY - 2.4}" r="2.2" fill="#fff"/>`;
  const mouth = sleeping
    ? `<ellipse cx="100" cy="${eyeY + 14}" rx="3.5" ry="2.5" fill="#2b2b2b"/>`
    : `<path d="M93 ${eyeY + 11} q7 7 14 0" fill="none" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>`;
  return `${eye(86)}${eye(114)}
    <ellipse cx="76" cy="${eyeY + 11}" rx="6.5" ry="3.5" fill="#ff8fa3" opacity=".55"/>
    <ellipse cx="124" cy="${eyeY + 11}" rx="6.5" ry="3.5" fill="#ff8fa3" opacity=".55"/>${mouth}`;
}

const leaf = (x, y, rx, ry, rot, fill = '#5cb85c') =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="${fill}"/>`;

const flower = (x, y, r, petal = '#ff9ec7', centre = '#ffd166') =>
  [0, 72, 144, 216, 288].map((a) => {
    const px = x + Math.cos((a * Math.PI) / 180) * r, py = y + Math.sin((a * Math.PI) / 180) * r;
    return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${r}" fill="${petal}"/>`;
  }).join('') + `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="${centre}"/>`;

const arms = (y, fill) =>
  leaf(55, y, 8, 13, 35, fill) + leaf(145, y, 8, 13, -35, fill);

function body(stage, id) {
  const grad = (c1, c2) => `<defs><radialGradient id="${id}b" cx="40%" cy="35%" r="75%">
    <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs>`;
  switch (stage) {
    case 0:
      return grad('#d4f7b5', '#8fd96b') +
        `<line x1="100" y1="104" x2="100" y2="86" stroke="#4e9f3d" stroke-width="4" stroke-linecap="round"/>` +
        leaf(89, 83, 11, 6, -30) + leaf(111, 81, 12, 6, 30) +
        `<ellipse cx="100" cy="142" rx="46" ry="38" fill="url(#${id}b)"/>`;
    case 1:
      return grad('#d9f8bd', '#86d562') +
        `<line x1="100" y1="92" x2="100" y2="62" stroke="#4e9f3d" stroke-width="5" stroke-linecap="round"/>` +
        leaf(84, 70, 17, 8, -35) + leaf(117, 66, 18, 8, 30) + leaf(101, 54, 7, 12, 0, '#6cc56c') +
        arms(146, '#86d562') +
        `<ellipse cx="100" cy="136" rx="48" ry="45" fill="url(#${id}b)"/>`;
    case 2:
    case 3:
      return grad('#dcf7c4', '#7ccf5b') + arms(150, '#7ccf5b') +
        `<ellipse cx="80" cy="181" rx="12" ry="6" fill="#a8774f"/><ellipse cx="120" cy="181" rx="12" ry="6" fill="#a8774f"/>` +
        `<ellipse cx="100" cy="138" rx="50" ry="44" fill="url(#${id}b)"/>` +
        `<circle cx="70" cy="100" r="20" fill="#4fae4f"/><circle cx="130" cy="98" r="21" fill="#4fae4f"/>` +
        `<circle cx="98" cy="86" r="26" fill="#5cbf5c"/><circle cx="82" cy="104" r="15" fill="#66c766"/>` +
        `<circle cx="118" cy="103" r="15" fill="#66c766"/>` +
        (stage === 3
          ? flower(126, 80, 8) + flower(74, 92, 5, '#ffc2dc') +
            `<g class="drift">${flower(150, 120, 3, '#ffc2dc')}${flower(46, 70, 2.5, '#ff9ec7')}</g>`
          : `<circle cx="125" cy="80" r="6" fill="#ff9ec7"/>`);
    case 4:
    case 5: {
      const gold = stage === 5;
      const aura = gold ? '#ffe9a8' : '#b8f0b0';
      const leafA = gold ? '#58b368' : '#43a047', leafB = gold ? '#7cc97a' : '#5cb85c';
      const blossom = gold ? '#fff4c2' : '#ff9ec7';
      return `<defs><radialGradient id="${id}a"><stop offset="0" stop-color="${aura}" stop-opacity=".8"/>
          <stop offset="1" stop-color="${aura}" stop-opacity="0"/></radialGradient></defs>` +
        `<circle cx="100" cy="110" r="95" fill="url(#${id}a)" class="pulse"/>` +
        grad(gold ? '#fff3d6' : '#f1d9b5', gold ? '#e2b973' : '#c99a68') +
        leaf(52, 150, 8, 18, 45, '#a8774f') + leaf(148, 150, 8, 18, -45, '#a8774f') +
        `<ellipse cx="82" cy="186" rx="13" ry="6" fill="#8d6240"/><ellipse cx="118" cy="186" rx="13" ry="6" fill="#8d6240"/>` +
        `<ellipse cx="100" cy="148" rx="46" ry="38" fill="url(#${id}b)"/>` +
        `<circle cx="58" cy="96" r="30" fill="${leafA}"/><circle cx="142" cy="96" r="30" fill="${leafA}"/>` +
        `<circle cx="100" cy="72" r="38" fill="${leafB}"/><circle cx="78" cy="112" r="22" fill="${leafB}"/>` +
        `<circle cx="122" cy="112" r="22" fill="${leafB}"/>` +
        [[70, 80], [128, 68], [100, 50], [148, 104], [52, 104], [112, 98]].map(([x, y]) => flower(x, y, gold ? 5 : 4, blossom)).join('') +
        (gold
          ? `<g class="twinkle">${[[30, 60], [170, 50], [24, 150], [178, 140], [100, 20]].map(([x, y]) =>
              `<path d="M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z" fill="#ffd34d"/>`).join('')}</g>`
          : '');
    }
  }
  return '';
}

function item(id, a) {
  const { top, eyeY, neckY, width } = a;
  const w = width;
  switch (id) {
    case 'party_hat':
      return `<path d="M${100 - w * 0.22} ${top + 4} L100 ${top - 38} L${100 + w * 0.22} ${top + 4}Z" fill="#7c5cff"/>
        <path d="M${100 - w * 0.15} ${top - 8} L${100 + w * 0.15} ${top - 8}" stroke="#ffd166" stroke-width="4"/>
        <circle cx="100" cy="${top - 40}" r="5" fill="#ff6b9a"/>`;
    case 'beanie':
      return `<path d="M${100 - w * 0.42} ${top + 8} a${w * 0.42} ${w * 0.4} 0 0 1 ${w * 0.84} 0Z" fill="#e4572e"/>
        <rect x="${100 - w * 0.45}" y="${top + 2}" width="${w * 0.9}" height="10" rx="5" fill="#c4401c"/>
        <circle cx="100" cy="${top - w * 0.38}" r="7" fill="#fff"/>`;
    case 'top_hat':
      return `<rect x="${100 - w * 0.4}" y="${top - 2}" width="${w * 0.8}" height="8" rx="4" fill="#222"/>
        <rect x="${100 - w * 0.26}" y="${top - 42}" width="${w * 0.52}" height="42" rx="3" fill="#2b2b2b"/>
        <rect x="${100 - w * 0.26}" y="${top - 12}" width="${w * 0.52}" height="7" fill="#b22a2a"/>`;
    case 'wizard_hat':
      return `<path d="M${100 - w * 0.45} ${top + 6} Q100 ${top - 4} ${100 + w * 0.45} ${top + 6}Z" fill="#3b2b8f"/>
        <path d="M${100 - w * 0.3} ${top + 2} L${100 + 12} ${top - 62} L${100 + w * 0.3} ${top + 2}Z" fill="#4b39b5"/>
        <circle cx="94" cy="${top - 20}" r="3" fill="#ffd34d"/><circle cx="106" cy="${top - 36}" r="2.5" fill="#ffd34d"/>
        <circle cx="${100 + 12}" cy="${top - 62}" r="4" fill="#ffd34d"/>`;
    case 'flower_crown':
      return [-0.4, -0.2, 0, 0.2, 0.4].map((f, i) =>
        flower(100 + f * w, top + 6 - Math.abs(f) * -6, 5, ['#ff9ec7', '#ffd166', '#a0c4ff', '#ffd166', '#ff9ec7'][i])).join('');
    case 'golden_crown':
      return `<path d="M${100 - w * 0.3} ${top + 6} L${100 - w * 0.32} ${top - 22} L${100 - w * 0.15} ${top - 8} L100 ${top - 30}
        L${100 + w * 0.15} ${top - 8} L${100 + w * 0.32} ${top - 22} L${100 + w * 0.3} ${top + 6}Z" fill="#ffc83d" stroke="#d99a00" stroke-width="2"/>
        <circle cx="100" cy="${top - 6}" r="4" fill="#e63946"/>`;
    case 'sunglasses':
      return `<rect x="73" y="${eyeY - 8}" width="24" height="15" rx="6" fill="#1d1d1d"/>
        <rect x="103" y="${eyeY - 8}" width="24" height="15" rx="6" fill="#1d1d1d"/>
        <path d="M97 ${eyeY - 3} h6" stroke="#1d1d1d" stroke-width="3"/>`;
    case 'heart_glasses': {
      const heart = (x) => `<path d="M${x} ${eyeY + 9} l-11 -11 a6 6 0 0 1 11 -6 a6 6 0 0 1 11 6Z" fill="#ff4d7a" opacity=".9"/>`;
      return heart(86) + heart(114) + `<path d="M95 ${eyeY - 4} h10" stroke="#ff4d7a" stroke-width="3"/>`;
    }
    case 'monocle':
      return `<circle cx="114" cy="${eyeY}" r="11" fill="#cfe8ff" fill-opacity=".35" stroke="#c9a227" stroke-width="3"/>
        <path d="M125 ${eyeY} q8 18 0 34" fill="none" stroke="#c9a227" stroke-width="1.5"/>`;
    case 'star_glasses': {
      const star = (x) => `<path d="M${x} ${eyeY - 13} L${x + 4} ${eyeY - 4} L${x + 13} ${eyeY - 3} L${x + 6} ${eyeY + 3}
        L${x + 8} ${eyeY + 12} L${x} ${eyeY + 7} L${x - 8} ${eyeY + 12} L${x - 6} ${eyeY + 3} L${x - 13} ${eyeY - 3} L${x - 4} ${eyeY - 4}Z"
        fill="#ffd34d" stroke="#e0a800" stroke-width="1.5"/>`;
      return star(86) + star(114) + `<path d="M97 ${eyeY - 2} h6" stroke="#e0a800" stroke-width="3"/>`;
    }
    case 'scarf':
      return `<path d="M62 ${neckY - 8} Q100 ${neckY + 8} 138 ${neckY - 8} L138 ${neckY + 2} Q100 ${neckY + 18} 62 ${neckY + 2}Z" fill="#e63946"/>
        <rect x="114" y="${neckY + 2}" width="12" height="22" rx="4" fill="#c92a37"/>`;
    case 'bowtie':
      return `<path d="M100 ${neckY} l-16 -9 v18Z M100 ${neckY} l16 -9 v18Z" fill="#3a86ff"/>
        <circle cx="100" cy="${neckY}" r="4.5" fill="#2a6fdb"/>`;
    case 'cape':
      return `<path d="M64 ${neckY - 20} Q100 ${neckY - 4} 136 ${neckY - 20} L156 ${neckY + 22} Q100 ${neckY + 34} 44 ${neckY + 22}Z" fill="#c1121f"/>`;
  }
  return '';
}

// worn: { head: itemId, face: itemId, ... }
export function companionSvg(stage, worn = {}, { sleeping = false, id = 'c' } = {}) {
  const a = ANCHORS[stage];
  const zzz = sleeping
    ? `<g class="zzz" fill="currentColor" font-family="system-ui, sans-serif" font-weight="700">
        <text x="146" y="${a.top + 4}" font-size="16">z</text><text x="158" y="${a.top - 12}" font-size="12">z</text></g>`
    : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your companion">
    <ellipse cx="100" cy="190" rx="52" ry="7" fill="#000" opacity=".12"/>
    <g class="${sleeping ? 'breathe' : 'bob'}">
      ${worn.back ? item(worn.back, a) : ''}
      ${body(stage, id)}
      ${face(a.eyeY, sleeping)}
      ${worn.neck ? item(worn.neck, a) : ''}
      ${worn.face && !sleeping ? item(worn.face, a) : ''}
      ${worn.head ? item(worn.head, a) : ''}
    </g>${zzz}</svg>`;
}
