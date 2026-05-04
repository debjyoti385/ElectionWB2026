/* ── Main App Controller ──────────────────────────────────────── */
(() => {
  const REFRESH_INTERVAL = 180;
  const DATA_PATH = './data/live_data.json';
  const MAP_PATH  = './data/wb_map.json';
  const MAJORITY  = 148;
  const TOTAL     = 294;

  const COLORS = {
    BJP:'#f97316', AITC:'#22c55e', 'CPI(M)':'#dc2626', AJUP:'#7c3aed',
    AISF:'#0284c7', INC:'#0ea5e9', BSP:'#d97706', IND:'#6b7280',
    OTH:'#9ca3af', ''  :'#475569'
  };

  // Party symbols — official logos where available, emoji fallback for others
  const SYMBOLS = {
    BJP:     '<img src="./images/symbols/bjp.png"  alt="BJP"    class="party-sym">',
    AITC:    '<img src="./images/symbols/aitc.png" alt="AITC"   class="party-sym">',
    'CPI(M)':'<img src="./images/symbols/cpim.png" alt="CPI(M)" class="party-sym">',
    INC:     '<img src="./images/symbols/inc.png"  alt="INC"    class="party-sym">',
    AJUP:    '<span class="party-sym-emoji">🌾</span>',
    AISF:    '<span class="party-sym-emoji">⭐</span>',
    BSP:     '<span class="party-sym-emoji">🐘</span>',
    IND:     '<span class="party-sym-emoji">👤</span>',
    OTH:     '<span class="party-sym-emoji">🔵</span>',
  };
  const PARTY_FULL = {
    BJP:'Bharatiya Janata Party', AITC:'All India Trinamool Congress',
    'CPI(M)':'CPI (Marxist)', INC:'Indian National Congress',
    AJUP:'Aam Janata Unnayan Party', AISF:'All India Secular Front',
    BSP:'Bahujan Samaj Party', IND:'Independent',
  };

  // Notable candidates to track
  // search: substring(s) to match against leadCand/trailCand in ECI data
  const STAR_CANDIDATES = [
    {name:'MAMATA BANERJEE',   search:['MAMATA'],       ac:'159', party:'AITC', role:'Chief Minister'},
    {name:'SUVENDU ADHIKARI',  search:['ADHIKARI SUVENDU','SUVENDU ADHIKARI'], ac:'210', party:'BJP',  role:'Leader of Opposition'},
    {name:'DILIP GHOSH',       search:['DILIP GHOSH'],  ac:'224', party:'BJP',  role:'BJP Senior Leader'},
    {name:'FIRHAD HAKIM',      search:['FIRHAD'],       ac:'158', party:'AITC', role:'Kolkata Mayor'},
    {name:'PRASUN BANERJEE',   search:['PRASUN'],       ac:'45',  party:'AITC', role:'Footballer-Politician'},
    {name:'NISHITH PRAMANIK',  search:['NISHITH'],      ac:'2',   party:'BJP',  role:'Union Minister'},
    {name:'ARJUN SINGH',       search:['ARJUN SINGH'],  ac:'107', party:'BJP',  role:'BJP Senior Leader'},
  ];

  let electionData = null;
  let mapGeoJSON   = null;
  let mapLoaded    = false;
  let countdown    = REFRESH_INTERVAL;
  let timer        = null;
  let isFetching   = false;
  let activeTab    = 'overview';

  // ── Boot ──────────────────────────────────────────────────────
  async function init() {
    if (window.SEED_DATA) {
      electionData = buildFromSeed(window.SEED_DATA);
      renderAll(electionData);
    }
    hideLoading();
    setupTabs();
    ResultsTable.init();
    await fetchData();
    startCountdown();
  }

  function buildFromSeed(seed) {
    const pt = {};
    Object.values(seed).forEach(c => {
      const p = c.party||'OTH';
      if (!pt[p]) pt[p] = {fullName:PARTY_FULL[p]||p, won:0, leading:0, total:0, votes:0, votePct:0, color:COLORS[p]||'#9ca3af'};
      pt[p].total++;
      if (c.status==='Result Declared') pt[p].won++;
      else pt[p].leading++;
    });
    return {
      timestamp:'Seed data', totalSeats:TOTAL, totalVotes:0,
      totalReporting: Object.values(seed).filter(c=>c.status&&c.status!=='Not Started'&&c.status!=='').length,
      partyTotals:pt, constituencies:seed
    };
  }

  // ── Fetch ─────────────────────────────────────────────────────
  async function fetchData() {
    if (isFetching) return;
    isFetching = true;
    setStatus('Fetching latest data…','');
    try {
      const r = await fetch(DATA_PATH+'?t='+Date.now());
      if (!r.ok) throw new Error('HTTP '+r.status);
      const json = await r.json();
      if (json?.constituencies) {
        // Extract totalVotes from partyTotals if stored there
        if (json.partyTotals?.__totalVotes__) {
          json.totalVotes = json.partyTotals.__totalVotes__;
          delete json.partyTotals.__totalVotes__;
        }
        electionData = json;
        window._electionData = json;
        renderAll(electionData);
        const istNow = new Date().toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
        setStatus('✓ Updated '+(json.timestamp||istNow+' IST'),'success');
      }
    } catch(e) {
      setStatus('⚠ Showing cached data — run fetcher.py for live updates','error');
    } finally { isFetching = false; }
  }

  async function loadMap() {
    if (mapLoaded) { ElectionMap.update(electionData); return; }
    setStatus('Loading map data…','');
    try {
      const r = await fetch(MAP_PATH);
      if (!r.ok) throw new Error('HTTP '+r.status);
      mapGeoJSON = await r.json();
      ElectionMap.init(mapGeoJSON, electionData);
      mapLoaded = true;
      setStatus('Map loaded','success');
    } catch(e) { setStatus('Map error: '+e.message,'error'); }
  }

  // ── Render All ────────────────────────────────────────────────
  function renderAll(data) {
    renderSummaryCards(data);
    renderAllianceBattle(data);
    renderMajorityBar(data);
    renderStats(data);
    renderHighlights(data);
    renderStarCandidates(data);
    renderFPTPBanner(data);
    renderVoteShareTable(data);
    renderMarginCategories(data);
    renderClosestRaces(data);
    Charts.render(data);
    ResultsTable.update(data);
    if (mapLoaded) ElectionMap.update(data);
  }

  // ── FPTP Distortion Banner (dynamic) ─────────────────────────
  function renderFPTPBanner(data) {
    const el = document.getElementById('fptp-body');
    if (!el) return;
    const pt  = data.partyTotals || {};
    const ts  = data.totalSeats  || 294;

    const bjpVote  = (pt.BJP?.votePct  || 0).toFixed(1);
    const aitcVote = (pt.AITC?.votePct || 0).toFixed(1);
    const bjpSeats  = pt.BJP?.total  || 0;
    const aitcSeats = pt.AITC?.total || 0;
    const bjpSeatPct  = bjpSeats  ? (bjpSeats  / ts * 100).toFixed(1) : '—';
    const aitcSeatPct = aitcSeats ? (aitcSeats / ts * 100).toFixed(1) : '—';

    el.innerHTML = `
      Under <em>First Past The Post</em> voting, a party can win far more
      <em>seats</em> than its <em>vote share</em> suggests.
      BJP leads with
      <strong style="color:#f97316">${bjpVote}% of votes</strong>
      but is winning
      <strong style="color:#f97316">${bjpSeatPct}% of seats (${bjpSeats})</strong>.
      AITC has
      <strong style="color:var(--aitc)">${aitcVote}% of votes</strong>
      but only
      <strong style="color:var(--aitc)">${aitcSeatPct}% of seats (${aitcSeats})</strong>.
      <span style="display:block;margin-top:6px;font-size:.8rem;opacity:.75">
        Vote-to-seat gap — BJP: <strong style="color:#f97316">+${(bjpSeatPct - bjpVote).toFixed(1)}pp</strong> &nbsp;|&nbsp;
        AITC: <strong style="color:var(--aitc)">${(aitcSeatPct - aitcVote).toFixed(1)}pp</strong>
      </span>`;
  }

  // ── Summary Cards ─────────────────────────────────────────────
  function renderSummaryCards(data) {
    const el = document.getElementById('summary-cards');
    if (!el) return;
    const pt = data.partyTotals||{};
    const cards = [
      {key:'AITC',cls:'card-aitc'}, {key:'BJP',cls:'card-bjp'},
      {key:'CPI(M)',cls:'card-cpim'}, {key:'AJUP',cls:'card-ajup'},
      {key:'AISF',cls:'card-aisf'}, {key:'INC',cls:'card-oth'},
    ];
    el.innerHTML = cards.map(({key,cls}) => {
      const p = pt[key]||{total:0,won:0,leading:0};
      const sym = SYMBOLS[key] || '';
      return `<div class="summary-card ${cls}">
        <div class="card-symbol">${sym}</div>
        <div class="card-num">${p.total||0}</div>
        <div class="card-label">${key}</div>
        <div class="card-sub">W:${p.won||0} / L:${p.leading||0}</div>
      </div>`;
    }).join('') + `<div class="summary-card card-total">
      <div class="card-num">${data.totalReporting||0}</div>
      <div class="card-label">Reporting</div>
      <div class="card-sub">of ${TOTAL}</div>
    </div>`;
  }

  // ── Alliance Battle Bar ───────────────────────────────────────
  function renderAllianceBattle(data) {
    const el = document.getElementById('alliance-battle');
    if (!el) return;
    const pt = data.partyTotals||{};
    const BJP_SEATS  = pt.BJP?.total||0;
    const AITC_SEATS = pt.AITC?.total||0;
    const LEFT_SEATS = (pt['CPI(M)']?.total||0)+(pt.INC?.total||0)+(pt.AISF?.total||0);
    const OTH_SEATS  = TOTAL - BJP_SEATS - AITC_SEATS - LEFT_SEATS;

    const segments = [
      {party:'BJP', seats:BJP_SEATS, color:COLORS.BJP, align:'left'},
      {party:'AITC', seats:AITC_SEATS, color:COLORS.AITC, align:'right'},
      {party:'Left+', seats:LEFT_SEATS, color:COLORS['CPI(M)'], align:'right'},
      {party:'Others', seats:OTH_SEATS, color:COLORS.OTH, align:'right'},
    ];

    el.innerHTML = `
      <div class="battle-labels">
        <span style="color:${COLORS.BJP};font-weight:700;display:flex;align-items:center;gap:6px">${SYMBOLS.BJP}<span>BJP &nbsp;${BJP_SEATS}</span></span>
        <span style="color:var(--muted);font-size:.8rem">← Majority: ${MAJORITY} →</span>
        <span style="color:${COLORS.AITC};font-weight:700;display:flex;align-items:center;gap:6px"><span>${AITC_SEATS} AITC</span>${SYMBOLS.AITC}</span>
      </div>
      <div class="battle-track">
        ${segments.map(s => `<div class="battle-seg" style="width:${(s.seats/TOTAL*100).toFixed(2)}%;background:${s.color}" title="${s.party}: ${s.seats}"></div>`).join('')}
        <div class="battle-marker" style="left:${(MAJORITY/TOTAL*100).toFixed(2)}%"></div>
      </div>
      <div class="battle-sub">
        ${LEFT_SEATS ? `<span style="color:${COLORS['CPI(M)']};font-size:.78rem">Left+INC+AISF: ${LEFT_SEATS}</span>` : ''}
        ${OTH_SEATS ? `<span style="color:${COLORS.OTH};font-size:.78rem">Others: ${OTH_SEATS}</span>` : ''}
      </div>
    `;
  }

  // ── Majority Bar ──────────────────────────────────────────────
  function renderMajorityBar(data) {
    const bar = document.getElementById('majority-bar');
    if (!bar) return;
    const pt = data.partyTotals||{};
    const order = ['AITC','BJP','CPI(M)','AJUP','AISF','INC','BSP','IND','OTH'];
    bar.innerHTML = order.filter(p=>pt[p]?.total>0).map(p => {
      const w = (pt[p].total/TOTAL*100).toFixed(2);
      return `<div class="majority-segment" style="width:${w}%;background:${COLORS[p]}" title="${p}: ${pt[p].total}"></div>`;
    }).join('');
    const marker = document.getElementById('majority-marker');
    if (marker) marker.style.left = (MAJORITY/TOTAL*100).toFixed(2)+'%';
  }

  // ── Stats Row ─────────────────────────────────────────────────
  function renderStats(data) {
    const pt = data.partyTotals||{};
    const consts = Object.values(data.constituencies||{});
    const leader = Object.entries(pt).filter(([p])=>p!=='__totalVotes__').sort((a,b)=>(b[1].total||0)-(a[1].total||0))[0];
    setEl('stat-leader', leader ? `${leader[0]}: ${leader[1].total}` : '—');
    setEl('stat-reporting', `${data.totalReporting||0} / ${TOTAL}`);
    const maxM = consts.reduce((b,c)=>(c.margin||0)>(b.margin||0)?c:b, {});
    setEl('stat-margin', maxM.margin ? `${maxM.margin.toLocaleString()} — ${maxM.acName||''}` : '—');
    const minM = consts.filter(c=>c.margin>0).reduce((b,c)=>(c.margin||Infinity)<(b.margin||Infinity)?c:b, {});
    setEl('stat-closest', minM.margin ? `${minM.margin.toLocaleString()} — ${minM.acName||''}` : '—');
    // Total votes
    if (data.totalVotes) {
      setEl('stat-votes', (data.totalVotes/1e6).toFixed(2)+'M');
    }
  }

  // ── Highlights ────────────────────────────────────────────────
  function renderHighlights(data) {
    const el = document.getElementById('highlights-grid');
    if (!el) return;
    const consts = Object.values(data.constituencies||{})
      .filter(c=>c.margin>0).sort((a,b)=>b.margin-a.margin).slice(0,12);
    el.innerHTML = consts.map(c => {
      const color = COLORS[c.party]||'#6b7280';
      const statusCls = c.status==='Result Declared'?'status-declared':'status-progress';
      return `<div class="highlight-card" style="border-left-color:${color}">
        <div class="hc-top">
          <span class="hc-ac">${c.acName||'—'}</span>
          <span class="hc-badge" style="background:${color}22;color:${color}">${c.party||'?'}</span>
        </div>
        <div class="hc-cand">${c.leadCand||c.candidate||'—'}</div>
        ${c.margin?`<div class="hc-margin">+${c.margin.toLocaleString()} votes</div>`:''}
        ${c.trailCand?`<div class="hc-trail">vs ${c.trailCand}</div>`:''}
        <span class="status-badge ${statusCls}" style="font-size:.68rem">${c.round?'Rnd '+c.round:c.status}</span>
      </div>`;
    }).join('');
  }

  // ── Star Candidates ───────────────────────────────────────────
  function renderStarCandidates(data) {
    const el = document.getElementById('star-candidates');
    if (!el || !data.constituencies) return;

    el.innerHTML = STAR_CANDIDATES.map(sc => {
      // First try the known AC; then scan all constituencies using search terms
      let c = data.constituencies[sc.ac];
      let matchedAc = sc.ac;

      // Verify the known AC actually contains this candidate
      const nameInAc = (sc.search || [sc.name]).some(term =>
        (c?.leadCand||'').toUpperCase().includes(term) ||
        (c?.trailCand||'').toUpperCase().includes(term)
      );

      if (!nameInAc) {
        // Scan all constituencies for the candidate name
        for (const [ac, cst] of Object.entries(data.constituencies)) {
          const lead  = (cst.leadCand  || '').toUpperCase();
          const trail = (cst.trailCand || '').toUpperCase();
          const found = (sc.search || [sc.name]).some(t => lead.includes(t) || trail.includes(t));
          if (found) { c = cst; matchedAc = ac; break; }
        }
      }

      if (!c) return '';   // candidate genuinely not found in data

      const terms = sc.search || [sc.name];
      const isLeading = terms.some(t => (c.leadCand||'').toUpperCase().includes(t));
      const color = COLORS[sc.party] || '#6b7280';
      const statusColor = isLeading ? 'var(--status-ok)' : 'var(--status-err)';
      const declared = (c.status||'').toLowerCase().includes('declared');
      const statusLabel = declared
        ? (isLeading ? '✓ Won' : '✗ Lost')
        : (isLeading ? '▲ Leading' : '▼ Trailing');

      // Show the correct opponent name
      const opponent = isLeading ? c.trailCand : c.leadCand;
      const opponentParty = isLeading ? c.trailParty : c.leadParty;

      const sym = SYMBOLS[sc.party] || '';
      return `<div class="star-card">
        <div class="star-header">
          <div>
            <div class="star-name">${sc.name}</div>
            <div class="star-role" style="color:var(--muted)">${sc.role}</div>
          </div>
          <span class="hc-badge" style="background:${color}22;color:${color};display:flex;align-items:center;gap:5px">${sym}${sc.party}</span>
        </div>
        <div class="star-ac" style="color:var(--muted)">${c.acName||''} · AC ${matchedAc}</div>
        <div class="star-status" style="color:${statusColor};font-weight:700">
          ${statusLabel}${c.margin ? ` · ${c.margin.toLocaleString()} votes` : ''}
        </div>
        <div class="star-vs" style="color:var(--muted)">vs ${opponent||'—'} <span style="font-size:.68rem">(${opponentParty||''})</span></div>
        ${c.round ? `<div style="font-size:.7rem;color:var(--muted);margin-top:3px">Round ${c.round}</div>` : ''}
      </div>`;
    }).join('');
  }

  // ── Vote Share Table ─────────────────────────────────────────
  function renderVoteShareTable(data) {
    const el = document.getElementById('vote-share-table');
    if (!el) return;
    const pt = data.partyTotals||{};
    const tv = data.totalVotes||0;
    const rows = Object.entries(pt)
      .filter(([p,v])=>p!=='__totalVotes__'&&(v.votes>0||v.total>0))
      .sort((a,b)=>(b[1].votes||0)-(a[1].votes||0));

    el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:.83rem">
      <thead><tr style="color:var(--muted);border-bottom:1px solid var(--border);font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">
        <th style="padding:8px 10px;text-align:left">Party</th>
        <th style="padding:8px 10px;text-align:right">Votes</th>
        <th style="padding:8px 10px;text-align:right">Vote %</th>
        <th style="padding:8px 10px;text-align:right">Seats</th>
        <th style="padding:8px 10px;text-align:right">Seat %</th>
        <th style="padding:8px 10px;text-align:left">Vote Bar</th>
      </tr></thead><tbody>` +
    rows.map(([p,v]) => {
      const color = COLORS[p]||'#9ca3af';
      const votePct = v.votePct || (tv>0?+(v.votes/tv*100).toFixed(2):0);
      const seatPct = v.total ? +(v.total/294*100).toFixed(1) : 0;
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 10px">
          <span style="display:inline-flex;align-items:center;gap:6px">
            <span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block"></span>
            <strong style="color:${color}">${p}</strong>
            <span style="color:var(--muted);font-size:.75rem">${v.fullName||''}</span>
          </span>
        </td>
        <td style="padding:7px 10px;text-align:right;color:var(--text2)">${v.votes?(v.votes).toLocaleString():'—'}</td>
        <td style="padding:7px 10px;text-align:right;font-weight:600;color:${color}">${votePct?votePct.toFixed(2)+'%':'—'}</td>
        <td style="padding:7px 10px;text-align:right;color:var(--text2)">${v.total||0}</td>
        <td style="padding:7px 10px;text-align:right;color:var(--muted)">${seatPct?seatPct+'%':'—'}</td>
        <td style="padding:7px 10px;min-width:100px">
          <div style="height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${Math.min(votePct*1.5,100).toFixed(1)}%;background:${color};border-radius:3px"></div>
          </div>
        </td>
      </tr>`;
    }).join('') + `</tbody></table>`;

    if (tv) {
      const totalEl = document.getElementById('total-votes-count');
      if (totalEl) totalEl.textContent = (tv/1e6).toFixed(2)+'M total votes cast';
    }
  }

  // ── Margin Categories ─────────────────────────────────────────
  function renderMarginCategories(data) {
    const el = document.getElementById('margin-categories');
    if (!el) return;
    const consts = Object.values(data.constituencies||{});
    const cats = [
      {label:'Wafer Thin', sub:'< 500', max:500,     color:'#ef4444', icon:'🔴'},
      {label:'Tight',      sub:'500–2K',max:2000,    color:'#f97316', icon:'🟠'},
      {label:'Close',      sub:'2K–5K', max:5000,    color:'#eab308', icon:'🟡'},
      {label:'Comfortable',sub:'5K–10K',max:10000,   color:'#22c55e', icon:'🟢'},
      {label:'Safe',       sub:'10K–25K',max:25000,  color:'#3b82f6', icon:'🔵'},
      {label:'Landslide',  sub:'> 25K', max:Infinity,color:'#8b5cf6', icon:'🟣'},
    ];
    cats.forEach(cat => {
      cat.seats = consts.filter(c=>c.margin>0&&c.margin<cat.max&&
        (cat.max===500||c.margin>=(cats[cats.indexOf(cat)-1]?.max||0))).length;
    });
    // Fix: recalculate properly
    cats.forEach((cat, i) => {
      const min = i===0?0:cats[i-1].max;
      cat.seats = consts.filter(c=>c.margin>0&&c.margin>=min&&c.margin<cat.max).length;
    });
    el.innerHTML = cats.map(cat => `
      <div class="margin-cat-card" style="border-top:3px solid ${cat.color}">
        <div style="font-size:1.5rem">${cat.icon}</div>
        <div style="font-size:1.6rem;font-weight:800;color:${cat.color}">${cat.seats}</div>
        <div style="font-size:.8rem;font-weight:600;color:var(--text2)">${cat.label}</div>
        <div style="font-size:.72rem;color:var(--muted)">${cat.sub}</div>
      </div>`).join('');
  }

  // ── Closest Races ─────────────────────────────────────────────
  function renderClosestRaces(data) {
    const el = document.getElementById('closest-races');
    if (!el) return;
    const races = Object.values(data.constituencies||{})
      .filter(c=>c.margin>0).sort((a,b)=>a.margin-b.margin).slice(0,10);
    el.innerHTML = races.map((c,i) => {
      const color = COLORS[c.party]||'#6b7280';
      return `<div class="race-row">
        <span class="race-rank">${i+1}</span>
        <div class="race-main">
          <span class="race-name">${c.acName}</span>
          <span class="hc-badge" style="background:${color}22;color:${color};font-size:.7rem">${c.party}</span>
        </div>
        <div class="race-margin" style="color:${color}">+${c.margin.toLocaleString()}</div>
        <div class="race-cands">${c.leadCand||'?'} vs ${c.trailCand||'?'}</div>
      </div>`;
    }).join('');
  }

  // ── Tabs ──────────────────────────────────────────────────────
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn =>
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );
  }
  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+tab));
    if (tab==='map'&&!mapLoaded) loadMap();
  }

  // ── Countdown ─────────────────────────────────────────────────
  function startCountdown() {
    countdown = REFRESH_INTERVAL;
    clearInterval(timer);
    timer = setInterval(() => {
      countdown--;
      setEl('countdown', countdown+'s');
      if (countdown<=0) { countdown=REFRESH_INTERVAL; fetchData(); }
    }, 1000);
  }
  window.forceRefresh = async () => {
    if (isFetching) return;
    const btn=document.getElementById('refresh-btn');
    if(btn){btn.classList.add('loading');btn.disabled=true;}
    countdown=REFRESH_INTERVAL;
    await fetchData();
    if(btn){btn.classList.remove('loading');btn.disabled=false;}
    startCountdown();
  };

  // ── Helpers ───────────────────────────────────────────────────
  function hideLoading() {
    const el=document.getElementById('loading-screen');
    if(el){el.classList.add('hidden');setTimeout(()=>el.remove(),500);}
  }
  function setEl(id,t){const e=document.getElementById(id);if(e)e.textContent=t;}
  function setStatus(msg,type){
    const e=document.getElementById('status-msg');
    if(!e)return; e.textContent=msg; e.className=type?'status-'+type:'';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

/* ── Theme Toggle ────────────────────────────────────────────── */
window.App = window.App || {};
App.toggleTheme = function() {
  const root = document.documentElement;
  const current = root.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  localStorage.setItem('wb-theme', next);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
  // Re-render charts with new theme colors
  if (window._electionData) Charts.render(window._electionData);
};

// Apply saved theme on load
(function() {
  const saved = localStorage.getItem('wb-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = saved === 'dark' ? '☀️' : '🌙';
})();
