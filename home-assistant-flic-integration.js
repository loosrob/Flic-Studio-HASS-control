// Home Assistant Media Integration with Flic App Module
// This script integrates Home Assistant media devices using the REST API
// with Flic buttons and Twist controllers for volume control

const flicApp = require('flicapp');
const http = require('http');

console.log('Home Assistant Media Integration Started');

// ============================================================================
// HOME ASSISTANT API CONFIGURATION
// ============================================================================

// Home Assistant configuration
const HA_CONFIG = {
    // Update these with your Home Assistant instance details
    baseUrl: 'http://HOME_ASSISTANT_IP:8123',
    token: 'YOUR_LONG_LIVED_ACCESS_TOKEN',
    
    // Device configuration by category
    devices: {
        // Media devices (TVs, speakers, etc.)
        media: [
            { 
                id: 'livingroom_tv', 
                entityId: 'media_player.living_room_tv',
                name: 'Living Room TV',
                type: 'media_player'
            },
            { 
                id: 'bedroom_speaker', 
                entityId: 'media_player.bedroom_speaker',
                name: 'Bedroom Speaker',
                type: 'media_player'
            },
            { 
                id: 'kitchen_radio', 
                entityId: 'media_player.kitchen_radio',
                name: 'Kitchen Radio',
                type: 'media_player'
            },
            { 
                id: 'playback_control', 
                entityId: 'media_player.living_room_tv', // Uses same device for playback control
                name: 'Playback Control',
                type: 'playback'
            }
        ],
        
        // Light devices (dimmable and color lights)
        lights: [
            {
                id: 'living_room_light',
                entityId: 'light.living_room_ceiling',
                name: 'Living Room Light',
                type: 'light'
            },
            {
                id: 'bedroom_light',
                entityId: 'light.bedroom_ceiling',
                name: 'Bedroom Light', 
                type: 'light'
            },
            {
                id: 'kitchen_color_light',
                entityId: 'light.kitchen_color_strip',
                name: 'Kitchen Color Light',
                type: 'color_light'
            }
        ],
        
        // Climate devices (thermostats, ACs)
        climate: [
            {
                id: 'living_room_thermostat',
                entityId: 'climate.living_room',
                name: 'Living Room Thermostat',
                type: 'climate',
                tempRange: { min: 16, max: 30 } // °C
            },
            {
                id: 'bedroom_ac',
                entityId: 'climate.bedroom_ac',
                name: 'Bedroom AC',
                type: 'climate',
                tempRange: { min: 18, max: 28 } // °C
            }
        ],
        
        // Blind/Cover devices (blinds, curtains, shutters)
        blinds: [
            {
                id: 'living_room_blinds',
                entityId: 'cover.living_room_blinds',
                name: 'Living Room Blinds',
                type: 'blind'
            },
            {
                id: 'bedroom_curtains',
                entityId: 'cover.bedroom_curtains',
                name: 'Bedroom Curtains',
                type: 'blind'
            },
            {
                id: 'kitchen_shutters',
                entityId: 'cover.kitchen_shutters',
                name: 'Kitchen Shutters',
                type: 'blind'
            }
        ]
    },
    
    // API endpoints
    endpoints: {
        states: '/api/states/',
        services: '/api/services/',
        config: '/api/config'
    },
    
    // Value ranges for different device types
    valueRanges: {
        // Media devices (Home Assistant uses 0-1 for volume)
        media_player: { min: 0, max: 1 },
        playback: { min: 0, max: 1 },
        
        // Light devices (Home Assistant uses 0-255 for brightness)
        light: { min: 0, max: 255 },
        color_light: { min: 0, max: 255 },
        
        // Climate devices (temperature ranges vary by device)
        climate: { min: 16, max: 30 }, // Default range, can be overridden per device
        
        // Blind devices (Home Assistant uses 0-100 for position percentage)
        blind: { min: 0, max: 100 } // 0 = closed, 100 = open
    }
};

// ============================================================================
// HOME ASSISTANT API FUNCTIONS
// ============================================================================

/**
 * Send HTTP request to Home Assistant API
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} data - Request data for POST requests
 * @returns {Promise} - Response promise
 */
/**
 * Send HTTP GET request to Home Assistant API
 */
function sendHARequest(endpoint) {
    const url = `${HA_CONFIG.baseUrl}${endpoint}`;
    // console.log(`🌐 GET ${url}`);
    
    return new Promise((resolve, reject) => {
        const requestOptions = {
            url: url,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${HA_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        };
        
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 10000);
        
        http.makeRequest(requestOptions, (error, result) => {
            clearTimeout(timeoutId);
            
            if (error) {
                console.error(`❌ GET request failed:`, error);
                reject(new Error(`HTTP request failed: ${error}`));
            } else {
                const responseData = result || {};
                const statusCode = responseData.statusCode || responseData.status || 200;
                const content = responseData.content || responseData.body || responseData.data || '';
                
                resolve({
                    success: statusCode >= 200 && statusCode < 300,
                    data: {
                        status: statusCode,
                        body: content,
                        headers: responseData.headers || {},
                        statusMessage: responseData.statusMessage || 'OK'
                    }
                });
            }
        });
    });
}

/**
 * Send Home Assistant service call using simplified approach
 * Based on working flic-hub-home-assistant-module from GitHub
 */
function callHAServiceDirect(domain, service, serviceData = {}) {
    const endpoint = `/api/services/${domain}/${service}`;
    const url = `${HA_CONFIG.baseUrl}${endpoint}`;
    
    // console.log(`🔧 Calling ${domain}.${service}`);
    
    return new Promise((resolve, reject) => {
        const jsonData = JSON.stringify(serviceData);
        
        const requestOptions = {
            url: url,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HA_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            content: jsonData
        };
        
        const timeoutId = setTimeout(() => {
            reject(new Error('Service call timeout'));
        }, 10000);
        
        http.makeRequest(requestOptions, (error, result) => {
            clearTimeout(timeoutId);
            
            if (error) {
                console.log(`❌ Service call error: ${error}`);
                reject(new Error(`Service call failed: ${error}`));
                return;
            }
            
            const statusCode = (result && (result.statusCode || result.status)) || 200;
            
            if (statusCode >= 200 && statusCode < 300) {
                // console.log(`✅ ${domain}.${service} successful`);
                resolve({ success: true, statusCode });
            } else {
                console.log(`❌ ${domain}.${service} failed: ${statusCode}`);
                reject(new Error(`Service call failed: ${statusCode}`));
            }
        });
    });
}



/**
 * Get current state of a Home Assistant entity
 * @param {string} entityId - Home Assistant entity ID
 * @returns {Promise<Object>} - Entity state
 */
async function getEntityState(entityId) {
    try {
        const response = await sendHARequest(`${HA_CONFIG.endpoints.states}${entityId}`);
        
        if (response.success) {
            const stateData = JSON.parse(response.data.body);
            return stateData;
        } else {
            throw new Error(`Failed to get state for ${entityId}`);
        }
    } catch (error) {
        console.error(`❌ Error getting state for ${entityId}:`, error);
        throw error;
    }
}

