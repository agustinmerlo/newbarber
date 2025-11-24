// src/pages/Reservar.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./reservar.css";

export default function Reservar() {
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
  const navigate = useNavigate();
  const location = useLocation();

  const [servicios, setServicios] = useState([]);
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Convierte una ruta relativa del backend (/media/...) a URL absoluta
  const toAbs = (u) =>
    !u ? "" : u.startsWith("http") ? u : `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;

  // -----------------------------
  // Helpers de formato y cálculo
  // -----------------------------
  const fmtCurrency = (n) =>
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);

  // Convierte "25", "$ 1.234,50", "1,200.75" → número JS
  const parsePrice = (v) => {
    if (typeof v === "number") return v;
    if (v == null) return 0;
    let s = String(v).trim();
    s = s.replace(/[^\d.,-]/g, "");

    // es-AR: "1.234,56"
    if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }

    // en-US: "1,234.56"
    s = s.replace(/,/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  // Convierte "45", "45 min", "1h 30m" → minutos
  const parseMinutes = (duracion) => {
    if (duracion == null) return 60;
    if (typeof duracion === "number") return duracion;
    const s = String(duracion).toLowerCase().trim();

    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const onlyMin = s.match(/^(\d+)\s*(min|m)$/i);
    if (onlyMin) return parseInt(onlyMin[1], 10);
    const h = s.match(/(\d+)\s*h/);
    const m = s.match(/(\d+)\s*m/);
    const hours = h ? parseInt(h[1], 10) : 0;
    const mins = m ? parseInt(m[1], 10) : 0;
    if (hours || mins) return hours * 60 + mins;

    return 60;
  };

  // -----------------------------
  // Cargar servicios desde API
  // -----------------------------
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const servicioId = params.get("id");

    let cancel = false;
    setCargando(true);
    setError("");

    fetch(`${API_BASE}/api/servicios/`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => {
        if (cancel) return;
        const items = Array.isArray(data) ? data : data?.results ?? [];
        
        // Normaliza las URLs de las imágenes del backend
        const itemsConImagenes = items.map(s => ({
          ...s,
          imagen: s.imagen ? toAbs(s.imagen) : ""
        }));
        
        setServicios(itemsConImagenes);

        // Si viene ?id=XX en la URL, preselecciona ese servicio si existe
        if (servicioId) {
          const servicio = itemsConImagenes.find((s) => s.id === Number(servicioId));
          if (servicio) {
            setServiciosSeleccionados((prev) =>
              prev.length === 0 ? [servicio] : prev
            );
          }
        }
      })
      .catch(() => !cancel && setError("No se pudieron cargar los servicios."))
      .finally(() => !cancel && setCargando(false));

    return () => {
      cancel = true;
    };
  }, [API_BASE, location.search]);

  // -----------------------------
  // Lógica de selección
  // -----------------------------
  const agregarServicio = (servicio, cantidad = 1) => {
    setServiciosSeleccionados((prev) => {
      const existente = prev.find((s) => s.id === servicio.id);
      if (existente) {
        return prev.map((s) => (s.id === servicio.id ? { ...s, cantidad } : s));
      }
      return [...prev, { ...servicio, cantidad }];
    });
  };

  const quitarServicio = (id) => {
    setServiciosSeleccionados((prev) => prev.filter((s) => s.id !== id));
  };

  const actualizarCantidad = (id, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      quitarServicio(id);
      return;
    }
    setServiciosSeleccionados((prev) =>
      prev.map((s) => (s.id === id ? { ...s, cantidad: nuevaCantidad } : s))
    );
  };

  // -----------------------------
  // Cálculos totales
  // -----------------------------
  const calcularTotal = () =>
    serviciosSeleccionados.reduce((sum, s) => {
      const precioUnit = parsePrice(s.precio);
      const cant = s.cantidad || 1;
      return sum + precioUnit * cant;
    }, 0);

  const calcularDuracionTotal = () =>
    serviciosSeleccionados.reduce((sum, s) => {
      const mins = parseMinutes(s.duracion);
      const cant = s.cantidad || 1;
      return sum + mins * cant;
    }, 0);

  // -----------------------------
  // Confirmar → /reservar/fecha
  // -----------------------------
  const handleConfirmarReserva = () => {
    if (serviciosSeleccionados.length === 0) {
      alert("Debes seleccionar al menos un servicio");
      return;
    }

    const payload = {
      servicios: serviciosSeleccionados,
      total: calcularTotal(),
      duracionTotal: calcularDuracionTotal(),
    };

    try {
      localStorage.setItem("serviciosReserva", JSON.stringify(payload.servicios));
    } catch {}

    navigate("/reservar/fecha", { state: payload });
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="reservar-page">
      {/* HEADER */}
      <header className="reservar-header">
        <div className="nav">
          <button 
            className="back-arrow"
            onClick={() => navigate('/cliente')}
            title="Volver al inicio"
          >
            ← 
          </button>
          <div className="logo">CLASE V</div>
          <nav>
            <a href="/cliente">Inicio</a>
            <a href="/servicios">Servicios</a>
            <a href="#barberos">Barberos</a>
            <a href="#contactos">Contactos</a>
          </nav>
        </div>
        <h1>Reservar Turno</h1>
      </header>

      {/* CONTENIDO */}
      <main className="reservar-content">
        {cargando && <p className="loading">Cargando servicios...</p>}
        {error && <p className="error">{error}</p>}

        {!cargando && !error && (
          <div className="reservar-split">
            {/* IZQUIERDA: SELECCIONAR SERVICIOS */}
            <div className="seleccion-servicios">
              <h2>Seleccionar Servicios</h2>

              <div className="servicios-list">
                {servicios.map((servicio) => {
                  const yaSeleccionado = serviciosSeleccionados.find((s) => s.id === servicio.id);
                  const cantidad = yaSeleccionado?.cantidad || 1;
                  const precioUnit = parsePrice(servicio.precio);
                  const precioMostrar = yaSeleccionado ? precioUnit * cantidad : precioUnit;

                  return (
                    <div
                      key={servicio.id}
                      className={`servicio-item ${yaSeleccionado ? "seleccionado" : ""}`}
                    >
                      <div className="servicio-img-container">
                        {servicio.imagen ? (
                          <img
                            src={servicio.imagen}
                            alt={servicio.nombre}
                            className="servicio-img-small"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling.style.display = 'flex';
                            }}
                          />
                        ) : null}
                        <div 
                          className="servicio-img-placeholder"
                          style={{display: servicio.imagen ? 'none' : 'flex'}}
                        >
                          <span>📸</span>
                        </div>
                      </div>

                      <div className="servicio-info">
                        <h4>{servicio.nombre}</h4>
                        <p className="servicio-duracion">{servicio.duracion || "60 min"}</p>
                        <p className="servicio-precio">${fmtCurrency(precioMostrar)}</p>
                      </div>

                      {!yaSeleccionado ? (
                        <button className="btn-agregar" onClick={() => agregarServicio(servicio, 1)}>
                          + Agregar
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              border: "1px solid #444",
                              borderRadius: 8,
                              overflow: "hidden",
                              background: "#121212",
                            }}
                          >
                            <button
                              style={{
                                padding: "4px 10px",
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                              onClick={() => actualizarCantidad(servicio.id, cantidad - 1)}
                            >
                              –
                            </button>
                            <span
                              style={{
                                padding: "0 10px",
                                minWidth: 24,
                                textAlign: "center",
                                color: "#fff",
                              }}
                            >
                              {cantidad}
                            </span>
                            <button
                              style={{
                                padding: "4px 10px",
                                background: "transparent",
                                border: "none",
                                color: "#fff",
                                cursor: "pointer",
                              }}
                              onClick={() => actualizarCantidad(servicio.id, cantidad + 1)}
                            >
                              +
                            </button>
                          </div>

                          <button className="btn-quitar" onClick={() => quitarServicio(servicio.id)} title="Quitar">
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DERECHA: RESUMEN */}
            <div className="resumen-reserva">
              <h2>Resumen de Reserva</h2>

              {serviciosSeleccionados.length === 0 ? (
                <div className="resumen-vacio">
                  <p>🛒 No hay servicios seleccionados</p>
                  <p className="texto-secundario">Agrega servicios desde la lista</p>
                </div>
              ) : (
                <>
                  <div className="servicios-seleccionados">
                    {serviciosSeleccionados.map((servicio) => {
                      const cantidad = servicio.cantidad || 1;
                      const unit = parsePrice(servicio.precio);
                      const subtotal = unit * cantidad;

                      return (
                        <div key={servicio.id} className="servicio-resumen">
                          <div className="servicio-resumen-info">
                            <h4>{servicio.nombre}</h4>
                            <p>{servicio.duracion || "60 min"}</p>
                          </div>

                          <div className="servicio-resumen-precio" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                border: "1px solid #444",
                                borderRadius: 8,
                                overflow: "hidden",
                                background: "#121212",
                              }}
                            >
                              <button
                                style={{
                                  padding: "2px 8px",
                                  background: "transparent",
                                  border: "none",
                                  color: "#fff",
                                  cursor: "pointer",
                                }}
                                onClick={() => actualizarCantidad(servicio.id, cantidad - 1)}
                              >
                                –
                              </button>
                              <span
                                style={{
                                  padding: "0 10px",
                                  minWidth: 24,
                                  textAlign: "center",
                                  color: "#fff",
                                }}
                              >
                                {cantidad}
                              </span>
                              <button
                                style={{
                                  padding: "2px 8px",
                                  background: "transparent",
                                  border: "none",
                                  color: "#fff",
                                  cursor: "pointer",
                                }}
                                onClick={() => actualizarCantidad(servicio.id, cantidad + 1)}
                              >
                                +
                              </button>
                            </div>

                            <span>${fmtCurrency(subtotal)}</span>
                            <button className="btn-quitar" onClick={() => quitarServicio(servicio.id)} title="Quitar">
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="resumen-totales">
                    <div className="total-item">
                      <span>Duración Total:</span>
                      <strong>{calcularDuracionTotal()} min</strong>
                    </div>
                    <div className="total-item total-precio">
                      <span>Total a Pagar:</span>
                      <strong>${fmtCurrency(calcularTotal())}</strong>
                    </div>
                  </div>

                  <button className="btn-confirmar" onClick={handleConfirmarReserva}>
                    Continuar con la Reserva
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}