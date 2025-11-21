# Portafolio Minimalista - Javier Alberto Suárez

Portafolio web profesional con diseño minimalista y animaciones elegantes. Especializado en WordPress, SEO y Marketing Digital.

![Portafolio Preview](assets/images/profile/javier-suarez.jpg)

## ✨ Características

### Diseño Minimalista
- **Paleta de colores limitada**: Blanco, gris y azul como único color de acento
- **Tipografía moderna**: Inter como fuente principal
- **Espacios limpios**: Diseño que respira con jerarquía visual clara
- **Dark Mode**: Modo oscuro con persistencia en localStorage

### Animaciones Elegantes
- **Hero Section**: Texto con stagger effect (palabra por palabra)
- **Texto Deslizante**: Marquee horizontal infinito con keywords
- **Reveal on Scroll**: Elementos que aparecen al hacer scroll con IntersectionObserver
- **Contadores Animados**: Números que cuentan desde 0 al entrar en viewport
- **Hover Effects**: Efectos sutiles en botones, cards y links
- **Scroll Progress Bar**: Barra superior que indica progreso de lectura

### Funcionalidades
- ✅ 100% Responsive (móvil, tablet, desktop)
- ✅ Navegación sticky con backdrop blur
- ✅ Smooth scroll entre secciones
- ✅ Formulario de contacto con validación
- ✅ Menú móvil funcional
- ✅ Scroll to top button
- ✅ SEO optimizado con Schema markup
- ✅ Performance optimizado

## 📁 Estructura del Proyecto

```
portafolio-new/
├── assets/
│   ├── css/
│   │   └── main.css          # Estilos principales
│   ├── js/
│   │   └── main.js           # JavaScript con todas las funcionalidades
│   └── images/
│       ├── profile/
│       │   └── javier-suarez.jpg
│       └── projects/
│           ├── Ingemotor.webp
│           ├── importadora-rpc.webp
│           ├── veterinaria-clinicpets.webp
│           ├── clinica-dental.webp
│           ├── im-repuestos.webp
│           └── alba-floristeria.webp
├── index.html                # Página principal
└── README.md                 # Este archivo
```

## 🚀 Instalación y Uso

### Opción 1: Abrir Localmente

1. Abre el archivo `index.html` en tu navegador favorito
2. ¡Listo! El portafolio está funcionando

### Opción 2: Servidor Local (Recomendado)

Para evitar problemas con CORS y ver todas las funcionalidades:

**Con Python:**
```bash
# Python 3
python -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

**Con Node.js (http-server):**
```bash
npx http-server -p 8000
```

**Con PHP:**
```bash
php -S localhost:8000
```

Luego abre `http://localhost:8000` en tu navegador.

### Opción 3: Desplegar en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub
2. Ve a Settings → Pages
3. Selecciona la rama `main` y carpeta `/ (root)`
4. Guarda y espera unos minutos
5. Tu portafolio estará disponible en `https://tu-usuario.github.io/nombre-repo/`

## 🎨 Personalización

### Cambiar Colores

Edita las variables CSS en `assets/css/main.css`:

```css
:root {
  /* Light Mode */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8F9FA;
  --text-primary: #1A1A1A;
  --text-secondary: #6B7280;
  --border: #E5E7EB;
  --accent: #2563EB;        /* ← Cambia este color */
  --accent-hover: #1D4ED8;  /* ← Y este también */
}

.dark {
  /* Dark Mode */
  --bg-primary: #0F172A;
  --bg-secondary: #1E293B;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --border: #334155;
  --accent: #3B82F6;        /* ← Cambia este color */
  --accent-hover: #60A5FA;  /* ← Y este también */
}
```

### Cambiar Contenido

Edita el archivo `index.html` y busca las secciones:

- **Hero**: Línea ~140 - Cambia nombre, título y descripción
- **Sobre Mí**: Línea ~200 - Actualiza biografía y experiencia
- **Timeline**: Línea ~270 - Modifica hitos profesionales
- **Estadísticas**: Línea ~310 - Ajusta números (data-target)
- **Servicios**: Línea ~380 - Personaliza servicios ofrecidos
- **Portafolio**: Línea ~500 - Actualiza proyectos
- **Contacto**: Línea ~650 - Cambia información de contacto

