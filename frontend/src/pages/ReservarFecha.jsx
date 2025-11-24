// src/pages/ReservarFecha.jsx
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./reservarFecha.css";

export default function ReservarFecha({
  serviciosRecibidos = [],
  totalRecibido = 0,
  duracionTotalRecibida = 0,
  onVolver,
  onConfirmar,
}) {
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";
  const location = useLocation();
  const navigate = useNavigate();

  // -----------------------------
  // Helpers de formato / parseo
  // -----------------------------
  const fmtCurrency = (n) =>
    new Intl.NumberFormat("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);

  const parsePrice = (v) => {
    if (typeof v === "number") return v;
    if (v == null) return 0;
    let s = String(v).trim();
    s = s.replace(/[^\d.,-]/g, "");
    if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    }
    s = s.replace(/,/g, "");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

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

  // ✅ NUEVA FUNCIÓN: Verificar si una fecha es domingo
  const esDomingo = (fechaString) => {
    if (!fechaString) return false;
    const fecha = new Date(`${fechaString}T00:00:00`);
    return fecha.getDay() === 0; // 0 = Domingo
  };

  // -----------------------------
  // Servicios
  // -----------------------------
  const [servicios, setServicios] = useState(() => {
    if (Array.isArray(serviciosRecibidos) && serviciosRecibidos.length > 0) {
      return serviciosRecibidos;
    }
    const nav = location?.state;
    if (nav?.servicios?.length) {
      try {
        localStorage.setItem("serviciosReserva", JSON.stringify(nav.servicios));
      } catch {}
      return nav.servicios;
    }
    const stored = localStorage.getItem("serviciosReserva");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing serviciosReserva:", e);
      }
    }
    return [];
  });

  const [cargandoServicios, setCargandoServicios] = useState(false);
  
  useEffect(() => {
    if (servicios.length === 0) {
      setCargandoServicios(true);
      fetch(`${API_BASE}/api/servicios/`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data) => {
          const list = Array.isArray(data) ? data : data?.results || [];
          console.log("✅ Servicios cargados desde API:", list);
        })
        .catch((err) => {
          console.error("Error cargando servicios:", err);
        })
        .finally(() => setCargandoServicios(false));
    }
  }, [API_BASE, servicios.length]);

  const total =
    totalRecibido ||
    servicios.reduce((sum, s) => sum + parsePrice(s.precio) * (s.cantidad || 1), 0);

  const duracionTotal =
    duracionTotalRecibida ||
    servicios.reduce((sum, s) => sum + parseMinutes(s.duracion) * (s.cantidad || 1), 0);

  // -----------------------------
  // UI State
  // -----------------------------
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [barberoSeleccionado, setBarberoSeleccionado] = useState(null);
  const [horarioSeleccionado, setHorarioSeleccionado] = useState("");

  const [barberos, setBarberos] = useState([]);
  const [cargandoBarberos, setCargandoBarberos] = useState(true);

  const [horariosDisponibles, setHorariosDisponibles] = useState([]);
  const [cargandoHorarios, setCargandoHorarios] = useState(false);

  // -----------------------------
  // Validaciones iniciales
  // -----------------------------
  useEffect(() => {
    if (!servicios || servicios.length === 0) {
      console.warn("⚠️ No hay servicios seleccionados");
      if (!cargandoServicios) {
        alert("No hay servicios seleccionados. Por favor, selecciona servicios primero.");
        if (onVolver) onVolver();
        else navigate("/reservar", { replace: true });
      }
    }
  }, [servicios.length, cargandoServicios]);

  // -----------------------------
  // Cargar BARBEROS desde API
  // -----------------------------
  useEffect(() => {
    let cancel = false;
    setCargandoBarberos(true);

    console.log("🔄 Cargando barberos desde:", `${API_BASE}/api/barbers/`);

    fetch(`${API_BASE}/api/barbers/`)
      .then((r) => {
        console.log("📥 Respuesta barberos status:", r.status);
        return r.ok ? r.json() : Promise.reject(r.status);
      })
      .then((data) => {
        if (cancel) return;
        
        console.log("✅ Datos de barberos recibidos:", data);
        
        const list = Array.isArray(data) ? data : data?.results || [];
        const activos = list.filter(b => !b.is_deleted);
        
        console.log(`✅ ${activos.length} barberos activos de ${list.length} totales`);
        
        const normalized = activos.map((b) => {
          let fotoUrl = "/assets/barbero1.jpg";
          if (b.photo || b.foto) {
            const foto = b.photo || b.foto;
            fotoUrl = foto.startsWith("http") ? foto : `${API_BASE}${foto}`;
          }

          return {
            id: b.id,
            nombre: b.name || b.nombre || "Sin nombre",
            especialidad: b.specialty || b.especialidad || "",
            horario: b.work_schedule || b.horario || "",
            foto: fotoUrl,
          };
        });

        console.log("✅ Barberos normalizados:", normalized);
        setBarberos(normalized);
      })
      .catch((err) => {
        console.error("❌ Error cargando barberos:", err);
        setBarberos([]);
      })
      .finally(() => !cancel && setCargandoBarberos(false));

    return () => {
      cancel = true;
    };
  }, [API_BASE]);

  // -----------------------------
  // ✅ CARGAR HORARIOS CON NUEVA LÓGICA
  // -----------------------------
  useEffect(() => {
    if (!fechaSeleccionada || !barberoSeleccionado) {
      setHorariosDisponibles([]);
      return;
    }

    // ✅ VALIDACIÓN: Si es domingo, no cargar horarios
    if (esDomingo(fechaSeleccionada)) {
      console.log("⚠️ Fecha seleccionada es domingo, no hay horarios disponibles");
      setHorariosDisponibles([]);
      return;
    }

    let cancel = false;
    setCargandoHorarios(true);

    console.log(`🔄 Cargando horarios para fecha: ${fechaSeleccionada}, barbero: ${barberoSeleccionado.id}`);

    const url = `${API_BASE}/api/horarios/?fecha=${fechaSeleccionada}&barbero=${barberoSeleccionado.id}&duracion_min=${duracionTotal}`;

    fetch(url)
      .then((response) => {
        console.log(`📥 Respuesta horarios status:`, response.status);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        if (cancel) return;

        console.log(`✅ Datos recibidos del backend:`, data);

        const slots = data.slots || [];
        
        if (slots.length === 0) {
          console.warn("⚠️ No hay horarios disponibles para esta fecha");
          setHorariosDisponibles([]);
        } else {
          console.log(`✅ ${slots.length} horarios recibidos`);
          setHorariosDisponibles(slots);
        }
      })
      .catch((error) => {
        if (cancel) return;
        
        console.error(`❌ Error cargando horarios:`, error);
        
        console.log("⚠️ Generando horarios de fallback...");
        
        const horariosFallback = [
          { hora: "09:00", disponible: true },
          { hora: "10:00", disponible: true },
          { hora: "11:00", disponible: true },
          { hora: "12:00", disponible: true },
          { hora: "17:00", disponible: true },
          { hora: "18:00", disponible: true },
          { hora: "19:00", disponible: true },
          { hora: "20:00", disponible: true },
          { hora: "21:00", disponible: true },
        ];
        
        setHorariosDisponibles(horariosFallback);
      })
      .finally(() => {
        if (!cancel) setCargandoHorarios(false);
      });

    return () => {
      cancel = true;
    };
  }, [API_BASE, fechaSeleccionada, barberoSeleccionado, duracionTotal]);

  // -----------------------------
  // Utils fecha min/max
  // -----------------------------
  const getFechaMinima = () => {
    const hoy = new Date();
    return hoy.toISOString().split("T")[0];
  };

  const getFechaMaxima = () => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + 30);
    return hoy.toISOString().split("T")[0];
  };

  // ✅ NUEVA FUNCIÓN: Manejar cambio de fecha con validación de domingo
  const handleFechaChange = (e) => {
    const nuevaFecha = e.target.value;
    
    if (esDomingo(nuevaFecha)) {
      alert("❌ No se pueden hacer reservas los domingos. Por favor selecciona otro día.");
      setFechaSeleccionada("");
      setHorarioSeleccionado("");
      return;
    }
    
    setFechaSeleccionada(nuevaFecha);
    setHorarioSeleccionado("");
  };

  // -----------------------------
  // Confirmar (pasa datos a siguiente paso)
  // -----------------------------
  const handleConfirmarReserva = () => {
    if (!fechaSeleccionada) return alert("Por favor selecciona una fecha");
    if (!barberoSeleccionado) return alert("Por favor selecciona un barbero");
    if (!horarioSeleccionado) return alert("Por favor selecciona un horario");

    // ✅ Validación adicional antes de confirmar
    if (esDomingo(fechaSeleccionada)) {
      alert("❌ No se pueden hacer reservas los domingos");
      return;
    }

    const reservaData = {
      servicios,
      total,
      duracionTotal,
      fecha: fechaSeleccionada,
      barbero: barberoSeleccionado,
      horario: horarioSeleccionado,
    };

    console.log("✅ Reserva confirmada:", reservaData);

    try {
      localStorage.setItem("reservaConfirmacion", JSON.stringify(reservaData));
    } catch {}

    if (onConfirmar) {
      onConfirmar(reservaData);
    } else {
      navigate("/reservar/confirmacion");
    }
  };

  const handleVolver = () => {
    if (onVolver) onVolver();
    else navigate(-1);
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div className="reservar-fecha-page">
      {/* HEADER */}
      <header className="reservar-header">
        <div className="nav">
          <div className="logo">CLASE V</div>
          <nav>
            <a href="/cliente">Inicio</a>
            <a href="/servicios">Servicios</a>
            <a href="#barberos">Barberos</a>
            <a href="#contactos">Contactos</a>
          </nav>
        </div>
        <h1>Seleccionar Fecha y Horario</h1>
      </header>

      <main className="reservar-fecha-content">
        <div className="reservar-fecha-split">
          {/* IZQUIERDA: SELECCIÓN */}
          <div className="seleccion-panel">
            {/* SERVICIOS SELECCIONADOS */}
            <section className="seccion-servicios">
              <h2>Servicios Seleccionados</h2>
              {cargandoServicios ? (
                <p className="loading-text">Verificando servicios...</p>
              ) : servicios.length === 0 ? (
                <div className="info-text">
                  <p>⚠️ No hay servicios seleccionados</p>
                  <button 
                    className="btn-volver" 
                    onClick={handleVolver}
                    style={{ marginTop: '1rem' }}
                  >
                    ← Volver a seleccionar servicios
                  </button>
                </div>
              ) : (
                <div className="servicios-mini-list">
                  {servicios.map((servicio) => (
                    <div key={servicio.id} className="servicio-mini">
                      <span className="servicio-mini-nombre">
                        {servicio.nombre} {servicio.cantidad > 1 && `(x${servicio.cantidad})`}
                      </span>
                      <span className="servicio-mini-precio">
                        ${fmtCurrency(parsePrice(servicio.precio) * (servicio.cantidad || 1))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SELECCIÓN DE FECHA */}
            <section className="seccion-fecha">
              <h2>📅 Seleccionar Fecha</h2>
              <input
                type="date"
                className="input-fecha"
                value={fechaSeleccionada}
                onChange={handleFechaChange}
                min={getFechaMinima()}
                max={getFechaMaxima()}
                disabled={servicios.length === 0}
              />
              {fechaSeleccionada && (
                <p className="fecha-formateada">
                  {new Date(`${fechaSeleccionada}T00:00:00`).toLocaleDateString("es-ES", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              )}
              {/* ✅ MENSAJE DE ADVERTENCIA */}
              <p style={{ fontSize: '0.85rem', color: '#ff9800', marginTop: '0.5rem' }}>
                ⚠️ No se aceptan reservas los domingos
              </p>
            </section>

            {/* SELECCIÓN DE BARBERO */}
            <section className="seccion-barberos">
              <h2>✂️ Seleccionar Barbero</h2>
              {cargandoBarberos ? (
                <p className="loading-text">Cargando barberos...</p>
              ) : barberos.length === 0 ? (
                <p className="info-text">No hay barberos disponibles</p>
              ) : (
                <div className="barberos-grid">
                  {barberos.map((barbero) => (
                    <div
                      key={barbero.id}
                      className={`barbero-card ${
                        barberoSeleccionado?.id === barbero.id ? "seleccionado" : ""
                      }`}
                      onClick={() => {
                        setBarberoSeleccionado(barbero);
                        setHorarioSeleccionado("");
                      }}
                    >
                      <div className="barbero-foto">
                        <img 
                          src={barbero.foto} 
                          alt={barbero.nombre}
                          onError={(e) => {
                            console.error("Error cargando imagen:", barbero.foto);
                            e.target.src = "/assets/barbero1.jpg";
                          }}
                        />
                      </div>
                      <h4>{barbero.nombre}</h4>
                      {barbero.especialidad && (
                        <p className="barbero-especialidad">{barbero.especialidad}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* SELECCIÓN DE HORARIO */}
            <section className="seccion-horarios">
              <h2>🕒 Horarios Disponibles</h2>
              {!fechaSeleccionada || !barberoSeleccionado ? (
                <p className="info-text">Selecciona una fecha y un barbero para ver horarios</p>
              ) : esDomingo(fechaSeleccionada) ? (
                <p className="info-text" style={{ color: '#ff5252' }}>
                  ❌ No hay horarios disponibles los domingos
                </p>
              ) : cargandoHorarios ? (
                <p className="loading-text">Cargando horarios...</p>
              ) : horariosDisponibles.length === 0 ? (
                <p className="info-text">No hay horarios disponibles para ese día</p>
              ) : (
                <div className="horarios-grid">
                  {horariosDisponibles.map((horario) => (
                    <button
                      key={horario.hora}
                      className={`horario-btn ${
                        horarioSeleccionado === horario.hora ? "seleccionado" : ""
                      } ${!horario.disponible ? "ocupado" : ""}`}
                      onClick={() => horario.disponible && setHorarioSeleccionado(horario.hora)}
                      disabled={!horario.disponible}
                      title={!horario.disponible ? "Horario no disponible" : "Seleccionar este horario"}
                    >
                      {horario.hora}
                      {!horario.disponible && <span className="badge-ocupado">Ocupado</span>}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* DERECHA: RESUMEN */}
          <div className="resumen-final">
            <h2>Resumen de Reserva</h2>

            <div className="resumen-detalle">
              <div className="resumen-item">
                <span className="resumen-label">📅 Fecha:</span>
                <span className="resumen-valor">
                  {fechaSeleccionada
                    ? new Date(`${fechaSeleccionada}T00:00:00`).toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "No seleccionada"}
                </span>
              </div>

              <div className="resumen-item">
                <span className="resumen-label">✂️ Barbero:</span>
                <span className="resumen-valor">{barberoSeleccionado?.nombre || "No seleccionado"}</span>
              </div>

              <div className="resumen-item">
                <span className="resumen-label">🕒 Horario:</span>
                <span className="resumen-valor">{horarioSeleccionado || "No seleccionado"}</span>
              </div>

              <div className="resumen-divider"></div>

              <div className="resumen-item">
                <span className="resumen-label">Servicios:</span>
                <span className="resumen-valor">{servicios.length}</span>
              </div>

              <div className="resumen-item">
                <span className="resumen-label">Duración Total:</span>
                <span className="resumen-valor">{duracionTotal} min</span>
              </div>

              <div className="resumen-item resumen-total">
                <span className="resumen-label">Total a Pagar:</span>
                <span className="resumen-valor">${fmtCurrency(total)}</span>
              </div>
            </div>

            <div className="resumen-acciones">
              <button className="btn-volver" onClick={handleVolver}>
                ← Volver
              </button>
              <button 
                className="btn-confirmar-final" 
                onClick={handleConfirmarReserva}
                disabled={!fechaSeleccionada || !barberoSeleccionado || !horarioSeleccionado || servicios.length === 0}
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}