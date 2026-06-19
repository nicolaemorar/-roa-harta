import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import RomaniaMap from './RomaniaMap'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'

function formatLei(value) {
  const num = Number(value || 0)
  return `${num.toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} lei`
}

function formatPercent(value) {
  const num = Number(value || 0)
  return `${num.toLocaleString('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`
}

function normalizeMontajItem(item) {
  return {
    ...item,
    stalpi_eligibili: Number(item?.stalpi_eligibili ?? 0),
    stalpi_montati: Number(item?.stalpi_montati ?? 0),
    stalpi_ramasi: Number(item?.stalpi_ramasi ?? 0),
    stalpi_in_verificare: Number(item?.stalpi_in_verificare ?? 0),
    procent_montat: Number(item?.procent_montat ?? 0),
    venit_total: Number(item?.venit_total ?? 0),
    marja_estimativa:
      item?.marja_estimativa != null ? Number(item.marja_estimativa) : null,
    marja_la_zi:
      item?.marja_la_zi != null ? Number(item.marja_la_zi) : null,
  }
}

function normalizeRouteSummaryItem(item) {
  return {
    ...item,
    valoare_ruta: Number(item?.valoare_ruta ?? 0),
    cheltuiala_ruta: Number(item?.cheltuiala_ruta ?? 0),
    cheltuiala_totala_judete_din_ruta: Number(item?.cheltuiala_totala_judete_din_ruta ?? 0),
    nr_obiective_ruta: Number(item?.nr_obiective_ruta ?? 0),
    judete_total: Number(item?.judete_total ?? 0),
    judete_finalizate: Number(item?.judete_finalizate ?? 0),
    judete_in_lucru: Number(item?.judete_in_lucru ?? 0),
  }
}