/**
 * Call a Home Assistant service
 * @param {string} domain - Service domain (e.g., 'media_player')
 * @param {string} service - Service name (e.g., 'turn_on')
 * @param {Object} serviceData - Service data
 * @returns {Promise} - Response promise
 */
async function callHAService(domain, service, serviceData = {}) {
    try {
        const result = await callHAServiceDirect(domain, service, serviceData);
        return result;
    } catch (error) {
        console.error(`❌ Error calling ${domain}.${service}:`, error);
        throw error;
    }
}

/**
 * Universal device action handler - reduces repetitive service call patterns
 * @param {Object} device - Device configuration
 * @param {string} domain - HA domain (media_player, light, climate, cover)
 * @param {string} service - HA service name
 * @param {Object} data - Service data
 * @param {string} successMsg - Success message
 * @param {Function} onSuccess - Optional callback after success
 * @returns {Promise} - Service response
 */
async function executeDeviceAction(device, domain, service, data = {}, successMsg = '', onSuccess = null) {
    try {
        const response = await callHAService(domain, service, {
            entity_id: device.entityId,
            ...data
        });
        
        if (response.success) {
            if (successMsg) console.log(`✅ ${device.name} ${successMsg}`);
            if (onSuccess) await onSuccess(device);
            return response;
        } else {
            throw new Error(`Failed to ${service} for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error ${service} for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Set volume for a media device
 */
async function setMediaVolume(deviceId, volume) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    const volumeLevel = volume / 100; // Convert percentage to 0-1 range
    return executeDeviceAction(device, 'media_player', 'volume_set', 
        { volume_level: volumeLevel }, '', () => getCurrentVolumeAndUpdate(device));
}

/**
 * Set power state for a media device
 */
async function setMediaPower(deviceId, powerOn) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    const service = powerOn ? 'turn_on' : 'turn_off';
    return executeDeviceAction(device, 'media_player', service, {}, `power ${powerOn ? 'on' : 'off'}`);
}

/**
 * Set mute state for a media device
 */
async function setMediaMute(deviceId, muted) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    return executeDeviceAction(device, 'media_player', 'volume_mute', 
        { is_volume_muted: muted }, `${muted ? 'muted' : 'unmuted'}`);
}

/**
 * Pause media playback
 */
async function setMediaPause(deviceId) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    return executeDeviceAction(device, 'media_player', 'media_pause', {}, 'playback paused');
}

/**
 * Resume/play media playback
 */
async function setMediaPlay(deviceId) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    return executeDeviceAction(device, 'media_player', 'media_play', {}, 'playback resumed');
}

/**
 * Skip to next track
 */
async function setMediaNextTrack(deviceId) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    return executeDeviceAction(device, 'media_player', 'media_next_track', {}, 'skipped to next track');
}

/**
 * Find a device by ID across all device categories
 * @param {string} deviceId - Device identifier
 * @returns {Object|null} - Device object or null if not found
 */
function findDevice(deviceId) {
    // Search across all device categories
    for (const category of Object.values(HA_CONFIG.devices)) {
        const device = category.find(d => d.id === deviceId);
        if (device) {
            return device;
        }
    }
    return null;
}

// ============================================================================
// COLOR CONVERSION HELPER FUNCTIONS
// ============================================================================

/**
 * Convert RGB values to HSV (Hue, Saturation, Value)
 * @param {number} r - Red component (0-255)
 * @param {number} g - Green component (0-255)
 * @param {number} b - Blue component (0-255)
 * @returns {Object} - HSV object with h (0-1), s (0-1), v (0-1)
 */
function rgbToHsv(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;
    
    if (diff !== 0) {
        switch (max) {
            case r:
                h = ((g - b) / diff) % 6;
                break;
            case g:
                h = (b - r) / diff + 2;
                break;
            case b:
                h = (r - g) / diff + 4;
                break;
        }
    }
    
    h = Math.max(0, h / 6); // Convert to 0-1 range
    
    return { h, s, v };
}

// ============================================================================
// DEBOUNCING SYSTEM FOR TWIST UPDATES
// ============================================================================

// Store pending updates to prevent API flooding
const pendingUpdates = new Map();

// Track expected final states for immediate virtual device updates
const expectedStates = new Map();

// Color memory system - remembers last meaningful color before going white
const colorMemory = new Map();

// Color configuration
const MEANINGFUL_SATURATION_THRESHOLD = 5; // Below 5% saturation is considered essentially white

// Debounce configuration  
const DEBOUNCE_DELAY = 100; // Reduced to 100ms for better responsiveness

/**
 * Debounced device update with immediate virtual device state update
 * @param {string} deviceId - Device identifier
 * @param {string} updateType - Type of update (brightness, color, volume, etc.)
 * @param {Object} updateData - Data to send to Home Assistant
 * @param {Function} updateFunction - Function to call with the final update
 * @param {Function} immediateStateUpdate - Function to immediately update virtual device state
 */
function debouncedDeviceUpdate(deviceId, updateType, updateData, updateFunction, immediateStateUpdate = null) {
    const key = `${deviceId}_${updateType}`;
    
    // Cancel previous timeout for this device/type combination
    if (pendingUpdates.has(key)) {
        clearTimeout(pendingUpdates.get(key).timeoutId);
    }
    
    // Store expected final state for this device/type
    expectedStates.set(key, updateData);
    
    // Immediately update virtual device state if function provided
    if (immediateStateUpdate) {
        try {
            immediateStateUpdate(updateData);
        } catch (error) {
            console.error(`❌ Immediate state update failed for ${deviceId}:`, error);
        }
    }
    
    // Store the update with a new timeout
    const timeoutId = setTimeout(async () => {
        try {
            await updateFunction(updateData);
        } catch (error) {
            console.error(`❌ Debounced update failed for ${deviceId}:`, error);
        } finally {
            // Clean up the pending update and expected state
            pendingUpdates.delete(key);
            expectedStates.delete(key);
        }
    }, DEBOUNCE_DELAY);
    
    // Store the pending update
    pendingUpdates.set(key, {
        timeoutId,
        updateData,
        updateFunction
    });
}

/**
 * Store a meaningful color in memory (when saturation > threshold)  
 * @param {string} deviceId - Device identifier
 * @param {number} hue - Hue value (0-360)
 * @param {number} saturation - Saturation value (0-100)
 */
function rememberColor(deviceId, hue, saturation) {
    if (saturation > MEANINGFUL_SATURATION_THRESHOLD) {  // Only remember truly meaningful colors
        colorMemory.set(deviceId, { hue, saturation });
    }
}

/**
 * Get remembered color for a device, or fallback values
 * @param {string} deviceId - Device identifier
 * @param {number} fallbackHue - Fallback hue if no memory (default: 0)
 * @param {number} fallbackSat - Fallback saturation if no memory (default: 100)
 * @returns {Object} - {hue, saturation}
 */
function getRememberedColor(deviceId, fallbackHue = 0, fallbackSat = 100) {
    const remembered = colorMemory.get(deviceId);
    if (remembered) {
        return remembered;
    } else {
        return { hue: fallbackHue, saturation: fallbackSat };
    }
}

// ============================================================================
// LIGHT CONTROL FUNCTIONS
// ============================================================================

/**
 * Set brightness for a light device
 * @param {string} deviceId - Device identifier
 * @param {number} brightness - Brightness level (0-255)
 * @returns {Promise} - Response promise
 */
async function setLightBrightness(deviceId, brightness) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    const clampedBrightness = Math.max(0, Math.min(255, Math.round(brightness)));
    return executeDeviceAction(device, 'light', 'turn_on', 
        { brightness: clampedBrightness }, `brightness set to ${clampedBrightness}`,
        () => getCurrentBrightnessAndUpdate(device));
}

/**
 * Set power state for a light device
 */
async function setLightPower(deviceId, powerOn) {
    const device = findDevice(deviceId);
    if (!device) throw new Error(`Device ${deviceId} not found`);
    
    const service = powerOn ? 'turn_on' : 'turn_off';
    return executeDeviceAction(device, 'light', service, {}, 
        `turned ${powerOn ? 'on' : 'off'}`, () => getCurrentBrightnessAndUpdate(device));
}

/**
 * Set color for a color light device
 * @param {string} deviceId - Device identifier
 * @param {Array} rgbColor - RGB color array [r, g, b] (0-255 each)
 * @returns {Promise} - Response promise
 */
async function setLightColor(deviceId, rgbColor) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'color_light') {
        throw new Error(`Color light device ${deviceId} not found`);
    }
    
    // Validate RGB values
    const [r, g, b] = rgbColor.map(c => Math.max(0, Math.min(255, Math.round(c))));
    
    try {
        const response = await callHAService('light', 'turn_on', {
            entity_id: device.entityId,
            rgb_color: [r, g, b]
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} color set to RGB(${r}, ${g}, ${b})`);
            
            // Remember this color immediately (convert RGB to HSV for memory)
            const hsv = rgbToHsv(r, g, b);
            const hue360 = hsv.h * 360;
            const sat100 = hsv.s * 100;
            // rememberColor() function will check if saturation is meaningful
            rememberColor(deviceId, hue360, sat100);
            
            // Wait a moment for Home Assistant to update the state
            await new Promise(resolve => setTimeout(resolve, 100));
            // Update virtual device state
            await getCurrentBrightnessAndUpdate(device);
            return response;
        } else {
            throw new Error(`Failed to set color for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error setting color for ${device.name}:`, error);
        throw error;
    }
}

// ============================================================================
// CLIMATE CONTROL FUNCTIONS
// ============================================================================

/**
 * Set temperature for a climate device
 * @param {string} deviceId - Device identifier
 * @param {number} temperature - Target temperature in °C
 * @returns {Promise} - Response promise
 */
async function setClimateTemperature(deviceId, temperature) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'climate') {
        throw new Error(`Climate device ${deviceId} not found`);
    }
    
    // Use device-specific temperature range or default
    const tempRange = device.tempRange || HA_CONFIG.valueRanges.climate;
    const clampedTemp = Math.max(tempRange.min, Math.min(tempRange.max, Math.round(temperature * 10) / 10));
    
    try {
        const response = await callHAService('climate', 'set_temperature', {
            entity_id: device.entityId,
            temperature: clampedTemp
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} temperature set to ${clampedTemp}°C`);
            // Update virtual device state
            await getCurrentTemperatureAndUpdate(device);
            return response;
        } else {
            throw new Error(`Failed to set temperature for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error setting temperature for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Set HVAC mode for a climate device
 * @param {string} deviceId - Device identifier
 * @param {string} mode - HVAC mode ('heat', 'cool', 'auto', 'off', etc.)
 * @returns {Promise} - Response promise
 */
async function setClimateMode(deviceId, mode) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'climate') {
        throw new Error(`Climate device ${deviceId} not found`);
    }
    
    try {
        const response = await callHAService('climate', 'set_hvac_mode', {
            entity_id: device.entityId,
            hvac_mode: mode
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} HVAC mode set to ${mode}`);
            return response;
        } else {
            throw new Error(`Failed to set HVAC mode for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error setting HVAC mode for ${device.name}:`, error);
        throw error;
    }
}

// ============================================================================
// BLIND CONTROL FUNCTIONS
// ============================================================================

/**
 * Set position for a blind/cover device
 * @param {string} deviceId - Device identifier
 * @param {number} position - Position percentage (0-100, 0=closed, 100=open)
 * @returns {Promise} - Response promise
 */
async function setBlindPosition(deviceId, position) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        throw new Error(`Blind device ${deviceId} not found`);
    }
    
    // Clamp position to valid range
    const clampedPosition = Math.max(0, Math.min(100, Math.round(position)));
    try {
        const response = await callHAService('cover', 'set_cover_position', {
            entity_id: device.entityId,
            position: clampedPosition
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} position set to ${clampedPosition}%`);
            // Update virtual device state
            await getCurrentBlindPositionAndUpdate(device);
            return response;
        } else {
            throw new Error(`Failed to set position for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error setting position for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Open a blind/cover device
 * @param {string} deviceId - Device identifier
 * @returns {Promise} - Response promise
 */
async function setBlindOpen(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        throw new Error(`Blind device ${deviceId} not found`);
    }
    
    try {
        const response = await callHAService('cover', 'open_cover', {
            entity_id: device.entityId
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} opened`);
            // Update virtual device state
            setTimeout(() => getCurrentBlindPositionAndUpdate(device), 1000); // Delay to allow movement
            return response;
        } else {
            throw new Error(`Failed to open ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error opening ${device.name}:`, error);
        throw error;
    }
}

