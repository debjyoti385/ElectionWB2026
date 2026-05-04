/* ── Map Module (Leaflet) ─────────────────────────────────────── */
window.ElectionMap = (() => {
  let leafletMap = null;
  let geojsonLayer = null;
  let currentData = null;

  const COLORS = {
    BJP:    '#f97316', AITC:   '#3b82f6', 'CPI(M)':'#dc2626',
    AJUP:   '#7c3aed', AISF:   '#059669', INC:    '#0ea5e9',
    BSP:    '#d97706', IND:    '#6b7280', OTH:    '#9ca3af', '': '#475569'
  };

  const PARTY_LABELS = {
    BJP: 'Bharatiya Janata Party', AITC: 'All India Trinamool Congress',
    'CPI(M)': 'Communist Party of India (Marxist)', AJUP: 'Aam Janata Unnayan Party',
    AISF: 'All India Secular Front', INC: 'Indian National Congress',
    BSP: 'Bahujan Samaj Party', IND: 'Independent', OTH: 'Others', '': 'Pending'
  };

  function getConstData(acNo) {
    if (!currentData) return null;
    return currentData.constituencies && currentData.constituencies[String(acNo)];
  }

  function getColor(acNo) {
    const c = getConstData(acNo);
    if (!c || !c.party) return '#475569';
    return COLORS[c.party] || '#9ca3af';
  }

  function featureStyle(feature) {
    const color = getColor(feature.properties.AC_NO);
    return {
      fillColor: color,
      weight: 0.7,
      opacity: 1,
      color: '#0f172a',
      fillOpacity: 0.82
    };
  }

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.95 });
    layer.bringToFront();
  }

  function resetHighlight(e) {
    if (geojsonLayer) geojsonLayer.resetStyle(e.target);
  }

  function showInfo(feature) {
    const acNo = feature.properties.AC_NO;
    const acName = feature.properties.AC_NAME;
    const c = getConstData(acNo);

    const nameEl = document.getElementById('map-ac-name');
    const detailEl = document.getElementById('map-ac-details');
    const placeholder = document.getElementById('map-placeholder');

    if (nameEl) nameEl.textContent = `${acNo}. ${acName}`;
    if (placeholder) placeholder.style.display = 'none';

    if (!c) {
      if (detailEl) detailEl.innerHTML = '<span style="color:#94a3b8">No data</span>';
      return;
    }

    const partyColor = COLORS[c.party] || '#9ca3af';
    const partyLabel = PARTY_LABELS[c.party] || c.fullParty || c.party || 'Unknown';
    const statusClass = c.status === 'Result Declared' ? 'status-declared' :
                        c.status === 'Result in Progress' ? 'status-progress' : 'status-pending';

    if (detailEl) {
      detailEl.innerHTML = `
        <div style="margin-bottom:8px">
          <span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${partyColor};margin-right:6px;vertical-align:middle"></span>
          <strong style="color:${partyColor}">${partyLabel}</strong>
        </div>
        <div><span style="color:#64748b">Leading:</span> ${c.leadCand || c.candidate || '—'}</div>
        <div><span style="color:#64748b">Trailing:</span> ${c.trailCand || '—'}</div>
        <div><span style="color:#64748b">Trailing Party:</span> ${c.trailParty || '—'}</div>
        ${c.margin ? `<div><span style="color:#64748b">Margin:</span> <strong style="color:#a5b4fc">${c.margin.toLocaleString()}</strong></div>` : ''}
        ${c.round ? `<div><span style="color:#64748b">Round:</span> ${c.round}</div>` : ''}
        <div style="margin-top:8px"><span class="status-badge ${statusClass}">${c.status || 'Pending'}</span></div>
        <div style="margin-top:8px">
          <a href="https://results.eci.gov.in/ResultAcGenMay2026/candidateswise-S25${String(acNo).padStart(3,'0')}.htm"
             target="_blank" rel="noopener"
             style="font-size:.75rem;color:#818cf8">View ECI Results ↗</a>
        </div>
      `;
    }
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: e => { showInfo(feature); }
    });

    const acNo = feature.properties.AC_NO;
    const c = getConstData(acNo);
    const partyLabel = c ? (PARTY_LABELS[c.party] || c.party || 'Pending') : 'No data';
    layer.bindTooltip(
      `<strong>${feature.properties.AC_NAME}</strong><br>${partyLabel}${c && c.margin ? '<br>Margin: ' + c.margin.toLocaleString() : ''}`,
      { direction: 'top', offset: [0, -4], className: 'map-tooltip' }
    );
  }

  function init(mapData, electionData) {
    currentData = electionData;

    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    if (leafletMap) {
      leafletMap.remove();
      leafletMap = null;
    }

    leafletMap = L.map('map', {
      center: [23.5, 87.5],
      zoom: 7,
      zoomControl: true,
      attributionControl: true
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://carto.com/">CARTO</a> | ECI Data',
      subdomains: 'abcd',
      maxZoom: 14,
      opacity: 0.6
    }).addTo(leafletMap);

    geojsonLayer = L.geoJSON(mapData, {
      style: featureStyle,
      onEachFeature: onEachFeature
    }).addTo(leafletMap);

    // Fit to WB bounds
    try { leafletMap.fitBounds(geojsonLayer.getBounds(), { padding: [10, 10] }); }
    catch(e) {}

    renderLegend(electionData);
  }

  function update(electionData) {
    currentData = electionData;
    if (geojsonLayer) {
      geojsonLayer.setStyle(featureStyle);
      geojsonLayer.eachLayer(layer => {
        if (layer.feature) {
          layer.setTooltipContent(() => {
            const acNo = layer.feature.properties.AC_NO;
            const c = getConstData(acNo);
            const partyLabel = c ? (PARTY_LABELS[c.party] || c.party || 'Pending') : 'No data';
            return `<strong>${layer.feature.properties.AC_NAME}</strong><br>${partyLabel}${c && c.margin ? '<br>Margin: ' + c.margin.toLocaleString() : ''}`;
          });
        }
      });
    }
    renderLegend(electionData);
  }

  function renderLegend(data) {
    const el = document.getElementById('map-legend-items');
    if (!el) return;

    // Count seats per party
    const counts = {};
    if (data && data.partyTotals) {
      Object.entries(data.partyTotals).forEach(([abbr, v]) => {
        counts[abbr] = v.total;
      });
    } else if (data && data.constituencies) {
      Object.values(data.constituencies).forEach(c => {
        const p = c.party || '';
        counts[p] = (counts[p] || 0) + 1;
      });
    }

    const parties = Object.entries(counts)
      .filter(([p, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);

    el.innerHTML = parties.map(([p, n]) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${COLORS[p] || '#9ca3af'}"></div>
        <span>${p || 'Pending'}</span>
        <span class="legend-count">${n}</span>
      </div>
    `).join('');
  }

  return { init, update };
})();
