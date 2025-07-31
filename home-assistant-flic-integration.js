// Home Assistant Media Integration with Flic App Module
// This script integrates Home Assistant media devices using the REST API
// with Flic buttons and Twist controllers for volume and playback control

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
function sendHARequest(endpoint, method = 'GET', data = null) {
    const url = `${HA_CONFIG.baseUrl}${endpoint}`;
    
    console.log(`🌐 HTTP ${method} request: ${url}`);
    
    return new Promise((resolve, reject) => {
        const requestOptions = {
            url: url,
            method: method,
            headers: {
                'Authorization': `Bearer ${HA_CONFIG.token}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Flic-Hub-Studio/1.0'
            }
        };
        
        if (data && method === 'POST') {
            requestOptions.data = JSON.stringify(data);
        }
        
        const timeoutId = setTimeout(() => {
            reject(new Error('Request timeout'));
        }, 5000);
        
        http.makeRequest(requestOptions, (error, result) => {
            clearTimeout(timeoutId);
            
            if (error) {
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
        const response = await sendHARequest(
            `${HA_CONFIG.endpoints.services}${domain}/${service}`,
            'POST',
            serviceData
        );
        
        if (response.success) {
            console.log(`✅ Successfully called ${domain}.${service}`);
            return response;
        } else {
            throw new Error(`Failed to call ${domain}.${service}`);
        }
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
    // Check playback command cooldown before allowing volume changes
    const currentTime = Date.now();
    const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
    
    if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
        console.log(`⏳ Volume up command ignored - playback cooldown active (${remainingCooldown}s remaining)`);
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
    // Check playback command cooldown before allowing volume changes
    const currentTime = Date.now();
    const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
    
    if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
        const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
        console.log(`⏳ Volume down command ignored - playback cooldown active (${remainingCooldown}s remaining)`);
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
 * Get playback status from media device
 * @param {Object} device - Device configuration
 * @returns {Promise<string>} - Playback status ('playing', 'paused', 'idle', or 'unknown')
 */
async function getPlaybackStatus(device) {
    try {
        const stateData = await getEntityState(device.entityId);
        
        // Check if device is powered on first
        if (stateData.state !== 'on') {
            return 'off';
        }
        
        return stateData.state || 'unknown';
    } catch (error) {
        console.error(`❌ Error getting playback status for ${device.name}:`, error);
        return 'unknown';
    }
}

/**
 * Pause playback on media device
 * @param {Object} device - Device configuration
 */
async function pausePlayback(device) {
    try {
        await callHAService('media_player', 'media_pause', {
            entity_id: device.entityId
        });
        
        console.log(`⏸️ ${device.name} playback paused`);
    } catch (error) {
        console.error(`❌ Error pausing ${device.name}:`, error);
    }
}

/**
 * Resume playback on media device
 * @param {Object} device - Device configuration
 */
async function resumePlayback(device) {
    try {
        await callHAService('media_player', 'media_play', {
            entity_id: device.entityId
        });
        
        console.log(`▶️ ${device.name} playback resumed`);
    } catch (error) {
        console.error(`❌ Error resuming ${device.name}:`, error);
    }
}

/**
 * Skip to next track on media device
 * @param {Object} device - Device configuration
 */
async function skipToNextTrack(device) {
    try {
        await callHAService('media_player', 'media_next_track', {
            entity_id: device.entityId
        });
        
        console.log(`⏭️ ${device.name} skipped to next track`);
    } catch (error) {
        console.error(`❌ Error skipping track on ${device.name}:`, error);
    }
}

/**
 * Handle playback device updates for playback control
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist
 */
async function handlePlaybackDeviceUpdate(deviceId, values) {
    // Find the device configuration for this device
    const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
    if (!device || device.type !== 'playback') {
        return;
    }
    
    const volumeChange = values.volume - 0.5; // 0.5 is the center position
    
    // Check if this is a playback command (not just volume change)
    const isPlaybackCommand = Math.abs(volumeChange) > 0.1; // Threshold to detect intentional movement
    
    if (isPlaybackCommand) {
        // Check playback command cooldown
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
        
        // Apply playback control
        const mediaDevice = HA_CONFIG.mediaDevices.find(d => d.type === 'media_player');
        if (mediaDevice) {
            try {
                const playbackStatus = await getPlaybackStatus(mediaDevice);
                
                if (volumeChange < 0) {
                    // Decreasing value = pause playback
                    if (playbackStatus === 'playing') {
                        await pausePlayback(mediaDevice);
                    }
                } else if (volumeChange > 0) {
                    // Increasing value = resume or skip
                    if (playbackStatus === 'paused') {
                        await resumePlayback(mediaDevice);
                    } else if (playbackStatus === 'playing') {
                        await skipToNextTrack(mediaDevice);
                    }
                }
            } catch (error) {
                console.error(`❌ Error handling playback control:`, error);
            }
        }
        
        // Update last command timestamp only for playback commands
        lastPlaybackCommandTime = currentTime;
    }
    
    // Reset playback device to center position
    flicApp.virtualDeviceUpdateState('Speaker', deviceId, {
        volume: 0.5
    });
}

/**
 * Handle media device updates for volume control
 * @param {string} deviceId - Virtual device ID
 * @param {Object} values - Values from Flic Twist
 */
async function handleMediaDeviceUpdate(deviceId, values) {
    if (values.volume !== undefined) {
        // Check playback command cooldown before allowing volume changes
        const currentTime = Date.now();
        const timeSinceLastCommand = currentTime - lastPlaybackCommandTime;
        
        if (timeSinceLastCommand < PLAYBACK_COOLDOWN_MS) {
            const remainingCooldown = Math.ceil((PLAYBACK_COOLDOWN_MS - timeSinceLastCommand) / 1000);
            console.log(`⏳ Volume change ignored - playback cooldown active (${remainingCooldown}s remaining)`);
            return;
        }
        
        const volumePercentage = Math.round(values.volume * 100);
        const device = HA_CONFIG.mediaDevices.find(d => d.id === deviceId);
        
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
    // Skip playback devices as they don't have volume
    if (device.type === 'playback') {
        return null;
    }
    
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
 * Initialize virtual device states with current Home Assistant volumes
 */
async function initializeVirtualDeviceStates() {
    for (const device of HA_CONFIG.mediaDevices) {
        if (device.type === 'playback') {
            // Create virtual playback device for playback control
            flicApp.virtualDeviceUpdateState('Speaker', device.id, {
                volume: 0.5
            });
        } else {
            // Get current volume for regular media devices
            await getCurrentVolumeAndUpdate(device);
        }
    }
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
    
    // Initialize virtual device states with current volumes
    await initializeVirtualDeviceStates();
}

// Start the integration
initializeHAIntegration(); 