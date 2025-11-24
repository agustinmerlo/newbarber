// src/pages/AgendaAdmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import './AgendaAdmin.css';

const API_URL = "http://localhost:8000/api";

const getToken = () =>
  localStorage.getItem("token") || localStorage.getItem("authToken") || "";

function safeDate(fecha, horario) {
  if (!fecha) return null;
  const hhmm = (horario || "00:00").toString().slice(0, 5);
  const d = new Date(`${fecha}T${hhmm}:00`);
  return isNaN(d.getTime()) ? null : d;
}

const EstadoBadge = ({ estado }) => {
  const map = {
    pendiente: { txt: "Pendiente", cls: "badge badge-pendiente" },
    confirmada: { txt: "Confirmada", cls: "badge badge-confirmada" },
    cancelada: { txt: "Cancelada", cls: "badge badge-cancelada" },
    rechazada: { txt: "Rechazada", cls: "badge badge-rechazada" },
    completada: { txt: "Completada", cls: "badge badge-completada" },
  };
  const d = map[estado] || { txt: estado, cls: "badge" };
  return <span className={d.cls}>{d.txt}</span>;
};

export default function AgendaAdmin() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("proximos"); // proximos | hoy | todas
  const [busqueda, setBusqueda] = useState(""); // por cliente / barbero
  const [estado, setEstado] = useState("todos"); // estado quick filter

  const fetchReservas = async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/reservas/`, {
        headers: {
          Accept: "application/json",
          Authorization: getToken() ? `Token ${getToken()}` : undefined,
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data) ? data : data?.results ?? [];
      setReservas(items);
    } catch (e) {
      setError("No se pudieron cargar las reservas");
      setReservas([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    fetchReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ahora = new Date();

  const reservasFiltradas = useMemo(() => {
    let list = [...reservas];

    // Filtro de estado
    if (estado !== "todos") {
      list = list.filter((r) => (r.estado || "").toLowerCase() === estado);
    }

    // Filtro de búsqueda por cliente/barbero/email/teléfono
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      list = list.filter((r) => {
        const campos = [
          r.barbero_nombre,
          r.cliente_nombre,
          r.cliente_apellido,
          r.cliente_email,
          r.cliente_telefono,
        ]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase());
        return campos.some((c) => c.includes(q));
      });
    }

    // Filtro temporal
    list = list.filter((r) => {
      const dt = safeDate(r.fecha, r.horario);
      if (!dt) return true;
      if (filtro === "hoy") {
        const hoy = new Date();
        return (
          dt.getFullYear() === hoy.getFullYear() &&
          dt.getMonth() === hoy.getMonth() &&
          dt.getDate() === hoy.getDate()
        );
      }
      if (filtro === "proximos") {
        return dt >= ahora;
      }
      return true; // "todas"
    });

    // Orden: fecha ascendente
    list.sort((a, b) => {
      const da = safeDate(a.fecha, a.horario)?.getTime() || 0;
      const db = safeDate(b.fecha, b.horario)?.getTime() || 0;
      return da - db;
    });

    return list;
  }, [reservas, filtro, busqueda, estado, ahora]);

  const GroupedByDate = useMemo(() => {
    const map = new Map();
    for (const r of reservasFiltradas) {
      const key = r.fecha || "Sin fecha";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  }, [reservasFiltradas]);

  return (
    <div className="agenda-admin">
      <div className="agenda-toolbar">
        <div className="tabs">
          <button
            className={`tab ${filtro === "proximos" ? "active" : ""}`}
            onClick={() => setFiltro("proximos")}
          >
            Próximos
          </button>
          <button
            className={`tab ${filtro === "hoy" ? "active" : ""}`}
            onClick={() => setFiltro("hoy")}
          >
            Hoy
          </button>
          <button
            className={`tab ${filtro === "todas" ? "active" : ""}`}
            onClick={() => setFiltro("todas")}
          >
            Todas
          </button>
        </div>

        <div className="filters">
          <select
            className="select"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            title="Filtrar por estado"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="cancelada">Cancelada</option>
            <option value="rechazada">Rechazada</option>
            <option value="completada">Completada</option>
          </select>

          <input
            className="search"
            placeholder="Buscar por barbero / cliente / email / teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />

          <button className="btn small" onClick={fetchReservas} title="Recargar">
            ↻
          </button>
        </div>
      </div>

      {cargando ? (
        <div className="loading">Cargando reservas…</div>
      ) : error ? (
        <div className="api-error">{error}</div>
      ) : reservasFiltradas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>Sin turnos {filtro === "proximos" ? "próximos" : filtro}</h3>
        </div>
      ) : (
        <div className="agenda-groups">
          {[...GroupedByDate.entries()].map(([fecha, items]) => (
            <div key={fecha} className="agenda-day">
              <h3 className="agenda-day-title">
                {new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </h3>

              <div className="agenda-list">
                {items.map((r) => {
                  const dt = safeDate(r.fecha, r.horario);
                  const hora = dt
                    ? dt.toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })
                    : r.horario || "-";

                  const servicios = Array.isArray(r.servicios)
                    ? r.servicios.map((s) => s?.nombre).filter(Boolean).join(" • ")
                    : "-";

                  return (
                    <div key={r.id} className="agenda-card">
                      <div className="agenda-left">
                        <div className="agenda-time">{hora}</div>
                        <EstadoBadge estado={(r.estado || "").toLowerCase()} />
                      </div>

                      <div className="agenda-main">
                        <div className="row">
                          <span className="label">Barbero:</span>
                          <strong>{r.barbero_nombre || "-"}</strong>
                        </div>
                        <div className="row">
                          <span className="label">Cliente:</span>
                          <strong>
                            {(r.cliente_nombre || "-") + " " + (r.cliente_apellido || "")}
                          </strong>
                          <span className="muted">
                            {r.cliente_email ? ` • ${r.cliente_email}` : ""}
                            {r.cliente_telefono ? ` • ${r.cliente_telefono}` : ""}
                          </span>
                        </div>
                        <div className="row">
                          <span className="label">Servicios:</span>
                          <span>{servicios}</span>
                        </div>
                      </div>

                      <div className="agenda-right">
                        <div className="money">
                          <span>Total</span>
                          <strong>${r.total ?? 0}</strong>
                        </div>
                        {r["seña"] != null && (
                          <div className="money muted-small">
                            <span>Seña</span>
                            <strong>${r["seña"]}</strong>
                          </div>
                        )}
                        {r.estado === "confirmada" && r.total != null && r["seña"] != null && (
                          <div className="money restante">
                            <span>Restante</span>
                            <strong>${Math.max(0, (r.total || 0) - (r["seña"] || 0))}</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
