import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { feature as topojsonFeature } from 'topojson-client'

const DEFAULT_TOOLTIP_SECTIONS = {
  general: true,
  montaj: true,
  avizare: true,
  costuri: true,
  financiar: true,
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ț/g, 't')
    .replace(/ţ/g, 't')
    .replace(/ș/g, 's')
    .replace(/ş/g, 's')
    .replace(/ă/g, 'a')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/[^A-Z0-9]+/gi, '')
    .toUpperCase()
    .trim()
}

function getGeoJsonFromAny(input) {
  if (!input) return null
  if (input.type === 'FeatureCollection') return input
  if (input.type === 'Feature') return { type: 'FeatureCollection', features: [input] }
  if (input.type === 'Topology' && input.objects) {
    const firstKey = Object.keys(input.objects)[0]
    if (!firstKey) return null
    return topojsonFeature(input, input.objects[firstKey])
  }
  return null
}

function formatLei(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + ' lei'
}

function formatPercent(value) {
  return Number(value || 0).toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }) + '%'
}

function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function getCountyStyle(judet, isSelected) {
  const procent = Number(judet?.procent_montat || 0)

  let fillColor = '#f3f4f6'
  if (procent >= 100) fillColor = '#dcfce7'
  else if (procent > 0) fillColor = '#dbeafe'

  return {
    color: isSelected ? '#2563eb' : '#94a3b8',
    weight: isSelected ? 3 : 1.5,
    fillColor,
    fillOpacity: isSelected ? 0.9 : 0.72,
    opacity: 1,
  }
}

function buildTooltipHtml(judet, tooltipSections) {
  const htmlParts = [
    `<div class="county-tooltip county-tooltip-rich">`,
    `<div class="county-tooltip-title">${judet.nume_judet} (${judet.cod_judet})</div>`,
  ]

  if (tooltipSections.general) {
    htmlParts.push(`
      <div class="county-tooltip-section-title">General</div>
      <div class="county-tooltip-grid">
        <div>Total puncte</div><div>${safeText(judet.total_puncte, '0')}</div>
        <div>Puncte montate</div><div>${safeText(judet.puncte_montate_actual ?? judet.puncte_montate ?? judet.stalpi_montati, '0')}</div>
        <div>Puncte rămase</div><div>${safeText(judet.puncte_ramase_actual ?? judet.puncte_ramase_montaj ?? judet.stalpi_ramasi, '0')}</div>
        <div>Scos IGPR</div><div>${safeText(judet.puncte_eliminate_igpr, '0')}</div>
        <div>Eligibile montaj</div><div>${safeText(judet.puncte_eligibile_montaj, '0')}</div>
        <div>T17</div><div>${safeText(judet.total_t17, '0')}</div>
        <div>PV UAT</div><div>${safeText(judet.total_pv_uat, '0')}</div>
      </div>
    `)
  }

  if (tooltipSections.montaj) {
    htmlParts.push(`
      <div class="county-tooltip-section-title">Montaj</div>
      <div class="county-tooltip-grid">
        <div>Stâlpi montați</div><div>${safeText(judet.stalpi_montati, '0')}</div>
        <div>Stâlpi rămași</div><div>${safeText(judet.stalpi_ramasi, '0')}</div>
        <div>În verificare</div><div>${safeText(judet.stalpi_in_verificare, '0')}</div>
        <div>% montat</div><div>${formatPercent(judet.procent_montat)}</div>
      </div>
    `)
  }

  if (tooltipSections.avizare) {
    htmlParts.push(`
      <div class="county-tooltip-section-title">Avizare</div>
      <div class="county-tooltip-grid">
        <div>DR_IGPR</div><div>${safeText(judet.dr_igpr_status, 'nesolicitat')}</div>
        <div>IPJ</div><div>${safeText(judet.ipj_status, 'nesolicitat')}</div>
        <div>IPJ_SIG_CIRC</div><div>${safeText(judet.ipj_sig_circ_status, 'nesolicitat')}</div>
        <div>CNAIR</div><div>${safeText(judet.cnair_status, 'nesolicitat')}</div>
        <div>CJ</div><div>${safeText(judet.cj_status, 'nesolicitat')}</div>
        <div>UAT cu aviz</div><div>${safeText(judet.uat_cu_aviz, '0')} / ${safeText(judet.uat_total, '0')}</div>
      </div>
    `)
  }

  if (tooltipSections.costuri) {
    htmlParts.push(`
      <div class="county-tooltip-section-title">Costuri</div>
      <div class="county-tooltip-grid">
        <div>Materiale</div><div>${formatLei(judet.cost_materiale)}</div>
        <div>Manoperă</div><div>${formatLei(judet.cost_manopera)}</div>
        <div>Total</div><div>${formatLei(judet.cost_total)}</div>
      </div>
    `)
  }

  if (tooltipSections.financiar) {
    htmlParts.push(`
      <div class="county-tooltip-section-title">Financiar</div>
      <div class="county-tooltip-grid">
        <div>Venit total</div><div>${formatLei(judet.venit_total)}</div>
        <div>Dif. venit-cost</div><div>${formatLei(judet.diferenta_venit_cost)}</div>
      </div>
    `)
  }

  htmlParts.push(`</div>`)

  return htmlParts.join('')
}

