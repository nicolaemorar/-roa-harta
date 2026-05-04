import { useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { GeoJSON, MapContainer, Marker, TileLayer, ZoomControl } from 'react-leaflet'
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
  return `${num.toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} lei`
}

function formatPercent(value) {
  return Number(value || 0).toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }) + '%'
}

function safeText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function getCountyStyle(judet, isSelected, selectedRuta) {
  const procent = Number(judet?.procent_montat || 0)
  const judetRute = Array.isArray(judet?.rute) ? judet.rute : []

  const isRutaFiltered = selectedRuta && selectedRuta !== 'TOATE'
  const isInRuta = !isRutaFiltered || judetRute.includes(selectedRuta)

  let fillColor = '#f3f4f6'
  if (procent >= 100) fillColor = '#dcfce7'
  else if (procent > 0) fillColor = '#dbeafe'

  if (isRutaFiltered && !isInRuta) {
    return {
      color: '#cbd5e1',
      weight: isSelected ? 2 : 1,
      fillColor: '#f8fafc',
      fillOpacity: 0.16,
      opacity: 0.45,
    }
  }

  if (isRutaFiltered && isInRuta) {
    const isDone = procent >= 100
    return {
      color: isSelected ? '#1d4ed8' : isDone ? '#16a34a' : '#ca8a04',
      weight: isSelected ? 3.5 : 2.2,
      fillColor: isDone ? '#dcfce7' : '#fef3c7',
      fillOpacity: isSelected ? 0.94 : 0.86,
      opacity: 1,
    }
  }

  return {
    color: isSelected ? '#2563eb' : '#94a3b8',
    weight: isSelected ? 3 : 1.5,
    fillColor,
    fillOpacity: isSelected ? 0.9 : 0.72,
    opacity: 1,
  }
}

function buildTooltipHtml(judet, tooltipSections, selectedRuta) {
  const judetRute = Array.isArray(judet?.rute) ? judet.rute : []
  const htmlParts = [
    `<div class="county-tooltip county-tooltip-rich">`,
    `<div class="county-tooltip-title">${judet.nume_judet} (${judet.cod_judet})</div>`,
  ]

  if (selectedRuta && selectedRuta !== 'TOATE') {
    htmlParts.push(`
      <div class="county-tooltip-section-title">Rută selectată</div>
      <div class="county-tooltip-grid">
        <div>Rută</div><div>${selectedRuta}</div>
        <div>Județ în rută</div><div>${judetRute.includes(selectedRuta) ? 'DA' : 'NU'}</div>
        <div>Montaj</div><div>${formatPercent(judet.procent_montat)}</div>
      </div>
    `)
  }

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
        <div>Rute</div><div>${judetRute.length ? judetRute.join(', ') : '-'}</div>
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

  if (judet.google_earth_url) {
    htmlParts.push(`
      <div class="county-tooltip-section-title">Google Earth</div>
      <div class="county-tooltip-grid">
        <div>Hartă puncte</div>
        <div>
          <a
            href="${judet.google_earth_url}"
            target="_blank"
            rel="noreferrer"
            class="google-earth-link-btn"
          >
            Deschide
          </a>
        </div>
      </div>
    `)
  }

  htmlParts.push(`</div>`)

  return htmlParts.join('')
}

function collectLatLngs(coords, acc = []) {
  if (!Array.isArray(coords)) return acc

  if (
    coords.length >= 2 &&
    typeof coords[0] === 'number' &&
    typeof coords[1] === 'number'
  ) {
    acc.push([coords[1], coords[0]])
    return acc
  }

  coords.forEach((item) => collectLatLngs(item, acc))
  return acc
}

function getFeatureCenter(feature) {
  const geometry = feature?.geometry
  if (!geometry?.coordinates) return null

  const points = collectLatLngs(geometry.coordinates, [])
  if (!points.length) return null

  let minLat = points[0][0]
  let maxLat = points[0][0]
  let minLng = points[0][1]
  let maxLng = points[0][1]

  points.forEach(([lat, lng]) => {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  })

  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2]
}

function getProgressBadgeClass(procent) {
  const value = Number(procent || 0)

  if (value >= 100) {
    return 'route-progress-badge route-progress-badge-done'
  }

  if (value > 95) {
    return 'route-progress-badge route-progress-badge-work route-progress-badge-near-done'
  }

  return 'route-progress-badge route-progress-badge-work'
}