export default function App() {
  const [judete, setJudete] = useState([])
  const [selectedJudet, setSelectedJudet] = useState(null)
  const [judetDetails, setJudetDetails] = useState(null)
  const [judetPuncte, setJudetPuncte] = useState([])
  const [loading, setLoading] = useState(true)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [error, setError] = useState('')

  const [routeSummaries, setRouteSummaries] = useState([])
  const [selectedRuta, setSelectedRuta] = useState('TOATE')

  const [routeFilter, setRouteFilter] = useState('')
  const [indicatorFilter, setIndicatorFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  const mapPanelRef = useRef(null)

  async function handleToggleFullscreen() {
    const el = mapPanelRef.current
    if (!el) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await el.requestFullscreen()
      }
    } catch (fullscreenError) {
      console.error('Fullscreen error:', fullscreenError)
    }
  }

  useEffect(() => {
    async function loadJudete() {
      try {
        setLoading(true)
        setError('')

        const [dashboardResponse, montajResponse, routeSummaryResponse] = await Promise.all([
          fetch(`${API_BASE}/api/harta/judete`),
          fetch(`${API_BASE}/api/montaj/judete-summary`),
          fetch(`${API_BASE}/api/rute/summary`),
        ])

        if (!dashboardResponse.ok) {
          throw new Error('Nu am putut încărca județele din dashboard')
        }

        if (!montajResponse.ok) {
          throw new Error('Nu am putut încărca progresul de montaj')
        }

        if (!routeSummaryResponse.ok) {
          throw new Error('Nu am putut încărca sumarul rutelor')
        }

        const dashboardData = await dashboardResponse.json()
        const rawMontajData = await montajResponse.json()
        const rawRouteSummaryData = await routeSummaryResponse.json()

        const montajData = rawMontajData.map(normalizeMontajItem)
        const normalizedRouteSummaries = rawRouteSummaryData.map(normalizeRouteSummaryItem)

        setRouteSummaries(normalizedRouteSummaries)

        const montajMap = new Map(montajData.map((item) => [item.cod_judet, item]))

        const merged = dashboardData.map((judet) => {
          const montaj = montajMap.get(judet.cod_judet) ?? {}

          const stalpiEligibili = Number(montaj.stalpi_eligibili ?? 0)
          const stalpiMontati = Number(montaj.stalpi_montati ?? 0)
          const stalpiRamasi = Number(montaj.stalpi_ramasi ?? 0)
          const stalpiInVerificare = Number(montaj.stalpi_in_verificare ?? 0)
          const procentMontat = Number(montaj.procent_montat ?? 0)

          return {
            ...judet,
            stalpi_eligibili: stalpiEligibili,
            stalpi_montati: stalpiMontati,
            stalpi_ramasi: stalpiRamasi,
            stalpi_in_verificare: stalpiInVerificare,
            procent_montat: procentMontat,
            puncte_montate_actual: stalpiMontati,
            puncte_ramase_actual: stalpiRamasi,
            marja_estimativa:
              montaj.marja_estimativa != null ? Number(montaj.marja_estimativa) : null,
            marja_la_zi:
              montaj.marja_la_zi != null ? Number(montaj.marja_la_zi) : null,
          }
        })

        setJudete(merged)

        if (merged.length > 0) {
          await handleSelectJudet(merged[0], montajData)
        }
      } catch (err) {
        setError(err.message || 'A apărut o eroare')
      } finally {
        setLoading(false)
      }
    }

    loadJudete()
  }, [])

  async function handleSelectJudet(judet, montajSummaryDataFromLoad = null) {
    try {
      setSelectedJudet(judet)
      setDetailsLoading(true)
      setRouteFilter('')
      setIndicatorFilter('')
      setStatusFilter('')
      setSearchFilter('')
      setError('')

      const [detailsResponse, puncteResponse, montajSummaryResponse] = await Promise.all([
        fetch(`${API_BASE}/api/harta/judete/${judet.cod_judet}`),
        fetch(`${API_BASE}/api/harta/judete/${judet.cod_judet}/puncte`),
        montajSummaryDataFromLoad
          ? Promise.resolve({ ok: true, json: async () => montajSummaryDataFromLoad })
          : fetch(`${API_BASE}/api/montaj/judete-summary`),
      ])

      if (!detailsResponse.ok) {
        throw new Error('Nu am putut încărca fișa județului')
      }

      if (!puncteResponse.ok) {
        throw new Error('Nu am putut încărca punctele județului')
      }

      if (!montajSummaryResponse.ok) {
        throw new Error('Nu am putut încărca sumarul de montaj')
      }

      const detailsData = await detailsResponse.json()
      const puncteData = await puncteResponse.json()
      const rawMontajSummaryData = await montajSummaryResponse.json()
      const montajSummaryData = rawMontajSummaryData.map(normalizeMontajItem)

      const montajSummary =
        montajSummaryData.find((x) => x.cod_judet === judet.cod_judet) ?? {}

      const stalpiEligibili = Number(montajSummary.stalpi_eligibili ?? 0)
      const stalpiMontati = Number(montajSummary.stalpi_montati ?? 0)
      const stalpiRamasi = Number(montajSummary.stalpi_ramasi ?? 0)
      const stalpiInVerificare = Number(montajSummary.stalpi_in_verificare ?? 0)
      const procentMontat = Number(montajSummary.procent_montat ?? 0)

      const mergedSummary = {
        ...detailsData.summary,
        stalpi_eligibili: stalpiEligibili,
        stalpi_montati: stalpiMontati,
        stalpi_ramasi: stalpiRamasi,
        stalpi_in_verificare: stalpiInVerificare,
        procent_montat: procentMontat,
        puncte_montate_actual: stalpiMontati,
        puncte_ramase_actual: stalpiRamasi,
        marja_estimativa:
          montajSummary.marja_estimativa != null
            ? Number(montajSummary.marja_estimativa)
            : null,
        marja_la_zi:
          montajSummary.marja_la_zi != null
            ? Number(montajSummary.marja_la_zi)
            : null,
      }

      setJudetDetails({
        ...detailsData,
        summary: mergedSummary,
      })

      setJudetPuncte(puncteData)
    } catch (err) {
      setError(err.message || 'A apărut o eroare la încărcarea fișei județului')
    } finally {
      setDetailsLoading(false)
    }
  }

  const routeOptions = useMemo(() => {
    return ['TOATE', ...routeSummaries.map((route) => route.cod_ruta)]
  }, [routeSummaries])

  const selectedRouteSummary = useMemo(() => {
    if (!selectedRuta || selectedRuta === 'TOATE') return null
    return routeSummaries.find((route) => route.cod_ruta === selectedRuta) || null
  }, [routeSummaries, selectedRuta])

  const routeOptionsForTable = useMemo(() => {
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
      const selectedRutaOk =
        !selectedRuta || selectedRuta === 'TOATE' || punct.cod_ruta === selectedRuta
      const routeOk = !routeFilter || punct.cod_ruta === routeFilter
      const indicatorOk = !indicatorFilter || punct.tip_indicator === indicatorFilter
      const statusOk = !statusFilter || punct.status_operational === statusFilter
      const searchOk =
        !searchFilter ||
        punct.cod_punct?.toLowerCase().includes(searchFilter.toLowerCase())

      return selectedRutaOk && routeOk && indicatorOk && statusOk && searchOk
    })
  }, [judetPuncte, selectedRuta, routeFilter, indicatorFilter, statusFilter, searchFilter])

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
          <section className="map-panel" ref={mapPanelRef}>
            <div className="map-panel-header">
              <div className="map-panel-title-row">
                <h2>Hartă județe</h2>

                <div className="map-panel-actions">
                  <div className="route-filter-wrapper">
                    <span className="route-filter-label">Rută:</span>
                    <select
                      className="route-filter-select"
                      value={selectedRuta}
                      onChange={(e) => setSelectedRuta(e.target.value)}
                    >
                      {routeOptions.map((routeCode) => (
                        <option key={routeCode} value={routeCode}>
                          {routeCode === 'TOATE' ? 'Toate rutele' : routeCode}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="fullscreen-btn"
                    onClick={handleToggleFullscreen}
                  >
                    Full screen
                  </button>
                </div>
              </div>

              <div className="map-legend">
                <span className="legend-pill legend-start">0% montat</span>
                <span className="legend-pill legend-progress">progres montaj</span>
                <span className="legend-pill legend-mounted">100% montat</span>
              </div>
            </div>

            {selectedRouteSummary && (
              <div className="route-summary-card">
                <div className="route-summary-title">
                  {selectedRouteSummary.cod_ruta} - {selectedRouteSummary.nume_ruta}
                </div>

                <div className="route-summary-line">
                  <span>Valoare rută</span>
                  <strong>{formatLei(selectedRouteSummary.valoare_ruta)}</strong>
                </div>

                <div className="route-summary-line">
                  <span>Cheltuială rută</span>
                  <strong>{formatLei(selectedRouteSummary.cheltuiala_ruta)}</strong>
                </div>

                <div className="route-summary-line">
                  <span>Cheltuială totală județe din rută</span>
                  <strong>{formatLei(selectedRouteSummary.cheltuiala_totala_judete_din_ruta)}</strong>
                </div>

                <div className="route-summary-line">
                  <span>Obiective rută</span>
                  <strong>{selectedRouteSummary.nr_obiective_ruta || 0}</strong>
                </div>

                <div className="route-summary-line">
                  <span>Județe</span>
                  <strong>{selectedRouteSummary.judete_total || 0}</strong>
                </div>

                <div className="route-summary-line">
                  <span>Finalizate</span>
                  <strong>{selectedRouteSummary.judete_finalizate || 0}</strong>
                </div>

                <div className="route-summary-line">
                  <span>În lucru</span>
                  <strong>{selectedRouteSummary.judete_in_lucru || 0}</strong>
                </div>
              </div>
            )}

            <RomaniaMap
              judete={judete}
              selectedJudet={selectedJudet}
              onSelectJudet={handleSelectJudet}
              selectedRuta={selectedRuta}
            />
          </section>

          <div className="main-two-columns">
            <section className="summary-panel">
              <h2>Fișă județ</h2>

              {detailsLoading && <p>Se încarcă detaliile...</p>}

              {!detailsLoading && judetDetails?.summary && (
                <>
                  <div className="details-card">
                    <h3>
                      {judetDetails.summary.nume_judet} ({judetDetails.summary.cod_judet})
                    </h3>

                    <p>Total puncte: {judetDetails.summary.total_puncte}</p>
                    <p>Puncte eliminate IGPR: {judetDetails.summary.puncte_eliminate_igpr}</p>
                    <p>Puncte eligibile montaj: {judetDetails.summary.puncte_eligibile_montaj || 0}</p>
                    <p>Puncte montate: {judetDetails.summary.puncte_montate_actual || 0}</p>
                    <p>Puncte rămase: {judetDetails.summary.puncte_ramase_actual || 0}</p>

                    <hr />

                    <p><strong>Montaj stâlpi</strong></p>
                    <p>Stâlpi eligibili: {judetDetails.summary.stalpi_eligibili || 0}</p>
                    <p>Stâlpi montați: {judetDetails.summary.stalpi_montati || 0}</p>
                    <p>Stâlpi rămași: {judetDetails.summary.stalpi_ramasi || 0}</p>
                    <p>Stâlpi în verificare: {judetDetails.summary.stalpi_in_verificare || 0}</p>
                    <p>Procent montat: {formatPercent(judetDetails.summary.procent_montat)}</p>

                    <hr />

                    <p>Puncte de început: {judetDetails.summary.puncte_de_inceput}</p>
                    <p>Puncte în avizare: {judetDetails.summary.puncte_in_avizare}</p>
                    <p>Total T17: {judetDetails.summary.total_t17}</p>
                    <p>Total PV UAT: {judetDetails.summary.total_pv_uat}</p>
                    <p>Procent în avizare: {judetDetails.summary.procent_in_avizare}%</p>
                    <p>Procent eliminat IGPR: {judetDetails.summary.procent_eliminat_igpr}%</p>

                    <hr />

                    <p><strong>Avizare mare</strong></p>
                    <p>DR_IGPR: {judetDetails.summary.dr_igpr_status || 'nesolicitat'}</p>
                    <p>IPJ: {judetDetails.summary.ipj_status || 'nesolicitat'}</p>
                    <p>IPJ_SIG_CIRC: {judetDetails.summary.ipj_sig_circ_status || 'nesolicitat'}</p>
                    <p>CNAIR: {judetDetails.summary.cnair_status || 'nesolicitat'}</p>
                    <p>CJ: {judetDetails.summary.cj_status || 'nesolicitat'}</p>
                    <p>
                      UAT cu aviz: {judetDetails.summary.uat_cu_aviz || 0} /{' '}
                      {judetDetails.summary.uat_total || 0}
                    </p>
                    <p>UAT cu cerere: {judetDetails.summary.uat_cu_cerere || 0}</p>
                    <p>UAT cu clarificări: {judetDetails.summary.uat_cu_clarificari || 0}</p>
                    <p>UAT nesolicitate: {judetDetails.summary.uat_nesolicitate || 0}</p>

                    <hr />

                    <p><strong>Costuri standard</strong></p>
                    <p>Cost materiale: {formatLei(judetDetails.summary.cost_materiale)}</p>
                    <p>Cost manoperă: {formatLei(judetDetails.summary.cost_manopera)}</p>
                    <p>Cost total: {formatLei(judetDetails.summary.cost_total)}</p>

                    <hr />

                    <p><strong>Venituri</strong></p>
                    <p>Număr obiective: {judetDetails.summary.nr_obiective || 0}</p>
                    <p>Venit total: {formatLei(judetDetails.summary.venit_total)}</p>
                    <p>Diferență venit - cost: {formatLei(judetDetails.summary.diferenta_venit_cost)}</p>
                    {judetDetails.summary.marja_estimativa !== null && (
                      <p>Marjă estimativă stâlpi: {formatLei(judetDetails.summary.marja_estimativa)}</p>
                    )}
                    {judetDetails.summary.marja_la_zi !== null && (
                      <p>Marjă la zi: {formatLei(judetDetails.summary.marja_la_zi)}</p>
                    )}

                    <hr />

                    <p><strong>Decontare rute</strong></p>
                    {judetDetails.summary.situatie_decontare_rute ? (
                      judetDetails.summary.situatie_decontare_rute
                        .split(' | ')
                        .map((linie, index) => <p key={index}>{linie}</p>)
                    ) : (
                      <p>Fără date</p>
                    )}
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
                  <option value="">Toate rutele din județ</option>
                  {routeOptionsForTable.map((route) => (
                    <option key={route} value={route}>
                      {route}
                    </option>
                  ))}
                </select>

                <select
                  value={indicatorFilter}
                  onChange={(e) => setIndicatorFilter(e.target.value)}
                >
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

