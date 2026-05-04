/* ── Charts Module ───────────────────────────────────────────── */
window.Charts = (() => {
  const _charts = {};
  const COLORS = {
    BJP:'#f97316', AITC:'#22c55e', 'CPI(M)':'#dc2626', AJUP:'#7c3aed',
    AISF:'#0284c7', INC:'#0ea5e9', BSP:'#d97706', IND:'#6b7280',
    NOTA:'#94a3b8', Other:'#9ca3af', AIFB:'#b45309', RSP:'#38bdf8',
    OTH:'#9ca3af', ''  :'#475569'
  };
  const SEAT_ORDER = ['AITC','BJP','CPI(M)','AJUP','AISF','INC','BSP','IND','OTH'];

  // Theme-aware chart colors
  function tc() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      grid:   light ? '#e5ddd4' : '#334155',
      tick:   light ? '#6b7280' : '#94a3b8',
      legend: light ? '#475569' : '#94a3b8',
      border: light ? '#ffffff' : '#1e293b',
    };
  }

  function destroy(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }

  function mk(id, config) {
    destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return null;
    _charts[id] = new Chart(ctx, config);
    return _charts[id];
  }

  // ── Overview: Seat Donut ─────────────────────────────────────
  function renderSeatDonut(data) {
    const pt = data.partyTotals || {};
    const parties = SEAT_ORDER.filter(p => pt[p]?.total > 0);
    const t = tc();
    mk('donut-chart', {
      type: 'doughnut',
      data: {
        labels: parties.map(p => `${p} (${pt[p].total})`),
        datasets: [{ data: parties.map(p => pt[p].total),
          backgroundColor: parties.map(p => COLORS[p]||'#9ca3af'),
          borderWidth: 2, borderColor: t.border, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout:'62%',
        plugins: {
          legend: { position:'bottom', labels:{ color: t.legend, boxWidth:12, padding:10, font:{size:11} } },
          tooltip: { callbacks: { label: ctx => {
            const p = parties[ctx.dataIndex]; const v = pt[p];
            return ` ${p}: ${v.total} seats (Won: ${v.won||0}, Leading: ${v.leading||0})`;
          }}}
        }
      }
    });
  }

  // ── Overview: Won vs Leading Bar ─────────────────────────────
  function renderSeatBar(data) {
    const pt = data.partyTotals || {};
    const parties = SEAT_ORDER.filter(p => pt[p]?.total > 0);
    const t = tc();
    mk('bar-chart', {
      type:'bar',
      data: {
        labels: parties,
        datasets: [
          { label:'Won', data: parties.map(p => pt[p].won||0),
            backgroundColor: parties.map(p => COLORS[p]||'#9ca3af'), borderRadius:4 },
          { label:'Leading', data: parties.map(p => pt[p].leading||0),
            backgroundColor: parties.map(p => (COLORS[p]||'#9ca3af')+'77'), borderRadius:4 }
        ]
      },
      options: {
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        scales: {
          x: { stacked:true, grid:{color: t.grid}, ticks:{color: t.tick} },
          y: { stacked:true, grid:{display:false}, ticks:{color: t.tick, font:{weight:'600'}} }
        },
        plugins: {
          legend:{ position:'bottom', labels:{color: t.legend, boxWidth:12, padding:8, font:{size:11}} },
          tooltip:{ callbacks:{ afterTitle: items => {
            const p=items[0].label; const v=pt[p];
            return `Total: ${v?.total||0} seats`;
          }}}
        }
      }
    });
  }

  // ── Vote Analysis: Vote % vs Seat % Comparison ───────────────
  function renderVotesVsSeats(data) {
    const pt = data.partyTotals || {};
    const ts = data.totalSeats || 294;
    const parties = Object.entries(pt)
      .filter(([p,v]) => v.total > 0 || v.votePct > 0)
      .sort((a,b) => (b[1].total||0)-(a[1].total||0))
      .slice(0,6).map(([p]) => p);
    const t = tc();

    mk('votes-vs-seats-chart', {
      type:'bar',
      data: {
        labels: parties,
        datasets: [
          { label:'Vote Share %',
            data: parties.map(p => pt[p]?.votePct || 0),
            backgroundColor: parties.map(p => (COLORS[p]||'#9ca3af')+'cc'),
            borderRadius:5 },
          { label:'Seat Share %',
            data: parties.map(p => pt[p]?.total ? +((pt[p].total/ts)*100).toFixed(1) : 0),
            backgroundColor: parties.map(p => COLORS[p]||'#9ca3af'),
            borderRadius:5 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        scales: {
          x: { grid:{display:false}, ticks:{color: t.tick} },
          y: { grid:{color: t.grid}, ticks:{color: t.tick, callback: v => v+'%'},
               max: Math.ceil(Math.max(...parties.map(p => Math.max(pt[p]?.votePct||0, pt[p]?.total ? (pt[p].total/ts)*100 : 0)))/10)*10+10 }
        },
        plugins: {
          legend:{ position:'top', labels:{color: t.legend, boxWidth:12, padding:12, font:{size:11}} },
          tooltip:{ callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` }}
        }
      }
    });
  }

  // ── Vote Analysis: All-party vote share donut ─────────────────
  function renderVoteShareDonut(data) {
    const pt = data.partyTotals || {};
    let entries = Object.entries(pt)
      .filter(([p]) => p !== '__totalVotes__')
      .map(([p,v]) => [p, v.votes||0, v.votePct||0])
      .filter(([,v]) => v > 0)
      .sort((a,b) => b[1]-a[1]);

    const TOP = 6;
    const main = entries.slice(0, TOP);
    const rest = entries.slice(TOP);
    if (rest.length) {
      const otherVotes = rest.reduce((s,[,v])=>s+v, 0);
      const otherPct   = rest.reduce((s,[,,p])=>s+p, 0);
      main.push(['Others', otherVotes, +otherPct.toFixed(2)]);
    }
    const t = tc();

    mk('vote-share-donut', {
      type:'doughnut',
      data: {
        labels: main.map(([p,,pct]) => `${p} (${pct.toFixed(1)}%)`),
        datasets: [{ data: main.map(([,v])=>v),
          backgroundColor: main.map(([p]) => COLORS[p]||'#9ca3af'),
          borderWidth:2, borderColor: t.border, hoverOffset:6 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false, cutout:'58%',
        plugins: {
          legend:{ position:'bottom', labels:{color: t.legend, boxWidth:12, padding:8, font:{size:11}} },
          tooltip:{ callbacks:{ label: ctx => {
            const [p,v,pct] = main[ctx.dataIndex];
            return ` ${p}: ${pct.toFixed(2)}%  (${(v||0).toLocaleString()} votes)`;
          }}}
        }
      }
    });
  }

  // ── Analytics: Margin Distribution Histogram ─────────────────
  function renderMarginHistogram(data) {
    const consts = Object.values(data.constituencies||{});
    const bins = [
      {label:'<500 (Wafer thin)',    max:500,      color:'#ef4444'},
      {label:'500–2K (Tight)',       max:2000,     color:'#f97316'},
      {label:'2K–5K (Close)',        max:5000,     color:'#eab308'},
      {label:'5K–10K (Comfortable)', max:10000,    color:'#22c55e'},
      {label:'10K–25K (Safe)',       max:25000,    color:'#6366f1'},
      {label:'>25K (Landslide)',     max:Infinity, color:'#8b5cf6'},
    ];
    const counts = bins.map(() => 0);
    consts.forEach(c => {
      if (!c.margin) return;
      for (let i = 0; i < bins.length; i++) {
        if (c.margin < bins[i].max) { counts[i]++; break; }
      }
    });
    const t = tc();
    mk('margin-histogram', {
      type:'bar',
      data: {
        labels: bins.map(b => b.label),
        datasets: [{ label:'Constituencies', data:counts,
          backgroundColor: bins.map(b=>b.color+'cc'),
          borderColor: bins.map(b=>b.color),
          borderWidth:1, borderRadius:6 }]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        scales: {
          x: { grid:{display:false}, ticks:{color: t.tick, font:{size:11}} },
          y: { grid:{color: t.grid}, ticks:{color: t.tick, stepSize:10} }
        },
        plugins: {
          legend:{display:false},
          tooltip:{ callbacks:{ label: ctx => ` ${ctx.raw} seats` }}
        }
      }
    });
  }

  // ── Analytics: District Heatmap bar ──────────────────────────
  function renderDistrictChart(data) {
    const byDist = {};
    Object.values(data.constituencies||{}).forEach(c => {
      const d = c.district||'Other';
      if (!byDist[d]) byDist[d] = {BJP:0, AITC:0, other:0};
      if (c.party==='BJP') byDist[d].BJP++;
      else if (c.party==='AITC') byDist[d].AITC++;
      else byDist[d].other++;
    });
    const districts = Object.keys(byDist).sort((a,b) => {
      const ta = byDist[a].BJP+byDist[a].AITC+byDist[a].other;
      const tb = byDist[b].BJP+byDist[b].AITC+byDist[b].other;
      return tb - ta;
    });
    const t = tc();
    mk('district-chart', {
      type:'bar',
      data: {
        labels: districts,
        datasets: [
          { label:'BJP',    data:districts.map(d=>byDist[d].BJP),   backgroundColor:'#f97316cc', borderRadius:3 },
          { label:'AITC',   data:districts.map(d=>byDist[d].AITC),  backgroundColor:'#22c55ecc', borderRadius:3 },
          { label:'Others', data:districts.map(d=>byDist[d].other), backgroundColor:'#6b7280cc', borderRadius:3 },
        ]
      },
      options: {
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        scales: {
          x: { stacked:true, grid:{color: t.grid}, ticks:{color: t.tick, stepSize:5} },
          y: { stacked:true, grid:{display:false}, ticks:{color: t.tick, font:{size:10}} }
        },
        plugins: { legend:{ position:'top', labels:{color: t.legend, boxWidth:12, padding:10, font:{size:11}} } }
      }
    });
  }

  function render(data) {
    renderSeatDonut(data);
    renderSeatBar(data);
    renderVotesVsSeats(data);
    renderVoteShareDonut(data);
    renderMarginHistogram(data);
    renderDistrictChart(data);
  }

  return { render };
})();
