'use strict';

/* ---------- Finanza: stesse formule del foglio Excel ---------- */

function pmt(rateMonthly, n, pv) {
  if (n <= 0) return 0;
  if (rateMonthly === 0) return pv / n;
  return (pv * rateMonthly) / (1 - Math.pow(1 + rateMonthly, -n));
}

function amortize(capitale, tanAnnuo, durataMesi) {
  const r = tanAnnuo / 12;
  const rata = pmt(r, durataMesi, capitale);
  let residuo = capitale;
  let totInteressi = 0;
  const schedule = [];
  for (let m = 1; m <= durataMesi; m++) {
    const interessi = residuo * r;
    const quotaCapitale = rata - interessi;
    residuo = Math.max(0, residuo - quotaCapitale);
    totInteressi += interessi;
    schedule.push({ mese: m, rata, interessi, quotaCapitale, residuo });
  }
  return { rata, totInteressi, totRimborsato: rata * durataMesi, schedule };
}

function costiTotali(costi) {
  return (costi.istruttoria || 0) + (costi.perizia || 0) + (costi.notaio || 0) +
         (costi.penale || 0) + (costi.altri || 0);
}

/* ---------- Stato + persistenza ---------- */

const DEFAULT_STATE = {
  attuale: { capitale: 15000, tan: 8, durata: 48 },
  a: { capitale: 15000, tan: 6, durata: 48,
       costi: { istruttoria: 200, perizia: 150, notaio: 0, penale: 100, altri: 0 } },
  b: { capitale: 15000, tan: 5, durata: 60,
       costi: { istruttoria: 250, perizia: 200, notaio: 0, penale: 100, altri: 50 } },
  c: { capitale: 15000, tan: 5.5, durata: 48,
       costi: { istruttoria: 0, perizia: 0, notaio: 0, penale: 100, altri: 0 } },
};

const STORAGE_KEY = 'prestito-pwa-state-v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...parsed };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* ---------- Formattazione ---------- */

