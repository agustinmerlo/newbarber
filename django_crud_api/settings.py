"""
Django settings for django_crud_api project.

Usando Django 5.2.6 como backend (API con MySQL).
"""

from pathlib import Path
import os

# -------------------------------------------------------------------
# Rutas base
# -------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# -------------------------------------------------------------------
# Básicos
# -------------------------------------------------------------------
SECRET_KEY = 'django-insecure-8npq1vwes7$#las5pabldu$bcqvzr)os7%x)km^)_j8j7vmc+p'
DEBUG = True
ALLOWED_HOSTS = []  # Agrega dominios/IPS si desplegás

# -------------------------------------------------------------------
# Aplicaciones instaladas
# -------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Terceros
    'corsheaders',                  # Necesario para la comunicación con React
    'rest_framework',
    'rest_framework.authtoken',     # Para la autenticación basada en tokens

    # Apps locales
    'tasks',
    'servicios',
    'barbers',
    'reservas',
    'caja',
    'proveedores',
    'usuarios.apps.UsuariosConfig',                     
]

# -------------------------------------------------------------------
# Middleware
# -------------------------------------------------------------------
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',

    # ¡CORS lo más alto posible!
    'corsheaders.middleware.CorsMiddleware',

    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'django_crud_api.urls'

# -------------------------------------------------------------------
# Plantillas 
# -------------------------------------------------------------------
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [], 
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'django_crud_api.wsgi.application'

# -------------------------------------------------------------------
# Base de datos MySQL
# -------------------------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'barber_clase_v',
        'USER': 'root',
        'PASSWORD': 'Fabri_87',
        'HOST': 'localhost',
        'PORT': '3306',
    }
}

# -------------------------------------------------------------------
# Validadores de contraseña
# -------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# -------------------------------------------------------------------
# Internacionalización
# -------------------------------------------------------------------
LANGUAGE_CODE = 'es'
TIME_ZONE = 'America/Argentina/Buenos_Aires'
USE_I18N = True
USE_TZ = True

# -------------------------------------------------------------------
# Archivos estáticos
# -------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')  # Para producción

# -------------------------------------------------------------------
# Archivos de media (ej. comprobantes, fotos de servicios)
# -------------------------------------------------------------------
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# -------------------------------------------------------------------
# Configuración por defecto
# -------------------------------------------------------------------
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# -------------------------------------------------------------------
# CORS (para que React pueda consumir la API)
# -------------------------------------------------------------------
CORS_ALLOW_ALL_ORIGINS = True
# Si necesitás cookies/credenciales:
# CORS_ALLOW_CREDENTIALS = True
# CORS_ALLOWED_ORIGINS = ['http://localhost:3000']  # en vez de ALL si querés limitar

# -------------------------------------------------------------------
# Django REST Framework
# -------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',  # Autenticación principal
        'rest_framework.authentication.SessionAuthentication',
    ],
}

# -------------------------------------------------------------------
# Email (SMTP) para notificaciones/confirmaciones
# -------------------------------------------------------------------
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'      # o tu servidor SMTP
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'tu_email@gmail.com'                 # 👈 cambiar
EMAIL_HOST_PASSWORD = 'tu_contraseña_de_aplicacion'    # 👈 cambiar
DEFAULT_FROM_EMAIL = 'Barbería Clase V <noreply@clasev.com>'

# En desarrollo, si querés ver correos en consola:
# EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# Asegurar UTF-8 en emails
DEFAULT_CHARSET = 'utf-8'
FILE_CHARSET = 'utf-8'