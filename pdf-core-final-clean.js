/*
 * PDF Core Logic - Versión Final y Limpia
 * Renderizado de PDFs con marca de agua altamente visible
 */

(function() {
    'use strict';

    // Obtener referencias del visualizador
    const getViewerState = function() {
        if (window.supabaseViewer) {
            return {
                state: window.supabaseViewer.state,
                elements: window.supabaseViewer.elements,
                updatePageInfo: window.supabaseViewer.updatePageInfo
            };
        }
        throw new Error('Supabase Viewer no está disponible');
    };

    // Estado interno para renderizado
    const renderState = {
        canvas: null,
        context: null,
        isRendering: false
    };

    /*
     * Renderiza una página del PDF con marca de agua altamente visible
     */
    async function renderPage(pageNum) {
        if (renderState.isRendering) return;

        try {
            renderState.isRendering = true;
            
            const viewer = getViewerState();
            const state = viewer.state;
            const elements = viewer.elements;

            if (!state.pdfDoc) {
                console.error('PDF no cargado');
                return;
            }

            console.log(`Renderizando página ${pageNum}`);
            
            // Obtener y escalar la página
            const page = await state.pdfDoc.getPage(pageNum);
            const container = elements.canvas.parentElement;
            const viewport = page.getViewport({ scale: 1 });
            
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            const scale = Math.min(
                containerWidth / viewport.width,
                containerHeight / viewport.height
            ) * 0.95;
            
            const scaledViewport = page.getViewport({ scale });
            
            // Configurar canvas
            renderState.canvas = elements.canvas;
            renderState.context = renderState.canvas.getContext('2d');
            
            renderState.canvas.height = scaledViewport.height;
            renderState.canvas.width = scaledViewport.width;
            
            // Renderizar página
            const renderContext = {
                canvasContext: renderState.context,
                viewport: scaledViewport
            };
            
            await page.render(renderContext).promise;
            
            // Aplicar marca de agua altamente visible
            applyWatermark(renderState.context, renderState.canvas.width, renderState.canvas.height);
            
            console.log(`Página ${pageNum} renderizada con watermark visible`);
            viewer.updatePageInfo();
            
        } catch (error) {
            console.error('Error al renderizar:', error);
            alert('Error al renderizar la página.');
        } finally {
            renderState.isRendering = false;
        }
    }

    /*
     * Aplica la marca de agua altamente visible al canvas
     * Texto: "draft - for internal review - ach"
     * Color gris con opacidad ajustable, inclinada a 45°
     */
    function applyWatermark(context, canvasWidth, canvasHeight) {
        // Configuración mejorada para mayor visibilidad
        const watermarkConfig = {
            text: 'DRAFT - FOR INTERNAL REVIEW - ACH',
            fontSize: Math.max(32, Math.floor(canvasWidth / 15)), // Texto más grande
            color: 'rgba(128, 128, 128, 0.15)', // Opacidad ligeramente mayor (0.15 en lugar de 0.2)
            angle: -45,
            spacing: 150, // Mayor espaciado para mejor visibilidad
            padding: 100 // Mayor padding
        };
        
        context.save();
        
        // Configurar propiedades del texto para mejor visibilidad
        context.font = `bold ${watermarkConfig.fontSize}px Arial, sans-serif`;
        context.fillStyle = watermarkConfig.color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.globalAlpha = 0.15; // Opacidad ligeramente mayor
        
        // Rotar canvas para efecto diagonal
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        context.translate(centerX, centerY);
        context.rotate(watermarkConfig.angle * Math.PI / 180);
        context.translate(-centerX, -centerY);
        
        // Dibujar watermark en patrón más espaciado
        const textWidth = context.measureText(watermarkConfig.text).width;
        const textHeight = watermarkConfig.fontSize;
        
        let startX = -watermarkConfig.padding;
        let startY = -watermarkConfig.padding;
        let endX = canvasWidth + watermarkConfig.padding;
        let endY = canvasHeight + watermarkConfig.padding;
        
        // Dibujar en un patrón de cuadrícula más espaciado
        for (let x = startX; x < endX; x += watermarkConfig.spacing + textWidth) {
            for (let y = startY; y < endY; y += watermarkConfig.spacing + textHeight * 3) { // Mayor espaciado vertical
                const textX = x + textWidth / 2;
                const textY = y + textHeight / 2;
                context.fillText(watermarkConfig.text, textX, textY);
            }
        }
        
        context.restore();
        
        console.log('Watermark altamente visible aplicado');
    }

    /*
     * Maneja redimensionamiento
     */
    function handleResize() {
        clearTimeout(handleResize.timeout);
        handleResize.timeout = setTimeout(() => {
            const viewer = getViewerState();
            const state = viewer.state;
            
            if (state.pdfDoc && state.currentPage && renderState.canvas) {
                renderPage(state.currentPage);
            }
        }, 100);
    }

    /*
     * Configura seguridad del canvas
     */
    function setupCanvasSecurity() {
        const viewer = getViewerState();
        const elements = viewer.elements;
        const canvas = elements.canvas;
        
        canvas.addEventListener('dragstart', function(e) {
            e.preventDefault();
        });
        
        canvas.addEventListener('selectstart', function(e) {
            e.preventDefault();
        });
        
        canvas.addEventListener('dblclick', function(e) {
            e.preventDefault();
        });
    }

    /*
     * Configura navegación con teclado
     */
    function setupKeyboardNavigation() {
        document.addEventListener('keydown', function(e) {
            const activeElement = document.activeElement;
            const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
            
            if (isInput) return;
            
            const viewer = getViewerState();
            const state = viewer.state;
            
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                if (state.currentPage > 1 && !state.isLoading) {
                    state.currentPage--;
                    renderPage(state.currentPage);
                }
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                if (state.currentPage < state.totalPages && !state.isLoading) {
                    state.currentPage++;
                    renderPage(state.currentPage);
                }
            }
        });
    }

    /*
     * Inicializa el motor de renderizado
     */
    function initPdfCore() {
        try {
            const viewer = getViewerState();
            
            setupCanvasSecurity();
            setupKeyboardNavigation();
            window.addEventListener('resize', handleResize);
            
            window.pdfCore = {
                renderPage: renderPage,
                applyWatermark: applyWatermark,
                handleResize: handleResize
            };
            
            // Disparar evento de que está listo
            const event = new CustomEvent('pdfCoreReady', {
                detail: { renderPage: renderPage }
            });
            document.dispatchEvent(event);
            
            console.log('PDF Core Logic final e inicializado');
            
        } catch (error) {
            console.error('Error al inicializar PDF Core:', error);
            setTimeout(initPdfCore, 1000);
        }
    }

    // Inicializar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPdfCore);
    } else {
        initPdfCore();
    }

})();