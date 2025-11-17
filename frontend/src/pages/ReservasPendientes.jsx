// src/pages/ReservasPendientes.jsx
import React, { useState, useEffect } from "react";
import "./ReservasPendientes.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

export default function ReservasPendientes() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("pendiente");
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [procesando, setProcesando] = useState(null);
  
  // Estados para control de caja
  const [modalAperturaCaja, setModalAperturaCaja] = useState(false);
  const [montoApertura, setMontoApertura] = useState("");
  const [turnoActivo, setTurnoActivo] = useState(null);
  const [reservaPendienteConfirmar, setReservaPendienteConfirmar] = useState(null);

  // ===== Helpers de monto/moneda =====
  const parsePrice = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v == null) return 0;
    let s = String(v).trim();
    s = s.replace(/[^\d.,-]/g, "");
    if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  };

  const fmtCurrency = (n) =>
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);

  const toServiciosArray = (value) => {
    if (Array.isArray(value)) return value;
    if (value == null) return [];
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  // Verificar turno activo al cargar
  useEffect(() => {
    verificarTurnoActivo();
    cargarReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  const verificarTurnoActivo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/caja/turnos/turno_activo/`);
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
    setCargando(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/reservas/?estado=${encodeURIComponent(filtro)}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const items = Array.isArray(data) ? data : data?.results ?? [];

      const reservasNormalizadas = items.map((reserva) => ({
        ...reserva,
        servicios: toServiciosArray(reserva.servicios),
        barbero_nombre:
          reserva.barbero_nombre ||
          reserva.barbero?.name ||
          reserva.barbero?.nombre ||
          "-",
        fecha: reserva.fecha || reserva.date || null,
        horario: reserva.horario || reserva.hora || reserva.time || null,
        duracion_total:
          reserva.duracion_total || reserva.duracion || reserva.duration || null,
      }));

      setReservas(reservasNormalizadas);
    } catch (error) {
      console.error("❌ Error cargando reservas:", error);
      alert("Error al cargar las reservas");
    } finally {
      setCargando(false);
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    const d = new Date(fecha.includes('T') ? fecha : `${fecha}T00:00:00`);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatearHora = (hora) => {
    if (!hora) return "-";
    if (typeof hora !== "string") return String(hora);
    if (hora.includes(":")) return hora.substring(0, 5);
    return hora;
  };

  const formatearDuracion = (duracion) => {
    if (!duracion) return "-";
    const mins = parseInt(duracion, 10);
    if (isNaN(mins)) return String(duracion);
    if (mins < 60) return `${mins} min`;
    const horas = Math.floor(mins / 60);
    const minutosRestantes = mins % 60;
    if (minutosRestantes === 0) return `${horas}h`;
    return `${horas}h ${minutosRestantes}min`;
  };

  const calcularTotalServicios = (servicios) => {
    return servicios.reduce((sum, s) => {
      const precio = parsePrice(s?.precio);
      const cantidad = parseInt(s?.cantidad ?? 1, 10) || 1;
      return sum + precio * cantidad;
    }, 0);
  };

  const verComprobante = (reserva) => setComprobanteSeleccionado(reserva);
  
  const cerrarModal = () => {
    setComprobanteSeleccionado(null);
    setMotivoRechazo("");
  };

  // Abrir caja
  const abrirCaja = async () => {
    if (!montoApertura || parseFloat(montoApertura) < 0) {
      alert("Ingresa un monto de apertura válido");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/caja/turnos/`, {
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
      
      // Si había una reserva pendiente, confirmarla ahora
      if (reservaPendienteConfirmar) {
        await confirmarReservaDirecto(reservaPendienteConfirmar);
        setReservaPendienteConfirmar(null);
      }
    } catch (err) {
      console.error("Error abriendo caja:", err);
      alert("❌ Error al abrir la caja");
    }
  };

  // Confirmar reserva (con verificación de caja)
  const confirmarReserva = async (reservaId) => {
    // Verificar si hay turno activo
    await verificarTurnoActivo();
    
    if (!turnoActivo) {
      // No hay caja abierta, mostrar modal
      setReservaPendienteConfirmar(reservaId);
      setModalAperturaCaja(true);
      return;
    }

    // Si hay caja abierta, confirmar directamente
    await confirmarReservaDirecto(reservaId);
  };

  const confirmarReservaDirecto = async (reservaId) => {
    if (!window.confirm("¿Confirmar esta reserva?")) return;
    setProcesando(reservaId);
    try {
      const response = await fetch(
        `${API_BASE}/api/reservas/${reservaId}/confirmar/`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );
      if (response.ok) {
        alert("✅ Reserva confirmada! Se ha enviado un email al cliente.");
        cargarReservas();
        cerrarModal();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error al confirmar");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Error al confirmar la reserva: " + error.message);
    } finally {
      setProcesando(null);
    }
  };

  const rechazarReserva = async (reservaId) => {
    if (!motivoRechazo.trim()) {
      alert("Por favor ingresa un motivo de rechazo");
      return;
    }
    if (!window.confirm("¿Rechazar esta reserva?")) return;

    setProcesando(reservaId);
    try {
      const response = await fetch(
        `${API_BASE}/api/reservas/${reservaId}/rechazar/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivoRechazo }),
        }
      );

      if (response.ok) {
        alert("❌ Reserva rechazada. Se ha notificado al cliente.");
        cargarReservas();
        cerrarModal();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error al rechazar");
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Error al rechazar la reserva: " + error.message);
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div className="reservas-admin-container">
      <div className="reservas-admin-header">
        <h1>📋 Gestión de Reservas</h1>
        {/* Indicador de estado de caja */}
        <div style={{ 
          display: 'inline-block', 
          marginLeft: '20px',
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

      {/* FILTROS */}
      <div className="filtros-container">
        <button
          className={`filtro-btn ${filtro === "pendiente" ? "active" : ""}`}
          onClick={() => setFiltro("pendiente")}
        >
          ⏳ Pendientes
          {reservas.filter((r) => r.estado === "pendiente").length > 0 && (
            <span className="badge-filtro">
              {reservas.filter((r) => r.estado === "pendiente").length}
            </span>
          )}
        </button>
        <button
          className={`filtro-btn ${filtro === "confirmada" ? "active" : ""}`}
          onClick={() => setFiltro("confirmada")}
        >
          ✅ Confirmadas
        </button>
        <button
          className={`filtro-btn ${filtro === "rechazada" ? "active" : ""}`}
          onClick={() => setFiltro("rechazada")}
        >
          ❌ Rechazadas
        </button>
      </div>

      {/* LISTA DE RESERVAS */}
      {cargando ? (
        <div className="loading">Cargando reservas...</div>
      ) : reservas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No hay reservas {filtro}s</h3>
          <p>Las nuevas reservas aparecerán aquí</p>
        </div>
      ) : (
        <div className="reservas-grid">
          {reservas.map((reserva) => {
            const servicios = reserva.servicios || [];
            const subtotalServicios = servicios.length
              ? calcularTotalServicios(servicios)
              : parsePrice(reserva.total);

            const total = parsePrice(reserva.total) || subtotalServicios;
            const senia = parsePrice(
              reserva.seña ?? reserva.senia ?? reserva.sena ?? 0
            );
            const restante = Math.max(total - senia, 0);

            return (
              <div
                key={reserva.id}
                className={`reserva-card estado-${reserva.estado}`}
              >
                {/* HEADER */}
                <div className="reserva-header">
                  <h3>Reserva #{reserva.id}</h3>
                  <span className={`estado-badge ${reserva.estado}`}>
                    {reserva.estado === "pendiente" && "⏳ Pendiente"}
                    {reserva.estado === "confirmada" && "✅ Confirmada"}
                    {reserva.estado === "rechazada" && "❌ Rechazada"}
                  </span>
                </div>

                {/* INFORMACIÓN DEL CLIENTE */}
                <div className="reserva-seccion">
                  <h4>👤 Cliente</h4>
                  <p>
                    <strong>
                      {reserva.nombre_cliente} {reserva.apellido_cliente}
                    </strong>
                  </p>
                  <p>📧 {reserva.email_cliente || "-"}</p>
                  <p>📱 {reserva.telefono_cliente || "-"}</p>
                </div>

                {/* INFORMACIÓN DE LA RESERVA */}
                <div className="reserva-seccion">
                  <h4>📅 Detalles de la Reserva</h4>
                  <div className="detalle-grid">
                    <div className="detalle-item">
                      <span className="label">📅 Fecha:</span>
                      <span className="valor">{formatearFecha(reserva.fecha)}</span>
                    </div>
                    <div className="detalle-item">
                      <span className="label">🕒 Hora:</span>
                      <span className="valor">{formatearHora(reserva.horario)}</span>
                    </div>
                    <div className="detalle-item">
                      <span className="label">✂️ Barbero:</span>
                      <span className="valor">{reserva.barbero_nombre}</span>
                    </div>
                    <div className="detalle-item">
                      <span className="label">⏱️ Duración:</span>
                      <span className="valor">
                        {formatearDuracion(reserva.duracion_total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* SERVICIOS */}
                <div className="reserva-seccion">
                  <h4>💼 Servicios Solicitados</h4>
                  {servicios.length === 0 ? (
                    <p className="no-servicios">No hay servicios registrados</p>
                  ) : (
                    <ul className="servicios-lista">
                      {servicios.map((servicio, idx) => {
                        const nombre = servicio?.nombre || "Servicio sin nombre";
                        const precio = parsePrice(servicio?.precio);
                        const cantidad = parseInt(servicio?.cantidad ?? 1, 10) || 1;
                        const subtotal = precio * cantidad;

                        const stableKey =
                          servicio?.id || `${reserva.id}-${nombre}-${idx}`;

                        return (
                          <li key={stableKey} className="servicio-item">
                            <div className="servicio-info">
                              <span className="servicio-nombre">
                                {nombre}
                                {cantidad > 1 && (
                                  <span className="servicio-cantidad"> (x{cantidad})</span>
                                )}
                              </span>
                              {servicio?.duracion && (
                                <span className="servicio-duracion">
                                  ⏱️ {servicio.duracion} min
                                </span>
                              )}
                            </div>
                            <span className="servicio-precio">
                              ${fmtCurrency(precio)}
                              {cantidad > 1 && (
                                <span className="servicio-subtotal">
                                  {" "}
                                  = ${fmtCurrency(subtotal)}
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* PAGO */}
                <div className="reserva-seccion pago-section">
                  <div className="pago-detalle">
                    <div className="pago-item">
                      <span>Subtotal Servicios:</span>
                      <span>${fmtCurrency(subtotalServicios)}</span>
                    </div>
                    <div className="pago-item total">
                      <span>Total:</span>
                      <strong>${fmtCurrency(total)}</strong>
                    </div>
                    <div className="pago-item seña">
                      <span>Seña Abonada (30%):</span>
                      <strong className="highlight">${fmtCurrency(senia)}</strong>
                    </div>
                    <div className="pago-item restante">
                      <span>Restante a Abonar:</span>
                      <strong>${fmtCurrency(restante)}</strong>
                    </div>
                  </div>
                </div>

                {/* COMPROBANTE */}
                {reserva.comprobante && (
                  <div className="reserva-seccion">
                    <button
                      className="btn-ver-comprobante"
                      onClick={() => verComprobante(reserva)}
                    >
                      📸 Ver Comprobante de Pago
                    </button>
                  </div>
                )}

                {/* ACCIONES (solo para pendientes) */}
                {reserva.estado === "pendiente" && (
                  <div className="reserva-acciones">
                    <button
                      className="btn-confirmar"
                      onClick={() => confirmarReserva(reserva.id)}
                      disabled={procesando === reserva.id}
                    >
                      {procesando === reserva.id ? "Procesando..." : "✅ Confirmar"}
                    </button>
                    <button
                      className="btn-rechazar"
                      onClick={() => verComprobante(reserva)}
                      disabled={procesando === reserva.id}
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                )}

                {/* MOTIVO DE RECHAZO */}
                {reserva.estado === "rechazada" && reserva.motivo_rechazo && (
                  <div className="reserva-seccion rechazo-info">
                    <h4>❌ Motivo de Rechazo</h4>
                    <p className="motivo-texto">{reserva.motivo_rechazo}</p>
                  </div>
                )}

                {/* FECHA DE CREACIÓN */}
                <div className="reserva-footer">
                  <small>
                    📅 Recibida:{" "}
                    {reserva.fecha_creacion
                      ? new Date(reserva.fecha_creacion).toLocaleString("es-ES")
                      : "-"}
                  </small>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL APERTURA DE CAJA */}
      {modalAperturaCaja && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }} onClick={() => {
          setModalAperturaCaja(false);
          setReservaPendienteConfirmar(null);
        }}>
          <div style={{
            background: '#2a2a2a',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            color: '#fff'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              padding: '24px',
              borderBottom: '1px solid #444',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffc107' }}>
                ⚠️ Caja Cerrada
              </div>
              <button style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                fontSize: '28px',
                cursor: 'pointer'
              }} onClick={() => {
                setModalAperturaCaja(false);
                setReservaPendienteConfirmar(null);
              }}>×</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ color: '#aaa', marginBottom: '24px', fontSize: '16px', lineHeight: '1.6' }}>
                Para confirmar reservas, primero debes <strong style={{ color: '#ffc107' }}>abrir la caja</strong>.
                Esto te permitirá registrar los pagos de las señas correctamente.
              </p>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  color: '#ffc107',
                  fontWeight: '600',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  💵 Monto Inicial en Efectivo
                </label>
                <input
                  type="number"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '2px solid #444',
                    borderRadius: '8px',
                    background: '#1a1a1a',
                    color: '#fff',
                    fontSize: '16px'
                  }}
                  value={montoApertura}
                  onChange={(e) => setMontoApertura(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            
            <div style={{
              padding: '24px',
              borderTop: '1px solid #444',
              display: 'flex',
              gap: '12px'
            }}>
              <button style={{
                flex: 1,
                padding: '14px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '16px',
                cursor: 'pointer',
                background: '#444',
                color: '#fff'
              }} onClick={() => {
                setModalAperturaCaja(false);
                setReservaPendienteConfirmar(null);
              }}>
                Cancelar
              </button>
              <button style={{
                flex: 1,
                padding: '14px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '16px',
                cursor: 'pointer',
                background: '#ffc107',
                color: '#000'
              }} onClick={abrirCaja}>
                🔓 Abrir Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL COMPROBANTE */}
      {comprobanteSeleccionado && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal-comprobante" onClick={(e) => e.stopPropagation()}>
            <button className="btn-cerrar-modal" onClick={cerrarModal}>
              ✕
            </button>

            <h2>Comprobante - Reserva #{comprobanteSeleccionado.id}</h2>

            <div className="comprobante-info">
              <div className="info-row">
                <strong>Cliente:</strong>
                <span>
                  {comprobanteSeleccionado.nombre_cliente}{" "}
                  {comprobanteSeleccionado.apellido_cliente}
                </span>
              </div>
              <div className="info-row">
                <strong>Fecha:</strong>
                <span>{formatearFecha(comprobanteSeleccionado.fecha)}</span>
              </div>
              <div className="info-row">
                <strong>Hora:</strong>
                <span>{formatearHora(comprobanteSeleccionado.horario)}</span>
              </div>
              <div className="info-row">
                <strong>Monto Seña:</strong>
                <span className="monto-destacado">
                  ${fmtCurrency(
                    parsePrice(
                      comprobanteSeleccionado.seña ||
                        comprobanteSeleccionado.senia ||
                        comprobanteSeleccionado.sena ||
                        0
                    )
                  )}
                </span>
              </div>
            </div>

            {/* IMAGEN DEL COMPROBANTE */}
            {comprobanteSeleccionado.comprobante && (
              <div className="comprobante-imagen-container">
                <img
                  src={
                    String(comprobanteSeleccionado.comprobante).startsWith("http")
                      ? comprobanteSeleccionado.comprobante
                      : `${API_BASE}${comprobanteSeleccionado.comprobante}`
                  }
                  alt="Comprobante de pago"
                  className="comprobante-imagen"
                  onError={(e) => {
                    e.target.src =
                      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23f0f0f0' width='300' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999' font-size='16'%3EImagen no disponible%3C/text%3E%3C/svg%3E";
                  }}
                />
              </div>
            )}

            {/* ACCIONES */}
            {comprobanteSeleccionado.estado === "pendiente" && (
              <div className="modal-acciones">
                <div className="rechazo-section">
                  <label htmlFor="motivo">Motivo de rechazo:</label>
                  <textarea
                    id="motivo"
                    value={motivoRechazo}
                    onChange={(e) => setMotivoRechazo(e.target.value)}
                    placeholder="Ej: El monto no coincide, la imagen no es legible, etc."
                    rows="3"
                  />
                </div>

                <div className="modal-botones">
                  <button
                    className="btn-modal-confirmar"
                    onClick={() => confirmarReserva(comprobanteSeleccionado.id)}
                    disabled={procesando === comprobanteSeleccionado.id}
                  >
                    {procesando === comprobanteSeleccionado.id
                      ? "Procesando..."
                      : "✅ Confirmar Reserva"}
                  </button>
                  <button
                    className="btn-modal-rechazar"
                    onClick={() => rechazarReserva(comprobanteSeleccionado.id)}
                    disabled={procesando === comprobanteSeleccionado.id}
                  >
                    {procesando === comprobanteSeleccionado.id
                      ? "Procesando..."
                      : "❌ Rechazar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}