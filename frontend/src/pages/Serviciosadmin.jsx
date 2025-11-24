// src/pages/Serviciosadmin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Serviciosadmin.css";

// API base (Django)
const API_ROOT = process.env.REACT_APP_API_BASE || "http://localhost:8000";
const API_BASE = `${API_ROOT}/api/servicios`;

// Función para convertir URLs relativas a absolutas
const toAbsoluteURL = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_ROOT}${url.startsWith("/") ? "" : "/"}${url}`;
};

// Función para obtener imagen según nombre del servicio (SOLO como fallback)
const getImageForService = (nombre) => {
  const lower = (nombre || "").toLowerCase();
  if (lower.includes("corte")) return "/assets/corte.png";
  if (lower.includes("barba")) return "/assets/barba.png";
  if (lower.includes("color")) return "/assets/completo.png";
  if (lower.includes("ceja") || lower.includes("perfilado")) return "/assets/cejas.png";
  return "/assets/default-service.png";
};

// ------------- Helpers -------------
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Respuesta no JSON (${res.status}). ${text.slice(0, 120)}`);
  }
  return res.json();
}

async function listServices() {
  const res = await fetch(`${API_BASE}/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}

async function deleteService(id) {
  const res = await fetch(`${API_BASE}/${id}/`, { method: "DELETE" });
  if (!(res.status === 204 || res.ok)) throw new Error(`HTTP ${res.status}`);
}

async function createService(formData) {
  const res = await fetch(`${API_BASE}/`, {
    method: "POST",
    body: formData, // Enviamos FormData directamente, sin Content-Type
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  return safeJson(res);
}

async function updateService(id, formData) {
  const res = await fetch(`${API_BASE}/${id}/`, {
    method: "PUT",
    body: formData, // Enviamos FormData directamente
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  return safeJson(res);
}

// Iconos SVG
const EditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// ------------- Componente -------------
const Services = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const emptyForm = useMemo(
    () => ({
      id: null,
      nombre: "",
      duracion: "",
      precio: "",
      imagen: null,
      imagenPreview: "",
    }),
    []
  );
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listServices();
      const list = (data?.results ?? data).map((s) => ({
        ...s,
        imagen: s.imagen ? toAbsoluteURL(s.imagen) : getImageForService(s.nombre),
      }));
      setRows(list);
    } catch (e) {
      setError(e.message || "Error cargando servicios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDelete = async (id) => {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    try {
      await deleteService(id);
      reload();
    } catch (e) {
      setError(e.message || "Error eliminando");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona una imagen válida');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no debe superar los 5MB');
        return;
      }

      setForm({
        ...form,
        imagen: file,
        imagenPreview: URL.createObjectURL(file),
      });
      setError("");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.nombre.trim()) return setError("El nombre es obligatorio");
    if (!form.precio || Number(form.precio) <= 0) return setError("El precio debe ser mayor a 0");

    // Extrae número de duración (acepta "45", "45 min", "1h 30m")
    let duracionNumero = form.duracion?.toString().trim() || "";
    if (duracionNumero) {
      const m = duracionNumero.match(/\d+/g);
      duracionNumero = m ? parseInt(m[m.length - 1], 10) : 60;
    } else {
      duracionNumero = 60;
    }

    // Crear FormData para enviar archivos
    const formData = new FormData();
    formData.append('nombre', form.nombre.trim());
    formData.append('descripcion', '');
    formData.append('duracion', duracionNumero);
    formData.append('precio', Number(form.precio));
    formData.append('activo', true);
    
    // Solo agregar imagen si se seleccionó una nueva
    if (form.imagen instanceof File) {
      formData.append('imagen', form.imagen);
    }

    try {
      if (form.id) {
        await updateService(form.id, formData);
      } else {
        await createService(formData);
      }
      setOpen(false);
      setForm(emptyForm);
      await reload();
    } catch (e2) {
      setError(e2.message || "Error guardando servicio");
    }
  };

  const onEdit = (row) => {
    setForm({
      id: row.id,
      nombre: row.nombre || "",
      duracion: row.duracion?.toString?.() || "",
      precio: row.precio?.toString?.() || "",
      imagen: null,
      imagenPreview: row.imagen || "",
    });
    setOpen(true);
  };

  return (
    <div className="services-page">
      <div className="services-header">
        <div className="left">
          <Link to="/home" className="back-btn">← Inicio</Link>
          <h1>Servicios</h1>
        </div>

        <div className="services-actions">
          <button
            className="btn primary"
            onClick={() => {
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            + Agregar Servicio
          </button>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="loading">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧴</div>
          <h3>No hay servicios registrados</h3>
          <p>Comienza agregando tu primer servicio</p>
          <button
            className="btn primary"
            onClick={() => {
              setForm(emptyForm);
              setOpen(true);
            }}
          >
            + Agregar primer servicio
          </button>
        </div>
      ) : (
        <div className="services-grid">
          {rows.map((service) => (
            <div key={service.id} className="service-card">
              <div className="service-card-header">
                <div className="service-thumb">
                  <img
                    src={service.imagen}
                    alt={service.nombre}
                    onError={(e) => {
                      const fallback = getImageForService(service.nombre);
                      if (e.currentTarget.src !== fallback) {
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                </div>
                <div className="service-card-actions">
                  <button className="icon-btn edit" onClick={() => onEdit(service)} title="Editar">
                    <EditIcon />
                  </button>
                  <button className="icon-btn delete" onClick={() => onDelete(service.id)} title="Eliminar">
                    <TrashIcon />
                  </button>
                </div>
              </div>

              <div className="service-card-body">
                <h3 className="service-card-name">{service.nombre}</h3>
                {service.duracion && (
                  <p className="service-card-duration">
                    <span className="label">⏱️ Duración:</span> {service.duracion}
                  </p>
                )}
                <div className="service-card-price">
                  <span className="price-label">Precio:</span>
                  <span className="price-value">${service.precio}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{form.id ? "Editar Servicio" : "Agregar Servicio"}</h2>
            <form onSubmit={onSubmit} className="form-grid">
              
              {/* Imagen */}
              <label style={{ gridColumn: '1 / -1' }}>
                <span>Imagen del Servicio</span>
                <div style={{ 
                  border: '2px dashed #444', 
                  borderRadius: '8px', 
                  padding: '20px',
                  textAlign: 'center',
                  marginTop: '8px',
                  background: '#1a1a1a'
                }}>
                  {form.imagenPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={form.imagenPreview} 
                        alt="Preview" 
                        style={{ 
                          maxWidth: '200px', 
                          maxHeight: '200px',
                          borderRadius: '8px',
                          marginBottom: '10px'
                        }} 
                      />
                      <br />
                      <label 
                        htmlFor="imagen-input" 
                        style={{ 
                          cursor: 'pointer',
                          color: '#c9a227',
                          textDecoration: 'underline'
                        }}
                      >
                        📷 Cambiar imagen
                      </label>
                    </div>
                  ) : (
                    <label 
                      htmlFor="imagen-input" 
                      style={{ 
                        cursor: 'pointer',
                        display: 'block',
                        padding: '20px'
                      }}
                    >
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>📷</div>
                      <div style={{ color: '#c9a227', fontWeight: 'bold' }}>
                        Haz clic para seleccionar una imagen
                      </div>
                      <div style={{ color: '#888', fontSize: '0.85em', marginTop: '5px' }}>
                        JPG, PNG o GIF (máx. 5MB)
                      </div>
                    </label>
                  )}
                  <input
                    id="imagen-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: 'none' }}
                  />
                </div>
              </label>

              <label>
                <span>Nombre del Servicio *</span>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Ej: Corte Clásico"
                  required
                />
              </label>

              <label>
                <span>Duración</span>
                <input
                  type="text"
                  value={form.duracion}
                  onChange={(e) => setForm({ ...form, duracion: e.target.value })}
                  placeholder="Ej: 45 minutos"
                />
              </label>

              <label>
                <span>Precio ($) *</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio}
                  onChange={(e) => setForm({ ...form, precio: e.target.value })}
                  placeholder="Ej: 2500"
                  required
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn primary">
                  {form.id ? "Guardar cambios" : "Crear servicio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;