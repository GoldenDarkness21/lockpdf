/*
 * Aplicación PDF Seguro - Versión Simplificada
 * Todo en un solo archivo para mejor compatibilidad
 */

// Configuración de Supabase
const SUPABASE_CONFIG = {
    pdfUrl: 'https://blukoqkyjlghgihfnsso.supabase.co/storage/v1/object/sign/pdfreview/ReporteFintech.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMjc2NzJhMS0xMjBhLTRlODUtYThmMi01OWNjMWM2ZTc1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwZGZyZXZpZXcvUmVwb3J0ZUZpbnRlY2gucGRmIiwiaWF0IjoxNzc0MTAyNzA5LCJleHAiOjE4MDU2Mzg3MDl9.fO7rXJNdmJs7R-O98AHaRxxJB57_znKiWIZzJYPB9bo',
};

// Hard Reset de la Lógica de Zoom: Variable Única de Verdad
let currentScale = 1.0; // Escala base 100% - ÚNICA FUENTE DE VERDAD

// Variable para la escala inicial calculada (solo para referencia)
let initialScale = 1.0; // Escala inicial calculada para el ajuste al contenedor

// Escala Inicial como Base: Valor que será nuestro 100% visual
let fitToWidthScale = 1.0; // Escala de ajuste al ancho que será la base

// Estado para manejar cambios de orientación y primera carga
let isFirstLoad = true;
let lastContainerWidth = 0;

/*
 * Función Unificada de Escala: Obtiene el container.clientWidth en tiempo real
 */
function getFitToWidthScale(viewport) {
    const container = document.querySelector('.pdf-scroll-container');
    if (!container) return 1.0;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Validar dimensiones del contenedor
    if (containerWidth === 0 || containerHeight === 0) {
        return 1.0;
    }
    
    // Detectar si hubo cambio de orientación o primera carga
    const isOrientationChange = Math.abs(containerWidth - lastContainerWidth) > 10;
    const isInitialLoad = isFirstLoad;
    
    // Actualizar el ancho del contenedor para la próxima comparación
    lastContainerWidth = containerWidth;
    
    // Matemática de Seguridad: Restar píxeles fijos al área disponible antes de dividir
    const safeWidth = containerWidth - 40;
    const safeHeight = containerHeight - 40;
    
    // Calcular escala para ajustar al contenedor manteniendo la proporción
    const scaleX = safeWidth / viewport.width;
    const scaleY = safeHeight / viewport.height;
    
    // Usar la escala más pequeña para que quepa completamente sin deformarse
    let scale = Math.min(scaleX, scaleY);
    
    // Asegurar que la escala sea razonable
    scale = Math.max(0.1, Math.min(scale, 5.0)); // Entre 0.1x y 5.0x
    
    // Validación en cada Render: Si es la primera vez o hubo cambio de orientación, fuerza el fitToWidth
    if (isInitialLoad || isOrientationChange) {
        console.log('Cambio de orientación o primera carga detectado. Forzando fitToWidth.');
        isFirstLoad = false;
        fitToWidthScale = scale;
        currentScale = fitToWidthScale;
    }
    
    return scale;
}

/*
 * Prevenir Saltos: Asegúrate de que el primer clic en + use el valor actual calculado y no un valor por defecto de 1.0
 */
function getActualScaleForRendering() {
    // Zoom Relativo: Los botones + y - deben modificar currentScale
    return currentScale;
}

/*
 * Función de Debounce para Resize: Evita múltiples renderizados rápidos
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Valores de Escala
const DEFAULT_SCALE = 1.0; // Escala base 100%

// Estado interno
const state = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    isLoading: false,
    renderPageFunction: null,
    currentScale: currentScale, // Usar la variable global
    minScale: 0.1, // Bajar el límite mínimo: Cambia el valor de MIN_SCALE para que permita bajar hasta 0.1 (10%)
    maxScale: 3.0,
    renderTimeout: null,
    isRendering: false,
    currentRenderTask: null
};

// Elementos del DOM
const elements = {
    canvas: document.getElementById('pdfCanvas'),
    statusIndicator: document.getElementById('statusIndicator'),
    statusDot: document.querySelector('.status-dot'),
    statusText: document.querySelector('.status-text'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    prevPageBtnBottom: document.getElementById('prevPageBtnBottom'),
    nextPageBtnBottom: document.getElementById('nextPageBtnBottom'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    securityOverlay: document.getElementById('securityOverlay'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    zoomInBtn: document.getElementById('zoomInBtn')
};

/*
 * Inicializa la aplicación
 */