### Cambiar Foto Profesional

1. Reemplaza `assets/images/profile/javier-suarez.jpg` con tu foto
2. Mantén el mismo nombre o actualiza la ruta en `index.html` (línea ~210)

### Cambiar Proyectos

1. Reemplaza las imágenes en `assets/images/projects/`
2. Actualiza los enlaces y descripciones en `index.html` (sección Portafolio)

## 🎯 Secciones del Portafolio

1. **Navegación**: Sticky navbar con dark mode toggle
2. **Hero**: Presentación principal con animaciones
3. **Marquee**: Texto deslizante con keywords
4. **Sobre Mí**: Biografía, timeline y estadísticas
5. **Certificaciones**: Cards con especialidades
6. **Servicios**: 6 servicios principales
7. **Portafolio**: 6 proyectos destacados
8. **Contacto**: Formulario y datos de contacto
9. **Footer**: Redes sociales y copyright

## 🔧 Tecnologías Utilizadas

- **HTML5**: Estructura semántica
- **CSS3**: Variables CSS, Flexbox, Grid, Animations
- **JavaScript Vanilla**: Sin frameworks, código limpio
- **Google Fonts**: Inter como fuente principal
- **SVG Icons**: Iconos inline para mejor performance

## 📱 Responsive Design

El portafolio está optimizado para:

- **Móvil**: < 768px (1 columna)
- **Tablet**: 768px - 1024px (2 columnas)
- **Desktop**: > 1024px (3 columnas)

## ⚡ Performance

- **Sin dependencias externas**: Solo Google Fonts
- **CSS optimizado**: Variables y reutilización
- **JavaScript modular**: Funciones separadas
- **Imágenes optimizadas**: WebP para proyectos
- **Lazy loading**: Preparado para imágenes diferidas

## 🌐 SEO

- ✅ Meta tags optimizados
- ✅ Open Graph para redes sociales
- ✅ Twitter Cards
- ✅ Schema.org markup (Person)
- ✅ Canonical URL
- ✅ Sitemap ready

## 🎨 Animaciones Implementadas

### CSS Keyframes
- `fade-in`: Entrada suave desde abajo
- `slide-up`: Deslizamiento vertical
- `marquee`: Texto deslizante horizontal
- `gradient-shift`: Gradiente animado

### JavaScript Animations
- Reveal on scroll con IntersectionObserver
- Contadores animados
- Stagger effect en hero subtitle
- Navbar scroll effect
- Scroll progress bar

## 📝 Notas Importantes

### Dark Mode
El modo oscuro se guarda en `localStorage` y persiste entre sesiones.

### Formulario de Contacto
Actualmente el formulario muestra una notificación. Para integrarlo con un backend:

1. **Formspree**: Agrega `action="https://formspree.io/f/tu-id"` al form
2. **EmailJS**: Integra el SDK y configura el servicio
3. **Backend propio**: Crea un endpoint y envía con fetch/axios

### Enlaces Sociales
Actualiza los enlaces en el footer (línea ~750) con tus perfiles reales.

## 🐛 Solución de Problemas

### Las animaciones no funcionan
- Verifica que `assets/js/main.js` esté cargando correctamente
- Abre la consola del navegador (F12) y busca errores

### Las imágenes no se ven
- Verifica que las rutas sean correctas
- Asegúrate de que las imágenes existan en `assets/images/`

### El dark mode no persiste
- Verifica que localStorage esté habilitado en tu navegador
- Prueba en modo incógnito para descartar extensiones

## 📄 Licencia

Este proyecto es de uso personal para Javier Alberto Suárez.

## 👤 Autor

**Javier Alberto Suárez**
- Email: jasoolaya@gmail.com
- WhatsApp: +57 310 625 5406
- Ubicación: Ibagué, Tolima, Colombia

---

**¿Necesitas ayuda?** Contacta conmigo por WhatsApp o email. ¡Estoy aquí para ayudarte! 🚀