const fmtEUR = (n) => (isFinite(n) ? n : 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtPct = (n) => `${n.toFixed(2)}%`;
const fmtNum = (n, d = 1) => (isFinite(n) ? n.toFixed(d) : '—');

/* ---------- Rendering ---------- */

const LOAN_META = {
  attuale: { title: 'Prestito Attuale', isScenario: false },
  a: { title: 'Scenario A — Rinegoziazione', isScenario: true },
  b: { title: 'Scenario B — Surroga altra banca', isScenario: true },
  c: { title: 'Scenario C — Surroga altra banca', isScenario: true },
};

function computeLoan(key) {
  const d = state[key];
  const res = amortize(d.capitale, d.tan / 100, d.durata);
  const costi = d.costi ? costiTotali(d.costi) : 0;
  return { ...res, costi, costoTotale: res.totInteressi + costi };
}

function renderLoanPanel(key) {
  const meta = LOAN_META[key];
  const d = state[key];
  const calc = computeLoan(key);

  let costiHtml = '';
  if (meta.isScenario) {
    const c = d.costi;
    costiHtml = `
      <h3>Costi una tantum di rinegoziazione/surroga</h3>
      ${fieldNumber(key, 'costi.istruttoria', 'Istruttoria pratica (€)', c.istruttoria)}
      ${fieldNumber(key, 'costi.perizia', 'Perizia (€)', c.perizia)}
      ${fieldNumber(key, 'costi.notaio', 'Spese notarili (€)', c.notaio)}
      ${fieldNumber(key, 'costi.penale', 'Penale estinzione anticipata (€)', c.penale)}
      ${fieldNumber(key, 'costi.altri', 'Altri costi (€)', c.altri)}
      <div class="result-row"><span>Totale costi una tantum</span><span class="val">${fmtEUR(calc.costi)}</span></div>
    `;
  }

  const rows = calc.schedule.map(r => `
    <tr>
      <td>${r.mese}</td>
      <td>${fmtEUR(r.rata)}</td>
      <td>${fmtEUR(r.interessi)}</td>
      <td>${fmtEUR(r.quotaCapitale)}</td>
      <td>${fmtEUR(r.residuo)}</td>
    </tr>`).join('');

  return `
    <div class="card">
      <h2>${meta.title}</h2>
      ${fieldNumber(key, 'capitale', 'Capitale da finanziare (€)', d.capitale)}
      ${fieldNumber(key, 'tan', 'Tasso annuo TAN (%)', d.tan, 0.01)}
      ${fieldNumber(key, 'durata', 'Durata (mesi)', d.durata, 1)}
      ${costiHtml}
    </div>

    <div class="card">
      <h2>Risultati</h2>
      <div class="stat-grid">
        <div class="stat"><div class="label">Rata mensile</div><div class="value">${fmtEUR(calc.rata)}</div></div>
        <div class="stat"><div class="label">Totale interessi</div><div class="value">${fmtEUR(calc.totInteressi)}</div></div>
        <div class="stat"><div class="label">Totale rimborsato</div><div class="value">${fmtEUR(calc.totRimborsato)}</div></div>
        <div class="stat"><div class="label">Costo totale operazione</div><div class="value">${fmtEUR(calc.costoTotale)}</div></div>
      </div>
    </div>

    <div class="card">
      <details>
        <summary>Mostra piano di ammortamento (${d.durata} mesi)</summary>
        <div class="table-scroll" style="margin-top:10px;">
          <table class="amort">
            <thead><tr><th>Mese</th><th>Rata</th><th>Interessi</th><th>Capitale</th><th>Residuo</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </details>
    </div>
  `;
}

function fieldNumber(key, path, label, value, step = 1) {
  const id = `f-${key}-${path}`;
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <input id="${id}" type="number" inputmode="decimal" step="${step}"
             value="${value}" data-key="${key}" data-path="${path}">
    </div>`;
}

function renderConfronto() {
  const keys = ['attuale', 'a', 'b', 'c'];
  const calcs = Object.fromEntries(keys.map(k => [k, computeLoan(k)]));
  const rataAttuale = calcs.attuale.rata;
  const intAttuale = calcs.attuale.totInteressi;

  const rows = [
    ['Capitale', k => fmtEUR(state[k].capitale)],
    ['Tasso TAN', k => fmtPct(state[k].tan)],
    ['Durata (mesi)', k => state[k].durata],
    ['Rata mensile', k => fmtEUR(calcs[k].rata)],
    ['Risparmio rata vs attuale', k => k === 'attuale' ? '—' : fmtEUR(rataAttuale - calcs[k].rata)],
    ['Totale interessi', k => fmtEUR(calcs[k].totInteressi)],
    ['Costi una tantum', k => k === 'attuale' ? '—' : fmtEUR(calcs[k].costi)],
    ['Costo totale operazione', k => fmtEUR(calcs[k].costoTotale)],
    ['Risparmio netto totale', k => k === 'attuale' ? '—' : fmtEUR((intAttuale - calcs[k].totInteressi) - calcs[k].costi)],
    ['Break-even (mesi)', k => {
      if (k === 'attuale') return '—';
      const rispRata = rataAttuale - calcs[k].rata;
      if (rispRata <= 0) return 'mai (rata non conveniente)';
      return fmtNum(calcs[k].costi / rispRata);
    }],
  ];

  const labels = { attuale: 'Attuale', a: 'Scenario A', b: 'Scenario B', c: 'Scenario C' };

  const headerCells = keys.map(k => `<th>${labels[k]}</th>`).join('');
  const bodyRows = rows.map(([label, fn]) =>
    `<tr><td>${label}</td>${keys.map(k => `<td>${fn(k)}</td>`).join('')}</tr>`
  ).join('');

  const verdictCells = keys.map(k => {
    if (k === 'attuale') return '<td>—</td>';
    const netto = (intAttuale - calcs[k].totInteressi) - calcs[k].costi;
    const good = netto > 0;
    return `<td><span class="badge ${good ? 'good' : 'bad'}">${good ? 'SÌ' : 'NO'}</span></td>`;
  }).join('');

  return `
    <div class="card">
      <h2>Confronto</h2>
      <div class="compare-scroll">
        <table class="compare-table">
          <thead><tr><th>Voce</th>${headerCells}</tr></thead>
          <tbody>${bodyRows}
            <tr><td><strong>Conviene rinegoziare?</strong></td>${verdictCells}</tr>
          </tbody>
        </table>
      </div>
      <p class="note">Il "Risparmio netto totale" confronta l'intero costo residuo (interessi + costi una tantum).
      Il "Break-even" indica dopo quanti mesi il risparmio sulla rata copre i costi di rinegoziazione: se prevedi di
      ripagare o vendere prima di quel punto, l'operazione potrebbe non convenire anche con un tasso più basso.</p>
    </div>

    <div class="card">
      <h2>Costo totale operazione a confronto</h2>
      <canvas id="chart" width="640" height="220"></canvas>
    </div>
  `;
}

function drawChart(calcs) {
  const canvas = document.getElementById('chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 640;
  const cssH = 220;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue('--text-dim').trim() || '#666';
  const barColors = ['#8a97a6', '#2e75b6', '#5b9bd5', '#7fb3e8'];
  const labels = ['Attuale', 'Scenario A', 'Scenario B', 'Scenario C'];
  const values = ['attuale', 'a', 'b', 'c'].map(k => calcs[k].costoTotale);
  const maxVal = Math.max(...values, 1);

  const padLeft = 8, padRight = 8, padBottom = 28, padTop = 10;
  const chartW = cssW - padLeft - padRight;
  const chartH = cssH - padTop - padBottom;
  const barW = chartW / values.length * 0.55;
  const gap = chartW / values.length;

  values.forEach((v, i) => {
    const h = (v / maxVal) * chartH;
    const x = padLeft + i * gap + (gap - barW) / 2;
    const y = padTop + (chartH - h);
    ctx.fillStyle = barColors[i % barColors.length];
    ctx.beginPath();
    const r = 6;
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.lineTo(x + barW - r, y);
    ctx.arcTo(x + barW, y, x + barW, y + r, r);
    ctx.lineTo(x + barW, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = textColor;
    ctx.font = '11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW / 2, cssH - 10);
    ctx.fillText(fmtEUR(v).replace(' ', ' '), x + barW / 2, y - 6 < 12 ? y + 12 : y - 6);
  });
}

/* ---------- App shell / tabs ---------- */

const TABS = ['attuale', 'a', 'b', 'c', 'confronto'];

function renderPanel(tab) {
  if (tab === 'confronto') return renderConfronto();
  return renderLoanPanel(tab);
}

function renderAll() {
  const app = document.getElementById('app');
  app.innerHTML = TABS.map(tab =>
    `<div class="panel ${tab === activeTab ? 'active' : ''}" data-panel="${tab}">${renderPanel(tab)}</div>`
  ).join('');
  attachFieldListeners();
  if (activeTab === 'confronto') {
    const calcs = Object.fromEntries(['attuale', 'a', 'b', 'c'].map(k => [k, computeLoan(k)]));
    drawChart(calcs);
  }
}

function attachFieldListeners() {
  document.querySelectorAll('input[data-key]').forEach(input => {
    input.addEventListener('input', (e) => {
      const key = e.target.dataset.key;
      const path = e.target.dataset.path;
      const value = parseFloat(e.target.value);
      const num = isNaN(value) ? 0 : value;
      if (path.startsWith('costi.')) {
        const sub = path.split('.')[1];
        state[key].costi[sub] = num;
      } else {
        state[key][path] = num;
      }
      saveState();
      renderResultsOnly(key);
    });
  });
}

// Aggiorna solo i risultati del pannello attivo, senza ridisegnare gli input (mantiene il focus)
function renderResultsOnly(key) {
  if (activeTab === 'confronto') {
    const panel = document.querySelector('.panel[data-panel="confronto"]');
    if (panel) panel.innerHTML = renderConfronto();
    const calcs = Object.fromEntries(['attuale', 'a', 'b', 'c'].map(k => [k, computeLoan(k)]));
    drawChart(calcs);
    return;
  }
  if (key !== activeTab) return;
  const panel = document.querySelector(`.panel[data-panel="${key}"]`);
  if (!panel) return;
  const focusedId = document.activeElement && document.activeElement.id;
  const selStart = document.activeElement && document.activeElement.selectionStart;
  panel.innerHTML = renderPanel(key);
  attachFieldListeners();
  if (focusedId) {
    const el = document.getElementById(focusedId);
    if (el) {
      el.focus();
      if (selStart != null && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selStart); } catch {}
      }
    }
  }
}

let activeTab = 'attuale';

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
    });
    renderAll();
  });
});

renderAll();

/* ---------- PWA: service worker + installazione ---------- */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.createElement('button');
  btn.className = 'install-btn';
  btn.textContent = 'Installa app';
  btn.style.display = 'block';
  btn.addEventListener('click', async () => {
    btn.remove();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
    }
  });
  document.querySelector('main').prepend(btn);
});
