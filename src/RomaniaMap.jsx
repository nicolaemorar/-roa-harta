import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, TileLayer } from 'react-leaflet'
import { feature } from 'topojson-client'

function normalizeText(value) {
  return (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ș/g, 's')
    .replace(/ş/g, 's')
    .replace(/ț/g, 't')
    .replace(/ţ/g, 't')
    .replace(/ă/g, 'a')
    .replace(/î/g, 'i')
    .replace(/â/g, 'a')
    .toLowerCase()
    .trim()
}

function detectObjectName(topology) {
  const keys = Object.keys(topology.objects || {})
  return keys[0]
}

function formatLei(value) {
  const num = Number(value || 0)
  return num.toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

function getCountyStyle(judet, selectedJudet) {
  const areAvizeMariComplete =
    judet?.dr_igpr_status === 'emis' &&
    judet?.ipj_status === 'emis' &&
    judet?.ipj_sig_circ_status === 'emis' &&
    judet?.cnair_status === 'emis' &&
    judet?.cj_status === 'emis'

  const fillColor = areAvizeMariComplete ? '#d9f99d' : '#e5e7eb'
  const borderColor = areAvizeMariComplete ? '#84cc16' : '#94a3b8'
  const isSelected = selectedJudet?.cod_judet === judet?.cod_judet

  return {
    color: isSelected ? '#2563eb' : borderColor,
    weight: isSelected ? 3 : 1.2,
    fillColor,
    fillOpacity: 0.88,
  }
}

export default function RomaniaMap({ judete, selectedJudet, onSelectJudet, isFullscreen }) {
  const [geoData, setGeoData] = useState(null)

  useEffect(() => {
    async function loadMap() {
      const response = await fetch('/romania-counties.json')
      const topology = await response.json()
      const objectName = detectObjectName(topology)
      const geojson = feature(topology, topology.objects[objectName])
      setGeoData(geojson)
    }

    loadMap()
  }, [])

  const judeteByName = useMemo(() => {
    const map = new Map()
    judete.forEach((j) => {
      map.set(normalizeText(j.nume_judet), j)
    })
    return map
  }, [judete])

  function findJudet(props) {
    const possibleNames = [
      props?.NAME_1,
      props?.name,
      props?.countyName,
      props?.judet,
      props?.nume,
    ].filter(Boolean)

    for (const name of possibleNames) {
      const judet = judeteByName.get(normalizeText(name))
      if (judet) return judet
    }

    return null
  }

  return (
    <div
      style={{
        height: isFullscreen ? 'calc(100vh - 84px)' : '560px',
        borderRadius: isFullscreen ? '0' : '18px',
        overflow: 'hidden',
      }}
    >
      <MapContainer
        center={[45.8, 24.9]}
        zoom={7}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {geoData && (
          <GeoJSON
            data={geoData}
            style={(feat) => {
              const judet = findJudet(feat?.properties || {})
              return getCountyStyle(judet, selectedJudet)
            }}
            onEachFeature={(feat, layer) => {
              const judet = findJudet(feat?.properties || {})
              const rawName = feat?.properties?.NAME_1 || 'Necunoscut'

              const nume = judet?.nume_judet || rawName
              const cod = judet?.cod_judet || '-'
              const total = judet?.total_puncte || 0
              const eligibileMontaj = judet?.puncte_eligibile_montaj || 0
              const montate = judet?.puncte_montate || 0
              const ramaseMontaj = judet?.puncte_ramase_montaj || 0

              const drIgprStatus = judet?.dr_igpr_status || 'nesolicitat'
              const ipjStatus = judet?.ipj_status || 'nesolicitat'
              const ipjSigCircStatus = judet?.ipj_sig_circ_status || 'nesolicitat'
              const cnairStatus = judet?.cnair_status || 'nesolicitat'
              const cjStatus = judet?.cj_status || 'nesolicitat'
              const uatTotal = judet?.uat_total || 0
              const uatCuAviz = judet?.uat_cu_aviz || 0

              const costTotal = judet?.cost_total || 0
              const nrObiective = judet?.nr_obiective || 0
              const venitTotal = judet?.venit_total || 0
              const diferentaVenitCost = judet?.diferenta_venit_cost || 0

              const tooltipHtml = `
                <div class="county-tooltip county-tooltip-compact">
                  <div class="county-tooltip-title">${nume}</div>
                  <div class="county-tooltip-subtitle">Cod: ${cod}</div>

                  <div class="county-tooltip-grid county-tooltip-grid-compact">
                    <div class="tooltip-section">
                      <div class="tooltip-section-title">Operațional</div>
                      <div class="tooltip-row"><span>Total</span><strong>${total}</strong></div>
                      <div class="tooltip-row"><span>Eligibile</span><strong>${eligibileMontaj}</strong></div>
                      <div class="tooltip-row"><span>Montate</span><strong>${montate}</strong></div>
                      <div class="tooltip-row"><span>Rămase</span><strong>${ramaseMontaj}</strong></div>
                    </div>

                    <div class="tooltip-section">
                      <div class="tooltip-section-title">Avizare</div>
                      <div class="tooltip-row"><span>DR_IGPR</span><strong>${drIgprStatus}</strong></div>
                      <div class="tooltip-row"><span>IPJ</span><strong>${ipjStatus}</strong></div>
                      <div class="tooltip-row"><span>IPJ_SIG_CIRC</span><strong>${ipjSigCircStatus}</strong></div>
                      <div class="tooltip-row"><span>CNAIR</span><strong>${cnairStatus}</strong></div>
                      <div class="tooltip-row"><span>CJ</span><strong>${cjStatus}</strong></div>
                      <div class="tooltip-row"><span>UAT aviz</span><strong>${uatCuAviz} / ${uatTotal}</strong></div>
                    </div>

                    <div class="tooltip-section">
                      <div class="tooltip-section-title">Financiar</div>
                      <div class="tooltip-row"><span>Cost total</span><strong>${formatLei(costTotal)} lei</strong></div>
                      <div class="tooltip-row"><span>Venit</span><strong>${formatLei(venitTotal)} lei</strong></div>
                      <div class="tooltip-row"><span>Diferență</span><strong>${formatLei(diferentaVenitCost)} lei</strong></div>
                      <div class="tooltip-row"><span>Obiective</span><strong>${nrObiective}</strong></div>
                    </div>
                  </div>
                </div>
              `

              layer.bindTooltip(tooltipHtml, {
                direction: 'auto',
                sticky: true,
                opacity: 1,
                className: 'county-tooltip-wrapper',
              })

              layer.on({
                click: () => {
                  if (judet) onSelectJudet(judet)
                },
              })
            }}
          />
        )}
      </MapContainer>
    </div>
  )
}