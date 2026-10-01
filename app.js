(function(){
'use strict';

/* ---------- small helpers ---------- */
const $ = id => document.getElementById(id);
const LN2 = Math.LN2, LN10 = Math.LN10, LOG10_2 = Math.log10(2);
const SEC_YEAR = 31557600, AGE_UNIV_LOG_YR = Math.log10(1.38e10);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const NS = 'http://www.w3.org/2000/svg';

function sci(l){
  let e = Math.floor(l + 1e-9), m = Math.pow(10, l - e);
  if (m >= 9.995) { m = 1; e += 1; }
  return m.toFixed(2) + ' × 10<sup>' + (e < 0 ? '−' + Math.abs(e) : e) + '</sup>';
}
function fmtBig(x){
  const s = x.toString();
  if (s.length <= 9) return Number(s).toLocaleString('en-US');
  return s[0] + '.' + s.slice(1, 3) + ' × 10<sup>' + (s.length - 1) + '</sup>';
}
function log10Big(x){
  if (x <= 0n) return -Infinity;
  const s = x.toString();
  if (s.length <= 15) return Math.log10(Number(s));
  return Math.log10(Number(s.slice(0, 15))) + (s.length - 15);
}
const log2Big = x => log10Big(x) / LOG10_2;
function fmtCount(n){ return n < 1e9 ? Math.round(n).toLocaleString('en-US') : sci(Math.log10(n)); }
function fmtProb(p){
  if (p <= 0) return '0';
  if (p >= 0.9999995) return 'over 99.9999%';
  if (p < 1e-3) { const inv = 1 / p; return '1 in ' + (inv < 1e7 ? Math.round(inv).toLocaleString('en-US') : sci(Math.log10(inv))); }
  return (p * 100).toFixed(p < 0.1 ? 2 : 1) + '%';
}
function fmtDur(l){
  if (l < -3) return 'under 1 millisecond';
  if (l < 0) return Math.max(1, Math.round(Math.pow(10, l) * 1000)) + ' milliseconds';
  const s = Math.pow(10, l);
  if (s < 60) return (s < 10 ? s.toFixed(1) : Math.round(s)) + ' seconds';
  if (s < 3600) return (s / 60 < 10 ? (s / 60).toFixed(1) : Math.round(s / 60)) + ' minutes';
  if (s < 86400) return (s / 3600 < 10 ? (s / 3600).toFixed(1) : Math.round(s / 3600)) + ' hours';
  if (s < SEC_YEAR) return (s / 86400 < 10 ? (s / 86400).toFixed(1) : Math.round(s / 86400)) + ' days';
  const ly = l - Math.log10(SEC_YEAR);
  if (ly < 3) { const y = Math.pow(10, ly); return (y < 10 ? y.toFixed(1) : Math.round(y).toLocaleString('en-US')) + ' years'; }
  if (ly < 6) return Math.pow(10, ly - 3).toFixed(1) + ' thousand years';
  if (ly < 9) return Math.pow(10, ly - 6).toFixed(1) + ' million years';
  if (ly < 12) return Math.pow(10, ly - 9).toFixed(1) + ' billion years';
  return sci(ly) + ' years';
}
function universeNote(l){
  const ly = l - Math.log10(SEC_YEAR), d = ly - AGE_UNIV_LOG_YR;
  if (d < -3) return '';
  if (d < 0) return (Math.pow(10, d) * 100).toFixed(d < -1 ? 2 : 0) + '% of the age of the universe';
  return d < 1 ? 'about ' + Math.pow(10, d).toFixed(1) + ' times the age of the universe' : sci(d) + ' times the age of the universe';
}
const logAvgGuesses = bits => bits < 50 ? Math.log10((Math.pow(2, bits) + 1) / 2) : (bits - 1) * LOG10_2;
const logWorstGuesses = bits => bits * LOG10_2;

/* ---------- big-integer counting ---------- */
const fact = n => { let r = 1n; for (let i = 2n; i <= BigInt(n); i++) r *= i; return r; };
const perm = (n, k) => { if (k > n) return 0n; let r = 1n; for (let i = 0; i < k; i++) r *= BigInt(n - i); return r; };
const comb = (n, k) => { if (k > n) return 0n; k = Math.min(k, n - k); let r = 1n; for (let i = 1; i <= k; i++) r = r * BigInt(n - k + i) / BigInt(i); return r; };
function atLeastOneEach(sizes, L){
  const k = sizes.length, R = sizes.reduce((a, b) => a + b, 0);
  let total = 0n;
  for (let mask = 0; mask < (1 << k); mask++){
    let sub = 0, bits = 0;
    for (let i = 0; i < k; i++) if (mask >> i & 1) { sub += sizes[i]; bits++; }
    const term = BigInt(R - sub) ** BigInt(L);
    total += bits % 2 ? -term : term;
  }
  return total;
}

/* ---------- data ---------- */
const CLASSES = [
  {id:'lower', name:'a–z', long:'lowercase letters', size:26},
  {id:'upper', name:'A–Z', long:'uppercase letters', size:26},
  {id:'digit', name:'0–9', long:'digits', size:10},
  {id:'symbol', name:'Symbols', long:'symbols and spaces', size:33},
  {id:'other', name:'Other', long:'non-ASCII characters', size:100}
];
const RATES = [
  {id:'online', name:'Online login', sub:'about 10 a second', rate:10, who:'a throttled online login'},
  {id:'kdf', name:'Slow hash, 1 GPU', sub:'about 1,000 a second', rate:1e3, who:'a single GPU cracking bcrypt or Argon2 hashes'},
  {id:'gpu', name:'SHA-256, 1 GPU', sub:'about 20 billion a second', rate:2e10, who:'a single GPU cracking SHA-256 hashes'},
  {id:'rig', name:'MD5, 8 GPUs', sub:'about 1 trillion a second', rate:1e12, who:'an eight-GPU rig cracking MD5 hashes'},
  {id:'farm', name:'Large cluster', sub:'about 1 quadrillion a second', rate:1e15, who:'a large cluster or ASIC farm'},
  {id:'custom', name:'Custom', sub:'set the rate below', rate:null, who:'your custom attacker'}
];
const HASHES = [
  {b:16, name:'16 bits'}, {b:32, name:'32 bits'}, {b:64, name:'64 bits'},
  {b:128, name:'128 bits (MD5)'}, {b:160, name:'160 bits (SHA-1)'}, {b:256, name:'256 bits (SHA-256)'}
];
const COMMON_PW = ['123456','password','12345678','qwerty','123456789','12345','1234','111111','1234567','dragon','123123','baseball','abc123','football','monkey','letmein','shadow','master','666666','qwertyuiop','123321','mustang','1234567890','michael','654321','superman','1qaz2wsx','7777777','121212','000000','qazwsx','123qwe','killer','trustno1','jordan','jennifer','zxcvbnm','asdfgh','hunter','buster','soccer','harley','batman','andrew','tigger','sunshine','iloveyou','2000','charlie','robert','thomas','hockey','ranger','daniel','starwars','112233','george','computer','michelle','jessica','pepper','1111','zxcvbn','555555','11111111','131313','freedom','777777','pass','maggie','159753','aaaaaa','ginger','princess','joshua','cheese','amanda','summer','love','ashley','nicole','chelsea','biteme','matthew','access','yankees','987654321','dallas','austin','thunder','taylor','matrix','admin','welcome','login','passw0rd','p@ssw0rd','password1','password123','qwerty123','admin123','letmein1','changeme','iloveyou1','abc12345','india123','pune123','cricket','sachin','virat','rohit','krishna','ganesh','shivaji'];
const WORDS = new Set(('love life hate dragon summer winter spring autumn monkey tiger lion eagle wolf horse fish bird football soccer cricket hockey india pune mumbai delhi sunshine princess shadow master hunter ninja killer secret angel flower cookie coffee banana orange purple silver golden mother father sister brother friend family school college student teacher engineer computer laptop mobile phone internet google apple hello welcome admin login user guest test demo root system office money happy lucky magic power super king queen prince star moon water earth storm thunder black white green yellow pink rocket batman superman spiderman ironman pokemon naruto minecraft password pass word qwerty letmein iloveyou monday tuesday friday sunday january march april june july august october november december correct horse battery staple pizza burger cheese chocolate guitar music dance game gamer player boss hacker coder python java linux android windows jordan robert michael daniel john david james mary rahul rohan amit priya neha shivaji ganesh krishna sachin virat rohit sun sky fire wind').split(' ').filter(w => w.length >= 4));
const LEET = {'@':'a','4':'a','3':'e','1':'i','!':'i','0':'o','$':'s','5':'s','7':'t','8':'b'};
const KEYROWS = ['qwertyuiop','asdfghjkl','zxcvbnm','1234567890'];
const SEG_LABEL = {common:'common password', word:'dictionary word', repeat:'repeated character', block:'repeated block', seq:'sequence', keys:'keyboard run', year:'year'};
const SEG_ART = {common:'a common password', word:'a dictionary word', repeat:'a repeated character', block:'a repeated block', seq:'a sequence', keys:'a keyboard run', year:'a year'};

/* ---------- state ---------- */
const S = {
  mode:'typed', pw:'Summer2024!', reveal:true,
  len:12, cls:{lower:true, upper:true, digit:true, symbol:false},
  rate:'gpu', custom:1e9,
  hash:64, logn:6, dict:7776, pk:5
};

/* ---------- model ---------- */
function classify(chars){
  const has = {lower:false, upper:false, digit:false, symbol:false, other:false};
  for (const c of chars){
    const cp = c.codePointAt(0);
    if (cp >= 97 && cp <= 122) has.lower = true;
    else if (cp >= 65 && cp <= 90) has.upper = true;
    else if (cp >= 48 && cp <= 57) has.digit = true;
    else if (cp >= 32 && cp <= 126) has.symbol = true;
    else has.other = true;
  }
  return has;
}
function getModel(){
  let chars = null, L, has;
  if (S.mode === 'typed'){ chars = Array.from(S.pw); L = chars.length; has = classify(chars); }
  else { L = S.len; has = Object.assign({other:false}, S.cls); }
  const active = CLASSES.filter(c => has[c.id]);
  const sizes = active.map(c => c.size);
  const R = sizes.reduce((a, b) => a + b, 0);
  return {mode:S.mode, chars, L, active, sizes, R, empty: L === 0 || R === 0};
}

/* pattern-aware entropy: cheapest segmentation into known patterns */
function patternEntropy(chars, R){
  const n = chars.length, s = chars.join(''), low = s.toLowerCase(), lg = Math.log2(R);
  const cp = chars.map(c => c.codePointAt(0));
  const isAl = c => /^[A-Za-z0-9]$/.test(c);
  const seg = (i, len) => chars.slice(i, i + len).join('');
  const norm = chars.map(c => LEET[c] || c.toLowerCase());
  const normS = norm.join('');

  let idx = COMMON_PW.indexOf(low), extra = s !== low ? 1 : 0;
  if (idx < 0){ idx = COMMON_PW.indexOf(normS); extra = 2 + (s !== low ? 1 : 0); }
  if (idx >= 0){
    const bits = Math.min(n * lg, Math.max(1, Math.log2(idx + 1)) + extra);
    return {bits, segs:[{t:'common', a:0, b:n, bits}], rank: idx + 1};
  }

  const dp = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(null);
  dp[0] = 0;
  const relax = (i, len, cost, type) => {
    if (len * lg <= cost) return;
    if (dp[i] + cost < dp[i + len]){ dp[i + len] = dp[i] + cost; prev[i + len] = {i, type, cost}; }
  };
  for (let i = 0; i < n; i++){
    if (dp[i] + lg < dp[i + 1]){ dp[i + 1] = dp[i] + lg; prev[i + 1] = {i, type:'char', cost:lg}; }
    if (i + 4 <= n && /^(19|20)\d\d$/.test(seg(i, 4))) relax(i, 4, Math.log2(120), 'year');
    let j = i; while (j < n && chars[j] === chars[i]) j++;
    for (let len = 3; len <= j - i; len++) relax(i, len, lg + Math.log2(len), 'repeat');
    for (let blk = 2; blk <= 8 && i + 2 * blk <= n; blk++){
      let reps = 1;
      while (i + (reps + 1) * blk <= n && seg(i + reps * blk, blk) === seg(i, blk)) reps++;
      for (let r = 2; r <= reps; r++) relax(i, blk * r, blk * lg + Math.log2(r), 'block');
    }
    if (i + 2 < n && isAl(chars[i]) && isAl(chars[i + 1])){
      const d = cp[i + 1] - cp[i];
      if (Math.abs(d) === 1){
        let e = i + 1;
        while (e + 1 < n && isAl(chars[e + 1]) && cp[e + 1] - cp[e] === d) e++;
        for (let len = 3; len <= e - i + 1; len++) relax(i, len, lg + Math.log2(len) + 1, 'seq');
      }
    }
    for (let len = 3; len <= Math.min(10, n - i); len++){
      const sub = seg(i, len).toLowerCase(), rev = sub.split('').reverse().join('');
      if (!KEYROWS.some(r => r.indexOf(sub) >= 0 || r.indexOf(rev) >= 0)) break;
      relax(i, len, Math.log2(40) + Math.log2(len) + 1, 'keys');
    }
    for (let len = 4; len <= Math.min(14, n - i); len++){
      const w = normS.slice(i, i + len);
      if (WORDS.has(w)){
        const raw = seg(i, len);
        relax(i, len, 13 + (raw !== raw.toLowerCase() ? 1 : 0) + (raw.toLowerCase() !== w ? 1 : 0), 'word');
      }
    }
  }
  const segs = [];
  let k = n;
  while (k > 0){
    const p = prev[k];
    const last = segs[0];
    if (p.type === 'char' && last && last.t === 'char' && last.a === k){ last.a = p.i; last.bits += p.cost; }
    else segs.unshift({t:p.type, a:p.i, b:k, bits:p.cost});
    k = p.i;
  }
  return {bits: dp[n], segs, rank: null};
}

function analyze(m){
  const bitsU = m.L * Math.log2(m.R);
  if (m.mode !== 'typed') return {bitsU, bitsE:bitsU, segs:null, rank:null};
  const r = patternEntropy(m.chars, m.R);
  return {bitsU, bitsE: Math.min(bitsU, r.bits), segs: r.segs, rank: r.rank};
}
function band(bits){
  if (bits < 28) return 'Very weak';
  if (bits < 36) return 'Weak';
  if (bits < 60) return 'Fair';
  if (bits < 80) return 'Strong';
  if (bits < 128) return 'Very strong';
  return 'Beyond what is needed';
}
function getRate(){
  const r = RATES.find(x => x.id === S.rate);
  return {id:r.id, who:r.who, name:r.name, rate: r.rate || S.custom};
}

/* ---------- rendering: hero ---------- */
function drum(ch){ return '<div class="drum">' + ch + '</div>'; }
function renderWheels(m, A){
  const MAX = 24;
  let html = '', used = 0;
  const shown = ch => S.reveal ? esc(ch) : '•';
  if (m.mode === 'typed' && !m.empty){
    for (const sg of A.segs){
      if (used >= MAX) break;
      const isPat = sg.t !== 'char';
      let inner = '';
      for (let i = sg.a; i < sg.b && used < MAX; i++, used++){
        inner += '<div class="w">' + drum(shown(m.chars[i])) + (isPat ? '' : '<div class="r">' + m.R + '</div>') + '</div>';
      }
      html += '<div class="g' + (isPat ? ' p' : '') + '"><div class="row">' + inner + '</div>' +
        (isPat ? '<div class="cap">' + SEG_LABEL[sg.t] + ', ' + Math.round(sg.bits) + (Math.round(sg.bits) === 1 ? ' bit' : ' bits') + '</div>' : '') + '</div>';
    }
    if (m.L > used) html += '<div class="more">and ' + (m.L - used) + ' more</div>';
  } else if (m.mode === 'model' && !m.empty){
    let inner = '';
    for (let i = 0; i < Math.min(m.L, MAX); i++) inner += '<div class="w">' + drum('?') + '<div class="r">' + m.R + '</div></div>';
    html = '<div class="g"><div class="row">' + inner + '</div></div>';
    if (m.L > MAX) html += '<div class="more">and ' + (m.L - MAX) + ' more</div>';
  } else {
    let inner = '';
    for (let i = 0; i < 8; i++) inner += '<div class="w">' + drum('') + '<div class="r">&nbsp;</div></div>';
    html = '<div class="g"><div class="row" style="opacity:.35">' + inner + '</div></div>';
  }
  $('wheels').innerHTML = html;
}
function renderProduct(m){
  const el = $('product');
  if (m.empty){ el.innerHTML = m.mode === 'typed' ? 'Each position is a wheel with as many faces as the alphabet has symbols.' : 'Choose at least one set of characters.'; return; }
  const N = BigInt(m.R) ** BigInt(m.L);
  const expr = m.L <= 6 ? Array(m.L).fill(m.R).join(' × ') : m.R + ' × ' + m.R + ' × … (' + m.L + ' times)';
  el.innerHTML = 'Each wheel can show any of ' + m.R + ' symbols, so the wheels together have <b>' + expr + ' = ' + fmtBig(N) + '</b> settings.';
}
function drawRuler(hasData, bitsU, bitsE){
  const x = b => 10 + Math.min(Math.max(b, 0), 160) / 160 * 600;
  const ticks = [0, 28, 36, 60, 80, 128, 160];
  const bands = [[0,28,'very weak'],[28,36,'weak'],[36,60,'fair'],[60,80,'strong'],[80,128,'very strong'],[128,160,'beyond need']];
  let g = '<line x1="10" x2="610" y1="26" y2="26" stroke="var(--ink)" stroke-width="2"/>';
  ticks.forEach(t => { g += '<line x1="' + x(t) + '" x2="' + x(t) + '" y1="26" y2="33" stroke="var(--ink)" stroke-width="1.5"/><text x="' + x(t) + '" y="46" text-anchor="middle">' + t + '</text>'; });
  bands.forEach(b => { g += '<text x="' + ((x(b[0]) + x(b[1])) / 2) + '" y="64" text-anchor="middle">' + b[2] + '</text>'; });
  if (hasData){
    g += '<circle cx="' + x(bitsU) + '" cy="26" r="5" fill="var(--bg)" stroke="var(--ink)" stroke-width="2"/>';
    const xe = x(bitsE);
    g += '<path d="M' + xe + ' 24 L' + (xe - 7) + ' 8 L' + (xe + 7) + ' 8 Z" fill="var(--brass)"/>';
  }
  $('ruler').innerHTML = g;
}
function buildObs(m, A){
  const out = [], lg = Math.log2(m.R);
  if (m.mode === 'typed'){
    A.segs.filter(s => s.t !== 'char').forEach(s => {
      const what = S.reveal ? '“' + esc(m.chars.slice(s.a, s.b).join('')) + '”' : 'Characters ' + (s.a + 1) + ' to ' + s.b;
      out.push(what + ' reads as ' + SEG_ART[s.t] + ', worth about ' + s.bits.toFixed(0) + ' bits instead of the ' + ((s.b - s.a) * lg).toFixed(0) + ' bits the same length would give as random characters.');
    });
  }
  out.push('Each extra character multiplies the search by ' + m.R + ' and adds ' + lg.toFixed(1) + ' bits.');
  const miss = ['symbol','digit','upper','lower'].map(id => CLASSES.find(c => c.id === id)).find(c => !m.active.some(a => a.id === c.id));
  if (miss) out.push('Adding ' + miss.long + ' would widen the alphabet from ' + m.R + ' to ' + (m.R + miss.size) + ' symbols, worth ' + (m.L * Math.log2((m.R + miss.size) / m.R)).toFixed(1) + ' bits at this length if they land in unpredictable places.');
  if (m.L < 12) out.push('Under 12 characters is short against offline attacks.');
  return out;
}
function renderVerdict(m, A, rt){
  const hint = $('detected');
  if (m.mode === 'typed'){
    hint.textContent = S.pw === 'Summer2024!' ? 'An example is loaded. Replace it with your own.' :
      (m.empty ? '' : 'Alphabet detected: ' + m.active.map(c => c.long).join(', ') + '. That is ' + m.R + ' symbols.');
  }
  renderWheels(m, A);
  renderProduct(m);
  drawRuler(!m.empty, m.empty ? 0 : A.bitsU, m.empty ? 0 : A.bitsE);

  if (m.empty){
    $('headline').textContent = m.mode === 'typed' ? 'Type a password above to see how it is counted.' : 'Choose at least one set of characters.';
    $('verdict-p').textContent = '';
    $('ruler-legend').innerHTML = '';
    $('obs').innerHTML = '';
    $('readout').innerHTML = '';
    $('live').textContent = 'Waiting for input';
    return;
  }
  const l10 = logAvgGuesses(A.bitsE) - Math.log10(rt.rate);
  const t = fmtDur(l10), un = universeNote(l10);
  let head;
  if (l10 < -3) head = 'Against ' + rt.who + ', it falls in under a millisecond.';
  else if (l10 - Math.log10(SEC_YEAR) > AGE_UNIV_LOG_YR) head = 'Against ' + rt.who + ', brute force needs about ' + t + ', far longer than the universe has existed.';
  else head = 'Against ' + rt.who + ', expect it to be found in about ' + t + '.';
  $('headline').innerHTML = head;

  const N = BigInt(m.R) ** BigInt(m.L);
  let p = 'As a random string, ' + m.L + ' characters from an alphabet of ' + m.R + ' allow ' + fmtBig(N) + ' passwords, which is ' + A.bitsU.toFixed(1) + ' bits of entropy.';
  if (m.mode === 'typed' && A.bitsU - A.bitsE > 0.5) p += ' This password is more predictable than that: an attacker who tries common words, years and keyboard runs first faces about ' + A.bitsE.toFixed(1) + ' bits, and the time above uses that lower figure.';
  else if (m.mode === 'model') p += ' A policy is assumed to be filled with uniformly random characters.';
  $('verdict-p').innerHTML = p;

  $('ruler-legend').innerHTML = '<span><svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px;margin-right:6px"><path d="M7 13 L0 1 L14 1 Z" fill="var(--brass)"/></svg>' + (m.mode === 'typed' ? 'As typed, ' : 'Uniform, ') + A.bitsE.toFixed(1) + ' bits</span>' +
    (m.mode === 'typed' ? '<span><svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px;margin-right:6px"><circle cx="7" cy="7" r="5" fill="none" stroke="var(--ink)" stroke-width="2"/></svg>If random, ' + A.bitsU.toFixed(1) + ' bits</span>' : '');
  $('obs').innerHTML = buildObs(m, A).map(o => '<li>' + o + '</li>').join('');

  const wl = logWorstGuesses(A.bitsE) - Math.log10(rt.rate);
  let ro = '<div><dt>Possibilities if random</dt><dd>' + fmtBig(N) + '</dd></div>' +
    '<div><dt>Entropy if random</dt><dd>' + A.bitsU.toFixed(1) + ' bits</dd></div>';
  if (m.mode === 'typed') ro += '<div><dt>Entropy as typed</dt><dd>' + A.bitsE.toFixed(1) + ' bits</dd></div>';
  ro += '<div><dt>Rating</dt><dd>' + band(A.bitsE) + '</dd></div>' +
    '<div><dt>Average guesses needed</dt><dd>' + (A.bitsE < 50 ? fmtCount((Math.pow(2, A.bitsE) + 1) / 2) : sci((A.bitsE - 1) * LOG10_2)) + '</dd></div>' +
    '<div><dt>Worst case, full sweep</dt><dd>' + fmtDur(wl) + '</dd></div>' +
    (un ? '<div><dt>Average time compared with the universe</dt><dd>' + un + '</dd></div>' : '');
  $('readout').innerHTML = ro;
  $('live').innerHTML = '<b>' + A.bitsE.toFixed(1) + ' bits</b>, ' + band(A.bitsE).toLowerCase() + '. Average time against ' + rt.who + ': <b>' + t + '</b>';
}

/* ---------- rendering: counting ---------- */
function renderCounting(m){
  const tb = $('count-table').querySelector('tbody');
  if (m.empty){ tb.innerHTML = '<tr><td colspan="3">Enter a password or choose characters to see the counts.</td></tr>'; $('pigeon-note').textContent = ''; return; }
  const R = m.R, L = m.L, rows = [];
  const add = (name, formula, val, cls) => rows.push('<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + name + '<small>' + formula + '</small></td><td class="n">' + (val === null ? 'none exist' : fmtBig(val)) + '</td><td class="n">' + (val === null || val === 0n ? '—' : log2Big(val).toFixed(1)) + '</td></tr>');
  add('Ordered, repeats allowed', R + '^' + L, BigInt(R) ** BigInt(L), 'you');
  const P = perm(R, L);
  add('Ordered, no repeats (permutation)', R + '! / (' + R + ' − ' + L + ')!', L > R ? null : P);
  add('Unordered, no repeats (combination)', 'C(' + R + ', ' + L + ')', L > R ? null : comb(R, L));
  add('Unordered, repeats allowed', 'C(' + (R + L - 1) + ', ' + L + ')', comb(R + L - 1, L));
  add('Any length from 1 to ' + L, 'sum of ' + R + '^i, i = 1 to ' + L, R === 1 ? BigInt(L) : (BigInt(R) ** BigInt(L + 1) - BigInt(R)) / BigInt(R - 1));
  if (m.active.length >= 2){
    const pol = atLeastOneEach(m.sizes, L);
    add('At least one of each class present', 'inclusion–exclusion over ' + m.active.length + ' classes', pol);
  }
  if (m.mode === 'typed'){
    const counts = new Map(); m.chars.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
    let d = 1n; counts.forEach(v => { d *= fact(v); });
    add('Rearrangements of these exact characters', L + '! / product of repeat counts!', fact(L) / d);
  }
  tb.innerHTML = rows.join('');
  let note = 'Pigeonhole check: ';
  if (L > R) note += 'with ' + L + ' positions and only ' + R + ' symbols, every string must repeat a symbol, so no repeat-free password of this length exists.';
  else {
    const N = BigInt(R) ** BigInt(L);
    note += 'these ' + fmtBig(N) + ' possibilities are the pigeonholes. Any group of more than that many accounts, each with a password of this shape, must contain two identical passwords.';
  }
  $('pigeon-note').innerHTML = note;
}

/* ---------- charts ---------- */
function setSvg(id, inner){ $(id).innerHTML = inner; }
function drawTime(m, A, rt){
  const W = 640, H = 310, ml = 62, mr = 56, mt = 12, mb = 32, ymin = -3, ymax = 30;
  const xmax = (!m.empty && m.L > 34) ? m.L + 6 : 40;
  const X = l => ml + (l - 1) / (xmax - 1) * (W - ml - mr);
  const Y = v => mt + (ymax - Math.max(ymin, v)) / (ymax - ymin) * (H - mt - mb);
  const lr = Math.log10(rt.rate);
  const val = (r, l) => logAvgGuesses(l * Math.log2(r)) - lr;
  let g = '<defs><clipPath id="clipA"><rect x="' + ml + '" y="' + mt + '" width="' + (W - ml - mr) + '" height="' + (H - mt - mb) + '"/></clipPath></defs>';
  for (let l = 5; l <= xmax; l += 5) g += '<line x1="' + X(l) + '" x2="' + X(l) + '" y1="' + mt + '" y2="' + (H - mb) + '" stroke="var(--rule)" stroke-width="1"/><text x="' + X(l) + '" y="' + (H - 12) + '" text-anchor="middle">' + l + '</text>';
  g += '<text x="' + ml + '" y="' + (H - 12) + '" text-anchor="middle">1</text><text x="' + (W - mr) + '" y="' + (H - 1) + '" text-anchor="end">characters</text>';
  [[0,'1 second'],[3.556,'1 hour'],[7.499,'1 year'],[9.499,'100 years'],[17.64,'age of universe']].forEach(r => {
    g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(r[0]) + '" y2="' + Y(r[0]) + '" stroke="var(--mute)" stroke-width="1" stroke-dasharray="3 4"/><text x="' + (ml - 6) + '" y="' + (Y(r[0]) + 4) + '" text-anchor="end">' + r[1] + '</text>';
  });
  const sets = [{r:10, t:'digits'}, {r:26, t:'a–z'}, {r:62, t:'letters and digits'}, {r:95, t:'all printable'}];
  const own = (!m.empty && !sets.some(s => s.r === m.R)) ? {r:m.R, t:'your alphabet'} : null;
  const draw = (s, mine) => {
    let d = '', exit = null;
    for (let l = 1; l <= xmax; l++){
      const v = val(s.r, l);
      if (exit === null && v >= ymax) exit = l;
      d += (l === 1 ? 'M' : 'L') + X(l).toFixed(1) + ' ' + Y(v).toFixed(1) + ' ';
    }
    const col = mine ? 'var(--brass)' : 'var(--ink)';
    g += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (mine ? 3.5 : 1.5) + '" ' + (mine ? '' : 'opacity=".55" ') + 'clip-path="url(#clipA)"/>';
    const lab = 'R = ' + s.r;
    if (exit !== null) g += '<text x="' + (X(exit) - 4) + '" y="' + (mt + 12) + '" text-anchor="end" style="fill:' + col + '">' + lab + '</text>';
    else g += '<text x="' + (X(xmax) + 5) + '" y="' + (Y(val(s.r, xmax)) + 4) + '" style="fill:' + col + '">' + lab + '</text>';
  };
  sets.forEach(s => draw(s, !m.empty && s.r === m.R));
  if (own) draw(own, true);
  if (!m.empty){
    const v = logAvgGuesses(A.bitsU) - lr;
    const cx = X(Math.min(m.L, xmax));
    if (v <= ymax) g += '<circle cx="' + cx + '" cy="' + Y(v) + '" r="6" fill="var(--bg)" stroke="var(--brass)" stroke-width="3"/>';
    else g += '<path d="M' + cx + ' ' + (mt + 2) + ' l-6 10 h12 Z" fill="var(--brass)"/>';
  }
  setSvg('time-chart', g);
  $('time-key').innerHTML = '<span><i style="border-color:var(--brass)"></i>Your alphabet' + (m.empty ? '' : ' (R = ' + m.R + ')') + '</span><span><i style="border-color:var(--ink);opacity:.55"></i>Other alphabets</span><span>Vertical axis is time on a log scale, for ' + esc(rt.who) + '.</span>';
}
function renderTimeTable(m, A, rt){
  $('th-typed').hidden = m.mode !== 'typed';
  const rows = RATES.filter(r => r.id !== 'custom' || S.rate === 'custom').map(r => {
    const rate = r.rate || S.custom;
    const cell = bits => m.empty ? '—' : fmtDur(logAvgGuesses(bits) - Math.log10(rate));
    return '<tr' + (r.id === S.rate ? ' class="sel"' : '') + '><td>' + r.name + '<small>' + (r.rate ? r.sub : sci(Math.log10(rate)) + ' a second') + '</small></td><td class="n">' + cell(m.empty ? 0 : A.bitsU) + '</td>' +
      (m.mode === 'typed' ? '<td class="n">' + cell(m.empty ? 0 : A.bitsE) + '</td>' : '') + '</tr>';
  });
  $('time-table').querySelector('tbody').innerHTML = rows.join('');
}

/* birthday probability from log10(n) and bits */
function pCollide(logn, bits){
  const nn = Math.pow(10, logn);
  let lnPairs;
  if (logn > 12) lnPairs = 2 * logn * LN10 - LN2;
  else { const n = Math.round(nn); if (n < 2) return 0; lnPairs = Math.log(n * (n - 1) / 2); }
  const lnx = lnPairs - bits * LN2;
  if (lnx < -745) return 0;
  return -Math.expm1(-Math.exp(lnx));
}
const logNforP = (bits, p) => 0.5 * (Math.log10(2) + bits * LOG10_2 + Math.log10(-Math.log1p(-p)));
const nRow = (b, p) => { const l = logNforP(b, p); return l < 0 ? 'before the second input' : fmtN(l) + ' inputs'; };
const fmtN = logn => logn <= 12 ? Math.round(Math.pow(10, logn)).toLocaleString('en-US') : sci(logn);

function drawBirthday(){
  const W = 640, H = 300, ml = 46, mr = 14, mt = 12, mb = 34, xmax = 80;
  const X = t => ml + t / xmax * (W - ml - mr), Y = p => mt + (1 - p) * (H - mt - mb);
  let g = '';
  for (let t = 0; t <= xmax; t += 10) g += '<line x1="' + X(t) + '" x2="' + X(t) + '" y1="' + mt + '" y2="' + (H - mb) + '" stroke="var(--rule)"/><text x="' + X(t) + '" y="' + (H - 16) + '" text-anchor="middle">10<tspan dy="-5" font-size="8">' + t + '</tspan></text>';
  [0, .5, 1].forEach(p => { g += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="var(--rule)"/><text x="' + (ml - 6) + '" y="' + (Y(p) + 4) + '" text-anchor="end">' + (p * 100) + '%</text>'; });
  g += '<text x="' + (W - mr) + '" y="' + (H - 1) + '" text-anchor="end">inputs hashed</text>';
  HASHES.forEach(h => {
    const mine = h.b === S.hash;
    let d = '';
    for (let t = 0; t <= xmax; t += 0.2) d += (t === 0 ? 'M' : 'L') + X(t).toFixed(1) + ' ' + Y(pCollide(t, h.b)).toFixed(1) + ' ';
    g += '<path d="' + d + '" fill="none" stroke="' + (mine ? 'var(--brass)' : 'var(--ink)') + '" stroke-width="' + (mine ? 3.5 : 1.4) + '"' + (mine ? '' : ' opacity=".5"') + '/>';
    const t50 = logNforP(h.b, 0.5);
    g += '<text x="' + (X(t50) + 5) + '" y="' + (Y(0.5) + 15) + '" style="fill:' + (mine ? 'var(--brass)' : 'var(--mute)') + '">' + h.b + '</text>';
  });
  const tp = S.hash * LOG10_2;
  if (tp <= xmax) g += '<line x1="' + X(tp) + '" x2="' + X(tp) + '" y1="' + mt + '" y2="' + (H - mb) + '" stroke="var(--brass)" stroke-width="2" stroke-dasharray="5 4"/><text x="' + (X(tp) - 5) + '" y="' + (mt + 12) + '" text-anchor="end" style="fill:var(--brass)">collision guaranteed</text>';
  g += '<circle cx="' + X(S.logn) + '" cy="' + Y(pCollide(S.logn, S.hash)) + '" r="6" fill="var(--bg)" stroke="var(--ink)" stroke-width="3"/>';
  setSvg('birthday-chart', g);
  $('bday-key').innerHTML = '<span><i style="border-color:var(--brass)"></i>Selected hash size</span><span><i style="border-color:var(--ink);opacity:.5"></i>Other sizes, labelled in bits</span>';
}
function renderCollide(m, A){
  const b = S.hash;
  document.querySelectorAll('#hash-seg button').forEach(x => x.setAttribute('aria-pressed', +x.dataset.b === b));
  $('logn-out').innerHTML = fmtN(S.logn);
  const p = pCollide(S.logn, b);
  $('hash-facts').innerHTML =
    '<div><dt>Chance that two of your ' + fmtN(S.logn) + ' inputs collide</dt><dd>' + fmtProb(p) + '</dd></div>' +
    '<div><dt>Slots available</dt><dd>2<sup>' + b + '</sup> = ' + sci(b * LOG10_2) + '</dd></div>' +
    '<div><dt>Collision guaranteed by pigeonhole after</dt><dd>' + sci(b * LOG10_2) + ' inputs (2<sup>' + b + '</sup> + 1)</dd></div>' +
    '<div><dt>One in a billion chance at</dt><dd>' + nRow(b, 1e-9) + '</dd></div>' +
    '<div><dt>Even odds at</dt><dd>' + nRow(b, 0.5) + '</dd></div>' +
    '<div><dt>Near certainty (99%) at</dt><dd>' + nRow(b, 0.99) + '</dd></div>';
  drawBirthday();

  if (m.empty){
    $('space-note').textContent = 'Enter a password or choose a policy to see how likely two users are to share one.';
    $('space-facts').innerHTML = '';
  } else {
    const bits = A.bitsU;
    $('space-note').innerHTML = 'If every user picked a password uniformly at random from your ' + fmtBig(BigInt(m.R) ** BigInt(m.L)) + '-password space, the same birthday arithmetic applies. Real people choose far less evenly, so shared passwords appear much sooner than this.';
    $('space-facts').innerHTML =
      '<div><dt>Users for a 50% chance that two share a password</dt><dd>' + fmtN(logNforP(bits, 0.5)) + '</dd></div>' +
      '<div><dt>Chance that two of your ' + fmtN(S.logn) + ' users share one</dt><dd>' + fmtProb(pCollide(S.logn, bits)) + '</dd></div>' +
      '<div><dt>Users that guarantee a shared password</dt><dd>' + fmtBig(BigInt(m.R) ** BigInt(m.L) + 1n) + '</dd></div>';
  }
}

/* ---------- passphrases ---------- */
function renderPhrase(m, rt){
  const D = Math.max(2, Math.min(1e6, Math.floor(S.dict) || 2)), k = S.pk;
  $('pk-out').textContent = k;
  const ordered = BigInt(D) ** BigInt(k), unordered = comb(D + k - 1, k);
  const bits = k * Math.log2(D);
  const eq = Math.ceil(bits / Math.log2(95));
  const l10 = logAvgGuesses(bits) - Math.log10(rt.rate);
  $('phrase-facts').innerHTML =
    '<div><dt>Ordered, words may repeat: ' + D + '<sup>' + k + '</sup></dt><dd>' + fmtBig(ordered) + ' (' + bits.toFixed(1) + ' bits)</dd></div>' +
    '<div><dt>If word order did not matter: C(' + (D + k - 1) + ', ' + k + ')</dt><dd>' + fmtBig(unordered) + ' (' + log2Big(unordered).toFixed(1) + ' bits)</dd></div>' +
    '<div><dt>Strength that order adds</dt><dd>' + (bits - log2Big(unordered)).toFixed(1) + ' bits</dd></div>' +
    '<div><dt>Equal to random printable characters</dt><dd>' + eq + ' characters (95 symbols each)</dd></div>' +
    '<div><dt>Average time against ' + esc(rt.who) + '</dt><dd>' + fmtDur(l10) + '</dd></div>';
}

/* ---------- policy table ---------- */
function renderRef(m, A, rt){
  const lr = Math.log10(rt.rate);
  const rows = [];
  if (!m.empty) rows.push({name:'Your input', bits:A.bitsE, l10N:A.bitsE * LOG10_2, you:true});
  [['4-digit PIN',10,4],['6-digit PIN',10,6],['8 lowercase letters',26,8],['8 letters and digits',62,8],['8 printable characters',95,8],['12 printable characters',95,12],['16 printable characters',95,16],['20 lowercase letters',26,20]].forEach(r => rows.push({name:r[0], bits:r[2] * Math.log2(r[1]), l10N:r[2] * Math.log10(r[1])}));
  [[4,7776],[6,7776],[8,7776]].forEach(r => rows.push({name:r[0] + ' random words (7,776-word list)', bits:r[0] * Math.log2(r[1]), l10N:r[0] * Math.log10(r[1])}));
  $('ref-table').querySelector('tbody').innerHTML = rows.map(r =>
    '<tr' + (r.you ? ' class="you sel"' : '') + '><td>' + r.name + '</td><td><span class="bar-mini"><i style="width:' + Math.min(100, r.bits / 160 * 100) + '%"></i></span>' + r.bits.toFixed(1) + ' bits</td><td class="n">' + sci(r.l10N) + '</td><td class="n">' + fmtDur(logAvgGuesses(r.bits) - lr) + '</td><td>' + band(r.bits) + '</td></tr>').join('');
}

/* ---------- summary ---------- */
function plain(html){ return html.replace(/<sup>/g, '^').replace(/<\/sup>/g, '').replace(/&lt;/g, '<'); }
function renderReport(m, A, rt){
  const ta = $('report');
  if (m.empty){ ta.value = 'Nothing to report yet.'; return; }
  const N = BigInt(m.R) ** BigInt(m.L);
  const lines = [
    'Keyspace summary',
    'Length: ' + m.L + ' characters',
    'Alphabet: ' + m.active.map(c => c.long).join(', ') + ' (R = ' + m.R + ')',
    'Possibilities, R^L: ' + plain(fmtBig(N)),
    'Entropy if random: ' + A.bitsU.toFixed(1) + ' bits'
  ];
  if (m.mode === 'typed') lines.push('Entropy as typed (pattern-aware): ' + A.bitsE.toFixed(1) + ' bits');
  lines.push('Rating: ' + band(A.bitsE), '', 'Average time to find it (' + rt.who + '): ' + plain(fmtDur(logAvgGuesses(A.bitsE) - Math.log10(rt.rate))), '', 'Average time by attacker:');
  RATES.filter(r => r.rate).forEach(r => lines.push('  ' + r.name + ' (' + r.sub + '): ' + plain(fmtDur(logAvgGuesses(A.bitsE) - Math.log10(r.rate)))));
  lines.push('', 'Hash collision (' + S.hash + '-bit hash): 50% chance at ' + plain(fmtN(logNforP(S.hash, 0.5))) + ' inputs; guaranteed at 2^' + S.hash + ' + 1.');
  ta.value = lines.join('\n');
}

/* ---------- lab: toy hash ---------- */
const lab = {bits:6, counts:null, n:0, first:0, timer:null};
function fnv(str, bits){
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) & ((1 << bits) - 1);
}
function randPw(){ let s = ''; for (let i = 0; i < 8; i++) s += String.fromCharCode(97 + Math.floor(Math.random() * 26)); return s; }
function labStop(){ if (lab.timer){ clearInterval(lab.timer); lab.timer = null; } $('lab-run').disabled = false; }
function labReset(){
  labStop();
  lab.bits = +$('lab-bits').value; const M = 1 << lab.bits;
  $('lab-bits-out').textContent = M;
  lab.counts = new Uint16Array(M); lab.n = 0; lab.first = 0;
  const cols = Math.pow(2, Math.ceil(lab.bits / 2)), size = Math.max(9, Math.min(30, Math.floor(340 / cols)));
  const c = $('cells'); c.style.gridTemplateColumns = 'repeat(' + cols + ',' + size + 'px)';
  c.innerHTML = new Array(M + 1).join('<i></i>');
  $('lab-status').textContent = 'Every bucket is empty. Hash a password to begin.';
  $('lab-hist').innerHTML = ''; $('lab-stats').textContent = '';
}
function labStep(){
  const M = 1 << lab.bits, pw = randPw(), h = fnv(pw, lab.bits);
  lab.n++;
  lab.counts[h]++;
  const cell = $('cells').children[h];
  if (lab.counts[h] > 1){ cell.className = 'c'; if (!lab.first) lab.first = lab.n; } else cell.className = 'f';
  let msg = 'Input ' + lab.n + ': “' + pw + '” went to bucket ' + h + '. ';
  msg += lab.first ? 'The first collision came at input ' + lab.first + '.' : 'No collision yet.';
  msg += ' The pigeonhole principle guarantees one by input ' + (M + 1) + '.';
  $('lab-status').textContent = msg;
  return !!lab.first;
}
function labRun(){
  if (lab.timer) return;
  if (lab.first) labReset();
  $('lab-run').disabled = true;
  lab.timer = setInterval(() => { if (labStep()) labStop(); }, 45);
}
function labTrials(){
  labStop();
  const bits = lab.bits, M = 1 << bits, T = 2000, res = [];
  let sum = 0, max = 0;
  for (let t = 0; t < T; t++){
    const seen = new Set(); let k = 0;
    for (;;){ const h = fnv(randPw(), bits); k++; if (seen.has(h)) break; seen.add(h); }
    res.push(k); sum += k; if (k > max) max = k;
  }
  const q = [1]; let E = 1;
  for (let k = 1; k <= M; k++){ q[k] = q[k - 1] * (1 - (k - 1) / M); E += q[k]; }
  const kmax = max + 1, hist = new Array(kmax + 1).fill(0);
  res.forEach(k => hist[k]++);
  const pmf = k => k < 2 ? 0 : q[k - 1] * (k - 1) / M;
  let top = 0; for (let k = 2; k <= kmax; k++) top = Math.max(top, hist[k], pmf(k) * T);
  const W = 520, H = 200, ml = 8, mr = 8, mt = 8, mb = 26, bw = (W - ml - mr) / (kmax - 1);
  let g = '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + (H - mb) + '" y2="' + (H - mb) + '" stroke="var(--ink)" stroke-width="1.5"/>';
  let line = '';
  for (let k = 2; k <= kmax; k++){
    const x = ml + (k - 2) * bw, h = hist[k] / top * (H - mt - mb);
    g += '<rect x="' + x.toFixed(1) + '" y="' + (H - mb - h).toFixed(1) + '" width="' + Math.max(1, bw - 1).toFixed(1) + '" height="' + h.toFixed(1) + '" fill="var(--ink)" opacity=".4"/>';
    line += (k === 2 ? 'M' : 'L') + (x + bw / 2).toFixed(1) + ' ' + (H - mb - pmf(k) * T / top * (H - mt - mb)).toFixed(1) + ' ';
  }
  g += '<path d="' + line + '" fill="none" stroke="var(--brass)" stroke-width="2.5"/>';
  g += '<text x="' + ml + '" y="' + (H - 8) + '">2</text><text x="' + (W - mr) + '" y="' + (H - 8) + '" text-anchor="end">' + kmax + ' inputs to the first collision</text>';
  $('lab-hist').innerHTML = g;
  $('lab-stats').innerHTML = 'Over ' + T.toLocaleString('en-US') + ' runs with ' + M + ' buckets, the first collision came after ' + (sum / T).toFixed(1) + ' inputs on average. The formula predicts ' + E.toFixed(1) + '. The latest run was ' + max + ', well inside the pigeonhole limit of ' + (M + 1) + '. Bars are runs, the brass line is the prediction.';
}

/* ---------- controls ---------- */
function buildStatic(){
  $('chips').innerHTML = CLASSES.filter(c => c.id !== 'other').map(c => '<button type="button" class="chip" data-c="' + c.id + '" aria-pressed="' + S.cls[c.id] + '">' + c.name + '<small>' + c.size + '</small></button>').join('');
  $('hash-seg').innerHTML = HASHES.map(h => '<button type="button" data-b="' + h.b + '" aria-pressed="' + (h.b === S.hash) + '">' + h.name + '</button>').join('');
  $('att-list').innerHTML = RATES.map(r => '<button type="button" class="att" data-r="' + r.id + '" aria-pressed="' + (r.id === S.rate) + '">' + r.name + '<span>' + r.sub + '</span></button>').join('');
}
function syncControls(){
  const typed = S.mode === 'typed';
  $('m-typed').setAttribute('aria-pressed', typed); $('m-model').setAttribute('aria-pressed', !typed);
  $('typed-box').hidden = !typed; $('model-box').hidden = typed;
  document.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', S.cls[b.dataset.c]));
  document.querySelectorAll('.att').forEach(b => b.setAttribute('aria-pressed', b.dataset.r === S.rate));
  $('custom-rate').hidden = S.rate !== 'custom';
  $('reveal').textContent = S.reveal ? 'Hide' : 'Show';
  $('pw').type = S.reveal ? 'text' : 'password';
  $('len-out').textContent = S.len;
}
function render(){
  syncControls();
  const m = getModel(), rt = getRate();
  const A = m.empty ? null : analyze(m);
  renderVerdict(m, A, rt);
  renderCounting(m);
  drawTime(m, A, rt);
  renderTimeTable(m, A, rt);
  renderCollide(m, A);
  renderPhrase(m, rt);
  renderRef(m, A, rt);
  renderReport(m, A, rt);
}
function bind(){
  $('m-typed').onclick = () => { S.mode = 'typed'; render(); };
  $('m-model').onclick = () => { S.mode = 'model'; render(); };
  $('pw').addEventListener('input', e => { S.pw = e.target.value; render(); });
  $('reveal').onclick = () => { S.reveal = !S.reveal; render(); };
  $('len').addEventListener('input', e => { S.len = +e.target.value; render(); });
  $('chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; S.cls[b.dataset.c] = !S.cls[b.dataset.c]; render(); });
  $('att-list').addEventListener('click', e => { const b = e.target.closest('.att'); if (!b) return; S.rate = b.dataset.r; render(); });
  $('rate-in').addEventListener('input', e => { const v = parseFloat(e.target.value); if (v > 0 && isFinite(v)) { S.custom = v; render(); } });
  $('hash-seg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.hash = +b.dataset.b; render(); });
  $('logn').addEventListener('input', e => { S.logn = +e.target.value; render(); });
  $('dict').addEventListener('input', e => { S.dict = +e.target.value; render(); });
  $('pk').addEventListener('input', e => { S.pk = +e.target.value; render(); });
  $('lab-bits').addEventListener('input', labReset);
  $('lab-one').onclick = () => { if (lab.first && lab.n >= (1 << lab.bits) + 1) labReset(); labStep(); };
  $('lab-run').onclick = labRun;
  $('lab-reset').onclick = labReset;
  $('lab-trials').onclick = labTrials;
  $('copy').onclick = () => {
    const ta = $('report'), msg = $('copy-msg');
    const done = ok => { msg.textContent = ok ? 'Copied.' : 'Copy was blocked here. Select the text and copy it by hand.'; };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => done(true), () => done(false));
      else { ta.select(); done(document.execCommand('copy')); }
    } catch (err) { done(false); }
  };
  $('theme').onclick = () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    $('theme').textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
    try { localStorage.setItem('keyspace-theme', next); } catch (err) {}
  };
}
(function initTheme(){
  let t = null;
  try { t = localStorage.getItem('keyspace-theme'); } catch (err) {}
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t;
  const dark = t ? t === 'dark' : (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  $('theme').textContent = dark ? 'Light mode' : 'Dark mode';
})();

buildStatic();
bind();
render();
labReset();
})();