/**
 * Close a blind/cover device
 * @param {string} deviceId - Device identifier
 * @returns {Promise} - Response promise
 */
async function setBlindClose(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        throw new Error(`Blind device ${deviceId} not found`);
    }
    
    try {
        const response = await callHAService('cover', 'close_cover', {
            entity_id: device.entityId
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} closed`);
            // Update virtual device state
            setTimeout(() => getCurrentBlindPositionAndUpdate(device), 1000); // Delay to allow movement
            return response;
        } else {
            throw new Error(`Failed to close ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error closing ${device.name}:`, error);
        throw error;
    }
}

/**
 * Stop a blind/cover device
 * @param {string} deviceId - Device identifier
 * @returns {Promise} - Response promise
 */
async function setBlindStop(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        throw new Error(`Blind device ${deviceId} not found`);
    }
    
    try {
        const response = await callHAService('cover', 'stop_cover', {
            entity_id: device.entityId
        });
        
        if (response.success) {
            // console.log(`✅ ${device.name} stopped`);
            return response;
        } else {
            throw new Error(`Failed to stop ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error stopping ${device.name}:`, error);
        throw error;
    }
}

/**
 * Get current playback state of a media device
 * @param {string} deviceId - Device identifier
 * @returns {Promise<string>} - Current state ('playing', 'paused', 'idle', 'off', etc.)
 */
async function getMediaPlaybackState(deviceId) {
    const device = findDevice(deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    try {
        const stateData = await getEntityState(device.entityId);
        return stateData.state;
    } catch (error) {
        console.error(`❌ Error getting playback state for ${device.name}:`, error);
        throw error;
    }
}

// ============================================================================
// FLIC APP MODULE INTEGRATION
// ============================================================================

// Track last playback command timestamp for cooldown
let lastPlaybackCommandTime = 0;
const PLAYBACK_COOLDOWN_MS = 2500; // 2.5 seconds

// Action mapping for simplified command handling (defined after handlers)
let ACTION_HANDLERS;

// Handle action messages from Flic app
flicApp.on('actionMessage', async (message) => {
    console.log('Received action message:', message);
    
    // Parse device-specific commands: "{device-id} {action}"
    const parts = message.toLowerCase().split(' ');
    if (parts.length >= 2) {
        const deviceId = parts[0];
        const action = parts.slice(1).join(' ');
        
        // Find the device by device ID
        const device = findDevice(deviceId);
        if (!device) {
            console.log(`Unknown device: ${deviceId}`);
            return;
        }
        
        try {
            // Use action mapping for simplified handling
            const handler = ACTION_HANDLERS[action];
            if (handler) {
                await handler(deviceId);
            } else {
                console.log(`Unknown action for device ${deviceId}: ${action}`);
            }
        } catch (error) {
            console.error(`❌ Error executing action "${action}" for device ${deviceId}:`, error);
        }
    } else {
        console.log('Invalid action message format. Expected: "{device-id} {action}"');
    }
});

// Handle virtual device updates from Flic Twist controllers
flicApp.on('virtualDeviceUpdate', async (metaData, values) => {
    const device = findDevice(metaData.virtualDeviceId);
    if (!device) {
        console.error(`❌ Device not found: ${metaData.virtualDeviceId}`);
        return;
    }
    
    try {
        if (metaData.dimmableType === 'Speaker') {
            // Handle media devices (Speaker virtual devices)
            if (device.type === 'playback') {
                await handlePlaybackDeviceUpdate(metaData.virtualDeviceId, values);
            } else if (device.type === 'media_player') {
                await handleMediaDeviceUpdate(metaData.virtualDeviceId, values);
            }
        } else if (metaData.dimmableType === 'Light') {
            // Handle light devices (Light virtual devices)
            if (device.type === 'light' || device.type === 'color_light') {
                await handleLightDeviceUpdate(metaData.virtualDeviceId, values);
            }
        } else if (metaData.dimmableType === 'Blind') {
            // Handle climate and blind devices (both use Blind virtual devices with position)
            if (device.type === 'climate') {
                await handleClimateDeviceUpdate(metaData.virtualDeviceId, values);
            } else if (device.type === 'blind') {
                await handleBlindDeviceUpdate(metaData.virtualDeviceId, values);
            }
        }
    } catch (error) {
        console.error(`❌ Error handling virtual device update for ${device.name}:`, error);
    }
});

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Generic volume adjustment with cooldown protection
 */
async function adjustDeviceVolume(deviceId, delta) {
    // Check cooldown
    const currentTime = Date.now();
    const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
    
    if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
        // console.log(`⏳ Volume ${delta > 0 ? 'up' : 'down'} ignored - cooldown active (${remainingCooldown}s remaining)`);
        return;
    }
    
    const device = findDevice(deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        const stateData = await getEntityState(device.entityId);
        const currentVolume = stateData.attributes.volume_level * 100;
        const newVolume = Math.max(0, Math.min(100, currentVolume + delta));
        
        await setMediaVolume(deviceId, newVolume);
    } catch (error) {
        console.error(`❌ Error adjusting volume for ${device.name}:`, error);
    }
}

/**
 * Handle mute toggle for specific device
 */
async function handleDeviceMuteToggle(deviceId) {
    const device = findDevice(deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current mute status
        const stateData = await getEntityState(device.entityId);
        const isCurrentlyMuted = stateData.attributes.is_volume_muted;
        
        // Toggle mute status
        const newMuteState = !isCurrentlyMuted;
        await setMediaMute(deviceId, newMuteState);
        
        // console.log(`✅ ${device.name} ${newMuteState ? 'muted' : 'unmuted'}`);
    } catch (error) {
        console.error(`❌ Error toggling mute for ${device.name}:`, error);
    }
}

/**
 * Handle power toggle for specific device (works with all device types)
 */
async function handleDevicePowerToggle(deviceId) {
    const device = findDevice(deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current power status
        const stateData = await getEntityState(device.entityId);
        const isCurrentlyOn = stateData.state === 'on';
        
        // Toggle power status based on device type
        const newPowerState = !isCurrentlyOn;
        
        if (device.type === 'media_player') {
            await setMediaPower(deviceId, newPowerState);
        } else if (device.type === 'light' || device.type === 'color_light') {
            await setLightPower(deviceId, newPowerState);
        } else if (device.type === 'climate') {
            // For climate devices, use HVAC mode instead of power
            await setClimateMode(deviceId, newPowerState ? 'auto' : 'off');
        } else if (device.type === 'blind') {
            // For blind devices, open/close instead of power
            if (newPowerState) {
                await setBlindOpen(deviceId);
            } else {
                await setBlindClose(deviceId);
            }
        }
        
        // console.log(`✅ ${device.name} turned ${newPowerState ? 'on' : 'off'}`);
    } catch (error) {
        console.error(`❌ Error toggling power for ${device.name}:`, error);
    }
}

/**
 * Handle power on for specific device (works with all device types)
 */
async function handleDevicePowerOn(deviceId) {
    const device = findDevice(deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        if (device.type === 'media_player') {
            await setMediaPower(deviceId, true);
        } else if (device.type === 'light' || device.type === 'color_light') {
            await setLightPower(deviceId, true);
        } else if (device.type === 'climate') {
            await setClimateMode(deviceId, 'auto');
        } else if (device.type === 'blind') {
            await setBlindOpen(deviceId);
        }
        // console.log(`✅ ${device.name} turned on`);
    } catch (error) {
        console.error(`❌ Error turning on ${device.name}:`, error);
    }
}

/**
 * Handle power off for specific device (works with all device types)
 */
async function handleDevicePowerOff(deviceId) {
    const device = findDevice(deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        if (device.type === 'media_player') {
            await setMediaPower(deviceId, false);
        } else if (device.type === 'light' || device.type === 'color_light') {
            await setLightPower(deviceId, false);
        } else if (device.type === 'climate') {
            await setClimateMode(deviceId, 'off');
        } else if (device.type === 'blind') {
            await setBlindClose(deviceId);
        }
        // console.log(`✅ ${device.name} turned off`);
    } catch (error) {
        console.error(`❌ Error turning off ${device.name}:`, error);
    }
}

// ============================================================================
// LIGHT ACTION HANDLERS
// ============================================================================

/**
 * Handle brightness up for light devices
 */
async function handleDeviceBrightnessUp(deviceId) {
    const device = findDevice(deviceId);
    if (!device || (device.type !== 'light' && device.type !== 'color_light')) {
        console.error(`Light device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current brightness
        const currentBrightness = await getCurrentBrightnessAndUpdate(device);
        const newBrightness = Math.min(255, (currentBrightness || 0) + 25); // Increase by ~10%
        
        await setLightBrightness(deviceId, newBrightness);
    } catch (error) {
        console.error(`❌ Error increasing brightness for ${device.name}:`, error);
    }
}

