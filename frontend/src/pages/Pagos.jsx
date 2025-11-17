import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:8000/api";

const Pagos = () => {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("pendientes");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [montoPago, setMontoPago] = useState(""); 
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [guardando, setGuardando] = useState(false);
  
  // Estados para control de caja
  const [modalAperturaCaja, setModalAperturaCaja] = useState(false);
  const [montoApertura, setMontoApertura] = useState("");
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [pagosPendientes, setPagosPendientes] = useState(null);

  useEffect(() => {
    verificarTurnoActivo();
    cargarReservas();
  }, []);

  const verificarTurnoActivo = async () => {
    try {
      const res = await fetch(`${API_URL}/caja/turnos/turno_activo/`);
      const data = await res.json();
      if (data.existe) {
        setTurnoActivo(data.turno);
      } else {
        setTurnoActivo(null);
      }
    } catch (err) {
      console.error("Error verificando turno:", err);
      setTurnoActivo(null);
    }
  };

  const cargarReservas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reservas/?estado=confirmada`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const todasReservas = Array.isArray(data) ? data : data?.results ?? [];
      
      const reservasConPagos = todasReservas.map(reserva => {
        const total = parseFloat(reserva.total || 0);
        const seña = parseFloat(reserva.seña || reserva.senia || reserva.sena || 0);
        const saldoPagado = parseFloat(reserva.saldo_pagado || 0);
        const pendiente = Math.max(0, parseFloat((total - seña - saldoPagado).toFixed(2)));
        
        return {
          ...reserva,
          total: parseFloat(total.toFixed(2)),
          seña: parseFloat(seña.toFixed(2)),
          saldo_pagado: parseFloat(saldoPagado.toFixed(2)),
          pendiente: parseFloat(pendiente.toFixed(2)),
          estado_pago: pendiente <= 0 ? 'pagado' : seña > 0 ? 'parcial' : 'sin_pagar'
        };
      });

      setReservas(reservasConPagos);
    } catch (err) {
      console.error("Error cargando reservas:", err);
    } finally {
      setLoading(false);
    }
  };

  const abrirCaja = async () => {
    if (!montoApertura || parseFloat(montoApertura) < 0) {
      alert("Ingresa un monto de apertura válido");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/caja/turnos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto_apertura: parseFloat(montoApertura) })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setTurnoActivo(data);
      setModalAperturaCaja(false);
      setMontoApertura("");
      
      alert("✅ Caja abierta exitosamente");
      
      if (pagosPendientes) {
        await registrarPagoDirecto(
          pagosPendientes.reserva,
          pagosPendientes.monto,
          pagosPendientes.metodo
        );
        setPagosPendientes(null);
      }
    } catch (err) {
      console.error("Error abriendo caja:", err);
      alert("❌ Error al abrir la caja");
    }
  };

  const abrirModalPago = async (reserva) => {
    await verificarTurnoActivo();
    
    if (!turnoActivo) {
      setPagosPendientes({
        reserva,
        monto: parseFloat(reserva.pendiente),
        metodo: "efectivo"
      });
      setModalAperturaCaja(true);
      return;
    }

    setReservaSeleccionada(reserva);
    setMontoPago(reserva.pendiente.toString());
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setReservaSeleccionada(null);
    setMontoPago("");
    setMetodoPago("efectivo");
  };

  const registrarPago = async () => {
    if (!montoPago || parseFloat(montoPago) <= 0) {
      alert("Ingresa un monto válido");
      return;
    }

    const monto = parseFloat(montoPago);
    
    if (monto > reservaSeleccionada.pendiente) {
      alert(`El monto no puede superar el pendiente: $${reservaSeleccionada.pendiente.toFixed(2)}`);
      return;
    }

    await registrarPagoDirecto(reservaSeleccionada, monto, metodoPago);
  };

  const registrarPagoDirecto = async (reserva, monto, metodo) => {
    setGuardando(true);
    try {
      const nuevoSaldoPagado = parseFloat(reserva.saldo_pagado || 0) + monto;

      const body = {
        saldo_pagado: parseFloat(nuevoSaldoPagado.toFixed(2)),
        metodo_pago: metodo,
        fecha_pago: new Date().toISOString()
      };

      const res = await fetch(`${API_URL}/reservas/${reserva.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      alert(`✅ Pago de $${monto.toFixed(2)} registrado exitosamente y guardado en caja`);
      cerrarModal();
      
      await cargarReservas();
      await verificarTurnoActivo();
    } catch (err) {
      console.error("❌ Error registrando pago:", err);
      alert(`❌ Error al registrar el pago: ${err.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    const [year, month, day] = fecha.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString("es-ES", { 
      day: "numeric", 
      month: "short",
      year: "numeric"
    });
  };

  const formatearHora = (hora) => {
    if (!hora) return "-";
    const [h, m] = hora.substring(0, 5).split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const reservasFiltradas = reservas.filter(r => {
    if (filtro === "pendientes") return r.pendiente > 0;
    if (filtro === "pagadas") return r.pendiente <= 0;
    return true;
  });

  const getEstadoPagoColor = (estadoPago) => {
    switch(estadoPago) {
      case 'pagado': return '#4caf50';
      case 'parcial': return '#ff9800';
      case 'sin_pagar': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const getEstadoPagoTexto = (estadoPago) => {
    switch(estadoPago) {
      case 'pagado': return '✅ Pagado';
      case 'parcial': return '⏳ Pago parcial';
      case 'sin_pagar': return '❌ Sin pagar';
      default: return estadoPago;
    }
  };

  const totalRecaudado = reservas.reduce((sum, r) => {
    const seña = parseFloat(r.seña || 0);
    const saldoPagado = parseFloat(r.saldo_pagado || 0);
    return sum + seña + saldoPagado;
  }, 0);
  
  const totalPendiente = reservas.reduce((sum, r) => {
    return sum + parseFloat(r.pendiente || 0);
  }, 0);
  
  const reservasConSeña = reservas.filter(r => parseFloat(r.seña || 0) > 0).length;

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', minHeight: '100vh', color: '#fff' }}>
      <style>{`
        .pagos-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          flex-wrap: wrap;
          gap: 20px;
        }
        .filtros-pagos {
          display: flex;
          gap: 10px;
        }
        .filtro-btn {
          padding: 8px 20px;
          border: 2px solid #444;
          background: #2a2a2a;
          color: #fff;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }
        .filtro-btn.active {
          background: #ffc107;
          color: #000;
          border-color: #ffc107;
        }
        .filtro-btn:hover {
          border-color: #ffc107;
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card-pago {
          background: linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%);
          padding: 20px;
          border-radius: 12px;
          border-left: 4px solid #ffc107;
        }
        .stat-label {
          color: #aaa;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .stat-value {
          color: #ffc107;
          font-size: 28px;
          font-weight: 700;
        }
        .reservas-grid {
          display: grid;
          gap: 20px;
        }
        .reserva-pago-card {
          background: #2a2a2a;
          border-radius: 12px;
          overflow: hidden;
          border: 2px solid #333;
          transition: all 0.3s;
        }
        .reserva-pago-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
          border-color: #ffc107;
        }
        .reserva-pago-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: rgba(255, 193, 7, 0.05);
          border-bottom: 1px solid #333;
        }
        .cliente-info {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .cliente-nombre-pago {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
        }
        .fecha-hora-pago {
          font-size: 14px;
          color: #aaa;
        }
        .estado-pago-badge {
          padding: 6px 16px;
          border-radius: 20px;
          color: white;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .reserva-pago-body {
          padding: 20px;
        }
        .servicios-pago {
          margin-bottom: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid #333;
        }
        .servicio-item-pago {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          color: #ccc;
          font-size: 14px;
        }
        .desglose-pago {
          display: grid;
          gap: 12px;
          margin-bottom: 20px;
        }
        .linea-pago {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #1a1a1a;
          border-radius: 6px;
        }
        .linea-pago.total {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid #ffc107;
          font-weight: 700;
          font-size: 16px;
        }
        .linea-pago.pendiente {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid #f44336;
          font-weight: 700;
          color: #f44336;
        }
        .linea-pago.pagado-item {
          background: rgba(76, 175, 80, 0.1);
          border: 1px solid #4caf50;
        }
        .label-pago {
          color: #aaa;
          font-size: 14px;
        }
        .monto-pago {
          color: #fff;
          font-weight: 600;
        }
        .acciones-pago {
          display: flex;
          gap: 10px;
        }
        .btn-pago {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-saldo {
          background: #4caf50;
          color: white;
        }
        .btn-saldo:hover {
          background: #388e3c;
          transform: translateY(-2px);
        }
        .btn-pago:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-content {
          background: #2a2a2a;
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        .modal-header {
          padding: 24px;
          border-bottom: 1px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-title {
          font-size: 20px;
          font-weight: 700;
          color: #ffc107;
        }
        .btn-cerrar {
          background: none;
          border: none;
          color: #aaa;
          font-size: 28px;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        .btn-cerrar:hover {
          background: #333;
          color: #fff;
        }
        .modal-body {
          padding: 24px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-label {
          display: block;
          color: #ffc107;
          font-weight: 600;
          margin-bottom: 8px;
          font-size: 14px;
        }
        .form-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #444;
          border-radius: 8px;
          background: #1a1a1a;
          color: #fff;
          font-size: 16px;
          transition: all 0.2s;
        }
        .form-input:focus {
          outline: none;
          border-color: #ffc107;
          box-shadow: 0 0 0 3px rgba(255, 193, 7, 0.1);
        }
        .info-box {
          background: rgba(255, 193, 7, 0.1);
          border: 1px solid #ffc107;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .info-item {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          color: #fff;
        }
        .alert-info {
          background: rgba(33, 150, 243, 0.1);
          border: 1px solid #2196f3;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          color: #64b5f6;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .modal-footer {
          padding: 24px;
          border-top: 1px solid #333;
          display: flex;
          gap: 12px;
        }
        .btn-modal {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-cancelar {
          background: #444;
          color: #fff;
        }
        .btn-cancelar:hover {
          background: #555;
        }
        .btn-confirmar {
          background: #ffc107;
          color: #000;
        }
        .btn-confirmar:hover {
          background: #ffca28;
          transform: translateY(-2px);
        }
        .btn-confirmar:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #aaa;
        }
        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        @media (max-width: 768px) {
          .pagos-header {
            flex-direction: column;
            align-items: stretch;
          }
          .filtros-pagos {
            flex-wrap: wrap;
          }
          .acciones-pago {
            flex-direction: column;
          }
          .modal-footer {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="pagos-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#fff' }}>💰 Gestión de Pagos</h2>
          <div style={{ 
            display: 'inline-block',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            background: turnoActivo ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)',
            color: turnoActivo ? '#4caf50' : '#f44336',
            border: `2px solid ${turnoActivo ? '#4caf50' : '#f44336'}`
          }}>
            {turnoActivo ? '🟢 Caja Abierta' : '🔴 Caja Cerrada'}
          </div>
        </div>
        <div className="filtros-pagos">
          <button 
            className={`filtro-btn ${filtro === "pendientes" ? "active" : ""}`}
            onClick={() => setFiltro("pendientes")}
          >
            Pendientes
          </button>
          <button 
            className={`filtro-btn ${filtro === "pagadas" ? "active" : ""}`}
            onClick={() => setFiltro("pagadas")}
          >
            Pagadas
          </button>
          <button 
            className={`filtro-btn ${filtro === "todas" ? "active" : ""}`}
            onClick={() => setFiltro("todas")}
          >
            Todas
          </button>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-card-pago">
          <div className="stat-label">💵 Total Recaudado</div>
          <div className="stat-value">${totalRecaudado.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
        </div>
        <div className="stat-card-pago">
          <div className="stat-label">⏳ Pendiente de Cobro</div>
          <div className="stat-value" style={{ color: '#f44336' }}>${totalPendiente.toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
        </div>
        <div className="stat-card-pago">
          <div className="stat-label">✅ Reservas con Seña</div>
          <div className="stat-value">{reservasConSeña}</div>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">Cargando reservas...</div>
      ) : reservasFiltradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <p>No hay reservas {filtro === "pendientes" ? "con pagos pendientes" : filtro === "pagadas" ? "completamente pagadas" : ""}</p>
        </div>
      ) : (
        <div className="reservas-grid">
          {reservasFiltradas.map(reserva => (
            <div key={reserva.id} className="reserva-pago-card">
              <div className="reserva-pago-header">
                <div className="cliente-info">
                  <div className="cliente-nombre-pago">
                    {reserva.nombre_cliente} {reserva.apellido_cliente}
                  </div>
                  <div className="fecha-hora-pago">
                    📅 {formatearFecha(reserva.fecha)} • 🕐 {formatearHora(reserva.horario)}
                  </div>
                  <div className="fecha-hora-pago">
                    ✂️ {reserva.barbero_nombre || "Sin asignar"}
                  </div>
                </div>
                <div 
                  className="estado-pago-badge"
                  style={{ backgroundColor: getEstadoPagoColor(reserva.estado_pago) }}
                >
                  {getEstadoPagoTexto(reserva.estado_pago)}
                </div>
              </div>

              <div className="reserva-pago-body">
                <div className="servicios-pago">
                  <strong style={{ color: '#ffc107', display: 'block', marginBottom: '10px' }}>
                    🧴 Servicios:
                  </strong>
                  {reserva.servicios?.map((servicio, idx) => (
                    <div key={idx} className="servicio-item-pago">
                      <span>{servicio.nombre}</span>
                      <span>${parseFloat(servicio.precio || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                    </div>
                  ))}
                </div>

                <div className="desglose-pago">
                  <div className="linea-pago total">
                    <span className="label-pago">💵 Total del Servicio</span>
                    <span className="monto-pago">${parseFloat(reserva.total || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                  </div>

                  {parseFloat(reserva.seña || 0) > 0 && (
                    <div className="linea-pago pagado-item">
                      <span className="label-pago">✅ Seña Pagada</span>
                      <span className="monto-pago" style={{ color: '#4caf50' }}>
                        ${parseFloat(reserva.seña).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  )}

                  {parseFloat(reserva.saldo_pagado || 0) > 0 && (
                    <div className="linea-pago pagado-item">
                      <span className="label-pago">✅ Saldo Pagado</span>
                      <span className="monto-pago" style={{ color: '#4caf50' }}>
                        ${parseFloat(reserva.saldo_pagado).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      </span>
                    </div>
                  )}

                  {parseFloat(reserva.pendiente || 0) > 0 && (
                    <div className="linea-pago pendiente">
                      <span className="label-pago">⚠️ Pendiente</span>
                      <span className="monto-pago">${parseFloat(reserva.pendiente).toLocaleString('es-AR', {minimumFractionDigits: 2})}</span>
                    </div>
                  )}
                </div>

                {parseFloat(reserva.pendiente || 0) > 0 && (
                  <div className="acciones-pago">
                    <button 
                      className="btn-pago btn-saldo"
                      onClick={() => abrirModalPago(reserva)}
                    >
                      💵 Pagar Saldo
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAperturaCaja && (
        <div className="modal-overlay" onClick={() => {
          setModalAperturaCaja(false);
          setPagosPendientes(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">⚠️ Caja Cerrada</div>
              <button className="btn-cerrar" onClick={() => {
                setModalAperturaCaja(false);
                setPagosPendientes(null);
              }}>×</button>
            </div>
            
            <div className="modal-body">
              <p style={{ color: '#aaa', marginBottom: '24px', fontSize: '16px', lineHeight: '1.6' }}>
                Para registrar pagos, primero debes <strong style={{ color: '#ffc107' }}>abrir la caja</strong>.
                Esto te permitirá registrar los ingresos correctamente.
              </p>
              
              <div className="form-group">
                <label className="form-label">💵 Monto Inicial en Efectivo</label>
                <input
                  type="number"
                  className="form-input"
                  value={montoApertura}
                  onChange={(e) => setMontoApertura(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-modal btn-cancelar" onClick={() => {
                setModalAperturaCaja(false);
                setPagosPendientes(null);
              }}>
                Cancelar
              </button>
              <button className="btn-modal btn-confirmar" onClick={abrirCaja}>
                🔓 Abrir Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAbierto && reservaSeleccionada && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">💵 Registrar Pago de Saldo</div>
              <button className="btn-cerrar" onClick={cerrarModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="alert-info">
                ℹ️ Este pago se registrará automáticamente en la caja como ingreso
              </div>

              <div className="info-box">
                <div className="info-item">
                  <span>Cliente:</span>
                  <strong>{reservaSeleccionada.nombre_cliente} {reservaSeleccionada.apellido_cliente}</strong>
                </div>
                <div className="info-item">
                  <span>Total del servicio:</span>
                  <strong>${parseFloat(reservaSeleccionada.total || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                </div>
                {parseFloat(reservaSeleccionada.seña || 0) > 0 && (
                  <div className="info-item">
                    <span>Seña ya pagada:</span>
                    <strong style={{ color: '#4caf50' }}>${parseFloat(reservaSeleccionada.seña).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                  </div>
                )}
                {parseFloat(reservaSeleccionada.saldo_pagado || 0) > 0 && (
                  <div className="info-item">
                    <span>Saldo ya pagado:</span>
                    <strong style={{ color: '#4caf50' }}>${parseFloat(reservaSeleccionada.saldo_pagado).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                  </div>
                )}
                <div className="info-item">
                  <span>Pendiente:</span>
                  <strong style={{ color: '#f44336' }}>${parseFloat(reservaSeleccionada.pendiente || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Monto a cobrar</label>
                <input
                  type="number"
                  className="form-input"
                  value={montoPago}
                  onChange={(e) => setMontoPago(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Método de pago</label>
                <select
                  className="form-input"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option value="efectivo">💵 Efectivo</option>
                  <option value="tarjeta">💳 Tarjeta</option>
                  <option value="transferencia">🏦 Transferencia</option>
                  <option value="mercadopago">📱 Mercado Pago</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-modal btn-cancelar" onClick={cerrarModal}>
                Cancelar
              </button>
              <button 
                className="btn-modal btn-confirmar" 
                onClick={registrarPago}
                disabled={guardando}
              >
                {guardando ? "Guardando..." : "✅ Confirmar Pago"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Pagos;