function createProgressIcon(procent) {
  return L.divIcon({
    className: 'route-progress-marker-shell',
    html: `<div class="${getProgressBadgeClass(procent)}">${formatPercent(procent)}</div>`,
    iconSize: [56, 24],
    iconAnchor: [28, 12],
  })
}

function createCountyCodeIcon(code) {
  return L.divIcon({
    className: 'county-code-marker-shell',
    html: `<div class="county-code-badge">${code}</div>`,
    iconSize: [34, 18],
    iconAnchor: [17, 9],
  })
}

export default function RomaniaMap({
  judete,
  selectedJudet,
  onSelectJudet,
  selectedRuta,
}) {
  const [geoData, setGeoData] = useState(null)
  const [showTooltipSettings, setShowTooltipSettings] = useState(false)
  const [tooltipSections, setTooltipSections] = useState(() => {
    try {
      const saved = localStorage.getItem('roa_tooltip_sections')
      return saved ? JSON.parse(saved) : DEFAULT_TOOLTIP_SECTIONS
    } catch {
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

  const progressMarkers = useMemo(() => {
    if (!geoJsonWithData?.features) return []
    if (!selectedRuta || selectedRuta === 'TOATE') return []

    return geoJsonWithData.features
      .map((feature) => {
        const judet = feature.properties?.__judetData
        if (!judet) return null

        const judetRute = Array.isArray(judet.rute) ? judet.rute : []
        if (!judetRute.includes(selectedRuta)) return null

        const center = getFeatureCenter(feature)
        if (!center) return null

        return {
          key: `${judet.cod_judet}-${selectedRuta}-progress`,
          center: [center[0] - 0.18, center[1]],
          procent: Number(judet.procent_montat || 0),
        }
      })
      .filter(Boolean)
  }, [geoJsonWithData, selectedRuta])

  const countyCodeMarkers = useMemo(() => {
    if (!geoJsonWithData?.features) return []

    return geoJsonWithData.features
      .map((feature) => {
        const judet = feature.properties?.__judetData
        if (!judet?.cod_judet) return null

        const center = getFeatureCenter(feature)
        if (!center) return null

        const showCode = !selectedRuta || selectedRuta === 'TOATE'
          ? true
          : (Array.isArray(judet.rute) ? judet.rute : []).includes(selectedRuta)

        if (!showCode) return null

        return {
          key: `${judet.cod_judet}-code`,
          center,
          code: judet.cod_judet,
        }
      })
      .filter(Boolean)
  }, [geoJsonWithData, selectedRuta])

  function toggleTooltipSection(sectionKey) {
    setTooltipSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  function onEachFeature(feature, layer) {
    const judet = feature.properties?.__judetData
    if (!judet) return

    layer.bindPopup(buildTooltipHtml(judet, tooltipSections, selectedRuta), {
      autoClose: true,
      closeButton: true,
      className: 'county-popup-wrapper',
      maxWidth: 340,
      minWidth: 260,
      offset: [0, 10],
    })

    layer.on({
      click: () => {
        onSelectJudet?.(judet)
        layer.openPopup()
      },
      mouseover: (e) => {
        e.target.setStyle({
          weight: 3,
          color: '#2563eb',
          fillOpacity: 0.9,
        })
      },
      mouseout: (e) => {
        const isSelected = selectedJudet?.cod_judet === judet.cod_judet
        e.target.setStyle(getCountyStyle(judet, isSelected, selectedRuta))
      },
    })
  }

  function styleFeature(feature) {
    const judet = feature.properties?.__judetData
    const isSelected = selectedJudet?.cod_judet === judet?.cod_judet
    return getCountyStyle(judet, isSelected, selectedRuta)
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
            key={`${selectedJudet?.cod_judet || 'all'}-${selectedRuta || 'TOATE'}-${JSON.stringify(tooltipSections)}`}
            data={geoJsonWithData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}

        {countyCodeMarkers.map((item) => (
          <Marker
            key={item.key}
            position={item.center}
            icon={createCountyCodeIcon(item.code)}
            interactive={false}
          />
        ))}

        {progressMarkers.map((item) => (
          <Marker
            key={item.key}
            position={item.center}
            icon={createProgressIcon(item.procent)}
            interactive={false}
          />
        ))}
      </MapContainer>
    </div>
  )
}