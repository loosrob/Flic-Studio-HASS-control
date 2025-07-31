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
    
    // Media devices configuration
    mediaDevices: [
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
    
    // API endpoints
    endpoints: {
        states: '/api/states/',
        services: '/api/services/',
        config: '/api/config'
    },
    
    // Volume ranges (Home Assistant uses 0-1 for volume)
    volumeRanges: {
        media_player: {
            min: 0,
            max: 1
        },
        playback: {
            min: 0,
            max: 1
        }
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
    console.log(`🌐 GET ${url}`);
    
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
    
    console.log(`🔧 Calling ${domain}.${service}`);
    
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
                console.log(`✅ ${domain}.${service} successful`);
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
 * Set volume for a media device
 * @param {string} deviceId - Device identifier
 * @param {number} volume - Volume level (0-100)
 * @returns {Promise} - Response promise
 */
async function setMediaVolume(deviceId, volume) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    // Convert percentage to 0-1 range for Home Assistant
    const volumeLevel = volume / 100;
    
    try {
        const response = await callHAService('media_player', 'volume_set', {
            entity_id: device.entityId,
            volume_level: volumeLevel
        });
        
        if (response.success) {
            // Get actual volume from device and update virtual device state
            await getCurrentVolumeAndUpdate(device);
            
            return response;
        } else {
            throw new Error(`Failed to set volume for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error setting volume for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Set power state for a media device
 * @param {string} deviceId - Device identifier
 * @param {boolean} powerOn - True to turn on, false to turn off
 * @returns {Promise} - Response promise
 */
async function setMediaPower(deviceId, powerOn) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    const service = powerOn ? 'turn_on' : 'turn_off';
    console.log(`Setting power for ${device.name} to ${powerOn ? 'on' : 'off'}`);
    
    try {
        const response = await callHAService('media_player', service, {
            entity_id: device.entityId
        });
        
        if (response.success) {
            console.log(`Successfully set power for ${device.name}`);
            return response;
        } else {
            throw new Error(`Failed to set power for ${device.name}`);
        }
    } catch (error) {
        console.error(`Error setting power for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Set mute state for a media device
 * @param {string} deviceId - Device identifier
 * @param {boolean} muted - True to mute, false to unmute
 * @returns {Promise} - Response promise
 */
async function setMediaMute(deviceId, muted) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    const service = muted ? 'volume_mute' : 'volume_mute';
    console.log(`Setting mute for ${device.name} to ${muted}`);
    
    try {
        const response = await callHAService('media_player', service, {
            entity_id: device.entityId,
            is_volume_muted: muted
        });
        
        if (response.success) {
            console.log(`Successfully set mute for ${device.name}`);
            return response;
        } else {
            throw new Error(`Failed to set mute for ${device.name}`);
        }
    } catch (error) {
        console.error(`Error setting mute for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Pause media playback
 * @param {string} deviceId - Device identifier
 * @returns {Promise} - Response promise
 */
async function setMediaPause(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    console.log(`Pausing playback for ${device.name}`);
    
    try {
        const response = await callHAService('media_player', 'media_pause', {
            entity_id: device.entityId
        });
        
        if (response.success) {
            console.log(`✅ ${device.name} playback paused`);
            return response;
        } else {
            throw new Error(`Failed to pause playback for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error pausing playback for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Resume/play media playback
 * @param {string} deviceId - Device identifier
 * @returns {Promise} - Response promise
 */
async function setMediaPlay(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    console.log(`Resuming playback for ${device.name}`);
    
    try {
        const response = await callHAService('media_player', 'media_play', {
            entity_id: device.entityId
        });
        
        if (response.success) {
            console.log(`✅ ${device.name} playback resumed`);
            return response;
        } else {
            throw new Error(`Failed to resume playback for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error resuming playback for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Skip to next track
 * @param {string} deviceId - Device identifier
 * @returns {Promise} - Response promise
 */
async function setMediaNextTrack(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        throw new Error(`Device ${deviceId} not found`);
    }
    
    console.log(`Skipping to next track for ${device.name}`);
    
    try {
        const response = await callHAService('media_player', 'media_next_track', {
            entity_id: device.entityId
        });
        
        if (response.success) {
            console.log(`✅ ${device.name} skipped to next track`);
            return response;
        } else {
            throw new Error(`Failed to skip track for ${device.name}`);
        }
    } catch (error) {
        console.error(`❌ Error skipping track for ${device.name}:`, error);
        throw error;
    }
}

/**
 * Get current playback state of a media device
 * @param {string} deviceId - Device identifier
 * @returns {Promise<string>} - Current state ('playing', 'paused', 'idle', 'off', etc.)
 */
async function getMediaPlaybackState(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
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

// Handle action messages from Flic app
flicApp.on('actionMessage', (message) => {
    console.log('Received action message:', message);
    
    // Parse device-specific commands: "{device-id} {action}"
    const parts = message.toLowerCase().split(' ');
    if (parts.length >= 2) {
        const deviceId = parts[0];
        const action = parts.slice(1).join(' ');
        
        // Find the device by device ID
        const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
        if (!device) {
            console.log(`Unknown device: ${deviceId}`);
            return;
        }
        
        // Handle device-specific actions
        switch (action) {
            case 'volume up':
                handleDeviceVolumeUp(deviceId);
                break;
            case 'volume down':
                handleDeviceVolumeDown(deviceId);
                break;
            case 'mute':
                handleDeviceMuteToggle(deviceId);
                break;
            case 'power':
                handleDevicePowerToggle(deviceId);
                break;
            case 'on':
                handleDevicePowerOn(deviceId);
                break;
            case 'off':
                handleDevicePowerOff(deviceId);
                break;
            default:
                console.log(`Unknown action for device ${deviceId}: ${action}`);
                break;
        }
    } else {
        console.log('Invalid action message format. Expected: "{device-id} {action}"');
    }
});

// Handle virtual device updates from Flic Twist controllers
flicApp.on('virtualDeviceUpdate', (metaData, values) => {
    if (metaData.dimmableType === 'Speaker') {
        const device = HA_CONFIG.mediaDevices.find(d => d.id === metaData.virtualDeviceId);
        if (device && device.type === 'playback') {
            handlePlaybackDeviceUpdate(metaData.virtualDeviceId, values);
        } else {
            handleMediaDeviceUpdate(metaData.virtualDeviceId, values);
        }
    }
});

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle volume up for specific device
 */
async function handleDeviceVolumeUp(deviceId) {
    // Check cooldown
    const currentTime = Date.now();
    const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
    
    if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
        console.log(`⏳ Volume up ignored - cooldown active (${remainingCooldown}s remaining)`);
        return;
    }
    
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current volume
        const stateData = await getEntityState(device.entityId);
        const currentVolume = stateData.attributes.volume_level * 100; // Convert to percentage
        const newVolume = Math.min(100, currentVolume + 10);
        
        await setMediaVolume(deviceId, newVolume);
    } catch (error) {
        console.error(`❌ Error increasing volume for ${device.name}:`, error);
    }
}

/**
 * Handle volume down for specific device
 */
async function handleDeviceVolumeDown(deviceId) {
    // Check cooldown
    const currentTime = Date.now();
    const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
    
    if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
        console.log(`⏳ Volume down ignored - cooldown active (${remainingCooldown}s remaining)`);
        return;
    }
    
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current volume
        const stateData = await getEntityState(device.entityId);
        const currentVolume = stateData.attributes.volume_level * 100; // Convert to percentage
        const newVolume = Math.max(0, currentVolume - 10);
        
        await setMediaVolume(deviceId, newVolume);
    } catch (error) {
        console.error(`❌ Error decreasing volume for ${device.name}:`, error);
    }
}

/**
 * Handle mute toggle for specific device
 */
async function handleDeviceMuteToggle(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
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
        
        console.log(`✅ ${device.name} ${newMuteState ? 'muted' : 'unmuted'}`);
    } catch (error) {
        console.error(`❌ Error toggling mute for ${device.name}:`, error);
    }
}

/**
 * Handle power toggle for specific device
 */
async function handleDevicePowerToggle(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        // Get current power status
        const stateData = await getEntityState(device.entityId);
        const isCurrentlyOn = stateData.state === 'on';
        
        // Toggle power status
        const newPowerState = isCurrentlyOn ? false : true;
        await setMediaPower(deviceId, newPowerState);
        
        console.log(`✅ ${device.name} turned ${newPowerState ? 'on' : 'off'}`);
    } catch (error) {
        console.error(`❌ Error toggling power for ${device.name}:`, error);
    }
}

/**
 * Handle power on for specific device
 */
async function handleDevicePowerOn(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setMediaPower(deviceId, true);
        console.log(`✅ ${device.name} turned on`);
    } catch (error) {
        console.error(`❌ Error turning on ${device.name}:`, error);
    }
}

/**
 * Handle power off for specific device
 */
async function handleDevicePowerOff(deviceId) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device) {
        console.error(`Device not found: ${deviceId}`);
        return;
    }
    
    try {
        await setMediaPower(deviceId, false);
        console.log(`✅ ${device.name} turned off`);
    } catch (error) {
        console.error(`❌ Error turning off ${device.name}:`, error);
    }
}

/**
 * Handle media device updates for volume control
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist
 */
/**
 * Handle playback device updates for playback control
 */
async function handlePlaybackDeviceUpdate(deviceId, values) {
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
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
            console.log(`⏳ Playback command ignored - cooldown active (${remainingCooldown}s remaining)`);
            
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
                console.log(`📊 Current playback state: ${currentState}`);
                
                if (currentState === 'paused') {
                    // If paused, resume playback
                    await setMediaPlay(deviceId);
                } else if (currentState === 'playing') {
                    // If playing, skip to next track
                    await setMediaNextTrack(deviceId);
                } else {
                    // For other states (idle, off, etc.), try to start playback
                    console.log(`📱 Device in ${currentState} state, attempting to start playback`);
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
            console.log(`⏳ Volume change ignored - cooldown active (${remainingCooldown}s remaining)`);
            return;
        }
        
        const volumePercentage = Math.round(values.volume * 100);
        
        try {
            await setMediaVolume(deviceId, volumePercentage);
        } catch (error) {
            console.error(`❌ Failed to update media device ${deviceId}:`, error);
        }
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
 * Create virtual devices for Flic Twist integration
 */
function createVirtualDevices() {
    console.log('🎛️ Creating virtual devices...');
    
    HA_CONFIG.mediaDevices.forEach(device => {
        if (device.type === 'media_player' || device.type === 'playback') {
            // Create Speaker virtual device for volume/playback control
            const virtualDevice = flicApp.createVirtualDevice(device.id, 'Speaker', device.name);
            console.log(`✅ Created virtual device: ${device.name}`);
        }
    });
}

/**
 * Initialize virtual device states with current Home Assistant volumes
 */
async function initializeVirtualDeviceStates() {
    console.log('🔄 Initializing virtual device states...');
    
    for (const device of HA_CONFIG.mediaDevices) {
        if (device.type === 'media_player') {
            // Get current volume for media devices
            await getCurrentVolumeAndUpdate(device);
        } else if (device.type === 'playback') {
            // Set playback device to center position
            flicApp.virtualDeviceUpdateState('Speaker', device.id, {
                volume: 0.5
            });
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
    console.log('Configured devices:', HA_CONFIG.mediaDevices.map(d => d.name));
}

// Initialize the integration
async function initializeHAIntegration() {
    loadHAConfig();
    
    console.log('Home Assistant Media Integration Ready!');
    console.log('Available features:');
    console.log('- Volume control via Flic buttons');
    console.log('- Volume control via Flic Twist controllers');
    console.log('- Playback control via Flic Twist (playback device)');
    console.log('- Multi-device synchronization');
    console.log('');
    console.log('Action messages:');
    console.log('- "{device-id} volume up" - Increase volume by 10% (e.g., "livingroom_tv volume up")');
    console.log('- "{device-id} volume down" - Decrease volume by 10% (e.g., "livingroom_tv volume down")');
    console.log('- "{device-id} mute" - Toggle mute (e.g., "livingroom_tv mute")');
    console.log('- "{device-id} power" - Toggle power on/off (e.g., "livingroom_tv power")');
    console.log('- "{device-id} on" - Turn device on (e.g., "livingroom_tv on")');
    console.log('- "{device-id} off" - Turn device off (e.g., "livingroom_tv off")');
    
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