const puppeteer = require('puppeteer');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

// Coordenadas de clicks en orden de ejecución
const COORD_PRIMER_CLICK = { x: 650, y: 40 };
const COORD_SEGUNDO_CLICK = { x: 1950, y: 50 };
const COORD_TERCER_CLICK = { x: 2000, y: 100 };


const copilot_url = process.env['copilot-url'];

// Función auxiliar para esperar
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Función para visualizar coordenadas
async function visualizeCoordinates(page, x, y, color = 'red', duration = 2000) {
    await page.evaluate((x, y, color, duration) => {
        // Crear un elemento div para el punto
        const point = document.createElement('div');
        point.style.position = 'absolute';
        point.style.left = `${x}px`;
        point.style.top = `${y}px`;
        point.style.width = '10px';
        point.style.height = '10px';
        point.style.backgroundColor = color;
        point.style.borderRadius = '50%';
        point.style.zIndex = '10000';
        point.style.pointerEvents = 'none';
        
        // Crear un elemento div para las coordenadas
        const coords = document.createElement('div');
        coords.style.position = 'absolute';
        coords.style.left = `${x + 15}px`;
        coords.style.top = `${y - 20}px`;
        coords.style.color = color;
        coords.style.fontSize = '12px';
        coords.style.fontWeight = 'bold';
        coords.style.zIndex = '10000';
        coords.style.pointerEvents = 'none';
        coords.textContent = `(${x}, ${y})`;
        
        // Añadir elementos al documento
        document.body.appendChild(point);
        document.body.appendChild(coords);
        
        // Remover después de la duración especificada
        setTimeout(() => {
            document.body.removeChild(point);
            document.body.removeChild(coords);
        }, duration);
    }, x, y, color, duration);
}

