// src/pages/Barbers.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./Barbers.css";

const API_BASE = "http://localhost:8000/api/barbers";

// Helpers de API
async function safeJson(res) {
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Respuesta no JSON (${res.status}). ${text.slice(0, 80)}`);
  }
  return res.json();
}

async function listBarbers({ includeDeleted = false } = {}) {
  const url = includeDeleted ? `${API_BASE}/all/?include_deleted=true` : `${API_BASE}/`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}

async function listDeletedBarbers() {
  const res = await fetch(`${API_BASE}/eliminados/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}

async function softDeleteBarber(id) {
  const res = await fetch(`${API_BASE}/${id}/`, { method: "DELETE" });
  if (!(res.status === 204 || res.ok)) throw new Error(`HTTP ${res.status}`);
}

async function restoreBarber(id) {
  const res = await fetch(`${API_BASE}/${id}/restore/`, { method: "POST" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return safeJson(res);
}

async function createBarber(formData) {
  const res = await fetch(`${API_BASE}/`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }
  return safeJson(res);
}

async function updateBarber(id, formData) {
  const res = await fetch(`${API_BASE}/${id}/`, {
    method: "PUT",
    body: formData,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

const RestoreIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const Barbers = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const emptyForm = useMemo(
    () => ({ 
      id: null, 
      name: "", 
      email: "",
      username: "",
      password: "",
      specialty: "", 
      work_schedule: "",
      photo: null,
      photo_preview: null
    }),
    []
  );
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError("");
    try {
      let data;
      if (showDeleted) {
        // Cargar SOLO eliminados
        data = await listDeletedBarbers();
        setRows(data?.results ?? data);
      } else {
        // Cargar SOLO activos
        data = await listBarbers({ includeDeleted: false });
        setRows(data?.results ?? data);
      }
    } catch (e) {
      setError(e.message || "Error cargando barberos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDeleted]);

  const onDelete = async (id) => {
    if (!window.confirm("¿Eliminar este barbero? También se degradará a 'Cliente' en empleados.")) return;
    try {
      await softDeleteBarber(id);
      setSuccessMsg("✅ Barbero eliminado y degradado a Cliente");
      setTimeout(() => setSuccessMsg(""), 3000);
      reload();
    } catch (e) {
      setError(e.message || "Error eliminando");
    }
  };

  const onRestore = async (id) => {
    if (!window.confirm("¿Restaurar este barbero? También se le asignará el rol 'Barbero' en empleados.")) return;
    try {
      await restoreBarber(id);
      setSuccessMsg("✅ Barbero restaurado y rol actualizado");
      setTimeout(() => setSuccessMsg(""), 3000);
      reload();
    } catch (e) {
      setError(e.message || "Error restaurando");
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Por favor selecciona una imagen válida');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError('La imagen no puede superar 5MB');
        return;
      }

      setForm(prev => ({
        ...prev,
        photo: file,
        photo_preview: URL.createObjectURL(file)
      }));
      setError('');
    }
  };

  const removePhoto = () => {
    if (form.photo_preview) {
      URL.revokeObjectURL(form.photo_preview);
    }
    setForm(prev => ({
      ...prev,
      photo: null,
      photo_preview: null
    }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    
    if (!form.name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    // Solo validar email al crear nuevo barbero
    if (!form.id && !form.email.trim()) {
      setError('El email es obligatorio para crear un nuevo barbero');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', form.name.trim());
      formData.append('specialty', form.specialty.trim());
      formData.append('work_schedule', form.work_schedule.trim());
      
      // Solo al crear nuevo barbero
      if (!form.id) {
        formData.append('email', form.email.trim());
        if (form.username.trim()) {
          formData.append('username', form.username.trim());
        }
        if (form.password.trim()) {
          formData.append('password', form.password.trim());
        }
      }
      
      if (form.photo) {
        formData.append('photo', form.photo);
      }

      let response;
      if (form.id) {
        response = await updateBarber(form.id, formData);
      } else {
        response = await createBarber(formData);
        
        // Mostrar credenciales generadas
        if (response.user_created) {
          setSuccessMsg(
            `✅ Barbero creado exitosamente!\n\n` +
            `Usuario: ${response.user_created.username}\n` +
            `Email: ${response.user_created.email}\n` +
            `Contraseña: ${response.user_created.password}\n\n` +
            `⚠️ Guarda esta información, el barbero la necesitará para iniciar sesión.`
          );
        }
      }
      
      setForm(emptyForm);
      reload();
      
      // No cerrar el modal inmediatamente si hay mensaje de éxito
      if (!response?.user_created) {
        setOpen(false);
      }
    } catch (e) {
      setError(e.message || "Error guardando barbero");
    }
  };

  const onEdit = (row) => {
    setForm({
      ...row,
      email: row.email || '',
      username: row.username || '',
      password: '',
      photo: null,
      photo_preview: row.photo || null
    });
    setOpen(true);
  };

  return (
    <div className="barbers-page">
      <div className="barbers-header">
        <div className="left">
          <Link to="/home" className="back-btn">← Inicio</Link>
          <h1>Barberos</h1>
        </div>

        <div className="barbers-actions">
          <label className="checkbox" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: showDeleted ? '#ef4444' : '#374151',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontWeight: showDeleted ? '600' : '400'
          }}>
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
              style={{cursor: 'pointer'}}
            />
            <span>{showDeleted ? '🗑️ Mostrando eliminados' : '👥 Mostrar eliminados'}</span>
          </label>
          
          {!showDeleted && (
            <button
              className="btn primary"
              onClick={() => {
                setForm(emptyForm);
                setError('');
                setSuccessMsg('');
                setOpen(true);
              }}
            >
              + Agregar Barbero
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}
      
      {loading ? (
        <div className="loading">Cargando…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {showDeleted ? '🗑️' : '✂️'}
          </div>
          <h3>
            {showDeleted ? 'No hay barberos eliminados' : 'No hay barberos registrados'}
          </h3>
          <p>
            {showDeleted 
              ? 'Los barberos eliminados aparecerán aquí' 
              : 'Comienza agregando tu primer barbero al equipo'}
          </p>
          {!showDeleted && (
            <button
              className="btn primary"
              onClick={() => {
                setForm(emptyForm);
                setOpen(true);
              }}
            >
              + Agregar primer barbero
            </button>
          )}
        </div>
      ) : (
        <div className="barbers-grid">
          {rows.map((b) => (
            <div key={b.id} className={`barber-card ${b.is_deleted ? "deleted" : ""}`}>
              <div className="barber-card-header">
                {b.photo ? (
                  <img 
                    src={b.photo} 
                    alt={b.name}
                    className="barber-card-photo"
                  />
                ) : (
                  <div className="barber-card-avatar">
                    {b.name?.charAt(0)?.toUpperCase() || "B"}
                  </div>
                )}
                <div className="barber-card-actions">
                  {!b.is_deleted ? (
                    <>
                      <button 
                        className="icon-btn edit" 
                        onClick={() => onEdit(b)}
                        title="Editar"
                      >
                        <EditIcon />
                      </button>
                      <button 
                        className="icon-btn delete" 
                        onClick={() => onDelete(b.id)}
                        title="Eliminar"
                      >
                        <TrashIcon />
                      </button>
                    </>
                  ) : (
                    <button 
                      className="icon-btn restore" 
                      onClick={() => onRestore(b.id)}
                      title="Restaurar barbero y rol"
                      style={{
                        background: '#10b981',
                        color: 'white'
                      }}
                    >
                      <RestoreIcon />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="barber-card-body">
                <h3 className="barber-card-name">{b.name}</h3>
                {b.email && (
                  <p className="barber-card-email">
                    <span className="label">✉️</span> {b.email}
                  </p>
                )}
                {b.username && (
                  <p className="barber-card-username">
                    <span className="label">👤</span> @{b.username}
                  </p>
                )}
                {b.specialty && (
                  <p className="barber-card-specialty">
                    <span className="label">✂️</span> {b.specialty}
                  </p>
                )}
                {b.work_schedule && (
                  <p className="barber-card-schedule">
                    <span className="label">🕐</span> {b.work_schedule}
                  </p>
                )}
                
                {/* Badge de estado */}
                {b.is_deleted && (
                  <div style={{
                    marginTop: '12px',
                    padding: '6px 12px',
                    background: '#ef4444',
                    color: 'white',
                    borderRadius: '6px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    textAlign: 'center'
                  }}>
                    🗑️ Eliminado
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="modal-backdrop" onClick={() => !successMsg && setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{form.id ? "Editar Barbero" : "Agregar Barbero"}</h2>
            
            {successMsg && (
              <div className="alert success" style={{whiteSpace: 'pre-wrap', marginBottom: '20px'}}>
                {successMsg}
                <button 
                  className="btn primary" 
                  onClick={() => {
                    setSuccessMsg('');
                    setOpen(false);
                  }}
                  style={{marginTop: '15px', width: '100%'}}
                >
                  Cerrar
                </button>
              </div>
            )}
            
            {!successMsg && (
              <form onSubmit={onSubmit} className="form-grid">
                
                {/* Campo de foto */}
                <div className="photo-upload">
                  <label>Foto del barbero</label>
                  <div className="photo-preview-container">
                    {form.photo_preview ? (
                      <div className="photo-preview">
                        <img src={form.photo_preview} alt="Preview" />
                        <button 
                          type="button" 
                          className="remove-photo"
                          onClick={removePhoto}
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <div className="photo-placeholder">
                        <ImageIcon />
                        <span>Sin foto</span>
                      </div>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    id="photo-input"
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="photo-input" className="btn ghost">
                    {form.photo_preview ? 'Cambiar foto' : 'Seleccionar foto'}
                  </label>
                </div>

                <label>
                  <span>Nombre completo *</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </label>

                {/* Solo mostrar campos de usuario al crear */}
                {!form.id && (
                  <>
                    <label>
                      <span>Email * (para iniciar sesión)</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="juan.perez@ejemplo.com"
                        required
                      />
                    </label>

                    <label>
                      <span>Username (opcional)</span>
                      <input
                        value={form.username}
                        onChange={(e) => setForm({ ...form, username: e.target.value })}
                        placeholder="Se generará automáticamente si no lo especificas"
                      />
                      <small style={{color: '#888', fontSize: '0.85em'}}>
                        Dejar vacío para generar automáticamente
                      </small>
                    </label>

                    <label>
                      <span>Contraseña (opcional)</span>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        placeholder="Se generará automáticamente si no la especificas"
                      />
                      <small style={{color: '#888', fontSize: '0.85em'}}>
                        Dejar vacío para generar automáticamente
                      </small>
                    </label>
                  </>
                )}
                
                <label>
                  <span>Especialidad</span>
                  <input
                    value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    placeholder="Ej: Cortes clásicos, Fade"
                  />
                </label>
                
                <label>
                  <span>Horario de trabajo</span>
                  <input
                    value={form.work_schedule}
                    onChange={(e) => setForm({ ...form, work_schedule: e.target.value })}
                    placeholder="Ej: Lun-Vie 9am-6pm"
                  />
                </label>

                <div className="modal-actions">
                  <button type="button" className="btn ghost" onClick={() => setOpen(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn primary">
                    {form.id ? "Guardar cambios" : "Crear barbero"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Barbers; 