function initApp() {
    console.log('Inicializando Visualizador PDF Seguro');
    setupSecurity();
    setupControls();
    loadPdfFromSupabase();
}

/*
 * Configura seguridad y eventos
 */
function setupSecurity() {
    // Bloquear teclas de seguridad
    document.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            alert('La impresión está deshabilitada.');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            alert('La descarga está deshabilitada.');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            alert('Acceso al código fuente deshabilitado.');
        }
    });

    // Bloquear clic derecho
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    });
}

/*
 * Configura controles de navegación
 */
function setupControls() {
    // Eliminar Navegación Superior: Localiza y elimina (o comenta) el código HTML y JS que genera los botones de 'Anterior' y 'Siguiente' página en la parte superior
    // Los botones del header han sido eliminados para simplificar la interfaz
    // El usuario se moverá por el PDF solo mediante scroll
    
    // Navegación con teclado (flechas)
    document.addEventListener('keydown', function(e) {
        // Bloquear teclas de seguridad (mantener existente)
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
            e.preventDefault();
            alert('La impresión está deshabilitada.');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            alert('La descarga está deshabilitada.');
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
            e.preventDefault();
            alert('Acceso al código fuente deshabilitado.');
        }
        
        // Navegación con flechas
        if (e.key === 'ArrowLeft' || e.key === 'Left') {
            e.preventDefault();
            if (state.currentPage > 1) {
                state.currentPage--;
                renderPage(state.currentPage);
            }
        } else if (e.key === 'ArrowRight' || e.key === 'Right') {
            e.preventDefault();
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                renderPage(state.currentPage);
            }
        }
    });
    
    elements.fullscreenBtn.addEventListener('click', function() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    });
    
    // Detectar cambios de pantalla completa
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Botones de navegación en el footer
    if (elements.prevPageBtnBottom) {
        elements.prevPageBtnBottom.addEventListener('click', async function() {
            if (state.currentPage > 1) {
                state.currentPage--;
                await renderPage(state.currentPage);
            }
        });
    }
    
    if (elements.nextPageBtnBottom) {
        elements.nextPageBtnBottom.addEventListener('click', async function() {
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                await renderPage(state.currentPage);
            }
        });
    }
    
    // 2. Control de Incrementos (Zoom más suave): Cambia los pasos de zoom de 0.5 a 0.2 (o 0.15 si prefieres algo más fino)
    // 4. Lógica de los Botones: Implementar límites de seguridad
    if (elements.zoomOutBtn) {
        elements.zoomOutBtn.addEventListener('click', function() {
            console.log('Escala antes (zoom out):', currentScale);
            
            // Variable de Estado Limpia: Actualizar currentScale de forma aritmética
            currentScale = Math.max(fitToWidthScale, currentScale - 0.2);
            
            console.log('Escala después (zoom out):', currentScale);
            setZoom(currentScale);
        });
    }
    
    if (elements.zoomInBtn) {
        elements.zoomInBtn.addEventListener('click', function() {
            console.log('Escala antes (zoom in):', currentScale);
            
            // Variable de Estado Limpia: Actualizar currentScale de forma aritmética
            currentScale = Math.min(3.0, currentScale + 0.2);
            
            console.log('Escala después (zoom in):', currentScale);
            setZoom(currentScale);
        });
    }
    
    // No actualizar display de zoom (se elimina el porcentaje visible)
}

/*
 * Maneja cambios de pantalla completa
 */
function handleFullscreenChange() {
    const isFullscreen = !!document.fullscreenElement || 
                        !!document.webkitFullscreenElement || 
                        !!document.mozFullScreenElement || 
                        !!document.msFullscreenElement;
    
    if (isFullscreen) {
        // En pantalla completa: sin zoom, usar escala normal
        state.fullscreenScale = null;
    } else {
        // Salir de pantalla completa: escala normal
        state.fullscreenScale = null;
    }
    
    // Volver a renderizar la página actual
    if (state.pdfDoc && state.currentPage) {
        renderPage(state.currentPage);
    }
}

/*
 * Actualiza el estado de carga
 */
