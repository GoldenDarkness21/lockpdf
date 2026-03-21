/*
 * Supabase Logic - Versión con Marca de Agua
 * Descarga segura de PDFs desde Supabase con marca de agua usando pdf-lib
 */

(function() {
    'use strict';

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

    // Promesa de sincronización con el motor de renderizado
    const renderEngineReady = new Promise((resolve) => {
        if (window.pdfCore && typeof window.pdfCore.renderPage === 'function') {
            resolve(window.pdfCore.renderPage);
        } else {
            document.addEventListener('pdfCoreReady', (event) => {
                resolve(event.detail.renderPage);
            });
        }
    });

    /*
     * Carga el PDF desde Supabase y le agrega marca de agua
     */
    async function loadPdfFromSupabase() {
        try {
            updateLoadingState(true);
            console.log('Cargando PDF desde Supabase...');
            
            // Descargar el PDF como ArrayBuffer
            const arrayBuffer = await downloadPdf(SUPABASE_CONFIG.pdfUrl);
            console.log('PDF descargado, tamaño:', arrayBuffer.byteLength, 'bytes');
            
            // Agregar marca de agua al PDF
            const pdfWithWatermark = await addWatermarkToPdf(arrayBuffer);
            console.log('Marca de agua agregada al PDF');
            
            // Cargar el PDF con PDF.js
            state.pdfDoc = await pdfjsLib.getDocument({ data: pdfWithWatermark }).promise;
            state.totalPages = state.pdfDoc.numPages;
            console.log('PDF con watermark cargado, total de páginas:', state.totalPages);
            
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
     * Agrega marca de agua al PDF usando pdf-lib
     */
    async function addWatermarkToPdf(arrayBuffer) {
        try {
            console.log('Procesando PDF para agregar marca de agua...');
            
            // Verificar si pdf-lib está disponible
            if (typeof PDFLib === 'undefined') {
                throw new Error('PDF-Lib no está cargado. Asegúrate de incluir el script de pdf-lib.');
            }

            // Crear un nuevo documento PDF
            const { PDFDocument, rgb, degrees } = PDFLib;
            
            // Cargar el documento original
            const existingPdfBytes = arrayBuffer;
            const pdfDoc = await PDFDocument.load(existingPdfBytes);
            
            // Obtener todas las páginas
            const pages = pdfDoc.getPages();
            const totalPages = pages.length;
            
            console.log(`Procesando ${totalPages} páginas para agregar marca de agua...`);
            
            // Configuración de la marca de agua gigante
            const watermarkText = 'DRAFT - FOR INTERNAL REVIEW - ACH';
            const fontSize = 180; // Tamaño grande pero no gigante para evitar salirse
            const color = rgb(0.5, 0.5, 0.5); // Gris claro
            const opacity = 0.3;
            const rotation = degrees(46); // 45 grados
            
            // Procesar cada página
            for (let i = 0; i < totalPages; i++) {
                const page = pages[i];
                const { width, height } = page.getSize();
                
                // Ajustar posición para que no salga del PDF y esté más abajo
                // Mover la marca de agua más hacia la izquierda y más abajo
                const xPosition = width * 0.05; // 35% del ancho (más hacia la izquierda)
                const yPosition = height * 0.05; // 40% del alto (más abajo)
                
                // Dibujar la marca de agua mejor posicionada
                page.drawText(watermarkText, {
                    x: xPosition,
                    y: yPosition,
                    size: fontSize,
                    color: color,
                    opacity: opacity,
                    rotate: rotation,
                    textAlign: 'center',
                    lineHeight: fontSize * 1.2, // Espaciado más compacto
                });
                
                // Mostrar progreso cada 10 páginas
                if ((i + 1) % 10 === 0 || i === totalPages - 1) {
                    console.log(`Marcas de agua agregadas a ${i + 1}/${totalPages} páginas`);
                }
            }
            
            // Serializar el documento modificado
            const pdfBytes = await pdfDoc.save();
            console.log('PDF con marca de agua procesado exitosamente');
            
            return pdfBytes;
            
        } catch (error) {
            console.error('Error al agregar marca de agua:', error);
            throw error;
        }
    }

    /*
     * Renderiza la primera página cuando el motor esté listo
     */
    async function renderFirstPage() {
        try {
            state.renderPageFunction = await renderEngineReady;
            console.log('Motor de renderizado listo, renderizando primera página');
            await state.renderPageFunction(state.currentPage);
        } catch (error) {
            console.error('Error al renderizar:', error);
            alert('No se pudo renderizar el documento.');
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
        elements.prevPageBtn.addEventListener('click', async function() {
            if (state.currentPage > 1 && state.renderPageFunction) {
                state.currentPage--;
                await state.renderPageFunction(state.currentPage);
                updatePageInfo();
            }
        });
        
        elements.nextPageBtn.addEventListener('click', async function() {
            if (state.currentPage < state.totalPages && state.renderPageFunction) {
                state.currentPage++;
                await state.renderPageFunction(state.currentPage);
                updatePageInfo();
            }
        });
        
        elements.fullscreenBtn.addEventListener('click', function() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        });
    }

    /*
     * Inicializa la aplicación
     */
    function initApp() {
        console.log('Inicializando Visualizador PDF Seguro con Marca de Agua');
        setupSecurity();
        setupControls();
        loadPdfFromSupabase();
    }

    // Exponer estado globalmente para el core
    window.supabaseViewer = {
        state: state,
        elements: elements,
        updatePageInfo: updatePageInfo
    };

    // Inicializar
    document.addEventListener('DOMContentLoaded', initApp);

})();