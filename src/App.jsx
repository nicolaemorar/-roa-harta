import { useEffect, useMemo, useRef, useState } from 'react'
import RomaniaMap from './RomaniaMap'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

function formatLei(value) {
  const num = Number(value || 0)
  return `${num.toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} lei`
}

function KpiCard({ label, value }) {
  return (
    <div
      style={{
        border: '1px solid rgba(60,60,67,0.12)',
        borderRadius: '12px',
        padding: '10px 12px',
        background: 'rgba(255,255,255,0.72)',
      }}
    >
      <div
        style={{
          fontSize: '11px',
          color: '#6e6e73',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          marginBottom: '4px',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

export default function App() {
  const [judete, setJudete] = useState([])
  const [selectedJudet, setSelectedJudet] = useState(null)
  const [judetDetails, setJudetDetails] = useState(null)
  const [judetPuncte, setJudetPuncte] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)

  const mapPanelRef = useRef(null)

  const [routeFilter, setRouteFilter] = useState('')
  const [indicatorFilter, setIndicatorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  useEffect(() => {
    async function loadJudete() {
      try {
        setLoading(true)
        setError('')

        const response = await fetch(`${API_BASE_URL}/api/harta/judete`)
        if (!response.ok) {
          throw new Error('Nu am putut încărca județele')
        }

        const data = await response.json()
        setJudete(data)

        if (data.length > 0) {
          await handleSelectJudet(data[0])
        }
      } catch (err) {
        setError(err.message || 'A apărut o eroare')
      } finally {
        setLoading(false)
      }
    }

    loadJudete()
  }, [])

  useEffect(() => {
    function handleFullscreenChange() {
      setIsMapFullscreen(document.fullscreenElement === mapPanelRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  async function toggleMapFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await mapPanelRef.current?.requestFullscreen()
      } else if (document.fullscreenElement === mapPanelRef.current) {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }

  async function handleSelectJudet(judet) {
    try {
      setSelectedJudet(judet)
      setDetailsLoading(true)
      setRouteFilter('')
      setIndicatorFilter('')
      setStatusFilter('')
      setSearchFilter('')

      const [detailsResponse, puncteResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/harta/judete/${judet.cod_judet}`),
        fetch(`${API_BASE_URL}/api/harta/judete/${judet.cod_judet}/puncte`),
      ])

      if (!detailsResponse.ok) {
        throw new Error('Nu am putut încărca fișa județului')
      }

      if (!puncteResponse.ok) {
        throw new Error('Nu am putut încărca punctele județului')
      }

      const detailsData = await detailsResponse.json()
      const puncteData = await puncteResponse.json()

      setJudetDetails(detailsData)
      setJudetPuncte(puncteData)
    } catch (err) {
      setError(err.message || 'A apărut o eroare la încărcarea fișei județului')
    } finally {
      setDetailsLoading(false)
    }
  }

  const routeOptions = useMemo(() => {
    return [...new Set(judetPuncte.map((p) => p.cod_ruta).filter(Boolean))].sort()
  }, [judetPuncte])

  const indicatorOptions = useMemo(() => {
    return [...new Set(judetPuncte.map((p) => p.tip_indicator).filter(Boolean))].sort()
  }, [judetPuncte])

  const statusOptions = useMemo(() => {
    return [...new Set(judetPuncte.map((p) => p.status_operational).filter(Boolean))].sort()
  }, [judetPuncte])

  const filteredPuncte = useMemo(() => {
    return judetPuncte.filter((punct) => {
      const routeOk = !routeFilter || punct.cod_ruta === routeFilter
      const indicatorOk = !indicatorFilter || punct.tip_indicator === indicatorFilter
      const statusOk = !statusFilter || punct.status_operational === statusFilter
      const searchOk =
        !searchFilter ||
        punct.cod_punct?.toLowerCase().includes(searchFilter.toLowerCase())

      return routeOk && indicatorOk && statusOk && searchOk
    })
  }, [judetPuncte, routeFilter, indicatorFilter, statusFilter, searchFilter])

  const s = judetDetails?.summary

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>ROA - Hartă operațională</h1>
        <p>Dashboard județe pentru România Atractivă</p>
      </header>

      {loading && <p>Se încarcă datele...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <>
          <section
            ref={mapPanelRef}
            className={`map-panel ${isMapFullscreen ? 'map-panel-fullscreen' : ''}`}
          >
            <div className="map-panel-header">
              <h2>Hartă județe</h2>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <div className="map-legend">
                  <span className="legend-pill legend-complete">avize mari complete</span>
                  <span className="legend-pill legend-neutral">rest județe</span>
                </div>

                <button
                  type="button"
                  onClick={toggleMapFullscreen}
                  className="fullscreen-button"
                >
                  {isMapFullscreen ? 'Ieșire fullscreen' : 'Fullscreen'}
                </button>
              </div>
            </div>

            <RomaniaMap
              judete={judete}
              selectedJudet={selectedJudet}
              onSelectJudet={handleSelectJudet}
              isFullscreen={isMapFullscreen}
            />
          </section>

          <div className="main-two-columns">
            <section className="summary-panel">
              <h2>Fișă județ</h2>

              {detailsLoading && <p>Se încarcă detaliile...</p>}

              {!detailsLoading && s && (
                <>
                  <div className="details-card">
                    <h3>
                      {s.nume_judet} ({s.cod_judet})
                    </h3>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <KpiCard label="Total puncte" value={s.total_puncte} />
                      <KpiCard label="Eligibile" value={s.puncte_eligibile_montaj || 0} />
                      <KpiCard label="Montate" value={s.puncte_montate || 0} />
                      <KpiCard label="Rămase" value={s.puncte_ramase_montaj || 0} />
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '10px',
                        marginBottom: '12px',
                      }}
                    >
                      <KpiCard label="Cost total" value={formatLei(s.cost_total)} />
                      <KpiCard label="Venit total" value={formatLei(s.venit_total)} />
                      <KpiCard label="Diferență" value={formatLei(s.diferenta_venit_cost)} />
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          border: '1px solid rgba(60,60,67,0.12)',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        <p><strong>Avizare</strong></p>
                        <p>DR_IGPR: {s.dr_igpr_status || 'nesolicitat'}</p>
                        <p>IPJ: {s.ipj_status || 'nesolicitat'}</p>
                        <p>IPJ_SIG_CIRC: {s.ipj_sig_circ_status || 'nesolicitat'}</p>
                        <p>CNAIR: {s.cnair_status || 'nesolicitat'}</p>
                        <p>CJ: {s.cj_status || 'nesolicitat'}</p>
                        <p>UAT cu aviz: {s.uat_cu_aviz || 0} / {s.uat_total || 0}</p>
                      </div>

                      <div
                        style={{
                          border: '1px solid rgba(60,60,67,0.12)',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        <p><strong>Indicatori suport</strong></p>
                        <p>În avizare: {s.puncte_in_avizare}</p>
                        <p>Eliminate IGPR: {s.puncte_eliminate_igpr}</p>
                        <p>Total T17: {s.total_t17}</p>
                        <p>Total PV UAT: {s.total_pv_uat}</p>
                        <p>Obiective: {s.nr_obiective || 0}</p>
                        <p>UAT nesolicitate: {s.uat_nesolicitate || 0}</p>
                      </div>
                    </div>

                    <div style={{ marginTop: '12px' }}>
                      <p><strong>Decontare rute</strong></p>
                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginTop: '6px',
                        }}
                      >
                        {s.situatie_decontare_rute ? (
                          s.situatie_decontare_rute.split(' | ').map((linie, index) => (
                            <span
                              key={index}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '7px 10px',
                                borderRadius: '999px',
                                background: '#f2f2f7',
                                border: '1px solid rgba(60,60,67,0.12)',
                                fontSize: '11px',
                                fontWeight: 600,
                              }}
                            >
                              {linie}
                            </span>
                          ))
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '7px 10px',
                              borderRadius: '999px',
                              background: '#f2f2f7',
                              border: '1px solid rgba(60,60,67,0.12)',
                              fontSize: '11px',
                              fontWeight: 600,
                            }}
                          >
                            Fără date
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="subsection">
                    <h3>Rute</h3>
                    <div className="mini-table">
                      {judetDetails.routes?.map((route) => (
                        <div key={route.cod_ruta} className="mini-row">
                          <div>
                            <strong>{route.cod_ruta}</strong> - {route.nume_ruta}
                          </div>
                          <div>Total: {route.total_puncte}</div>
                          <div>În avizare: {route.puncte_in_avizare}</div>
                          <div>Eliminate: {route.puncte_eliminate_igpr}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>

            <section className="summary-panel">
              <h2>UAT-uri</h2>

              {detailsLoading && <p>Se încarcă detaliile...</p>}

              {!detailsLoading && judetDetails?.uat && (
                <div className="mini-table">
                  {judetDetails.uat.slice(0, 20).map((uat) => (
                    <div key={uat.cod_uat} className="mini-row">
                      <div>
                        <strong>{uat.nume_uat}</strong>
                      </div>
                      <div>Total: {uat.total_puncte}</div>
                      <div>În avizare: {uat.puncte_in_avizare}</div>
                      <div>Eliminate: {uat.puncte_eliminate_igpr}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="bottom-panel">
            <div className="bottom-panel-header">
              <h2>
                Puncte {selectedJudet ? `- ${selectedJudet.nume_judet} (${selectedJudet.cod_judet})` : ''}
              </h2>

              <div className="filters">
                <input
                  type="text"
                  placeholder="Caută cod punct"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />

                <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)}>
                  <option value="">Toate rutele</option>
                  {routeOptions.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>

                <select value={indicatorFilter} onChange={(e) => setIndicatorFilter(e.target.value)}>
                  <option value="">Toate tipurile</option>
                  {indicatorOptions.map((indicator) => (
                    <option key={indicator} value={indicator}>
                      {indicator}
                    </option>
                  ))}
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Toate statusurile</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="results-count">Rezultate afișate: {filteredPuncte.length}</p>

            <div className="points-table-wrapper">
              <table className="points-table points-table-compact">
                <thead>
                  <tr>
                    <th>Cod punct</th>
                    <th>Rută</th>
                    <th>Indicator</th>
                    <th>Tip drum</th>
                    <th>Regim</th>
                    <th>Poliție</th>
                    <th>Administrator</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPuncte.slice(0, 100).map((punct) => (
                    <tr key={punct.punct_id}>
                      <td>{punct.cod_punct}</td>
                      <td>{punct.cod_ruta}</td>
                      <td>{punct.tip_indicator}</td>
                      <td>{punct.tip_drum}</td>
                      <td>{punct.regim_documente}</td>
                      <td>{punct.autoritate_politie_cod || '-'}</td>
                      <td>{punct.autoritate_admin_cod || '-'}</td>
                      <td>{punct.status_operational}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}