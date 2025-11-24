// src/pages/cliente.jsx - AJUSTADO PARA TU API ACTUAL
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./cliente.css";

const API_URL = "http://localhost:8000/api";

export default function Cliente() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const [barbers, setBarbers] = useState([]);
  const [loadingBarbers, setLoadingBarbers] = useState(true);
  
  // ✅ Estado para servicios
  const [servicios, setServicios] = useState([]);
  const [loadingServicios, setLoadingServicios] = useState(true);

  // ✅ Helper para formatear precio
  const formatearPrecio = (precio) => {
    if (!precio || precio === 0) return "Consultar";
    
    const numero = typeof precio === 'number' ? precio : parseFloat(precio);
    
    if (isNaN(numero)) return "Consultar";
    
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(numero);
  };

  // ✅ Helper para formatear duración
  const formatearDuracion = (duracion) => {
    if (!duracion) return "";
    
    // Si viene como "45 min", extraer el número
    if (typeof duracion === 'string') {
      const match = duracion.match(/\d+/);
      if (match) {
        duracion = parseInt(match[0]);
      } else {
        return duracion; // Devolver tal cual si no se puede parsear
      }
    }
    
    const minutos = parseInt(duracion);
    
    if (isNaN(minutos)) return "";
    
    if (minutos < 60) return `${minutos} min`;
    
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    if (mins === 0) return `${horas}h`;
    return `${horas}h ${mins}min`;
  };

  // ✅ Cargar servicios desde la API
  useEffect(() => {
    const fetchServicios = async () => {
      setLoadingServicios(true);
      try {
        console.log('🔄 Cargando servicios desde:', `${API_URL}/servicios/`);
        const response = await fetch(`${API_URL}/servicios/`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('✅ Datos de servicios recibidos:', data);
        
        // La API puede devolver un array directo o un objeto con results
        const serviciosList = Array.isArray(data) ? data : (data?.results || []);
        
        // ✅ Filtrar solo servicios activos (campo 'activo' en tu modelo)
        const serviciosActivos = serviciosList.filter(s => s.activo === true);
        
        console.log(`✅ ${serviciosActivos.length} servicios activos de ${serviciosList.length} totales`);
        console.log('📋 Servicios activos:', serviciosActivos);
        
        setServicios(serviciosActivos);
        
      } catch (error) {
        console.error("❌ Error cargando servicios:", error);
        
        // Servicios por defecto en caso de error
        setServicios([
          { 
            id: 1, 
            nombre: "Corte de cabello", 
            descripcion: "Asesoría + lavado + styling",
            precio: "15000",
            duracion: 60
          },
          { 
            id: 2, 
            nombre: "Barba clásica", 
            descripcion: "Toalla caliente + navaja + bálsamo",
            precio: "8000",
            duracion: 30
          },
          { 
            id: 3, 
            nombre: "Afeitado clásico", 
            descripcion: "Experiencia tradicional con navaja",
            precio: "6000",
            duracion: 30
          },
          { 
            id: 4, 
            nombre: "Combo corte + barba", 
            descripcion: "Look completo en una sola visita",
            precio: "20000",
            duracion: 90
          }
        ]);
      } finally {
        setLoadingServicios(false);
      }
    };

    fetchServicios();
  }, []);

  // Cargar barberos desde la API
  useEffect(() => {
    const fetchBarbers = async () => {
      setLoadingBarbers(true);
      try {
        console.log('🔄 Cargando barberos desde:', `${API_URL}/barbers/`);
        const response = await fetch(`${API_URL}/barbers/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        const activeBarbers = (data?.results ?? data).filter(b => !b.is_deleted);
        console.log(`✅ ${activeBarbers.length} barberos activos`);
        setBarbers(activeBarbers);
      } catch (error) {
        console.error("❌ Error cargando barberos:", error);
        setBarbers([
          { id: 1, name: "Alex", specialty: "Fade • Clásicos • Estilizado" },
          { id: 2, name: "Bruno", specialty: "Navaja • Barba • Old school" },
          { id: 3, name: "Chris", specialty: "Cabello largo • Tendencias" }
        ]);
      } finally {
        setLoadingBarbers(false);
      }
    };

    fetchBarbers();
  }, []);

  const handleMiCuenta = () => {
    if (loading) {
      console.log('⏳ Esperando verificación de autenticación...');
      return;
    }

    console.log('🔍 isAuthenticated:', isAuthenticated);
    
    if (isAuthenticated) {
      console.log('✅ Usuario autenticado, redirigiendo a panel-cliente');
      navigate('/panel-cliente');
    } else {
      console.log('❌ Usuario no autenticado, redirigiendo a login');
      navigate('/login');
    }
  };

  return (
    <div className="client-landing">
      {/* HERO SIN IMAGEN */}
      <section className="hero hero--plain">
        <div className="hero__content">
          <h1 className="hero__title">Barber Studio</h1>
          <p className="hero__subtitle">Cortes precisos • Afeitado clásico • Estilo contemporáneo</p>
          <div className="hero__cta">
            <Link to="/reservar" className="btn btn--primary">Reservar turno</Link>
            <a href="#servicios" className="btn btn--ghost">Ver servicios</a>
            <button 
              onClick={handleMiCuenta}
              className="btn btn--outline"
              disabled={loading}
            >
              {loading ? '⏳ Verificando...' : '👤 Mi Cuenta'}
            </button>
          </div>
        </div>
      </section>
      
      {/* SELLING POINTS */}
      <section className="usp">
        <div className="container usp__grid">
          <div className="usp__item">
            <h3>Barberos expertos</h3>
            <p>Técnicas tradicionales y modernas para cada estilo.</p>
          </div>
          <div className="usp__item">
            <h3>Productos pro</h3>
            <p>Usamos líneas profesionales para un acabado superior.</p>
          </div>
          <div className="usp__item">
            <h3>Reserva fácil</h3>
            <p>Elegí servicio, fecha y hora en menos de un minuto.</p>
          </div>
        </div>
      </section>

      {/* ✅ SERVICIOS - DINÁMICOS DESDE LA API */}
      <section id="servicios" className="services">
        <div className="container">
          <div className="section-head">
            <h2>Servicios</h2>
            <p>Los clásicos de barbería con un toque premium.</p>
          </div>

          {loadingServicios ? (
            <div className="services-loading">
              <div className="spinner"></div>
              <p>Cargando servicios disponibles...</p>
            </div>
          ) : servicios.length === 0 ? (
            <div className="services-empty">
              <div className="empty-icon">✂️</div>
              <p>Próximamente tendremos servicios disponibles.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '1rem', color: '#666' }}>
                Agrega servicios desde el panel de administración.
              </p>
            </div>
          ) : (
            <ul className="services__grid">
              {servicios.map((servicio) => (
                <li key={servicio.id} className="card">
                  {/* ✅ Mostrar imagen si existe */}
                  {servicio.imagen && (
                    <div className="card__image">
                      <img 
                        src={servicio.imagen} 
                        alt={servicio.nombre}
                        onError={(e) => {
                          console.log('Error cargando imagen:', servicio.imagen);
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  
                  <div className="card__body">
                    <h4>{servicio.nombre}</h4>
                    <p>{servicio.descripcion || "Servicio de barbería profesional"}</p>
                    
                    <div className="card__footer">
                      <span className="price">
                        {formatearPrecio(servicio.precio)}
                      </span>
                      
                      {servicio.duracion && (
                        <span className="duration">
                          ⏱️ {formatearDuracion(servicio.duracion)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="center">
            <Link to="/reservar" className="btn btn--primary btn--lg">Reservar ahora</Link>
          </div>
        </div>
      </section>

      {/* BARBERS - Dinámicos desde la API */}
      <section className="barbers">
        <div className="container">
          <div className="section-head">
            <h2>Nuestro equipo</h2>
            <p>Profesionales dedicados a tu mejor versión.</p>
          </div>

          {loadingBarbers ? (
            <div className="barbers-loading">
              <div className="spinner"></div>
              <p>Cargando nuestro equipo...</p>
            </div>
          ) : barbers.length === 0 ? (
            <div className="barbers-empty">
              <div className="empty-icon">✂️</div>
              <p>Próximamente conocerás a nuestro equipo de expertos.</p>
            </div>
          ) : (
            <div className="barbers__grid">
              {barbers.map((barber) => (
                <div key={barber.id} className="barber-card-client">
                  <div className="barber-image-wrapper">
                    {barber.photo ? (
                      <img 
                        src={barber.photo} 
                        alt={barber.name}
                        className="barber-image"
                      />
                    ) : (
                      <div className="barber-avatar-client">
                        {barber.name?.charAt(0)?.toUpperCase() || "B"}
                      </div>
                    )}
                  </div>
                  <div className="barber-info">
                    <h4 className="barber-name">{barber.name}</h4>
                    <p className="barber-specialty">
                      {barber.specialty || "Especialista en barbería"}
                    </p>
                    {barber.work_schedule && (
                      <p className="barber-schedule">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/>
                          <polyline points="12 6 12 12 16 14"/>
                        </svg>
                        {barber.work_schedule}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* INFO */}
      <section className="info">
        <div className="container info__grid">
          <div>
            <h3>Horarios</h3>
            <ul className="hours">
              <li>Lun–Vie: 10:00–20:00</li>
              <li>Sáb: 10:00–18:00</li>
              <li>Dom: Cerrado</li>
            </ul>
            <Link to="/reservar" className="btn btn--primary">Agendar</Link>
          </div>
          <div>
            <h3>Ubicación</h3>
            <p>Av. Principal 123, Salta</p>
            <div className="map-embed">
              <iframe
                title="mapa"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src="https://www.google.com/maps/embed?pb=!1m18!..."
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__grid">
          <p>© {new Date().getFullYear()} Barber Studio — Todos los derechos reservados.</p>
          <div className="footer-links">
            <button 
              onClick={handleMiCuenta}
              className="footer-link-btn"
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Mi Cuenta'}
            </button>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
          </div>
        </div>
      </footer>
    </div>
  );
}