function updateLoadingState(isLoading, message = null) {
    state.isLoading = isLoading;
    
    if (isLoading) {
        elements.loadingSpinner.classList.remove('hidden');
        elements.canvas.classList.add('hidden');
        elements.statusDot.style.backgroundColor = '#ff9800';
        elements.statusText.textContent = message || 'Cargando documento...';
    } else {
        elements.loadingSpinner.classList.add('hidden');
        elements.canvas.classList.remove('hidden');
        elements.statusDot.style.backgroundColor = '#4CAF50';
        elements.statusText.textContent = message || 'Documento listo';
    }
}


/*
 * Descarga el PDF con manejo de progreso
 */
async function downloadPdf(url) {
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/pdf',
            'Origin': window.location.origin,
            'Access-Control-Allow-Origin': '*'
        },
        mode: 'cors'
    });

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    // Para archivos grandes, usar streaming
    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;

    while(true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        chunks.push(value);
        receivedLength += value.length;
    }

    // Concatenar chunks
    const arrayBuffer = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
        arrayBuffer.set(chunk, position);
        position += chunk.length;
    }

    return arrayBuffer.buffer;
}

/*
 * Carga el PDF desde Supabase
 */
async function loadPdfFromSupabase() {
    try {
        updateLoadingState(true);
        console.log('Cargando PDF desde Supabase...');
        
        const arrayBuffer = await downloadPdf(SUPABASE_CONFIG.pdfUrl);
        console.log('PDF descargado, tamaño:', arrayBuffer.byteLength, 'bytes');
        
        state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        state.totalPages = state.pdfDoc.numPages;
        console.log('PDF cargado, total de páginas:', state.totalPages);
        
        // Cálculo de Escala Inicial: En lugar de currentScale = 1.0, crea una función que calcule la escala necesaria para que el PDF quepa en el ancho del contenedor
        const firstPage = await state.pdfDoc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });

        fitToWidthScale = getFitToWidthScale(viewport);
        currentScale = fitToWidthScale; 

        updateLoadingState(false);
        // No llames a renderFirstPage, llama directo a renderPage
        await renderPage(1, fitToWidthScale);
        
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        updateLoadingState(false, 'Error al cargar el documento');
        alert('No se pudo cargar el documento. Por favor, verifica la URL.');
    }
}

/*
 * Renderiza la primera página
 */
async function renderFirstPage() {
    try {
        console.log('Renderizando primera página');
        await renderPage(1);
    } catch (error) {
        console.error('Error al renderizar:', error);
        alert('No se pudo renderizar el documento.');
    }
}

/*
 * Renderiza una página específica con marca de agua
 */
async function renderPage(pageNumber, zoomScale = null) {
    // 1. CANCELACIÓN AGRESIVA: Si hay algo renderizando, lo matamos primero
    if (state.currentRenderTask) {
        try {
            await state.currentRenderTask.cancel();
        } catch (e) {
            // Ignoramos el error de cancelación
        }
        state.currentRenderTask = null;
    }

    try {
        const page = await state.pdfDoc.getPage(pageNumber);
        
        // Usamos el zoom manual si existe, sino el de ajuste
        const scale = zoomScale || currentScale; 
        currentScale = scale;

        const viewport = page.getViewport({ scale: scale });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        
        const canvas = elements.canvas;
        const context = canvas.getContext('2d');
        
        // Ajustamos el tamaño interno (buffer)
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        
        // Ajustamos el tamaño visual (CSS)
        canvas.style.width = viewport.width + 'px';
        canvas.style.height = viewport.height + 'px';
        
        context.scale(dpr, dpr);
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        state.currentRenderTask = page.render(renderContext);
        await state.currentRenderTask.promise;
        
        addWatermarkToCanvas(context, canvas.width, canvas.height);
        
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
            console.error('Error real en render:', error);
        }
    }
}

/*
 * Agrega marca de agua al canvas
 */
function addWatermarkToCanvas(context, width, height) {
    // Configuración de la marca de agua
    const watermarkText = 'DRAFT - FOR INTERNAL REVIEW - ACH';
    
    // Ajustar tamaño de fuente según el dispositivo
    const isMobile = window.innerWidth <= 768;
    let fontSize;
    
    if (isMobile) {
        // En móviles, usar un tamaño más pequeño para no tapar el contenido
        fontSize = Math.max(20, Math.floor(width / 25));
    } else {
        // En desktop, tamaño más grande para mejor visibilidad
        fontSize = Math.max(40, Math.floor(width / 15));
    }
    
    const color = 'rgba(128, 128, 128, 0.3)'; // Gris semitransparente
    
    // Configurar fuente
    context.font = `bold ${fontSize}px Arial`;
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Rotación para diagonal
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate(Math.PI / 4); // 45 grados
    
    // Dibujar texto
    context.fillText(watermarkText, 0, 0);
    
    // Restaurar transformaciones
    context.restore();
}

/*
 * Configura el zoom del PDF con debounce
 */
function setZoom(scale) {
    // Detectar si es un dispositivo móvil
    const isMobile = window.innerWidth <= 768;
    
    // Ajustar límites de zoom según el dispositivo
    const minScale = isMobile ? 0.2 : 0.1; // En móviles, no permitir zoom tan pequeño para mejor usabilidad
    const maxScale = isMobile ? 2.5 : 3.0; // En móviles, límite de zoom ligeramente menor
    
    // Limitar el zoom dentro de los rangos permitidos
    const newScale = Math.max(minScale, Math.min(scale, maxScale));
    state.currentScale = newScale;
    
    // Ajustar debounce según el dispositivo
    const debounceTime = isMobile ? 150 : 100; // Más tiempo en móviles para evitar renderizados excesivos
    
    // Implementar debounce para evitar múltiples renderizados rápidos
    if (state.renderTimeout) {
        clearTimeout(state.renderTimeout);
    }
    
    // Programar el renderizado con un pequeño retraso
    state.renderTimeout = setTimeout(() => {
        // Volver a renderizar la página actual con el nuevo zoom
        if (state.pdfDoc && state.currentPage) {
            renderPage(state.currentPage, state.currentScale);
        }
    }, debounceTime);
}


// Exponer funciones globalmente
window.renderPage = renderPage;
window.setZoom = setZoom;

/*
 * Evento Resize: Detecta cambios de orientación y fuerza reajuste del PDF
 * Ignorar la barra de scroll en app.js: Busca al final de tu app.js el evento de resize. Vamos a decirle que si el cambio de tamaño es de solo 15-20 píxeles (lo que mide una barra de scroll), lo ignore por completo.
 */
let resizeTimeout = null;
let lastWindowWidth = window.innerWidth;

window.addEventListener('resize', function() {
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
    }
    
    resizeTimeout = setTimeout(() => {
        const currentWindowWidth = window.innerWidth;
        
        // LA MAGIA: Una barra de scroll mide aprox 15px. 
        // Solo reajustamos si el cambio es mayor a 30px (ej: rotar el celular o cambiar tamaño de ventana real)
        if (Math.abs(currentWindowWidth - lastWindowWidth) > 30) {
            console.log('Cambio REAL de tamaño de ventana detectado. Reajustando PDF...');
            lastWindowWidth = currentWindowWidth;
            
            if (state.pdfDoc && state.currentPage) {
                state.pdfDoc.getPage(1).then(page => {
                    const viewport = page.getViewport({ scale: 1 });
                    const newFitToWidthScale = getFitToWidthScale(viewport);
                    
                    if (Math.abs(newFitToWidthScale - fitToWidthScale) > 0.01) {
                        fitToWidthScale = newFitToWidthScale;
                        currentScale = fitToWidthScale;
                        renderPage(state.currentPage, currentScale);
                    }
                });
            }
        } else {
            // Ignoramos el evento porque fue solo la barra de scroll apareciendo/desapareciendo
            lastWindowWidth = currentWindowWidth; 
        }
    }, 200); 
});

/*
 * Evento de Cambio de Escala del Sistema: Detecta cambios en el devicePixelRatio
 */
let lastDevicePixelRatio = window.devicePixelRatio;
setInterval(() => {
    if (window.devicePixelRatio !== lastDevicePixelRatio) {
        console.log('Cambio de devicePixelRatio detectado:', lastDevicePixelRatio, '->', window.devicePixelRatio);
        lastDevicePixelRatio = window.devicePixelRatio;
        
        // Forzar re-renderizado suave para adaptarse al nuevo ratio
        if (state.pdfDoc && state.currentPage && !state.isRendering) {
            renderPage(state.currentPage, currentScale);
        }
    }
}, 1000); // Verificar cada segundo

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