export default function RomaniaMap({ judete, selectedJudet, onSelectJudet }) {
  const [geoData, setGeoData] = useState(null)
  const [showTooltipSettings, setShowTooltipSettings] = useState(false)
  const [tooltipSections, setTooltipSections] = useState(() => {
    try {
      const saved = localStorage.getItem('roa_tooltip_sections')
      return saved ? JSON.parse(saved) : DEFAULT_TOOLTIP_SECTIONS
    } catch (e) {
      return DEFAULT_TOOLTIP_SECTIONS
    }
  })

  const judeteByName = useMemo(() => {
    const map = new Map()
    judete.forEach((j) => {
      map.set(normalizeText(j.nume_judet), j)
    })
    return map
  }, [judete])

  useEffect(() => {
    async function loadGeo() {
      try {
        const response = await fetch('/romania-counties.json')
        const raw = await response.json()
        const geo = getGeoJsonFromAny(raw)
        setGeoData(geo)
      } catch (error) {
        console.error('Nu am putut încărca harta județelor:', error)
      }
    }

    loadGeo()
  }, [])

  useEffect(() => {
    localStorage.setItem('roa_tooltip_sections', JSON.stringify(tooltipSections))
  }, [tooltipSections])

  const geoJsonWithData = useMemo(() => {
    if (!geoData?.features) return null

    const features = geoData.features.map((featureItem) => {
      const props = featureItem.properties || {}
      const countyName = props.NAME_1 || props.name || props.NAME || ''
      const matchedJudet = judeteByName.get(normalizeText(countyName)) || null

      return {
        ...featureItem,
        properties: {
          ...props,
          __judetData: matchedJudet,
        },
      }
    })

    return {
      ...geoData,
      features,
    }
  }, [geoData, judeteByName])

  function toggleTooltipSection(sectionKey) {
    setTooltipSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  function onEachFeature(feature, layer) {
    const judet = feature.properties?.__judetData
    if (!judet) return

    layer.bindTooltip(buildTooltipHtml(judet, tooltipSections), {
      sticky: true,
      direction: 'auto',
      offset: [0, 10],
      opacity: 1,
      className: 'county-tooltip-wrapper',
    })

    layer.on({
      click: () => onSelectJudet?.(judet),
      mouseover: (e) => {
        e.target.setStyle({
          weight: 3,
          color: '#2563eb',
          fillOpacity: 0.9,
        })
      },
      mouseout: (e) => {
        const isSelected = selectedJudet?.cod_judet === judet.cod_judet
        e.target.setStyle(getCountyStyle(judet, isSelected))
      },
    })
  }

  function styleFeature(feature) {
    const judet = feature.properties?.__judetData
    const isSelected = selectedJudet?.cod_judet === judet?.cod_judet
    return getCountyStyle(judet, isSelected)
  }

  return (
    <div className="romania-map-shell">
      <div className="tooltip-settings-wrapper">
        <button
          type="button"
          className="tooltip-settings-button"
          onClick={() => setShowTooltipSettings((prev) => !prev)}
        >
          Tooltip settings
        </button>

        {showTooltipSettings && (
          <div className="tooltip-settings-panel">
            <label>
              <input
                type="checkbox"
                checked={tooltipSections.general}
                onChange={() => toggleTooltipSection('general')}
              />
              GENERAL
            </label>

            <label>
              <input
                type="checkbox"
                checked={tooltipSections.montaj}
                onChange={() => toggleTooltipSection('montaj')}
              />
              MONTAJ
            </label>

            <label>
              <input
                type="checkbox"
                checked={tooltipSections.avizare}
                onChange={() => toggleTooltipSection('avizare')}
              />
              AVIZARE
            </label>

            <label>
              <input
                type="checkbox"
                checked={tooltipSections.costuri}
                onChange={() => toggleTooltipSection('costuri')}
              />
              COSTURI
            </label>

            <label>
              <input
                type="checkbox"
                checked={tooltipSections.financiar}
                onChange={() => toggleTooltipSection('financiar')}
              />
              FINANCIAR
            </label>
          </div>
        )}
      </div>

      <MapContainer
        center={[45.9432, 24.9668]}
        zoom={7}
        minZoom={6}
        maxZoom={10}
        zoomControl={false}
        className="romania-map-canvas"
      >
        <ZoomControl position="topleft" />

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geoJsonWithData && (
          <GeoJSON
            key={`${selectedJudet?.cod_judet || 'all'}-${JSON.stringify(tooltipSections)}`}
            data={geoJsonWithData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  )
}