// Función para ejecutar el script de Python
function runPythonScript() {
    return new Promise((resolve, reject) => {
        exec('python close_edge.py', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error ejecutando Python: ${error}`);
                reject(error);
                return;
            }
            resolve();
        });
    });
}

async function press_click(activeTab, coords) {
    await visualizeCoordinates(activeTab, coords.x, coords.y, 'red', duration=5000);
    // Simular movimiento del mouse hacia la barra de búsqueda
    await activeTab.mouse.move(coords.x, coords.y);
    await sleep(1000);
    
    // Hacer clic en la barra de búsqueda
    await activeTab.mouse.click(coords.x, coords.y);
    console.log("click", coords.x, coords.y)
    await sleep(500);
}

// Función para verificar el perfil de Edge
async function verifyEdgeProfile() {
    const userDataDir = 'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Microsoft\\Edge\\User Data';
    const defaultProfilePath = path.join(userDataDir, 'Default');
    
    if (!fs.existsSync(userDataDir)) {
        throw new Error('No se encontró el directorio de perfil de Edge');
    }
    
    if (!fs.existsSync(defaultProfilePath)) {
        throw new Error('No se encontró el perfil por defecto de Edge');
    }
    
    console.log('Perfil de Edge encontrado en:', userDataDir);
    return userDataDir;
}

// Función para obtener el contenido HTML de un elemento
async function getElementContent(page, selector) {
    try {
        const element = await page.$(selector);
        if (element) {
            const content = await page.evaluate(el => el.innerHTML, element);
            return content;
        }
        return null;
    } catch (error) {
        console.log('Error al obtener contenido:', error.message);
        return null;
    }
}

// Función para obtener las coordenadas de un elemento
async function getElementCoordinates(page, selector) {
    try {
        const element = await page.$(selector);
        if (element) {
            const box = await element.boundingBox();
            return {
                x: box.x + (box.width / 2),
                y: box.y + (box.height / 2)
            };
        }
        return null;
    } catch (error) {
        console.log('Error al obtener coordenadas:', error.message);
        return null;
    }
}

// Función para obtener todos los elementos que coincidan con un selector
async function getAllElements(page, selector) {
    try {
        const elements = await page.$$(selector);
        return elements;
    } catch (error) {
        console.log('Error al obtener elementos:', error.message);
        return [];
    }
}

// Función para esperar y hacer clic en un elemento
async function waitAndClick(page, selector, timeout = 5000) {
    try {
        await page.waitForSelector(selector, { timeout });
        const coords = await getElementCoordinates(page, selector);
        if (coords) {
            await press_click(page, coords);
            return true;
        }
        return false;
    } catch (error) {
        console.log('Error al hacer clic:', error.message);
        return false;
    }
}

// Función para simular scroll humano
async function humanScroll(page, targetY) {
    // Obtener la posición actual del scroll
    const currentScroll = await page.evaluate(() => window.scrollY);
    const distance = targetY - currentScroll;
    const steps = 10; // Número de pasos para el scroll
    const stepDistance = distance / steps;
    let time_sleep = 0
    // Hacer scroll en pasos pequeños con delays aleatorios
    for (let i = 0; i < steps; i++) {
        await page.evaluate((step) => {
            window.scrollBy({
                top: step,
                behavior: 'smooth'
            });
        }, stepDistance);
        
        // Delay aleatorio entre cada paso
        sleep_aleatorio = Math.random() * 100 + 50
        time_sleep += sleep_aleatorio
        await sleep(sleep_aleatorio);
    }
    
    // Esperar un momento después del scroll
    await sleep(time_sleep + 500);
}

async function getCoords(element) {
    try {
        // Primero verificar si el elemento existe
        if (!element) {
            console.log('Elemento no encontrado');
            return null;
        }

        // Verificar si el elemento está en el DOM
        const isInDOM = await element.evaluate(el => {
            return document.body.contains(el);
        });

        if (!isInDOM) {
            console.log('Elemento no está en el DOM');
            return null;
        }

        return await element.evaluate(el => {
            // Obtener el rectángulo del elemento
            const rect = el.getBoundingClientRect();
            
            // Verificar si el elemento está visible
            const style = window.getComputedStyle(el);
            const isVisible = style.display !== 'none' && 
                            style.visibility !== 'hidden' && 
                            style.opacity !== '0' &&
                            rect.width > 0 && 
                            rect.height > 0;

            if (!isVisible) {
                console.log('Elemento no está visible');
                return null;
            }

            // Calcular el punto central
            const centerX = rect.left + (rect.width / 2);
            const centerY = rect.top + (rect.height / 2);

            // Verificar si hay elementos visibles superpuestos
            const elementsAtPoint = document.elementsFromPoint(centerX, centerY);

            // Solo verificar elementos visibles
            const visibleElements = elementsAtPoint.filter(e => {
                const style = window.getComputedStyle(e);
                const rect = e.getBoundingClientRect();
                return style.display !== 'none' && 
                       style.visibility !== 'hidden' && 
                       style.opacity !== '0' &&
                       rect.width > 0 && 
                       rect.height > 0;
            });

            // Si hay elementos visibles superpuestos que no son nuestro elemento
            if (visibleElements.length > 1 && visibleElements[0] !== el) {
                console.log('Elemento superpuesto detectado');
                return null;
            }

            return {
                x: centerX,
                y: centerY,
                width: rect.width,
                height: rect.height
            };
        });
    } catch (error) {
        console.log('Error al obtener coordenadas:', error.message);
        return null;
    }
}

async function searchPage(page, browser) {
    await setEdgeHighPriority();
    const copilotPage = await browser.newPage();
    // Español-English:
    // Saca la url "copilot-url" del archivo .env usando process.env y guárdala como copilot_url.
    await copilotPage.goto(copilot_url, {
        waitUntil: 'networkidle0',
        timeout: 30000
    });
    
    // Esperar a que el textarea esté disponible
    await copilotPage.waitForSelector('#userInput', { timeout: 10000 });
    
    mensaje = "Dame una lista de 30 temas interesantes para consultar el dia de hoy. Por favor, responde SOLO con un objeto JSON que tenga una key 'temas' con un array de strings, pero envíalo como texto normal, no como bloque de código. Ejemplo de formato: {\"temas\": [\"tema1\", \"tema2\", \"tema3\"]}"
    
    // Escribir el mensaje en el textarea
    await copilotPage.type('#userInput', mensaje);
    // Presionar Enter para enviar el mensaje
    await copilotPage.keyboard.press('Enter');
    
    // Esperar a que la respuesta se genere
    await sleep(15000);
    
    // Esperar y obtener la respuesta
    try {
        await copilotPage.waitForSelector('[data-content="ai-message"]', { timeout: 10000 });
        
        // Obtener el texto de la respuesta
        const response = await copilotPage.evaluate(() => {
            const messageElements = document.querySelectorAll('[data-content="ai-message"]');
            const lastMessage = messageElements[messageElements.length - 1];
            
            if (lastMessage) {
                const spanElement = lastMessage.querySelector('span');
                return spanElement ? spanElement.textContent : null;
            }
            return null;
        });
        
        if (response) {
            console.log('Respuesta de Copilot:', response);
            let temas = [];
            // Intentar parsear la respuesta como JSON
            try {
                const cleanResponse = response.trim();
                const jsonResponse = JSON.parse(cleanResponse);
                if (jsonResponse.temas && Array.isArray(jsonResponse.temas)) {
                    temas = jsonResponse.temas;
                    console.log('Lista de temas:', temas);
                } else {
                    throw new Error('La respuesta no contiene un array de temas válido');
                }
            } catch (error) {
                console.log('Error al procesar la respuesta:', error.message);
                // Enviar mensaje de error a Copilot
                await copilotPage.waitForSelector('#userInput', { timeout: 10000 });
                const errorMessage = `Tu respuesta debe ser un objeto JSON con una key 'temas' que contenga un array de strings. Por ejemplo: {"temas": ["tema1", "tema2", "tema3"]}. No escribas ningún otro texto. Error actual: ${error.message}`;
                await copilotPage.type('#userInput', errorMessage);
                await copilotPage.keyboard.press('Enter');
                
                // Esperar y obtener la nueva respuesta
                await sleep(5000);
                const newResponse = await copilotPage.evaluate(() => {
                    const messageElements = document.querySelectorAll('[data-content="ai-message"]');
                    const lastMessage = messageElements[messageElements.length - 1];
                    
                    if (lastMessage) {
                        const spanElement = lastMessage.querySelector('span');
                        return spanElement ? spanElement.textContent : null;
                    }
                    return null;
                });
                
                if (newResponse) {
                    console.log('Nueva respuesta de Copilot:', newResponse);
                    try {
                        const cleanNewResponse = newResponse.trim();
                        const jsonNewResponse = JSON.parse(cleanNewResponse);
                        if (jsonNewResponse.temas && Array.isArray(jsonNewResponse.temas)) {
                            temas = jsonNewResponse.temas;
                            console.log('Lista de temas (segundo intento):', temas);
                        } else {
                            throw new Error('La respuesta no contiene un array de temas válido');
                        }
                    } catch (secondError) {
                        console.log('Error en el segundo intento:', secondError.message);
                    }
                }
            }
            
            // Agradecer a Copilot
            await copilotPage.waitForSelector('#userInput', { timeout: 10000 });
            const agradecimiento = "¡Muchas gracias por la lista de temas! Me ayudaste a encontrar información muy interesante.";
            await copilotPage.type('#userInput', agradecimiento);
            await copilotPage.keyboard.press('Enter');
            
            // Esperar un momento para que Copilot pueda responder
            await sleep(5000);
            
            // Cerrar la pestaña de Copilot
            await copilotPage.close();
            
            // Trabajar con los temas
            if (temas.length > 0) {
                console.log('Iniciando búsquedas con los temas obtenidos...');
                
                for (const tema of temas) {
                    let intentos = 0;
                    const maxIntentos = 3;
                    let intentos_no_high = 0;
                    const maxIntentos_no_high = 1;
                    while (true) {
                        try {
                            // Esperar a que el campo de búsqueda esté disponible con timeout más corto
                            await page.waitForSelector('#sb_form_q', { timeout: 5000 });
                            // Pequeña espera para asegurar que la página esté completamente cargada
                            await sleep(1000);
                            // Limpiar el campo de búsqueda
                            await page.click('#sb_form_q');
                            await page.keyboard.down('Control');
                            await page.keyboard.press('A');
                            await page.keyboard.up('Control');
                            await page.keyboard.press('Backspace');
                            // Escribir el tema con delays aleatorios para simular escritura humana
                            for (let char of tema) {
                                await page.keyboard.type(char, { delay: Math.random() * 100 + 50 });
                            }
                            // Esperar un momento antes de presionar Enter
                            await sleep(Math.random() * 1000 + 500);
                            await page.keyboard.press('Enter');
                            console.log(`Buscando: ${tema}`);
                            // Esperar un tiempo aleatorio entre 30 segundos y 1 minuto
                            const waitTime = Math.floor(Math.random() * (60000 - 30000) + 30000);
                            console.log(`Esperando ${Math.round(waitTime/1000)} segundos antes de la siguiente búsqueda...`);
                            await sleep(waitTime);
                            // Si llegamos aquí, la búsqueda fue exitosa
                            break;
                        } catch (error) {
                            intentos++;
                            console.log(`Error al buscar el tema "${tema}" (Intento ${intentos}/${maxIntentos}):`, error.message);
                            if (intentos < maxIntentos) {
                                console.log(`Reintentando en 3 segundos...`);
                                await sleep(3000);
                            } else {
                                intentos_no_high++;
                                if (intentos_no_high < maxIntentos_no_high) {
                                    console.log(`No se pudo completar la búsqueda después de ${maxIntentos_no_high} intentos y no se pudo cambiar la prioridad de Edge.`);
                                    break;
                                }
                                // Nuevo: Verificar si hay procesos Edge sin prioridad HIGH
                                const processes = await getEdgeProcessesWithPriority();
                                console.log(processes);
                                const notHigh = processes.filter(p => p.priority != 13);
                                if (notHigh.length > 0) {
                                    console.log(`Al menos ${notHigh.length} procesos Edge no tienen prioridad HIGH. Corrigiendo...`);
                                    await setEdgeHighPriority();
                                    intentos = 0; // Reiniciar intentos para este tema
                                    console.log('Prioridad de Edge restaurada a HIGH. Reiniciando intentos para el tema.');
                                    await sleep(3000);
                                } else {
                                    console.log(`No se pudo completar la búsqueda después de ${maxIntentos} intentos y todos los procesos Edge ya están en HIGH.`);
                                    break;
                                }
                            }
                        }
                    }
                }
                
                console.log('Todas las búsquedas completadas');
            } else {
                console.log('No hay temas para buscar');
            }
            
        } else {
            console.log('No se pudo obtener la respuesta');
        }
    } catch (error) {
        console.log('Error al obtener la respuesta:', error.message);
    }
}


// Ejemplo de uso en la página de rewards
async function processRewardsPage(rewardsPage, browser) {
    try {
        // Esperar a que la página esté lista
        await rewardsPage.waitForSelector('body', { timeout: 5000 });
        
        // Ejemplo: Obtener todos los elementos de recompensas
        const rewardElements = await rewardsPage.$$eval('mee-card', elements => {
            return elements.map(el => {
                // Buscar en ambas estructuras posibles
                const headingElement = el.querySelector('h3[mee-heading="heading"]') || el.querySelector('span[mee-heading="heading"]');
                const iconSpan = el.querySelector('span.mee-icon');
                const linkElement = el.querySelector('a.ds-card-sec');
                
                // Verificar si tiene el span con la clase correcta y no está bloqueado
                const hasCorrectIcon = iconSpan && 
                    iconSpan.className === 'mee-icon mee-icon-AddMedium' && 
                    !iconSpan.className.includes('exclusiveLockedPts');
                
                // Verificar si el enlace está disponible y no está deshabilitado
                const isLinkEnabled = linkElement && 
                    !linkElement.hasAttribute('aria-disabled') && 
                    linkElement.getAttribute('aria-disabled') !== 'true';
                
                return {
                    text: headingElement ? headingElement.textContent : null,
                    element: el,
                    hasHeading: !!headingElement,
                    hasCorrectIcon: hasCorrectIcon,
                    isLinkEnabled: isLinkEnabled,
                    html: el.outerHTML
                };
            }).filter(item => 
                item.text !== null && 
                (item.hasCorrectIcon || item.isLinkEnabled)
            );
        });
        
        console.log('Elementos encontrados:', rewardElements.length);
        
        // Procesar cada elemento de recompensa
        let searchPageValidated = false;
        for (const element of rewardElements) {
            console.log('Procesando elemento:', element.text);
            
            // Obtener todos los mee-card
            const cards = await rewardsPage.$$('mee-card');
            let targetCard = null;

            for (const card of cards) {
                // Verificar si este mee-card tiene el span con el texto y la clase correcta
                const isValidCard = await card.evaluate((card, searchText) => {
                    // Buscar en ambas estructuras posibles
                    const heading = card.querySelector('h3[mee-heading="heading"]') || card.querySelector('span[mee-heading="heading"]');
                    const iconSpan = card.querySelector('span.mee-icon');
                    const link = card.querySelector('a.ds-card-sec');
                    
                    const hasCorrectText = heading && heading.textContent === searchText;
                    const hasCorrectIcon = iconSpan && 
                        iconSpan.className === 'mee-icon mee-icon-AddMedium' && 
                        !iconSpan.className.includes('exclusiveLockedPts');
                    const isLinkEnabled = link && 
                        !link.hasAttribute('aria-disabled') && 
                        link.getAttribute('aria-disabled') !== 'true';
                    
                    // Verificar si el elemento está visible
                    const style = window.getComputedStyle(card);
                    const rect = card.getBoundingClientRect();
                    const isVisible = style.display !== 'none' && 
                                    style.visibility !== 'hidden' && 
                                    style.opacity !== '0' &&
                                    rect.width > 0 && 
                                    rect.height > 0;
                    
                    console.log('Validación de tarjeta:', {
                        text: heading ? heading.textContent : null,
                        hasCorrectText,
                        hasCorrectIcon,
                        isLinkEnabled,
                        isVisible,
                        style: {
                            display: style.display,
                            visibility: style.visibility,
                            opacity: style.opacity
                        },
                        rect: {
                            width: rect.width,
                            height: rect.height
                        }
                    });
                    
                    return hasCorrectText && (hasCorrectIcon || isLinkEnabled) && isVisible;
                }, element.text);
                
                if (isValidCard) {
                    targetCard = card;
                    break;
                }
            }
            
            if (targetCard) {
                
                // Obtener el enlace dentro de la tarjeta
                const link = await targetCard.$('a.ds-card-sec');
                if (!link) {
                    console.log('No se encontró el enlace en la tarjeta');
                    continue;
                }

                // Obtener coordenadas del enlace
                const box = await link.boundingBox();
                if (!box) {
                    console.log('No se pudieron obtener las coordenadas del enlace');
                    continue;
                }
                
                // Calcular el punto central del enlace
                const coords = {
                    x: box.x + (box.width / 2),
                    y: box.y + (box.height / 2)
                };

                // Ajustar el scroll para mantener el elemento visible
                const viewportHeight = await rewardsPage.evaluate(() => window.innerHeight);
                const targetScrollY = coords.y - (viewportHeight / 2);
                
                // Recalcular las coordenadas después del scroll
                await humanScroll(rewardsPage, targetScrollY);
                
                // Esperar a que la página se estabilice después del scroll
                await sleep(1000);
                
                // Verificar nuevamente las coordenadas después del scroll
                const newBox = await link.boundingBox();
                if (newBox) {
                    coords.x = newBox.x + (newBox.width / 2);
                    coords.y = newBox.y + (newBox.height / 2);
                }

                console.log('Intentando hacer clic en:', coords);
                
                // Intentar hacer click
                await press_click(rewardsPage, coords);
                
                // Esperar a que se abra la nueva pestaña
                await sleep(5000);
                
                // Verificar si se abrió una nueva pestaña
                let allTabs = await browser.pages();
                let newTab = allTabs[allTabs.length - 1];
                
                if (newTab !== rewardsPage) {
                    console.log('Reclamando recompensa de '+element.text);
                    try {
                        await newTab.waitForSelector('body', { timeout: 5000 });
                        console.log('Recompensa reclamada correctamente.');
                        
                        // Obtener la URL actual
                        const currentUrl = await newTab.url();
                        
                        if (currentUrl === 'https://www.bing.com/') {
                            console.log('URL de Bing detectada, ejecutando searchPage...');
                            await searchPage(newTab, browser);
                            searchPageValidated = true;
                        } else {
                            console.log('Recompensa reclamada correctamente.');
                        }
                        
                        // Obtener todas las pestañas
                        const allTabs = await browser.pages();
                        
                        // Cerrar todas las pestañas que tengan la misma URL
                        for (const tab of allTabs) {
                            const tabUrl = await tab.url();
                            if (tabUrl === currentUrl) {
                                await tab.close();
                            }
                        }
                    } catch (error) {
                        console.log('Error al esperar la nueva página:', error.message);
                    }
                } else {
                    console.log("No se abrió ventana para "+element.text);
                    // Obtener la URL y datos del enlace
                    const linkData = await targetCard.evaluate(el => {
                        const link = el.querySelector('a.ds-card-sec');
                        if (!link) return null;
                        
                        return {
                            href: link.href,
                            biId: el.getAttribute('data-bi-id'),
                            dataM: el.getAttribute('data-m'),
                            isRewardable: el.hasAttribute('mee-rewardable')
                        };
                    });
                    
                    if (linkData) {
                        console.log('Intentando reclamar recompensa...');
                        
                        // Simular la interacción completa
                        await targetCard.evaluate((el, data) => {
                            // 1. Crear el evento de Angular
                            const event = new MouseEvent('click', {
                                bubbles: true,
                                cancelable: true,
                                view: window
                            });
                            
                            // 2. Asegurarse de que los atributos estén presentes
                            if (!el.hasAttribute('mee-rewardable')) {
                                el.setAttribute('mee-rewardable', '');
                            }
                            if (!el.getAttribute('data-bi-id')) {
                                el.setAttribute('data-bi-id', data.biId);
                            }
                            if (!el.getAttribute('data-m')) {
                                el.setAttribute('data-m', data.dataM);
                            }
                            
                            // 3. Disparar el evento en el elemento correcto
                            const link = el.querySelector('a.ds-card-sec');
                            if (link) {
                                // Disparar el evento nativo
                                link.dispatchEvent(event);
                                
                                // Intentar acceder al controlador de Angular de manera más segura
                                try {
                                    // Obtener el elemento Angular
                                    const angularElement = angular.element(link);
                                    if (angularElement && angularElement.scope) {
                                        const scope = angularElement.scope();
                                        if (scope) {
                                            // Intentar diferentes formas de acceder al controlador
                                            const controller = scope.$ctrl || scope.$$childHead?.$ctrl || scope.$parent?.$ctrl;
                                            if (controller && typeof controller.onCardClick === 'function') {
                                                controller.onCardClick(event);
                                                scope.$apply();
                                            } else {
                                                // Si no encontramos el controlador, intentar con el evento nativo
                                                link.click();
                                            }
                                        }
                                    }
                                } catch (error) {
                                    console.log('Error al acceder a Angular, usando click nativo');
                                    link.click();
                                }
                            }
                        }, linkData);
                        
                        // Esperar a que Angular procese los cambios y abra la pestaña
                        await sleep(2000);
                        
                        // Verificar si se abrió una nueva pestaña
                        let allTabs = await browser.pages();
                        let newTab = allTabs[allTabs.length - 1];
                        
                        if (newTab !== rewardsPage) {
                            try {
                                await newTab.waitForSelector('body', { timeout: 5000 });
                                await sleep(5000);
                                
                                // Obtener la URL actual
                                const currentUrl = await newTab.url();
                                
                                if (currentUrl === 'https://www.bing.com/') {
                                    console.log('URL de Bing detectada, ejecutando searchPage...');
                                    await searchPage(newTab, browser);
                                    searchPageValidated = true;
                                } else {
                                    console.log('Recompensa reclamada correctamente.');
                                }
                                        
                                // Obtener todas las pestañas
                                const allTabs = await browser.pages();
                                
                                // Cerrar todas las pestañas que tengan la misma URL
                                for (const tab of allTabs) {
                                    const tabUrl = await tab.url();
                                    if (tabUrl === currentUrl) {
                                        await tab.close();
                                    }
                                }
                            } catch (error) {
                                console.log('Error al esperar la nueva página:', error.message);
                            }
                        } else {
                            console.log('No se abrió la pestaña después del evento');
                        }
                    } else {
                        console.log('No se encontró URL en el elemento');
                    }
                }
                await sleep(1000);
            } else {
                console.log('No se encontró el mee-card válido para:', element.text);
            }
        }

        if (!searchPageValidated) {
            console.log("No se encontro tarjeta para la recompensa de busqueda. Accediendo a bing manualmente")
            newTab = await browser.newPage();
            await newTab.goto('https://www.bing.com/');
            await sleep(500);
            await searchPage(newTab, browser);
        }
        
    } catch (error) {
        console.log('Error procesando página de rewards:', error.message);
        console.error(error.stack);
    }
}

// Obtener el nombre del proceso Edge desde variable de entorno o usar por defecto
const EDGE_PROCESS_NAME = process.env.EDGE_PROCESS_NAME || 'msedge.exe';

// Mapeo de nombres a valores de prioridad de Windows
const PRIORITY_MAP = {
    'high': 128
};

// Cambiar prioridad de todos los Edge a alta
function setEdgeHighPriority() {
    return new Promise((resolve, reject) => {
        exec(`wmic process where name='${EDGE_PROCESS_NAME}' get ProcessId /format:csv`, (err, stdout, stderr) => {
            if (err) {
                console.error('Error obteniendo procesos Edge:', err.message);
                return reject(err);
            }
            const lines = stdout.trim().split('\n').slice(1);
            const pids = [];
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const pid = parseInt(parts[2]);
                    if (!isNaN(pid)) pids.push(pid);
                }
            }
            let changed = 0;
            if (pids.length === 0) {
                console.log('No se encontraron procesos Edge para cambiar prioridad.');
                return resolve();
            }
            pids.forEach(pid => {
                exec(`wmic process where processid='${pid}' CALL setpriority ${PRIORITY_MAP['high']}`,(err2, stdout2, stderr2) => {
                    if (!err2) {
                        console.log(`Prioridad de PID ${pid} cambiada a HIGH. Mensaje: ${stdout2.trim()}`);
                    } else {
                        console.error(`Error cambiando prioridad de PID ${pid}:`, err2.message, '| Mensaje:', stderr2.trim());
                    }
                    changed++;
                    if (changed === pids.length) resolve();
                });
            });
        });
    });
}

// Función para obtener los procesos Edge y sus prioridades
function getEdgeProcessesWithPriority() {
    return new Promise((resolve, reject) => {
        exec(`wmic process where name='${EDGE_PROCESS_NAME}' get ProcessId,Priority /format:csv`, (err, stdout, stderr) => {
            if (err) return reject(err);
            const lines = stdout.trim().split('\n').slice(1);
            const processes = [];
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const pid = parseInt(parts[2]);
                    const priority = parseInt(parts[1]);
                    if (!isNaN(pid) && !isNaN(priority)) {
                        processes.push({ pid, priority });
                    }
                }
            }
            resolve(processes);
        });
    });
}

async function runBot() {
    await sleep(30000);
    try{
        // Primero ejecutar el script de Python para cerrar Edge
        console.log('Cerrando instancias de Edge...');
        await runPythonScript();
        console.log('Edge cerrado correctamente');

        // Verificar el perfil de Edge
        console.log('Verificando perfil de Edge...');
        const userDataDir = await verifyEdgeProfile();
        
        // Ruta al ejecutable de Edge
        const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
        
        console.log('Iniciando Edge con perfil personal...');
        const browser = await puppeteer.launch({
            executablePath: edgePath,
            headless: false, // false para ver el navegador en pantalla, en true no se ve el navegador
            defaultViewport: null,
            userDataDir: userDataDir,
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--profile-directory=Default'
            ]
        });

        // Obtener todas las pestañas activas
        let pages = await browser.pages();
        
        // Abrir nueva pestaña usando el método más confiable
        let activeTab = await browser.newPage();
        console.log('Navegando a MSN...');
        await activeTab.goto('https://www.msn.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });
        
        console.log('Pestañas activas:', pages.length);
        // Cerrar pestañas about:blank si existen
        pages = await browser.pages();
        for (const page of pages) {
            const url = page.url();
            console.log("Pestaña: "+url)
            if (url === 'about:blank') {
                await page.close();
                console.log('Cerrando pestaña about:blank');
            }
        }

        // Configurar el user agent para que parezca más humano
        await activeTab.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0');

        // Esperar a que la página de inicio se cargue
        await sleep(4000);

        press_click(activeTab, COORD_PRIMER_CLICK)
        
        // Escribir "rewards" con delays aleatorios para simular escritura humana
        let searchText = 'rewards';
        for (let char of searchText) {
            await activeTab.keyboard.type(char, { delay: Math.random() * 100 + 50 });
        }
        
        // Esperar un momento antes de presionar Enter
        await sleep(800);
        await activeTab.keyboard.press('Enter');
        
        // Esperar a que los resultados aparezcan
        await sleep(5000);
        
        press_click(activeTab, COORD_SEGUNDO_CLICK)
        await sleep(4000);
        press_click(activeTab, COORD_TERCER_CLICK)
        await sleep(5000);

        // Esperar y capturar la nueva pestaña que se abre
        let allTabs = await browser.pages();
        let newTab = allTabs[allTabs.length - 1]; // La última pestaña es la nueva
        
        // Verificar que la nueva pestaña sea diferente a la actual
        if (newTab !== activeTab) {
            console.log('Cambiando a la nueva pestaña de rewards...');
            await activeTab.close();
            const rewardsPage = newTab;
            
            try {
                await rewardsPage.waitForSelector('body', { timeout: 5000 });
                console.log('Nueva página cargada correctamente');
                
                
            } catch (error) {
                console.log('La página ya estaba cargada');
            }
            // Procesar la página de rewards
            await processRewardsPage(rewardsPage, browser);
            
            await sleep(2000);
        }


        await sleep(10000)
        
    } catch (error) {        
        console.log("Error con: "+error);
        console.error(error.stack);
    } finally {
        console.log("finalizando")
        process.exit(0); // Termina el proceso de Node.js exitosamente
    }
}

runBot();
