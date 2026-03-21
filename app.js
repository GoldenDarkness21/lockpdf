/*
 * Aplicación PDF Seguro - Versión Simplificada
 * Todo en un solo archivo para mejor compatibilidad
 */

// Configuración de Supabase
const SUPABASE_CONFIG = {
    pdfUrl: 'https://blukoqkyjlghgihfnsso.supabase.co/storage/v1/object/sign/pdfreview/ReporteFintech.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hMjc2NzJhMS0xMjBhLTRlODUtYThmMi01OWNjMWM2ZTc1MzMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwZGZyZXZpZXcvUmVwb3J0ZUZpbnRlY2gucGRmIiwiaWF0IjoxNzc0MTAyNzA5LCJleHAiOjE4MDU2Mzg3MDl9.fO7rXJNdmJs7R-O98AHaRxxJB57_znKiWIZzJYPB9bo',
};

// Estado interno
const state = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    isLoading: false,
    renderPageFunction: null
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
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    currentPageSpan: document.getElementById('currentPage'),
    totalPagesSpan: document.getElementById('totalPages'),
    securityOverlay: document.getElementById('securityOverlay')
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
    // Botones del header
    elements.prevPageBtn.addEventListener('click', async function() {
        if (state.currentPage > 1) {
            state.currentPage--;
            await renderPage(state.currentPage);
            updatePageInfo();
        }
    });
    
    elements.nextPageBtn.addEventListener('click', async function() {
        if (state.currentPage < state.totalPages) {
            state.currentPage++;
            await renderPage(state.currentPage);
            updatePageInfo();
        }
    });
    
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
                updatePageInfo();
            }
        } else if (e.key === 'ArrowRight' || e.key === 'Right') {
            e.preventDefault();
            if (state.currentPage < state.totalPages) {
                state.currentPage++;
                renderPage(state.currentPage);
                updatePageInfo();
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
 * Actualiza la información de página
 */
function updatePageInfo() {
    elements.currentPageSpan.textContent = `Página ${state.currentPage}`;
    elements.totalPagesSpan.textContent = `de ${state.totalPages}`;
    elements.prevPageBtn.disabled = state.currentPage <= 1;
    elements.nextPageBtn.disabled = state.currentPage >= state.totalPages;
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
        
        updateLoadingState(false);
        updatePageInfo();
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
async function renderPage(pageNumber) {
    try {
        const page = await state.pdfDoc.getPage(pageNumber);
        
        // Calcular escala para que el PDF se ajuste al contenedor
        const container = document.querySelector('.canvas-wrapper');
        let containerWidth = container.clientWidth;
        let containerHeight = container.clientHeight;
        
        // Validar dimensiones del contenedor
        if (containerWidth === 0 || containerHeight === 0) {
            // Si el contenedor no tiene dimensiones, usar valores por defecto
            containerWidth = window.innerWidth * 0.8;
            containerHeight = window.innerHeight * 0.8;
        }
        
        // Ajustes específicos para móviles
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            // En móviles, usar un margen más generoso para mejor visualización
            containerWidth = containerWidth * 0.95;
            containerHeight = containerHeight * 0.95;
        }
        
        // Obtener dimensiones del PDF
        const viewport = page.getViewport({ scale: 1 });
        const pdfWidth = viewport.width;
        const pdfHeight = viewport.height;
        
        // Verificar si estamos en pantalla completa
        const isFullscreen = !!document.fullscreenElement || 
                           !!document.webkitFullscreenElement || 
                           !!document.mozFullScreenElement || 
                           !!document.msFullscreenElement;
        
        let scale;
        if (isFullscreen && state.fullscreenScale) {
            // En pantalla completa: usar zoom considerable
            scale = state.fullscreenScale;
        } else {
            // Modo normal: ajustar al contenedor
            const scaleX = containerWidth / pdfWidth;
            const scaleY = containerHeight / pdfHeight;
            scale = Math.min(scaleX, scaleY) * 0.95; // 95% para margen
        }
        
        // Asegurar que la escala sea razonable
        scale = Math.max(0.1, Math.min(scale, 5.0)); // Entre 0.1x y 5.0x
        
        const scaledViewport = page.getViewport({ scale: scale });

        // Preparar el canvas con soporte High DPI
        const canvas = elements.canvas;
        const context = canvas.getContext('2d');
        
        // Detectar devicePixelRatio para soporte Retina/High DPI
        const dpr = window.devicePixelRatio || 1;
        const maxDPR = 2; // Limitar a 2 para evitar saturación de memoria con PDFs grandes
        const actualDPR = Math.min(dpr, maxDPR);
        
        // Asegurar que el canvas tenga el tamaño correcto
        const canvasWidth = scaledViewport.width;
        const canvasHeight = scaledViewport.height;
        
        // Configurar canvas para High DPI
        canvas.width = Math.floor(canvasWidth * actualDPR);
        canvas.height = Math.floor(canvasHeight * actualDPR);
        
        // Establecer el tamaño visual del canvas con CSS
        canvas.style.width = `${canvasWidth}px`;
        canvas.style.height = `${canvasHeight}px`;
        
        // Escalar el contexto para renderizar en alta resolución
        context.scale(actualDPR, actualDPR);
        
        // Limpiar el canvas completamente
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        context.fillStyle = '#ffffff'; // Fondo blanco
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        // Renderizar la página con validación
        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };
        
        // Intentar renderizar con reintentos
        let renderAttempts = 0;
        const maxAttempts = 5; // Aumentar a 5 intentos para imágenes
        
        while (renderAttempts < maxAttempts) {
            try {
                await page.render(renderContext).promise;
                break; // Si tiene éxito, salir del bucle
            } catch (renderError) {
                renderAttempts++;
                console.warn(`Intento ${renderAttempts} fallido para página ${pageNumber}:`, renderError);
                
                if (renderAttempts >= maxAttempts) {
                    throw renderError;
                }
                
                // Mayor retraso para imágenes
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
        
        // Agregar marca de agua después de renderizar la página
        addWatermarkToCanvas(context, canvas.width, canvas.height);
        
        console.log(`Página ${pageNumber} renderizada con marca de agua`);
        
        // Asegurar que el canvas sea visible y centrado
        canvas.style.display = 'block';
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.width = 'auto';
        canvas.style.height = 'auto';
        canvas.style.margin = '0 auto';
        
        // Validación específica para pantalla completa
        if (isFullscreen) {
            // En pantalla completa, asegurar que el canvas ocupe el espacio disponible
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            canvas.style.maxWidth = 'none';
            canvas.style.maxHeight = 'none';
            canvas.style.objectFit = 'contain'; // Mantener proporciones sin distorsión
        }
        
        // Forzar actualización del layout
        canvas.offsetHeight; // trigger reflow
        
        // Validar que el canvas tenga contenido (especialmente importante para imágenes en pantalla completa)
        const imageData = context.getImageData(0, 0, 10, 10); // Muestra más píxeles para detección de imágenes
        const hasContent = imageData.data.some(value => value !== 255);
        
        if (!hasContent && pageNumber > 1) {
            console.warn(`Página ${pageNumber} parece estar vacía, intentando re-renderizar...`);
            
            // Estrategia 1: Reintentar con escala ligeramente diferente
            const retryScale = scale * 1.01;
            const retryViewport = page.getViewport({ scale: retryScale });
            
            canvas.height = retryViewport.height;
            canvas.width = retryViewport.width;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            const retryRenderContext = {
                canvasContext: context,
                viewport: retryViewport
            };
            
            await page.render(retryRenderContext).promise;
            addWatermarkToCanvas(context, canvas.width, canvas.height);
            
            // Validar de nuevo después del re-renderizado
            const retryImageData = context.getImageData(0, 0, 10, 10);
            const retryHasContent = retryImageData.data.some(value => value !== 255);
            
            if (!retryHasContent && isFullscreen) {
                console.warn(`Página ${pageNumber} en pantalla completa sigue sin contenido, intentando con escala menor...`);
                
                // Estrategia 2: En pantalla completa, intentar con escala menor para imágenes
                const imageScale = Math.max(0.5, scale * 0.8); // Escala menor para mejor carga de imágenes
                const imageViewport = page.getViewport({ scale: imageScale });
                
                canvas.height = imageViewport.height;
                canvas.width = imageViewport.width;
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);
                
                const imageRenderContext = {
                    canvasContext: context,
                    viewport: imageViewport
                };
                
                await page.render(imageRenderContext).promise;
                addWatermarkToCanvas(context, canvas.width, canvas.height);
            }
        }
        
    } catch (error) {
        console.error('Error al renderizar página:', error);
        throw error;
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

// Exponer funciones globalmente
window.renderPage = renderPage;
window.updatePageInfo = updatePageInfo;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);