/**
 * Handle brightness down for light devices
 */
async function handleDeviceBrightnessDown(deviceId) {
    const device = findDevice(deviceId);
    if (!device || (device.type !== 'light' && device.type !== 'color_light')) {
        console.error(`Light device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current brightness
        const currentBrightness = await getCurrentBrightnessAndUpdate(device);
        const newBrightness = Math.max(0, (currentBrightness || 0) - 25); // Decrease by ~10%
        
        if (newBrightness === 0) {
            await setLightPower(deviceId, false);
        } else {
            await setLightBrightness(deviceId, newBrightness);
        }
    } catch (error) {
        console.error(`❌ Error decreasing brightness for ${device.name}:`, error);
    }
}

/**
 * Handle set bright for light devices (100% brightness)
 */
async function handleDeviceSetBright(deviceId) {
    const device = findDevice(deviceId);
    if (!device || (device.type !== 'light' && device.type !== 'color_light')) {
        console.error(`Light device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setLightBrightness(deviceId, 255); // 100% brightness
    } catch (error) {
        console.error(`❌ Error setting bright for ${device.name}:`, error);
    }
}

/**
 * Handle set dim for light devices (20% brightness)
 */
async function handleDeviceSetDim(deviceId) {
    const device = findDevice(deviceId);
    if (!device || (device.type !== 'light' && device.type !== 'color_light')) {
        console.error(`Light device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setLightBrightness(deviceId, 51); // ~20% brightness
    } catch (error) {
        console.error(`❌ Error setting dim for ${device.name}:`, error);
    }
}

// ============================================================================
// CLIMATE ACTION HANDLERS
// ============================================================================

/**
 * Handle temperature up for climate devices
 */
async function handleDeviceTemperatureUp(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'climate') {
        console.error(`Climate device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current temperature
        const currentTemp = await getCurrentTemperatureAndUpdate(device);
        const newTemp = (currentTemp || 20) + 1; // Increase by 1°C
        
        await setClimateTemperature(deviceId, newTemp);
    } catch (error) {
        console.error(`❌ Error increasing temperature for ${device.name}:`, error);
    }
}

/**
 * Handle temperature down for climate devices
 */
async function handleDeviceTemperatureDown(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'climate') {
        console.error(`Climate device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current temperature
        const currentTemp = await getCurrentTemperatureAndUpdate(device);
        const newTemp = (currentTemp || 20) - 1; // Decrease by 1°C
        
        await setClimateTemperature(deviceId, newTemp);
    } catch (error) {
        console.error(`❌ Error decreasing temperature for ${device.name}:`, error);
    }
}

/**
 * Handle HVAC mode setting for climate devices
 */
async function handleDeviceSetMode(deviceId, mode) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'climate') {
        console.error(`Climate device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setClimateMode(deviceId, mode);
    } catch (error) {
        console.error(`❌ Error setting mode for ${device.name}:`, error);
    }
}

// ============================================================================
// BLIND ACTION HANDLERS
// ============================================================================

/**
 * Handle open for blind devices
 */
async function handleDeviceBlindOpen(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        console.error(`Blind device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setBlindOpen(deviceId);
    } catch (error) {
        console.error(`❌ Error opening ${device.name}:`, error);
    }
}

/**
 * Handle close for blind devices
 */
async function handleDeviceBlindClose(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        console.error(`Blind device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setBlindClose(deviceId);
    } catch (error) {
        console.error(`❌ Error closing ${device.name}:`, error);
    }
}

/**
 * Handle stop for blind devices
 */
async function handleDeviceBlindStop(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        console.error(`Blind device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setBlindStop(deviceId);
    } catch (error) {
        console.error(`❌ Error stopping ${device.name}:`, error);
    }
}

/**
 * Handle position up for blind devices (increase by 10%)
 */
async function handleDeviceBlindUp(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        console.error(`Blind device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current position
        const currentPosition = await getCurrentBlindPositionAndUpdate(device);
        const newPosition = Math.min(100, (currentPosition || 0) + 10); // Increase by 10%
        
        await setBlindPosition(deviceId, newPosition);
    } catch (error) {
        console.error(`❌ Error moving up ${device.name}:`, error);
    }
}

/**
 * Handle position down for blind devices (decrease by 10%)
 */
async function handleDeviceBlindDown(deviceId) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'blind') {
        console.error(`Blind device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current position
        const currentPosition = await getCurrentBlindPositionAndUpdate(device);
        const newPosition = Math.max(0, (currentPosition || 0) - 10); // Decrease by 10%
        
        await setBlindPosition(deviceId, newPosition);
    } catch (error) {
        console.error(`❌ Error moving down ${device.name}:`, error);
    }
}

// Initialize ACTION_HANDLERS after all handler functions are defined
ACTION_HANDLERS = {
    // Media device actions
    'volume up': deviceId => adjustDeviceVolume(deviceId, 10),
    'volume down': deviceId => adjustDeviceVolume(deviceId, -10),
    'mute': handleDeviceMuteToggle,
    
    // Light device actions
    'brightness up': handleDeviceBrightnessUp,
    'brightness down': handleDeviceBrightnessDown,
    'bright': handleDeviceSetBright,
    'dim': handleDeviceSetDim,
    
    // Climate device actions
    'temp up': handleDeviceTemperatureUp,
    'temp down': handleDeviceTemperatureDown,
    'heat': deviceId => handleDeviceSetMode(deviceId, 'heat'),
    'cool': deviceId => handleDeviceSetMode(deviceId, 'cool'),
    'auto': deviceId => handleDeviceSetMode(deviceId, 'auto'),
    
    // Blind device actions
    'open': handleDeviceBlindOpen,
    'close': handleDeviceBlindClose,
    'stop': handleDeviceBlindStop,
    'position up': handleDeviceBlindUp,
    'position down': handleDeviceBlindDown,
    
    // Universal device actions
    'power': handleDevicePowerToggle,
    'on': handleDevicePowerOn,
    'off': handleDevicePowerOff
};

// ============================================================================
// DEVICE UPDATE HANDLERS
// ============================================================================

/**
 * Handle media device updates for volume control
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist
 */
/**
 * Handle playback device updates for playback control
 */
async function handlePlaybackDeviceUpdate(deviceId, values) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'playback') {
        return;
    }
    
    const volumeChange = values.volume - 0.5; // 0.5 is the center position
    const isPlaybackCommand = Math.abs(volumeChange) > 0.1; // Threshold to detect intentional movement
    
    if (isPlaybackCommand) {
        // Check cooldown
        const currentTime = Date.now();
        const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
        
        if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
            const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
            //console.log(`⏳ Playback command ignored - cooldown active (${remainingCooldown}s remaining)`);
            
            // Reset playback device to center position
            flicApp.virtualDeviceUpdateState('Speaker', deviceId, {
                volume: 0.5
            });
            return;
        }
        
        // Playback control based on twist direction
        try {
            if (volumeChange < 0) {
                // Twist down/left = Pause
                await setMediaPause(deviceId);
            } else if (volumeChange > 0) {
                // Twist up/right = Smart play/skip logic
                const currentState = await getMediaPlaybackState(deviceId);
                //console.log(`📊 Current playback state: ${currentState}`);
                
                if (currentState === 'paused') {
                    // If paused, resume playback
                    await setMediaPlay(deviceId);
                } else if (currentState === 'playing') {
                    // If playing, skip to next track
                    await setMediaNextTrack(deviceId);
                } else {
                    // For other states (idle, off, etc.), try to start playback
                    //console.log(`📱 Device in ${currentState} state, attempting to start playback`);
                    await setMediaPlay(deviceId);
                }
            }
        } catch (error) {
            console.error(`❌ Error executing playback command for ${device.name}:`, error);
        }
        
        // Update cooldown
        lastPlaybackCommandTime = currentTime;
    }
    
    // Reset playback device to center position
    flicApp.virtualDeviceUpdateState('Speaker', deviceId, {
        volume: 0.5
    });
}

async function handleMediaDeviceUpdate(deviceId, values) {
    if (values.volume !== undefined) {
        // Check cooldown
        const currentTime = Date.now();
        const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
        
        if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
            const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
            //console.log(`⏳ Volume change ignored - cooldown active (${remainingCooldown}s remaining)`);
            return;
        }
        
        const volumePercentage = Math.round(values.volume * 100);
        
        // Debounce volume changes to prevent API flooding, but immediately update virtual device
        debouncedDeviceUpdate(
            deviceId, 
            'volume', 
            volumePercentage, 
            // Debounced function - calls HA after delay
            async (finalVolume) => {
                try {
                    await setMediaVolume(deviceId, finalVolume);
                } catch (error) {
                    console.error(`❌ Failed to update media device ${deviceId}:`, error);
                }
            },
            // Immediate state update - updates virtual device instantly
            (expectedVolume) => {
                flicApp.virtualDeviceUpdateState('Speaker', deviceId, {
                    volume: expectedVolume / 100
                });
            }
        );
    }
}

/**
 * Handle light device updates from Flic Twist controllers (with debouncing)
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist (brightness, hue, saturation, colorTemperature: all 0-1)
 */
async function handleLightDeviceUpdate(deviceId, values) {
    const device = findDevice(deviceId);
    if (!device) return;
    
    // Handle brightness changes with debouncing
    if (values.brightness !== undefined) {
        const brightness = Math.round(values.brightness * 255);
        
        if (brightness === 0) {
            // Immediate power off - don't debounce this
            try {
                await setLightPower(deviceId, false);
            } catch (error) {
                console.error(`❌ Failed to turn off light ${deviceId}:`, error);
            }
            return; // Exit early if turning off
        } else {
            // Debounce brightness changes but immediately update virtual device state
            debouncedDeviceUpdate(
                deviceId, 
                'brightness', 
                brightness,
                // Debounced function - calls HA after delay  
                async (finalBrightness) => {
                    try {
                        await setLightBrightness(deviceId, finalBrightness);
                    } catch (error) {
                        console.error(`❌ Failed to set brightness for ${deviceId}:`, error);
                    }
                },
                // Immediate state update - updates virtual device instantly
                (expectedBrightness) => {
                    // Get current virtual device state to preserve other properties
                    const currentState = {
                        brightness: expectedBrightness / 255,
                        hue: values.hue || 0,
                        saturation: values.saturation || 0,
                        colorTemperature: values.colorTemperature || 0.5
                    };
                    flicApp.virtualDeviceUpdateState('Light', deviceId, currentState);
                }
            );
        }
    }
    
    // Handle color changes (for color_light devices) with debouncing
    if (device.type === 'color_light') {
        // Store the current values for debounced update
        const colorUpdate = {
            hue: values.hue,
            saturation: values.saturation,
            colorTemperature: values.colorTemperature
        };
        
        // Debounce color changes (hue and saturation together)
        if (values.hue !== undefined || values.saturation !== undefined) {
            debouncedDeviceUpdate(deviceId, 'color', colorUpdate, async (finalColorUpdate) => {
                try {
                    await applyColorUpdate(deviceId, finalColorUpdate);
                } catch (error) {
                    console.error(`❌ Failed to update color for ${deviceId}:`, error);
                }
            });
        }
        
        // Debounce color temperature changes separately
        if (values.colorTemperature !== undefined) {
            debouncedDeviceUpdate(deviceId, 'colortemp', values.colorTemperature, async (finalColorTemp) => {
                try {
                    await applyColorTemperatureUpdate(deviceId, finalColorTemp);
                } catch (error) {
                    console.error(`❌ Failed to update color temperature for ${deviceId}:`, error);
                }
            });
        }
    }
}

/**
 * Apply color update to Home Assistant (used by debouncer) with color memory
 * @param {string} deviceId - Device identifier
 * @param {Object} colorUpdate - Color update data {hue, saturation}
 */
async function applyColorUpdate(deviceId, colorUpdate) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'color_light') return;
    
    // Get current state to preserve existing color values
    const currentState = await getEntityState(device.entityId);
    let currentHue = 0;    // Default fallback
    let currentSat = 100;  // Default fallback (full saturation, not white)
    
    if (currentState.attributes.hs_color) {
        [currentHue, currentSat] = currentState.attributes.hs_color;
        // Remember current color if it's meaningful
        rememberColor(deviceId, currentHue, currentSat);
    }
    
    // Start with current color values, then update what changed
    let finalHue = currentHue;
    let finalSat = currentSat;
    
    // Handle hue changes
    if (colorUpdate.hue !== undefined) {
        finalHue = Math.round(colorUpdate.hue * 360);

    }
    
    // Handle saturation changes with color memory logic
    if (colorUpdate.saturation !== undefined) {
        const newSat = Math.round(colorUpdate.saturation * 100);
        
        // Special case: if current saturation is essentially white and we're increasing to meaningful saturation
        if (currentSat <= MEANINGFUL_SATURATION_THRESHOLD && newSat > MEANINGFUL_SATURATION_THRESHOLD) {
            // Use remembered hue instead of current hue (which might be meaningless)
            const remembered = getRememberedColor(deviceId, finalHue, newSat);
            if (colorUpdate.hue === undefined) { // Only use remembered hue if hue wasn't explicitly changed
                finalHue = remembered.hue;
                //console.log(`🎨 Restoring from white: using remembered hue ${finalHue}° instead of current ${currentHue}° (current sat ${currentSat}% <= ${MEANINGFUL_SATURATION_THRESHOLD}%)`);
            }
        }
        
        finalSat = newSat;

    }
    
    // Remember the final color if it's meaningful
    // rememberColor() function will check if saturation is meaningful
    rememberColor(deviceId, finalHue, finalSat);
    
    const colorData = {
        hs_color: [finalHue, finalSat]
    };
    
    await callHAService('light', 'turn_on', {
        entity_id: device.entityId,
        ...colorData
    });
    
    //console.log(`✅ ${device.name} color updated (debounced)`);
    
    // Wait a moment for Home Assistant to update the state
    await new Promise(resolve => setTimeout(resolve, 100));
    // Update virtual device state to reflect changes
    await getCurrentBrightnessAndUpdate(device);
}

/**
 * Apply color temperature update to Home Assistant (used by debouncer)
 * @param {string} deviceId - Device identifier
 * @param {number} colorTemperature - Color temperature (0-1)
 */
async function applyColorTemperatureUpdate(deviceId, colorTemperature) {
    const device = findDevice(deviceId);
    if (!device || device.type !== 'color_light') return;
    
    // Convert 0-1 to typical mireds range (154-500, warm to cool)
    const mireds = Math.round(154 + (colorTemperature * (500 - 154)));
    await callHAService('light', 'turn_on', {
        entity_id: device.entityId,
        color_temp: mireds
    });
    
    //console.log(`✅ ${device.name} color temperature updated (debounced)`);
    
    // Wait a moment for Home Assistant to update the state
    await new Promise(resolve => setTimeout(resolve, 100));
    // Update virtual device state to reflect changes
    await getCurrentBrightnessAndUpdate(device);
}

/**
 * Handle climate device updates from Flic Twist controllers  
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist (position: 0-1 mapped to temperature)
 */
async function handleClimateDeviceUpdate(deviceId, values) {
    if (values.position !== undefined) {
        const device = findDevice(deviceId);
        if (!device) return;
        
        // Use device-specific temperature range or default
        const tempRange = device.tempRange || HA_CONFIG.valueRanges.climate;
        
        // Convert position (0-1) to temperature range
        const temperature = tempRange.min + (values.position * (tempRange.max - tempRange.min));
        const roundedTemp = Math.round(temperature * 10) / 10; // Round to 1 decimal place
        
        // Debounce temperature changes but immediately update virtual device state
        debouncedDeviceUpdate(
            deviceId, 
            'temperature', 
            roundedTemp,
            // Debounced function - calls HA after delay
            async (finalTemp) => {
                try {
                    await setClimateTemperature(deviceId, finalTemp);
                } catch (error) {
                    console.error(`❌ Failed to update climate device ${deviceId}:`, error);
                }
            },
            // Immediate state update - updates virtual device instantly
            (expectedTemp) => {
                const tempRange = device.tempRange || HA_CONFIG.valueRanges.climate;
                const normalizedTemp = (expectedTemp - tempRange.min) / (tempRange.max - tempRange.min);
                flicApp.virtualDeviceUpdateState('Blind', deviceId, {
                    position: Math.max(0, Math.min(1, normalizedTemp))
                });
            }
        );
    }
}

/**
 * Handle blind device updates from Flic Twist controllers
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist (position: 0-1 mapped to blind position)
 */
async function handleBlindDeviceUpdate(deviceId, values) {
    if (values.position !== undefined) {
        // Convert position from 0-1 to 0-100 percentage for Home Assistant
        const blindPosition = Math.round(values.position * 100);
        
        // Debounce blind position changes but immediately update virtual device state
        debouncedDeviceUpdate(
            deviceId, 
            'position', 
            blindPosition,
            // Debounced function - calls HA after delay
            async (finalPosition) => {
                try {
                    await setBlindPosition(deviceId, finalPosition);
                } catch (error) {
                    console.error(`❌ Failed to update blind device ${deviceId}:`, error);
                }
            },
            // Immediate state update - updates virtual device instantly
            (expectedPosition) => {
                flicApp.virtualDeviceUpdateState('Blind', deviceId, {
                    position: expectedPosition / 100
                });
            }
        );
    }
}

// ============================================================================
// VIRTUAL DEVICE STATE MANAGEMENT
// ============================================================================

/**
 * Get current volume from Home Assistant device and update virtual device state
 * @param {Object} device - Device configuration
 * @returns {Promise<number>} - Current volume percentage
 */
async function getCurrentVolumeAndUpdate(device) {
    try {
        const stateData = await getEntityState(device.entityId);
        const currentVolume = stateData.attributes.volume_level * 100; // Convert to percentage
        
        // Update virtual device state
        flicApp.virtualDeviceUpdateState('Speaker', device.id, {
            volume: currentVolume / 100
        });
        
        return currentVolume;
    } catch (error) {
        console.error(`❌ Error getting current volume for ${device.name}:`, error);
        return null;
    }
}

/**
 * Get current brightness from Home Assistant light device and update virtual device state
 * @param {Object} device - Device configuration
 * @returns {Promise<number>} - Current brightness (0-255)
 */
async function getCurrentBrightnessAndUpdate(device) {
    try {
        const stateData = await getEntityState(device.entityId);
        
        let brightness = 0;
        if (stateData.state === 'on' && stateData.attributes.brightness !== undefined) {
            brightness = stateData.attributes.brightness; // 0-255
        }
        
        // Prepare state update for Light virtual device with all required properties
        const lightState = {
            brightness: Math.max(0, Math.min(1, brightness / 255)) // Ensure 0-1 range
        };
        
        // Handle color information based on device type
        if (device.type === 'color_light') {

            
            // Handle hue and saturation from HS color
            if (stateData.attributes.hs_color) {
                const [hue, saturation] = stateData.attributes.hs_color;
                lightState.hue = Math.max(0, Math.min(1, hue / 360)); // Convert 0-360 to 0-1
                lightState.saturation = Math.max(0, Math.min(1, saturation / 100)); // Convert 0-100 to 0-1
                // Remember this color if it's meaningful
                rememberColor(device.id, hue, saturation);
            } else if (stateData.attributes.rgb_color) {
                // Convert RGB to HSV if HS not available
                const [r, g, b] = stateData.attributes.rgb_color;
                const hsv = rgbToHsv(r, g, b);
                lightState.hue = hsv.h;
                lightState.saturation = hsv.s;
                // Remember this color if it's meaningful
                const hue360 = hsv.h * 360;
                const sat100 = hsv.s * 100;
                rememberColor(device.id, hue360, sat100);
            } else {
                // No color information available - use neutral defaults
                // For color lights without color data, use white (like a regular light)
                lightState.hue = 0.0;        // Red hue
                lightState.saturation = 0.0;  // No saturation = white light

            }
            
            // Handle color temperature (only for color_light devices)
            if (stateData.attributes.color_temp) {
                const mireds = stateData.attributes.color_temp;
                // Convert mireds range (154-500) to 0-1, clamped
                lightState.colorTemperature = Math.max(0, Math.min(1, (mireds - 154) / (500 - 154)));

            } else {
                // Default color temperature (middle of range - neutral white)
                lightState.colorTemperature = 0.5;
            }
        } else {
            // Regular lights - use white light defaults
            lightState.hue = 0.0;        // Red hue (but with 0 saturation = white)
            lightState.saturation = 0.0;  // No saturation = white light
        }
        
        // Update virtual device state with all required properties
        flicApp.virtualDeviceUpdateState('Light', device.id, lightState);
        
        return brightness;
    } catch (error) {
        console.error(`❌ Error getting current brightness for ${device.name}:`, error);
        return null;
    }
}

/**
 * Get current temperature from Home Assistant climate device and update virtual device state
 * @param {Object} device - Device configuration  
 * @returns {Promise<number>} - Current target temperature in °C
 */
async function getCurrentTemperatureAndUpdate(device) {
    try {
        const stateData = await getEntityState(device.entityId);
        
        // Get current target temperature
        const targetTemp = stateData.attributes.temperature || 20; // Default to 20°C
        
        // Use device-specific temperature range or default
        const tempRange = device.tempRange || HA_CONFIG.valueRanges.climate;
        
        // Convert temperature to 0-1 range for virtual device
        const normalizedTemp = (targetTemp - tempRange.min) / (tempRange.max - tempRange.min);
        
        // Update virtual device state (Blind uses 0-1 range for position)
        flicApp.virtualDeviceUpdateState('Blind', device.id, {
            position: Math.max(0, Math.min(1, normalizedTemp))
        });
        
        return targetTemp;
    } catch (error) {
        console.error(`❌ Error getting current temperature for ${device.name}:`, error);
        return null;
    }
}

/**
 * Get current position from Home Assistant blind/cover device and update virtual device state
 * @param {Object} device - Device configuration
 * @returns {Promise<number>} - Current position percentage (0-100)
 */
async function getCurrentBlindPositionAndUpdate(device) {
    try {
        const stateData = await getEntityState(device.entityId);
        
        // Get current position (0-100 percentage)
        let position = 0;
        if (stateData.attributes.current_position !== undefined) {
            position = stateData.attributes.current_position;
        } else if (stateData.state === 'open') {
            position = 100;
        } else if (stateData.state === 'closed') {
            position = 0;
        }
        
        // Update virtual device state (Blind uses 0-1 range for position)
        flicApp.virtualDeviceUpdateState('Blind', device.id, {
            position: position / 100
        });
        
        return position;
    } catch (error) {
        console.error(`❌ Error getting current position for ${device.name}:`, error);
        return null;
    }
}

// Device type to virtual device type mapping
const VIRTUAL_DEVICE_TYPES = {
    'media_player': 'Speaker',
    'playback': 'Speaker',
    'light': 'Light',
    'color_light': 'Light',
    'climate': 'Blind',
    'blind': 'Blind'
};

/**
 * Create virtual devices for Flic Twist integration
 */
function createVirtualDevices() {
    console.log('🎛️ Creating virtual devices...');
    
    Object.values(HA_CONFIG.devices).flat().forEach(device => {
        const virtualDeviceType = VIRTUAL_DEVICE_TYPES[device.type] || 'Speaker';
        flicApp.createVirtualDevice(device.id, virtualDeviceType, device.name);
        console.log(`✅ Created virtual device: ${device.name} (${virtualDeviceType})`);
    });
}

/**
 * Initialize virtual device states with current Home Assistant volumes
 */
async function initializeVirtualDeviceStates() {
    console.log('🔄 Initializing virtual device states...');
    
    // Initialize all device types
    for (const device of Object.values(HA_CONFIG.devices).flat()) {
        if (device.type === 'media_player') {
            // Get current volume for media devices
            await getCurrentVolumeAndUpdate(device);
        } else if (device.type === 'playback') {
            // Set playback device to center position
            flicApp.virtualDeviceUpdateState('Speaker', device.id, {
                volume: 0.5
            });
        } else if (device.type === 'light' || device.type === 'color_light') {
            // Get current brightness for light devices
            await getCurrentBrightnessAndUpdate(device);
        } else if (device.type === 'climate') {
            // Get current temperature for climate devices
            await getCurrentTemperatureAndUpdate(device);
        } else if (device.type === 'blind') {
            // Get current position for blind devices
            await getCurrentBlindPositionAndUpdate(device);
        }
    }
    
    console.log('✅ Virtual device states initialized');
}

// ============================================================================
// INITIALIZATION AND CONFIGURATION
// ============================================================================

// Load configuration
function loadHAConfig() {
    console.log('Loading Home Assistant configuration...');
    
    const allDevices = Object.values(HA_CONFIG.devices).flat();
    console.log('Configured devices:', allDevices.map(d => d.name).join(', '));
}

// Initialize the integration
async function initializeHAIntegration() {
    loadHAConfig();
    
    console.log('Home Assistant Universal Integration Ready!');
    console.log('Available features:');
    console.log('- Media control via Flic buttons and Twist controllers');
    console.log('- Light control via Flic Twist controllers (brightness)');
    console.log('- Climate control via Flic Twist controllers (temperature)');
    console.log('- Multi-device synchronization across all device types');
    console.log('- Intelligent playbook control with state detection');
    console.log('');
    console.log('Action messages:');
    console.log('');
    console.log('📺 Media Devices:');
    console.log('- "{device-id} volume up/down" - Volume control');
    console.log('- "{device-id} mute" - Toggle mute');
    console.log('');
    console.log('💡 Light Devices:');
    console.log('- "{device-id} brightness up/down" - Brightness control');
    console.log('- "{device-id} bright" - Set to 100% brightness');
    console.log('- "{device-id} dim" - Set to 20% brightness');
    console.log('');
    console.log('🌡️ Climate Devices:');
    console.log('- "{device-id} temp up/down" - Temperature control');
    console.log('- "{device-id} heat/cool/auto" - HVAC mode control');
    console.log('');
    console.log('🪟 Blind/Cover Devices:');
    console.log('- "{device-id} open/close" - Open/close blinds');
    console.log('- "{device-id} stop" - Stop blind movement');
    console.log('- "{device-id} position up/down" - Adjust position by 10%');
    console.log('');
    console.log('🔌 Universal Actions (all devices):');
    console.log('- "{device-id} power" - Toggle power on/off');
    console.log('- "{device-id} on/off" - Direct power control');
    console.log('');
    console.log('🎛️ Flic Twist Controls:');
    console.log('- Media: Speaker devices for volume/playback');
    console.log('- Lights: Light devices for brightness/color control');
    console.log('- Climate: Blind devices for temperature control (position-based)');
    console.log('- Blinds: Blind devices for position control (0-100%)');
    
    // Test HTTP connectivity
    await testHTTPConnectivity();
    
    // Create virtual devices for Flic Twist integration
    createVirtualDevices();
    
    // Initialize virtual device states with current volumes
    await initializeVirtualDeviceStates();
}

/**
 * Test HTTP connectivity to Home Assistant
 */
async function testHTTPConnectivity() {
    console.log('🧪 Testing connectivity...');
    
    try {
        // Test basic API endpoint
        const response = await sendHARequest('/api/');
        console.log('✅ Home Assistant API connected');
        
        // Test service calls

        try {
            await callHAServiceDirect('persistent_notification', 'create', {
                message: 'Flic Hub Studio connected',
                title: 'Flic Test'
            });
            console.log('✅ Service calls working');
        } catch (error) {
            console.error('❌ Service call test failed:', error);
        }
    } catch (error) {
        console.error('❌ Home Assistant API connectivity test failed:', error);
        console.log('🔧 Please check:');
        console.log('   - Home Assistant IP address is correct');
        console.log('   - Access token is valid');
        console.log('   - Network connectivity');
    }
}

// Start the integration
initializeHAIntegration(); 