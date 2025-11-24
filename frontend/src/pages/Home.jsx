import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import Perfil from "./Perfil";
import ReservasPendientes from "./ReservasPendientes";
import Agenda from "./Agenda";
import Pagos from "./Pagos";
import MovimientosCaja from "./MovimientosCaja";

const API_URL = "http://localhost:8000/api";

const sections = [
  { name: "Inicio", icon: "🏠" },
  { name: "Pagos", icon: "💰" },
  { name: "Caja", icon: "💵" },
  { name: "Barberos", icon: "✂️" },
  { name: "Servicios", icon: "🧴" },
  { name: "Empleados", icon: "👥" },
  { name: "Reservas", icon: "📋" },
  { name: "Agenda", icon: "📅" },
  { name: "Perfil", icon: "👤" },
];

const BellIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 14h12a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M9 18a3 3 0 006 0" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

// Formato de dinero con 2 decimales
const formatMoney = (value) => {
  const num = Number(value || 0);
  return num.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// ======================= SERVICIOS MÁS VENDIDOS - GRÁFICO DE TORTA =======================
const ServiciosVendidosChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [hoveredIndex, setHoveredIndex] = useState(null);

  useEffect(() => {
    const hoy = new Date();
    const haceUnMes = new Date();
    haceUnMes.setMonth(haceUnMes.getMonth() - 1);

    setFechaFin(hoy.toISOString().split("T")[0]);
    setFechaInicio(haceUnMes.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (fechaInicio && fechaFin) {
      cargarDatos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  const cargarDatos = async () => {
    setLoading(true);
    setError("");

    try {
      const resReservas = await fetch(`${API_URL}/reservas/?estado=confirmada`);
      if (!resReservas.ok) throw new Error("Error al cargar reservas");

      const reservas = await resReservas.json();
      const reservasArray = Array.isArray(reservas)
        ? reservas
        : reservas?.results ?? [];

      const reservasFiltradas = reservasArray.filter((r) => {
        if (!r.fecha) return false;
        return r.fecha >= fechaInicio && r.fecha <= fechaFin;
      });

      const serviciosCount = {};

      reservasFiltradas.forEach((reserva) => {
        if (reserva.servicios && Array.isArray(reserva.servicios)) {
          reserva.servicios.forEach((servicio) => {
            // ✅ NORMALIZAR NOMBRE: minúsculas, sin espacios extras, capitalizar primera letra
            let nombreOriginal = servicio.nombre || "Sin nombre";
            
            // Convertir a minúsculas y quitar espacios extras
            let nombreNormalizado = nombreOriginal
              .toLowerCase()
              .trim()
              .replace(/\s+/g, ' '); // Reemplazar múltiples espacios por uno solo
            
            // Capitalizar primera letra de cada palabra
            nombreNormalizado = nombreNormalizado
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            const precioNum = Number(servicio.precio || 0);

            if (serviciosCount[nombreNormalizado]) {
              serviciosCount[nombreNormalizado].cantidad += 1;
              serviciosCount[nombreNormalizado].total += precioNum;
            } else {
              serviciosCount[nombreNormalizado] = {
                nombre: nombreNormalizado,
                cantidad: 1,
                total: precioNum,
                precio: precioNum,
              };
            }
          });
        }
      });

      const serviciosArray = Object.values(serviciosCount).sort(
        (a, b) => b.cantidad - a.cantidad
      );

      // 🔍 DEBUG: Ver qué servicios se están contando
      console.log("📊 Servicios encontrados:", serviciosArray);
      console.log("📋 Reservas filtradas:", reservasFiltradas.length);

      setData(serviciosArray);
    } catch (err) {
      console.error("Error cargando datos:", err);
      setError("No se pudieron cargar los datos del gráfico");
    } finally {
      setLoading(false);
    }
  };

  const COLORS = [
    "#FFD700",
    "#ff9800",
    "#ff7043",
    "#e91e63",
    "#ba68c8",
    "#7986cb",
    "#4fc3f7",
    "#4caf50",
  ];

  // Calcular el total de ventas para los porcentajes
  const totalVentas = data.reduce((sum, s) => sum + s.cantidad, 0);

  // Calcular ángulos para el gráfico de torta
  const dataWithAngles = data.map((servicio, index) => {
    const porcentaje = (servicio.cantidad / totalVentas) * 100;
    return {
      ...servicio,
      porcentaje: porcentaje.toFixed(1),
      color: COLORS[index % COLORS.length],
    };
  });

  return (
    <div
      style={{
        backgroundColor: "#1a1a1a",
        padding: "22px",
        borderRadius: "14px",
        marginBottom: "24px",
        border: "1px solid #262626",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "18px",
          flexWrap: "wrap",
          gap: "14px",
        }}
      >
        <div>
          <h2
            style={{
              color: "#FFD700",
              margin: 0,
              fontSize: "1.25rem",
            }}
          >
            📊 Servicios Más Vendidos
          </h2>
          <p
            style={{
              color: "#a0a0a0",
              margin: "4px 0 0",
              fontSize: "0.85rem",
            }}
          >
            Rendimiento por servicio en el período seleccionado.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ color: "#aaa", fontSize: "0.8em" }}>Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              max={fechaFin}
              style={{
                backgroundColor: "#202020",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "6px 10px",
                color: "#fff",
                fontSize: "0.9em",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ color: "#aaa", fontSize: "0.8em" }}>Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              min={fechaInicio}
              style={{
                backgroundColor: "#202020",
                border: "1px solid #333",
                borderRadius: "8px",
                padding: "6px 10px",
                color: "#fff",
                fontSize: "0.9em",
              }}
            />
          </div>

          <button
            onClick={cargarDatos}
            style={{
              backgroundColor: "#FFD700",
              color: "#000",
              border: "none",
              borderRadius: "8px",
              padding: "8px 18px",
              fontWeight: "bold",
              fontSize: "0.9em",
              cursor: "pointer",
              marginTop: "2px",
              transition: "background 0.2s, transform 0.1s",
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#e6c200";
              e.target.style.transform = "translateY(-1px)";
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#FFD700";
              e.target.style.transform = "translateY(0)";
            }}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#aaa",
            fontSize: "0.95rem",
          }}
        >
          Cargando datos del gráfico...
        </div>
      ) : error ? (
        <div
          style={{
            padding: "30px",
            textAlign: "center",
            color: "#ff7474",
            backgroundColor: "#2a1f1f",
            borderRadius: "8px",
            border: "1px solid #5c2a2a",
            fontSize: "0.95rem",
          }}
        >
          ⚠️ {error}
        </div>
      ) : data.length === 0 ? (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            color: "#aaa",
            backgroundColor: "#202020",
            borderRadius: "8px",
            border: "1px dashed #333",
            fontSize: "0.95rem",
          }}
        >
          📭 No hay servicios vendidos en este período
        </div>
      ) : (
        <>
          {/* GRÁFICO DE TORTA */}
          <div
            style={{
              backgroundColor: "#202020",
              borderRadius: "10px",
              padding: "26px 16px 18px",
              marginBottom: "22px",
              border: "1px solid #292929",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: window.innerWidth > 768 ? "row" : "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "40px",
                minHeight: "350px",
              }}
            >
              {/* SVG - Gráfico de Torta */}
              <svg
                width="300"
                height="300"
                viewBox="0 0 300 300"
                style={{ maxWidth: "100%" }}
              >
                <g transform="translate(150, 150)">
                  {dataWithAngles.map((servicio, index) => {
                    const startAngle = dataWithAngles
                      .slice(0, index)
                      .reduce((acc, s) => acc + (parseFloat(s.porcentaje) / 100) * 360, 0);
                    const endAngle = startAngle + (parseFloat(servicio.porcentaje) / 100) * 360;
                    
                    const startRad = (startAngle - 90) * (Math.PI / 180);
                    const endRad = (endAngle - 90) * (Math.PI / 180);
                    
                    const radius = 120;
                    const x1 = radius * Math.cos(startRad);
                    const y1 = radius * Math.sin(startRad);
                    const x2 = radius * Math.cos(endRad);
                    const y2 = radius * Math.sin(endRad);
                    
                    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
                    
                    const isHovered = hoveredIndex === index;
                    const scale = isHovered ? 1.05 : 1;
                    
                    // Calcular posición del texto (porcentaje)
                    const midAngle = (startAngle + endAngle) / 2;
                    const midRad = (midAngle - 90) * (Math.PI / 180);
                    const textRadius = radius * 0.7;
                    const textX = textRadius * Math.cos(midRad);
                    const textY = textRadius * Math.sin(midRad);

                    return (
                      <g
                        key={index}
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{
                          cursor: "pointer",
                          transform: `scale(${scale})`,
                          transformOrigin: "center",
                          transition: "transform 0.2s ease",
                        }}
                      >
                        <path
                          d={`M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                          fill={servicio.color}
                          stroke="#1a1a1a"
                          strokeWidth="2"
                          style={{
                            filter: isHovered ? `drop-shadow(0 0 10px ${servicio.color})` : "none",
                            transition: "filter 0.2s ease",
                          }}
                        />
                        
                        {/* Porcentaje en el centro de cada porción */}
                        {parseFloat(servicio.porcentaje) > 5 && (
                          <text
                            x={textX}
                            y={textY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#000"
                            fontSize="14"
                            fontWeight="bold"
                            style={{
                              pointerEvents: "none",
                            }}
                          >
                            {servicio.porcentaje}%
                          </text>
                        )}
                      </g>
                    );
                  })}
                  
                  {/* Círculo central (estilo donut) */}
                  <circle
                    r="45"
                    fill="#202020"
                    stroke="#FFD700"
                    strokeWidth="3"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#FFD700"
                    fontSize="16"
                    fontWeight="bold"
                  >
                    {totalVentas}
                  </text>
                  <text
                    textAnchor="middle"
                    y="20"
                    fill="#aaa"
                    fontSize="11"
                  >
                    ventas
                  </text>
                </g>
              </svg>

              {/* Leyenda */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  maxWidth: "300px",
                }}
              >
                {dataWithAngles.map((servicio, index) => (
                  <div
                    key={index}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      padding: "10px",
                      backgroundColor: hoveredIndex === index ? "#262626" : "transparent",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "background 0.2s",
                      border: hoveredIndex === index ? `2px solid ${servicio.color}` : "2px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                        backgroundColor: servicio.color,
                        flexShrink: 0,
                        boxShadow: hoveredIndex === index ? `0 0 10px ${servicio.color}` : "none",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          color: "#fff",
                          fontSize: "0.9rem",
                          fontWeight: hoveredIndex === index ? "bold" : "normal",
                        }}
                      >
                        {servicio.nombre}
                      </div>
                      <div
                        style={{
                          color: "#aaa",
                          fontSize: "0.8rem",
                          marginTop: "2px",
                        }}
                      >
                        {servicio.cantidad} ventas • {formatMoney(servicio.total)}
                      </div>
                    </div>
                    <div
                      style={{
                        color: servicio.color,
                        fontSize: "1.1rem",
                        fontWeight: "bold",
                      }}
                    >
                      {servicio.porcentaje}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TABLA RESUMEN */}
          <div>
            <h3
              style={{
                color: "#FFD700",
                marginBottom: "12px",
                fontSize: "1.05em",
              }}
            >
              📋 Resumen detallado
            </h3>
            <div
              style={{
                overflowX: "auto",
                backgroundColor: "#202020",
                borderRadius: "8px",
                padding: "10px",
                border: "1px solid #292929",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  color: "#ddd",
                  fontSize: "0.9rem",
                }}
              >
                <thead>
                  <tr style={{ borderBottom: "2px solid #303030" }}>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        color: "#FFD700",
                      }}
                    >
                      Puesto
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "left",
                        color: "#FFD700",
                      }}
                    >
                      Servicio
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        color: "#FFD700",
                      }}
                    >
                      %
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        color: "#FFD700",
                      }}
                    >
                      Ventas
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        color: "#FFD700",
                      }}
                    >
                      Precio
                    </th>
                    <th
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        color: "#FFD700",
                      }}
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dataWithAngles.map((servicio, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: "1px solid #303030",
                        transition: "background 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.backgroundColor = "#262626")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <td style={{ padding: "10px" }}>
                        <span
                          style={{
                            backgroundColor: servicio.color,
                            color: "#000",
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: "bold",
                            fontSize: "0.85em",
                          }}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td style={{ padding: "10px", fontWeight: "500" }}>
                        {servicio.nombre}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          color: servicio.color,
                          fontWeight: "bold",
                        }}
                      >
                        {servicio.porcentaje}%
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "center",
                          fontSize: "1em",
                          fontWeight: "bold",
                        }}
                      >
                        {servicio.cantidad}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          color: "#bbb",
                        }}
                      >
                        {formatMoney(servicio.precio)}
                      </td>
                      <td
                        style={{
                          padding: "10px",
                          textAlign: "right",
                          color: "#4caf50",
                          fontWeight: "bold",
                        }}
                      >
                        {formatMoney(servicio.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr
                    style={{
                      borderTop: "2px solid #FFD700",
                      fontWeight: "bold",
                    }}
                  >
                    <td
                      colSpan="3"
                      style={{ padding: "10px", color: "#FFD700" }}
                    >
                      TOTAL
                    </td>
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "center",
                        color: "#fff",
                        fontSize: "1.05em",
                      }}
                    >
                      {totalVentas}
                    </td>
                    <td style={{ padding: "10px" }} />
                    <td
                      style={{
                        padding: "10px",
                        textAlign: "right",
                        color: "#4caf50",
                        fontSize: "1.05em",
                      }}
                    >
                      {formatMoney(
                        dataWithAngles.reduce((sum, s) => sum + s.total, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ======================= HOME PRINCIPAL =======================
const Home = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("Inicio");
  const [role, setRole] = useState(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    if (storedRole) setRole(storedRole);
  }, []);

  const [citas, setCitas] = useState([]);
  const [loadingCitas, setLoadingCitas] = useState(true);

  const [popularServices, setPopularServices] = useState([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [savingIds, setSavingIds] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  const [notifications, setNotifications] = useState([
    { id: 1, text: "Nueva cita reservada para 15:30", read: false, time: "hace 2 min" },
    { id: 2, text: "Pago confirmado de Luis Rodríguez", read: false, time: "hace 15 min" },
    { id: 3, text: "Stock bajo: Pomada mate", read: true, time: "hoy 10:05" },
  ]);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      setLoadingServices(true);
      setErrorMsg("");
      try {
        const res = await fetch(`${API_URL}/servicios/`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPopularServices(data);
      } catch (err) {
        console.error("Error cargando servicios", err);
        setErrorMsg("No se pudieron cargar los servicios.");
      } finally {
        setLoadingServices(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const cargarCitas = async () => {
      setLoadingCitas(true);
      try {
        const res = await fetch(`${API_URL}/reservas/?estado=confirmada`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const reservas = Array.isArray(data) ? data : data?.results ?? [];

        const ahora = new Date();

        const citasFuturas = reservas.filter((r) => {
          if (!r.fecha || !r.horario) return false;
          const [year, month, day] = r.fecha.split("-").map(Number);
          const [hours, minutes] = r.horario.split(":").map(Number);
          const fechaReserva = new Date(year, month - 1, day, hours, minutes);
          return fechaReserva > ahora;
        });

        const citasOrdenadas = citasFuturas.sort((a, b) => {
          const [yearA, monthA, dayA] = a.fecha.split("-").map(Number);
          const [hoursA, minutesA] = a.horario.split(":").map(Number);
          const fechaA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);

          const [yearB, monthB, dayB] = b.fecha.split("-").map(Number);
          const [hoursB, minutesB] = b.horario.split(":").map(Number);
          const fechaB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);

          return fechaA - fechaB;
        });

        const citasAMostrar = citasOrdenadas.slice(0, 4);
        setCitas(citasAMostrar);
      } catch (err) {
        console.error("❌ Error cargando citas:", err);
      } finally {
        setLoadingCitas(false);
      }
    };

    if (activeSection === "Inicio") {
      cargarCitas();
    }
  }, [activeSection]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("userRole");
    navigate("/");
  };

  const handleSectionClick = (section) => {
    setActiveSection(section.name);

    if (section.name === "Barberos") {
      if (role === "admin") {
        navigate("/barbers");
      } else {
        alert("Solo los administradores pueden acceder a esta sección.");
      }
      return;
    }

    if (section.name === "Servicios") {
      if (role === "admin") {
        navigate("/services-admin");
      } else {
        alert("Solo los administradores pueden acceder a esta sección.");
      }
      return;
    }

    if (section.name === "Proveedores") {
      if (role === "admin") {
        navigate("/proveedores");
      } else {
        alert("Solo los administradores pueden acceder a esta sección.");
      }
      return;
    }

    if (section.name === "Empleados") {
      if (role === "admin") {
        navigate("/empleados");
      } else {
        alert("Solo los administradores pueden acceder a esta sección.");
      }
      return;
    }
  };

  const formatearHora = (hora) => {
    if (!hora) return "-";
    const [h, m] = hora.substring(0, 5).split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    const [year, month, day] = fecha.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const Header = () => (
    <header className="header">
      <h1>{activeSection}</h1>
      <div className="topbar-actions">
        <div className="notif-wrapper" ref={notifRef}>
          <button
            className="icon-button"
            aria-label="Notificaciones"
            onClick={() => setShowNotif((v) => !v)}
          >
            <BellIcon className="icon" />
            {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
          </button>

          {showNotif && (
            <div className="dropdown notif-dropdown">
              <div className="dropdown-header">
                <span>Notificaciones</span>
                <button className="link-btn" onClick={markAllAsRead}>
                  Marcar todo leído
                </button>
              </div>

              {notifications.length === 0 ? (
                <div className="empty">Sin notificaciones</div>
              ) : (
                <ul className="notif-list">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`notif-item ${n.read ? "" : "unread"}`}
                    >
                      <div className="notif-text">
                        <p>{n.text}</p>
                        <small>{n.time}</small>
                      </div>
                      <button
                        className="clear-btn"
                        onClick={() => removeNotification(n.id)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );

  return (
    <div className="home-container">
      <aside className="sidebar">
        <h2 className="brand">Barbería Clase V</h2>
        <nav className="menu">
          {sections.map((sec) => (
            <button
              key={sec.name}
              className={`menu-item ${
                activeSection === sec.name ? "active" : ""
              }`}
              onClick={() => handleSectionClick(sec)}
            >
              <span className="icon">{sec.icon}</span>
              {sec.name}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </aside>

      <main className="dashboard">
        <Header />

        {activeSection === "Reservas" ? (
          <ReservasPendientes />
        ) : activeSection === "Pagos" ? (
          <Pagos />
        ) : activeSection === "Caja" ? (
          <MovimientosCaja />
        ) : activeSection === "Agenda" ? (
          <Agenda />
        ) : activeSection === "Perfil" ? (
          <div className="stats-grid">
            <Perfil
              admin={{ name: "Administrador", email: "admin@barberia.com" }}
              onLogout={handleLogout}
              asCard
            />
          </div>
        ) : (
          <>
            <section className="appointments-section">
              <h2>Próximas citas</h2>

              {loadingCitas ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#aaa",
                  }}
                >
                  Cargando citas...
                </div>
              ) : citas.length === 0 ? (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "#aaa",
                  }}
                >
                  No hay citas próximas
                </div>
              ) : (
                <div className="appointments-list">
                  {citas.map((cita) => (
                    <div key={cita.id} className="appointment-card">
                      <div className="appointment-time">
                        {formatearHora(cita.horario)}
                        <small
                          style={{
                            display: "block",
                            fontSize: "0.7em",
                            color: "#888",
                            marginTop: "2px",
                          }}
                        >
                          {formatearFecha(cita.fecha)}
                        </small>
                      </div>
                      <div className="appointment-details">
                        <strong>
                          {cita.nombre_cliente} {cita.apellido_cliente}
                        </strong>
                        {" - "}
                        {cita.servicios && cita.servicios.length > 0
                          ? cita.servicios.map((s) => s.nombre).join(", ")
                          : "Sin servicio"}
                        <div
                          style={{
                            fontSize: "0.85em",
                            color: "#FFD700",
                            marginTop: "4px",
                          }}
                        >
                          👤 {cita.barbero_nombre || "Sin asignar"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <ServiciosVendidosChart />

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Ingresos de hoy</h3>
                <p className="highlight">{formatMoney(35000)}</p>
              </div>

              <div className="stat-card">
                <h3>Citas completadas</h3>
                <p className="highlight">7</p>
              </div>

              <div className="stat-card">
                <h3>Servicios más populares</h3>

                {loadingServices ? (
                  <p>Cargando…</p>
                ) : errorMsg ? (
                  <p className="api-error">{errorMsg}</p>
                ) : (
                  <ul className="services-list">
                    {popularServices.slice(0, 5).map((s) => (
                      <li
                        key={s.id}
                        className={`service-item ${
                          savingIds[s.id] ? "saving" : ""
                        }`}
                      >
                        <div className="service-header">
                          <span className="service-name">{s.nombre}</span>
                          <span className="service-value">
                            {formatMoney(s.precio)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Home;