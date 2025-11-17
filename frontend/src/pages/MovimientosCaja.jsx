import React, { useEffect, useState } from "react";

const API_URL = "http://localhost:8000/api/caja";

const MovimientosCaja = () => {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [movimientoEditar, setMovimientoEditar] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const [turnoActivo, setTurnoActivo] = useState(null);
  const [modalApertura, setModalApertura] = useState(false);
  const [modalCierre, setModalCierre] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);
  const [montoApertura, setMontoApertura] = useState("");
  
  const [montosCierre, setMontosCierre] = useState({
    efectivo: "",
    transferencia: "",
    seña: ""
  });
  
  const [observacionesCierre, setObservacionesCierre] = useState("");
  const [historialTurnos, setHistorialTurnos] = useState([]);

  const [formData, setFormData] = useState({
    tipo: "ingreso",
    monto: "",
    descripcion: "",
    metodo_pago: "efectivo",
    categoria: "servicios",
    fecha: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    verificarTurnoActivo();
    cargarMovimientos();
  }, []);

  const verificarTurnoActivo = async () => {
    try {
      const res = await fetch(`${API_URL}/turnos/turno_activo/`);
      const data = await res.json();
      if (data.existe) {
        console.log("✅ Turno activo:", data.turno);
        setTurnoActivo(data.turno);
      }
    } catch (err) {
      console.error("Error verificando turno:", err);
    }
  };

  const cargarMovimientos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/movimientos/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      const todosMovimientos = Array.isArray(data) ? data : data?.results ?? [];
      
      // Eliminar duplicados por ID
      const movimientosUnicos = Array.from(
        new Map(todosMovimientos.map(mov => [mov.id, mov])).values()
      );
      
      const movimientosOrdenados = movimientosUnicos.sort((a, b) => {
        const fechaA = new Date(a.fecha + 'T' + (a.hora || '00:00:00'));
        const fechaB = new Date(b.fecha + 'T' + (b.hora || '00:00:00'));
        return fechaB - fechaA;
      });

      console.log("✅ Movimientos cargados:", movimientosOrdenados.length);
      setMovimientos(movimientosOrdenados);
    } catch (err) {
      console.error("Error cargando movimientos:", err);
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
      const res = await fetch(`${API_URL}/turnos/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto_apertura: parseFloat(montoApertura) })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      setTurnoActivo(data);
      setModalApertura(false);
      setMontoApertura("");
      
      alert("✅ Caja abierta exitosamente");
      cargarMovimientos();
    } catch (err) {
      console.error("Error abriendo caja:", err);
      alert("❌ Error al abrir la caja");
    }
  };

  const prepararCierreCaja = () => {
    if (!turnoActivo) return;
    
    console.log("📊 Preparando cierre con turno:", turnoActivo);
    
    setMontosCierre({
      efectivo: turnoActivo.efectivo_esperado?.toString() || "0",
      transferencia: turnoActivo.transferencia_esperada?.toString() || "0",
      seña: turnoActivo.seña_esperada?.toString() || "0"
    });
    setModalCierre(true);
  };

  const cerrarCaja = async () => {
    if (!turnoActivo) {
      alert("❌ No hay turno activo para cerrar");
      return;
    }

    console.log("💰 Montos de cierre:", montosCierre);

    try {
      const body = {
        monto_cierre_efectivo: parseFloat(montosCierre.efectivo || 0),
        monto_cierre_transferencia: parseFloat(montosCierre.transferencia || 0),
        monto_cierre_mercadopago: 0,
        monto_cierre_seña: parseFloat(montosCierre.seña || 0),
        observaciones: observacionesCierre
      };

      console.log("📤 Enviando cierre:", body);

      const res = await fetch(`${API_URL}/turnos/${turnoActivo.id}/cerrar/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Error del servidor:", errorText);
        throw new Error(`HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      const turnoCerrado = data.turno;

      console.log("✅ Caja cerrada:", turnoCerrado);

      setTurnoActivo(null);
      setModalCierre(false);
      setMontosCierre({ efectivo: "", transferencia: "", seña: "" });
      setObservacionesCierre("");

      const mensaje = `✅ Caja cerrada exitosamente

💵 EFECTIVO
Esperado: $${parseFloat(turnoCerrado.efectivo_esperado).toLocaleString('es-AR', {minimumFractionDigits: 2})}
Contado: $${parseFloat(turnoCerrado.monto_cierre_efectivo).toLocaleString('es-AR', {minimumFractionDigits: 2})}
Diferencia: $${Math.abs(turnoCerrado.diferencia_efectivo).toLocaleString('es-AR', {minimumFractionDigits: 2})} ${turnoCerrado.diferencia_efectivo >= 0 ? '✅' : '⚠️'}

🏦 TRANSFERENCIA
Esperado: $${parseFloat(turnoCerrado.transferencia_esperada).toLocaleString('es-AR', {minimumFractionDigits: 2})}
Contado: $${parseFloat(turnoCerrado.monto_cierre_transferencia).toLocaleString('es-AR', {minimumFractionDigits: 2})}
Diferencia: $${Math.abs(turnoCerrado.diferencia_transferencia).toLocaleString('es-AR', {minimumFractionDigits: 2})} ${turnoCerrado.diferencia_transferencia >= 0 ? '✅' : '⚠️'}

💰 SEÑAS
Esperado: $${parseFloat(turnoCerrado.seña_esperada).toLocaleString('es-AR', {minimumFractionDigits: 2})}
Contado: $${parseFloat(turnoCerrado.monto_cierre_seña).toLocaleString('es-AR', {minimumFractionDigits: 2})}
Diferencia: $${Math.abs(turnoCerrado.diferencia_seña).toLocaleString('es-AR', {minimumFractionDigits: 2})} ${turnoCerrado.diferencia_seña >= 0 ? '✅' : '⚠️'}

🎯 DIFERENCIA TOTAL: $${Math.abs(turnoCerrado.diferencia_total).toLocaleString('es-AR', {minimumFractionDigits: 2})} ${turnoCerrado.diferencia_total >= 0 ? '(Sobrante)' : '(Faltante)'}`;
      
      alert(mensaje);
      cargarMovimientos();
      verificarTurnoActivo();
    } catch (err) {
      console.error("Error cerrando caja:", err);
      alert("❌ Error al cerrar la caja: " + err.message);
    }
  };

  const cargarHistorial = async () => {
    try {
      const res = await fetch(`${API_URL}/turnos/historial/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      setHistorialTurnos(data.turnos || []);
      setModalHistorial(true);
    } catch (err) {
      console.error("Error cargando historial:", err);
      alert("❌ Error al cargar el historial");
    }
  };

  const abrirModalNuevo = () => {
    if (!turnoActivo) {
      alert("❌ Debes abrir la caja antes de registrar movimientos");
      return;
    }
    setModoEdicion(false);
    setMovimientoEditar(null);
    setFormData({
      tipo: "ingreso",
      monto: "",
      descripcion: "",
      metodo_pago: "efectivo",
      categoria: "servicios",
      fecha: new Date().toISOString().split('T')[0]
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (movimiento) => {
    if (!movimiento.es_editable) {
      alert("⚠️ Este movimiento no puede ser editado porque pertenece a un turno cerrado");
      return;
    }

    setModoEdicion(true);
    setMovimientoEditar(movimiento);
    setFormData({
      tipo: movimiento.tipo,
      monto: movimiento.monto.toString(),
      descripcion: movimiento.descripcion || "",
      metodo_pago: movimiento.metodo_pago || "efectivo",
      categoria: movimiento.categoria || "servicios",
      fecha: movimiento.fecha
    });
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setModoEdicion(false);
    setMovimientoEditar(null);
    setFormData({
      tipo: "ingreso",
      monto: "",
      descripcion: "",
      metodo_pago: "efectivo",
      categoria: "servicios",
      fecha: new Date().toISOString().split('T')[0]
    });
  };

  const guardarMovimiento = async () => {
    if (!formData.monto || parseFloat(formData.monto) <= 0) {
      alert("❌ Ingresa un monto válido");
      return;
    }

    if (!formData.descripcion.trim()) {
      alert("❌ Ingresa una descripción");
      return;
    }

    setGuardando(true);
    try {
      const body = { ...formData, monto: parseFloat(formData.monto) };
      const url = modoEdicion ? `${API_URL}/movimientos/${movimientoEditar.id}/` : `${API_URL}/movimientos/`;
      const method = modoEdicion ? "PUT" : "POST";

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      alert(`✅ Movimiento ${modoEdicion ? "actualizado" : "registrado"} exitosamente`);
      cerrarModal();
      
      // Esperar un momento antes de recargar para evitar múltiples peticiones simultáneas
      await new Promise(resolve => setTimeout(resolve, 300));
      await cargarMovimientos();
      await verificarTurnoActivo();
    } catch (err) {
      console.error("Error guardando movimiento:", err);
      alert(err.message || "❌ Error al guardar el movimiento");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarMovimiento = async (id, esEditable) => {
    if (!esEditable) {
      alert("⚠️ Este movimiento no puede ser eliminado porque pertenece a un turno cerrado");
      return;
    }

    if (!window.confirm("⚠️ ¿Estás seguro de eliminar este movimiento?")) return;

    try {
      const res = await fetch(`${API_URL}/movimientos/${id}/`, { method: "DELETE" });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      alert("✅ Movimiento eliminado exitosamente");
      cargarMovimientos();
      verificarTurnoActivo();
    } catch (err) {
      console.error("Error eliminando movimiento:", err);
      alert(err.message || "❌ Error al eliminar el movimiento");
    }
  };

  const formatearFecha = (fecha) => {
    if (!fecha) return "-";
    const [year, month, day] = fecha.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
  };

  const formatearHora = (hora) => {
    if (!hora) return "";
    const [h, m] = hora.substring(0, 5).split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatearFechaHora = (fechaISO) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  // ✅ ESTADÍSTICAS CORREGIDAS - Convertir a número siempre
  const totalIngresos = movimientos
    .filter(m => m.tipo === "ingreso")
    .reduce((sum, m) => {
      const monto = parseFloat(m.monto);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);

  const totalEgresos = movimientos
    .filter(m => m.tipo === "egreso")
    .reduce((sum, m) => {
      const monto = parseFloat(m.monto);
      return sum + (isNaN(monto) ? 0 : monto);
    }, 0);

  const saldoCaja = totalIngresos - totalEgresos;

  console.log("📊 Estadísticas:", { totalIngresos, totalEgresos, saldoCaja, cantidadMovimientos: movimientos.length });

  const getTipoIcon = (tipo) => tipo === "ingreso" ? "📈" : "📉";
  const getTipoColor = (tipo) => tipo === "ingreso" ? "#4caf50" : "#f44336";

  const getMetodoIcon = (metodo) => {
    const iconos = {
      efectivo: "💵",
      tarjeta: "💳",
      transferencia: "🏦",
      seña: "💰"
    };
    return iconos[metodo] || "💰";
  };

  const getCategoriaIcon = (categoria) => {
    const iconos = {
      servicios: "✂️",
      productos: "🛍️",
      gastos: "📊",
      sueldos: "👨‍💼",
      alquiler: "🏢",
      servicios_publicos: "💡",
      otros: "📌"
    };
    return iconos[categoria] || "📌";
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#121212', minHeight: '100vh', color: '#fff' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
        <h2 style={{ margin: 0 }}>💰 Movimientos de Caja</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {!turnoActivo ? (
            <button 
              style={{ padding: '12px 24px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
              onClick={() => setModalApertura(true)}
            >
              🔓 Abrir Caja
            </button>
          ) : (
            <>
              <button 
                style={{ padding: '12px 24px', background: '#f44336', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                onClick={prepararCierreCaja}
              >
                🔒 Cerrar Caja
              </button>
              <button 
                style={{ padding: '12px 24px', background: '#ffc107', color: '#000', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
                onClick={abrirModalNuevo}
              >
                ➕ Nuevo Movimiento
              </button>
            </>
          )}
          <button 
            style={{ padding: '12px 24px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer' }}
            onClick={cargarHistorial}
          >
            📋 Historial
          </button>
        </div>
      </div>

      {/* Estado de Caja */}
      {turnoActivo ? (
        <div style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', padding: '20px', borderRadius: '12px', border: '2px solid #4caf50', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(76, 175, 80, 0.2)', color: '#4caf50', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '14px', display: 'inline-block', marginBottom: '16px' }}>
            🟢 Caja Abierta
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #4caf50' }}>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>💵 Efectivo</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#4caf50' }}>
                ${parseFloat(turnoActivo.efectivo_esperado || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
              </div>
            </div>
            
            <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #2196f3' }}>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>🏦 Transferencias</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#2196f3' }}>
                ${parseFloat(turnoActivo.transferencia_esperada || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
              </div>
            </div>
            
            <div style={{ background: '#1a1a1a', padding: '16px', borderRadius: '8px', borderLeft: '4px solid #ffc107' }}>
              <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '8px' }}>💰 Señas</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#ffc107' }}>
                ${parseFloat(turnoActivo.seña_esperada || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
              </div>
            </div>
          </div>
          
          <div style={{ color: '#aaa', fontSize: '14px', marginTop: '16px' }}>
            Abierta el: {formatearFechaHora(turnoActivo.fecha_apertura)} | Monto inicial: ${parseFloat(turnoActivo.monto_apertura).toLocaleString('es-AR', {minimumFractionDigits: 2})}
          </div>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', padding: '20px', borderRadius: '12px', border: '2px solid #f44336', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(244, 67, 54, 0.2)', color: '#f44336', padding: '8px 16px', borderRadius: '20px', fontWeight: '700', fontSize: '14px', display: 'inline-block', marginBottom: '8px' }}>
            🔴 Caja Cerrada
          </div>
          <div style={{ color: '#aaa', fontSize: '14px' }}>Debes abrir la caja para comenzar a operar</div>
        </div>
      )}

      {/* Estadísticas Generales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #4caf50' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Total Ingresos</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#4caf50' }}>
            ${totalIngresos.toLocaleString('es-AR', {minimumFractionDigits: 2})}
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #f44336' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📉</div>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Total Egresos</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#f44336' }}>
            ${totalEgresos.toLocaleString('es-AR', {minimumFractionDigits: 2})}
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)', padding: '24px', borderRadius: '12px', borderLeft: '4px solid #ffc107' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>💰</div>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '8px' }}>Saldo Total</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: saldoCaja >= 0 ? '#ffc107' : '#f44336' }}>
            ${saldoCaja.toLocaleString('es-AR', {minimumFractionDigits: 2})}
          </div>
        </div>
      </div>

      {/* Lista de Movimientos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>Cargando movimientos...</div>
      ) : movimientos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📊</div>
          <p>No hay movimientos registrados</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '16px' }}>
          {movimientos.map(mov => (
            <div key={mov.id} style={{ background: '#2a2a2a', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${mov.es_editable ? '#333' : '#666'}`, opacity: mov.es_editable ? 1 : 0.7 }}>
              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ fontSize: '32px' }}>{getTipoIcon(mov.tipo)}</div>
                    <div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: getTipoColor(mov.tipo) }}>
                        ${parseFloat(mov.monto || 0).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      </div>
                      <div style={{ color: '#aaa', fontSize: '14px' }}>
                        {mov.tipo === "ingreso" ? "Ingreso" : "Egreso"}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#aaa', fontSize: '14px' }}>{formatearFecha(mov.fecha)}</div>
                    <div style={{ color: '#666', fontSize: '12px' }}>{formatearHora(mov.hora)}</div>
                  </div>
                </div>
                
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ color: '#ffc107', fontWeight: '600', marginBottom: '4px' }}>Descripción</div>
                  <div style={{ color: '#fff' }}>{mov.descripcion || "-"}</div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Método de Pago</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '20px' }}>{getMetodoIcon(mov.metodo_pago)}</span>
                      <span style={{ color: '#fff', textTransform: 'capitalize' }}>
                        {mov.metodo_pago}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Categoría</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '20px' }}>{getCategoriaIcon(mov.categoria)}</span>
                      <span style={{ color: '#fff', textTransform: 'capitalize' }}>
                        {mov.categoria?.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '8px', padding: '16px 20px', background: '#1a1a1a', borderTop: '1px solid #333' }}>
                <button 
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: mov.es_editable ? 'pointer' : 'not-allowed', background: '#2196f3', color: 'white', opacity: mov.es_editable ? 1 : 0.5 }}
                  onClick={() => abrirModalEditar(mov)}
                  disabled={!mov.es_editable}
                >
                  ✏️ Editar
                </button>
                <button 
                  style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: mov.es_editable ? 'pointer' : 'not-allowed', background: '#f44336', color: 'white', opacity: mov.es_editable ? 1 : 0.5 }}
                  onClick={() => eliminarMovimiento(mov.id, mov.es_editable)}
                  disabled={!mov.es_editable}
                >
                  🗑️ Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Apertura */}
      {modalApertura && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setModalApertura(false)}>
          <div style={{ background: '#2a2a2a', borderRadius: '16px', maxWidth: '600px', width: '100%', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffc107' }}>🔓 Apertura de Caja</div>
              <button style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '28px', cursor: 'pointer' }} onClick={() => setModalApertura(false)}>×</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Monto Inicial en Efectivo</label>
                <input
                  type="number"
                  style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                  value={montoApertura}
                  onChange={(e) => setMontoApertura(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  autoFocus
                />
              </div>
            </div>
            
            <div style={{ padding: '24px', borderTop: '1px solid #333', display: 'flex', gap: '12px' }}>
              <button style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: 'pointer', background: '#444', color: '#fff' }} onClick={() => setModalApertura(false)}>
                Cancelar
              </button>
              <button style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: 'pointer', background: '#ffc107', color: '#000' }} onClick={abrirCaja}>
                Abrir Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cierre */}
      {modalCierre && turnoActivo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', overflowY: 'auto' }} onClick={() => setModalCierre(false)}>
          <div style={{ background: '#2a2a2a', borderRadius: '16px', maxWidth: '700px', width: '100%', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)', margin: '20px 0' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffc107' }}>🔒 Cierre de Caja</div>
              <button style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '28px', cursor: 'pointer' }} onClick={() => setModalCierre(false)}>×</button>
            </div>
            
            <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Resumen Esperado */}
              <div style={{ background: 'rgba(255, 193, 7, 0.1)', border: '1px solid #ffc107', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#ffc107', fontSize: '16px' }}>📊 Montos Esperados</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 193, 7, 0.2)' }}>
                    <span style={{ color: '#aaa' }}>💵 Efectivo:</span>
                    <strong style={{ color: '#fff' }}>${parseFloat(turnoActivo.efectivo_esperado).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255, 193, 7, 0.2)' }}>
                    <span style={{ color: '#aaa' }}>🏦 Transferencias:</span>
                    <strong style={{ color: '#fff' }}>${parseFloat(turnoActivo.transferencia_esperada).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#aaa' }}>💰 Señas:</span>
                    <strong style={{ color: '#fff' }}>${parseFloat(turnoActivo.seña_esperada).toLocaleString('es-AR', {minimumFractionDigits: 2})}</strong>
                  </div>
                </div>
              </div>

              {/* Formulario de Montos Reales */}
              <h3 style={{ margin: '0 0 16px 0', color: '#ffc107', fontSize: '16px' }}>💵 Ingresa los Montos Reales</h3>
              
              <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#4caf50', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                    💵 Efectivo Real en Caja
                  </label>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={montosCierre.efectivo}
                    onChange={(e) => setMontosCierre({...montosCierre, efectivo: e.target.value})}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  {montosCierre.efectivo && (
                    <small style={{ color: parseFloat(montosCierre.efectivo) - parseFloat(turnoActivo.efectivo_esperado) >= 0 ? '#4caf50' : '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Diferencia: ${Math.abs(parseFloat(montosCierre.efectivo) - parseFloat(turnoActivo.efectivo_esperado)).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      {parseFloat(montosCierre.efectivo) - parseFloat(turnoActivo.efectivo_esperado) >= 0 ? ' (Sobrante)' : ' (Faltante)'}
                    </small>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: '#2196f3', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                    🏦 Transferencias Verificadas
                  </label>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={montosCierre.transferencia}
                    onChange={(e) => setMontosCierre({...montosCierre, transferencia: e.target.value})}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  {montosCierre.transferencia && (
                    <small style={{ color: parseFloat(montosCierre.transferencia) - parseFloat(turnoActivo.transferencia_esperada) >= 0 ? '#4caf50' : '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Diferencia: ${Math.abs(parseFloat(montosCierre.transferencia) - parseFloat(turnoActivo.transferencia_esperada)).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      {parseFloat(montosCierre.transferencia) - parseFloat(turnoActivo.transferencia_esperada) >= 0 ? ' (Sobrante)' : ' (Faltante)'}
                    </small>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                    💰 Señas Verificadas
                  </label>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={montosCierre.seña}
                    onChange={(e) => setMontosCierre({...montosCierre, seña: e.target.value})}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                  {montosCierre.seña && (
                    <small style={{ color: parseFloat(montosCierre.seña) - parseFloat(turnoActivo.seña_esperada) >= 0 ? '#4caf50' : '#f44336', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Diferencia: ${Math.abs(parseFloat(montosCierre.seña) - parseFloat(turnoActivo.seña_esperada)).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                      {parseFloat(montosCierre.seña) - parseFloat(turnoActivo.seña_esperada) >= 0 ? ' (Sobrante)' : ' (Faltante)'}
                    </small>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Observaciones (opcional)</label>
                <textarea
                  style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px', resize: 'vertical', minHeight: '80px' }}
                  value={observacionesCierre}
                  onChange={(e) => setObservacionesCierre(e.target.value)}
                  placeholder="Notas sobre el cierre de caja..."
                />
              </div>
            </div>
            
            <div style={{ padding: '24px', borderTop: '1px solid #333', display: 'flex', gap: '12px' }}>
              <button style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: 'pointer', background: '#444', color: '#fff' }} onClick={() => setModalCierre(false)}>
                Cancelar
              </button>
              <button style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: 'pointer', background: '#ffc107', color: '#000' }} onClick={cerrarCaja}>
                Cerrar Caja
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Historial de Turnos */}
      {modalHistorial && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={() => setModalHistorial(false)}>
          <div style={{ background: '#2a2a2a', borderRadius: '16px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffc107' }}>📋 Historial de Turnos</div>
              <button style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '28px', cursor: 'pointer' }} onClick={() => setModalHistorial(false)}>×</button>
            </div>
            
            <div style={{ padding: '24px', maxHeight: 'calc(90vh - 100px)', overflowY: 'auto' }}>
              {historialTurnos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#aaa' }}>
                  <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
                  <p>No hay turnos cerrados</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {historialTurnos.map(turno => (
                    <div key={turno.id} style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', border: '1px solid #333' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '16px' }}>
                        <div>
                          <div style={{ color: '#ffc107', fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>
                            Turno #{turno.id}
                          </div>
                          <div style={{ color: '#aaa', fontSize: '14px' }}>
                            {formatearFechaHora(turno.fecha_apertura)} - {formatearFechaHora(turno.fecha_cierre)}
                          </div>
                        </div>
                        <div style={{ background: turno.diferencia_total >= 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)', color: turno.diferencia_total >= 0 ? '#4caf50' : '#f44336', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                          {turno.diferencia_total >= 0 ? '✅ CUADRADO' : '⚠️ DIFERENCIA'}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ background: '#2a2a2a', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Apertura</div>
                          <div style={{ color: '#fff', fontWeight: '600' }}>${parseFloat(turno.monto_apertura).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                        </div>
                        
                        <div style={{ background: '#2a2a2a', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>💵 Efectivo</div>
                          <div style={{ color: '#fff', fontWeight: '600' }}>${parseFloat(turno.monto_cierre_efectivo).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                          <div style={{ fontSize: '11px', color: turno.diferencia_efectivo >= 0 ? '#4caf50' : '#f44336' }}>
                            Dif: ${Math.abs(turno.diferencia_efectivo).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                          </div>
                        </div>
                        
                        <div style={{ background: '#2a2a2a', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>🏦 Transferencias</div>
                          <div style={{ color: '#fff', fontWeight: '600' }}>${parseFloat(turno.monto_cierre_transferencia).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                          <div style={{ fontSize: '11px', color: turno.diferencia_transferencia >= 0 ? '#4caf50' : '#f44336' }}>
                            Dif: ${Math.abs(turno.diferencia_transferencia).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                          </div>
                        </div>
                        
                        <div style={{ background: '#2a2a2a', padding: '12px', borderRadius: '8px' }}>
                          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>💰 Señas</div>
                          <div style={{ color: '#fff', fontWeight: '600' }}>${parseFloat(turno.monto_cierre_seña).toLocaleString('es-AR', {minimumFractionDigits: 2})}</div>
                          <div style={{ fontSize: '11px', color: turno.diferencia_seña >= 0 ? '#4caf50' : '#f44336' }}>
                            Dif: ${Math.abs(turno.diferencia_seña).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#2a2a2a', padding: '12px', borderRadius: '8px', borderLeft: '4px solid ' + (turno.diferencia_total >= 0 ? '#4caf50' : '#f44336') }}>
                        <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Diferencia Total</div>
                        <div style={{ color: turno.diferencia_total >= 0 ? '#4caf50' : '#f44336', fontWeight: '700', fontSize: '20px' }}>
                          ${Math.abs(turno.diferencia_total).toLocaleString('es-AR', {minimumFractionDigits: 2})}
                          <span style={{ fontSize: '14px', marginLeft: '8px' }}>
                            {turno.diferencia_total >= 0 ? '(Sobrante)' : '(Faltante)'}
                          </span>
                        </div>
                      </div>

                      {turno.observaciones && (
                        <div style={{ marginTop: '12px', padding: '12px', background: '#2a2a2a', borderRadius: '8px' }}>
                          <div style={{ color: '#aaa', fontSize: '12px', marginBottom: '4px' }}>Observaciones</div>
                          <div style={{ color: '#fff', fontSize: '14px' }}>{turno.observaciones}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo/Editar */}
      {modalAbierto && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={cerrarModal}>
          <div style={{ background: '#2a2a2a', borderRadius: '16px', maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '24px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#ffc107' }}>
                {modoEdicion ? "✏️ Editar Movimiento" : "➕ Nuevo Movimiento"}
              </div>
              <button style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '28px', cursor: 'pointer' }} onClick={cerrarModal}>×</button>
            </div>
            
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Tipo</label>
                  <select
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                  >
                    <option value="ingreso">📈 Ingreso</option>
                    <option value="egreso">📉 Egreso</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Monto</label>
                  <input
                    type="number"
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={formData.monto}
                    onChange={(e) => setFormData({...formData, monto: e.target.value})}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Descripción</label>
                <textarea
                  style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px', resize: 'vertical', minHeight: '80px' }}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  placeholder="Describe el motivo..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Categoría</label>
                  <select
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={formData.categoria}
                    onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                  >
                    <option value="servicios">✂️ Servicios</option>
                    <option value="productos">🛍️ Productos</option>
                    <option value="gastos">📊 Gastos</option>
                    <option value="sueldos">👨‍💼 Sueldos</option>
                    <option value="alquiler">🏢 Alquiler</option>
                    <option value="servicios_publicos">💡 Servicios Públicos</option>
                    <option value="otros">📌 Otros</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Método de Pago</label>
                  <select
                    style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                    value={formData.metodo_pago}
                    onChange={(e) => setFormData({...formData, metodo_pago: e.target.value})}
                  >
                    <option value="efectivo">💵 Efectivo</option>
                    <option value="tarjeta">💳 Tarjeta</option>
                    <option value="transferencia">🏦 Transferencia</option>
                    <option value="seña">💰 Seña</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#ffc107', fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>Fecha</label>
                <input
                  type="date"
                  style={{ width: '100%', padding: '12px 16px', border: '2px solid #444', borderRadius: '8px', background: '#1a1a1a', color: '#fff', fontSize: '16px' }}
                  value={formData.fecha}
                  onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                />
              </div>
            </div>
            
            <div style={{ padding: '24px', borderTop: '1px solid #333', display: 'flex', gap: '12px' }}>
              <button style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: 'pointer', background: '#444', color: '#fff' }} onClick={cerrarModal}>
                Cancelar
              </button>
              <button 
                style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '16px', cursor: guardando ? 'not-allowed' : 'pointer', background: '#ffc107', color: '#000', opacity: guardando ? 0.5 : 1 }} 
                onClick={guardarMovimiento}
                disabled={guardando}
              >
                {guardando ? "Guardando..." : modoEdicion ? "Actualizar" : "Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovimientosCaja;