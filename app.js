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

/*
 * Calcula la escala inicial para que el PDF quepa en el ancho del contenedor sin deformarse
 */
function calculateInitialScale(viewport) {
    const container = document.querySelector('.pdf-scroll-container');
    if (!container) return 1.0;
    
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Validar dimensiones del contenedor
    if (containerWidth === 0 || containerHeight === 0) {
        return 1.0;
    }
    
    // Calcular escala para ajustar al contenedor manteniendo la proporción
    const scaleX = containerWidth / viewport.width;
    const scaleY = containerHeight / viewport.height;
    
    // Usar la escala más pequeña para que quepa completamente sin deformarse
    let scale = Math.min(scaleX, scaleY);
    
    // Asegurar que la escala sea razonable
    scale = Math.max(0.1, Math.min(scale, 5.0)); // Entre 0.1x y 5.0x
    
    // Aplicar un pequeño margen para mejor visualización, pero no demasiado para evitar deformación
    scale = scale * 0.98;
    
    return scale;
}

/*
 * Prevenir Saltos: Asegúrate de que el primer clic en + use el valor actual calculado y no un valor por defecto de 1.0
 */
function getActualScaleForRendering() {
    // Zoom Relativo: Los botones + y - deben modificar currentScale
    return currentScale;
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
            
            // 4. Lógica de los Botones: En el botón -, usa: if (currentScale > fitToWidthScale) { currentScale = Math.max(fitToWidthScale, currentScale - 0.2); }
            if (currentScale > fitToWidthScale) {
                currentScale = Math.max(fitToWidthScale, currentScale - 0.2);
            }
            
            console.log('Escala después (zoom out):', currentScale);
            setZoom(currentScale);
        });
    }
    
    if (elements.zoomInBtn) {
        elements.zoomInBtn.addEventListener('click', function() {
            console.log('Escala antes (zoom in):', currentScale);
            
            // 4. Lógica de los Botones: En el botón +, usa: if (currentScale < 3.0) { currentScale = Math.min(3.0, currentScale + 0.2); }
            if (currentScale < 3.0) {
                currentScale = Math.min(3.0, currentScale + 0.2);
            }
            
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
        
        // 1. Escala Inicial como Base: Al cargar, calcula el fitToWidthScale (ancho contenedor / ancho PDF)
        // Asigna ese valor a currentScale. Este valor será nuestro 100% visual
        fitToWidthScale = calculateInitialScale(viewport);
        currentScale = fitToWidthScale;
        
        console.log('Escala inicial calculada (Fit to Width):', fitToWidthScale);
        console.log('currentScale asignado (100% visual):', currentScale);
        
        updateLoadingState(false);
        await renderFirstPage();
        
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
    try {
        // Cancelar renderizado anterior si está en progreso
        if (state.currentRenderTask) {
            try {
                state.currentRenderTask.cancel();
            } catch (cancelError) {
                console.warn('Error al cancelar renderizado anterior:', cancelError);
            }
        }
        
        // Marcar como en proceso de renderizado
        state.isRendering = true;
        
        const page = await state.pdfDoc.getPage(pageNumber);
        
        // Render Inicial: La función que carga el PDF desde Supabase debe llamar a renderPage(pdfDoc, 1, currentScale). No uses un valor 'hardcoded' (fijo) de 1.5 o 1.0 dentro de la función; usa siempre la variable global
        let scale;
        if (zoomScale !== null) {
            // Usar el zoomScale proporcionado (para zoom real)
            scale = zoomScale;
        } else {
            // Modo normal: usar la variable global currentScale
            scale = currentScale;
        }
        
        // Asegurar que la escala sea razonable
        scale = Math.max(0.1, Math.min(scale, 5.0)); // Entre 0.1x y 5.0x
        
        // 2. Normalización del Render: La función renderPage debe recibir ÚNICAMENTE el número currentScale
        // const viewport = page.getViewport({ scale: currentScale * Math.min(window.devicePixelRatio, 2) });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const finalScale = scale * dpr;
        const scaledViewport = page.getViewport({ scale: finalScale });

        // Preparar el canvas
        const canvas = elements.canvas;
        const context = canvas.getContext('2d');
        
        // Limpieza de Renderizado: Asegurarse de que el canvas se limpie y que las dimensiones canvas.width y canvas.height se actualicen antes de llamar al motor de PDF.js
        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        
        // 5. Refinado de UI: Asegúrate de que el PDF se mantenga centrado en el contenedor si el usuario logra reducirlo
        // Establecer el tamaño visual del canvas con CSS (sin estiramiento)
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;
        canvas.style.maxWidth = 'none';
        canvas.style.maxHeight = 'none';
        canvas.style.margin = '0 auto'; // Centrar el canvas en el contenedor
        
        // Escalar el contexto para renderizar en alta resolución
        context.scale(dpr, dpr);
        
        // Limpiar el canvas completamente
        context.clearRect(0, 0, scaledViewport.width, scaledViewport.height);
        context.fillStyle = '#ffffff'; // Fondo blanco
        context.fillRect(0, 0, scaledViewport.width, scaledViewport.height);

        // Renderizar la página
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };
        
        // Guardar la tarea de renderizado para poder cancelarla
        state.currentRenderTask = page.render(renderContext);
        
        try {
            await state.currentRenderTask.promise;
        } catch (renderError) {
            if (renderError.name === 'RenderingCancelledException') {
                console.log('Renderizado cancelado por nuevo zoom');
                return; // Salir silenciosamente si fue cancelado
            }
            throw renderError;
        }
        
        // Agregar marca de agua después de renderizar la página
        addWatermarkToCanvas(context, canvas.width, canvas.height);
        
        console.log(`Página ${pageNumber} renderizada con zoom ${scale} y marca de agua`);
        
        // Asegurar que el canvas sea visible
        canvas.style.display = 'block';
        
        // No forzar dimensiones fijas, permitir que el contenedor de scroll maneje el desplazamiento
        canvas.style.margin = '0 auto';
        
        // Forzar actualización del layout
        canvas.offsetHeight; // trigger reflow
        
    } catch (error) {
        if (error.name !== 'RenderingCancelledException') {
            console.error('Error al renderizar página:', error);
            throw error;
        }
    } finally {
        // Limpiar estado de renderizado
        state.isRendering = false;
        state.currentRenderTask = null;
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

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
