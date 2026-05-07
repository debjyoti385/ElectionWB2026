/* ── Results Table Module ─────────────────────────────────────── */
window.ResultsTable = (() => {
  let currentData = [];
  let sortCol = 'ac';
  let sortAsc = true;
  let filterParty = '';
  let filterStatus = '';
  let filterDistrict = '';
  let searchQuery = '';

  const DISTRICT_ORDER = [
    'Cooch Behar','Alipurduar','Jalpaiguri','Kalimpong','Darjeeling',
    'Uttar Dinajpur','Dakshin Dinajpur','Malda','Murshidabad','Nadia',
    'North 24 Parganas','South 24 Parganas','Kolkata','Howrah','Hooghly',
    'Purba Medinipur','Paschim Medinipur','Jhargram','Purulia','Bankura',
    'Purba Bardhaman','Paschim Bardhaman','Birbhum'
  ];

  const COLORS = {
    BJP: '#f97316', AITC: '#22c55e', 'CPI(M)': '#dc2626',
    AJUP: '#7c3aed', AISF: '#0284c7', INC: '#0ea5e9',
    BSP: '#d97706', IND: '#6b7280', OTH: '#9ca3af', '': '#475569'
  };
  const SYMBOLS_IMG = {
    BJP:     './images/symbols/bjp.png',
    AITC:    './images/symbols/aitc.png',
    'CPI(M)':'./images/symbols/cpim.png',
    INC:     './images/symbols/inc.png',
  };

  function populateDistrictFilter() {
    const el = document.getElementById('filter-district');
    if (!el || el.options.length > 1) return; // already populated
    DISTRICT_ORDER.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      el.appendChild(opt);
    });
  }

  function init() {
    const searchEl   = document.getElementById('table-search');
    const partyEl    = document.getElementById('filter-party');
    const statusEl   = document.getElementById('filter-status');
    const districtEl = document.getElementById('filter-district');

    if (searchEl)   searchEl.addEventListener('input',  e => { searchQuery = e.target.value.toLowerCase(); renderTable(); });
    if (partyEl)    partyEl.addEventListener('change',  e => { filterParty = e.target.value; renderTable(); });
    if (statusEl)   statusEl.addEventListener('change', e => { filterStatus = e.target.value; renderTable(); });
    if (districtEl) districtEl.addEventListener('change', e => { filterDistrict = e.target.value; renderTable(); });

    populateDistrictFilter();

    // Sort headers
    document.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('sort-asc','sort-desc'));
        th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
        renderTable();
      });
    });
  }

  function update(data) {
    if (!data || !data.constituencies) return;
    const distMap = window.WB_DISTRICT_MAP || {};
    currentData = Object.entries(data.constituencies)
      .map(([key, c]) => {
        const ac = c.ac != null ? Number(c.ac) : Number(key);
        return { ...c, ac, district: distMap[ac] || c.district || '' };
      })
      .sort((a, b) => (a.ac || 0) - (b.ac || 0));
    renderTable();
  }

  function getFiltered() {
    return currentData.filter(c => {
      if (filterParty    && c.party    !== filterParty)    return false;
      if (filterDistrict && c.district !== filterDistrict) return false;
      if (filterStatus) {
        if (filterStatus === 'declared' && c.status !== 'Result Declared') return false;
        if (filterStatus === 'progress' && c.status !== 'Result in Progress') return false;
        if (filterStatus === 'pending' && c.status && c.status !== 'Not Started' && c.status !== '') return false;
      }
      if (searchQuery) {
        const q = searchQuery;
        return (
          (c.acName    || '').toLowerCase().includes(q) ||
          (c.leadCand  || '').toLowerCase().includes(q) ||
          (c.trailCand || '').toLowerCase().includes(q) ||
          (c.party     || '').toLowerCase().includes(q) ||
          (c.district  || '').toLowerCase().includes(q) ||
          String(c.ac).includes(q)
        );
      }
      return true;
    });
  }

  function getSorted(rows) {
    return [...rows].sort((a, b) => {
      let va, vb;
      switch (sortCol) {
        case 'ac':     va = a.ac || 0;       vb = b.ac || 0;       break;
        case 'name':   va = a.acName || '';   vb = b.acName || '';  break;
        case 'party':  va = a.party || '';    vb = b.party || '';   break;
        case 'margin': va = a.margin || 0;    vb = b.margin || 0;   break;
        default:       va = a.ac || 0;       vb = b.ac || 0;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  function partyBadge(party, fullParty) {
    const color = COLORS[party] || '#9ca3af';
    const label = party || '—';
    const imgSrc = SYMBOLS_IMG[party];
    const symHtml = imgSrc
      ? `<img src="${imgSrc}" alt="${party}" class="tbl-sym">`
      : `<span class="party-dot" style="background:${color}"></span>`;
    return `<span class="party-badge" style="background:${color}22;color:${color};border:1px solid ${color}44;display:inline-flex;align-items:center;gap:4px">
      ${symHtml}${label}
    </span>`;
  }

  function statusBadge(status) {
    if (!status || status === 'Not Started' || status === '') {
      return `<span class="status-badge status-pending">Pending</span>`;
    }
    if (status === 'Result Declared') {
      return `<span class="status-badge status-declared">✓ Declared</span>`;
    }
    return `<span class="status-badge status-progress">● In Progress</span>`;
  }

  function renderTable() {
    const tbody = document.getElementById('results-tbody');
    const countEl = document.getElementById('results-count');
    if (!tbody) return;

    const filtered = getSorted(getFiltered());
    if (countEl) countEl.textContent = `${filtered.length} of ${currentData.length} constituencies`;

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">No results match your filter</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      const acNo = String(c.ac || '').padStart(3, '0');
      const eciUrl = `https://results.eci.gov.in/ResultAcGenMay2026/candidateswise-S25${acNo}.htm`;
      const marginStr = c.margin ? c.margin.toLocaleString() : '—';
      const trailInfo = c.trailCand
        ? `<div class="trail-info">${c.trailCand}${c.trailParty ? ' · ' + c.trailParty.replace('All India Trinamool Congress','AITC').replace('Bharatiya Janata Party','BJP') : ''}</div>`
        : '';

      return `<tr>
        <td class="ac-no">${c.ac || '—'}</td>
        <td>
          <a class="ac-link" href="${eciUrl}" target="_blank" rel="noopener">${c.acName || '—'}</a>
          ${c.district ? `<div style="font-size:.68rem;color:var(--muted);margin-top:1px">${c.district}</div>` : ''}
        </td>
        <td>${partyBadge(c.party, c.fullParty)}</td>
        <td>
          <div class="cand-name">${c.leadCand || c.candidate || '—'}</div>
          ${trailInfo}
        </td>
        <td class="margin-val">${marginStr}</td>
        <td class="round-val">${c.round || '—'}</td>
        <td>${statusBadge(c.status)}</td>
      </tr>`;
    }).join('');
  }

  return { init, update };
})();
