# Home Assistant Media Integration with Flic Hub Studio

This integration allows you to control Home Assistant media devices using Flic buttons and Twist controllers through the Flic Hub Studio. It uses the [Home Assistant REST API](https://developers.home-assistant.io/docs/api/rest/) to provide precise volume control, playback control, and multi-device management.

## Features

- **Volume Control**: Precise volume control using Flic Twist controllers
- **Playback Control**: Pause, resume, and skip tracks using configurable playback devices
- **Multi-Device Support**: Control multiple media devices (TVs, speakers, radios)
- **Device-Specific Actions**: Use action messages to control specific devices
- **Smart Cooldown**: 2.5-second cooldown prevents rapid-fire commands
- **State Synchronization**: Virtual devices stay in sync with actual device states
- **Power Control**: Turn devices on/off and toggle power states
- **Mute Control**: Toggle mute states with smart detection

## Prerequisites

1. **Home Assistant Instance**: Running Home Assistant with media devices configured
2. **Network Access**: Flic Hub must be on the same network as Home Assistant
3. **Long-Lived Access Token**: API token for authentication
4. **Media Devices**: Configured media_player entities in Home Assistant
5. **Flic Hub Studio**: Access to Flic Hub Studio for script deployment

## Setup Instructions

### 1. Get Your Home Assistant Access Token

1. **Open Home Assistant Web Interface**:
   - Navigate to your Home Assistant instance (e.g., `http://192.168.1.100:8123`)
   - Log in with your account

2. **Create Long-Lived Access Token**:
   - Go to your profile: `http://YOUR_HA_IP:8123/profile`
   - Scroll down to "Long-Lived Access Tokens"
   - Click "Create Token"
   - Give it a name like "Flic Hub Studio Integration"
   - Copy the generated token (keep it secure!)

### 2. Find Your Media Device Entity IDs

1. **Using Home Assistant Developer Tools**:
   - Go to Developer Tools → States
   - Look for `media_player.*` entities
   - Note the entity IDs (e.g., `media_player.living_room_tv`)

2. **Using Home Assistant API**:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        -H "Content-Type: application/json" \
        http://YOUR_HA_IP:8123/api/states
   ```

3. **Common Media Device Entity IDs**:
   - `media_player.living_room_tv`
   - `media_player.bedroom_speaker`
   - `media_player.kitchen_radio`
   - `media_player.sonos_living_room`

### 3. Configure the Script

Edit the `HA_CONFIG` section in `home-assistant-flic-integration.js`:

```javascript
const HA_CONFIG = {
    // Update these with your Home Assistant instance details
    baseUrl: 'http://YOUR_HA_IP:8123',
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
    ]
};
```

**Replace the values** with your actual Home Assistant IP address, access token, and media device entity IDs.

### 4. Test Home Assistant Connectivity

Test if your Home Assistant instance responds to the API:

```bash
# Test basic connectivity
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://YOUR_HA_IP:8123/api/

# Test getting a media device state
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://YOUR_HA_IP:8123/api/states/media_player.living_room_tv

# Test volume control
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"entity_id": "media_player.living_room_tv", "volume_level": 0.5}' \
     http://YOUR_HA_IP:8123/api/services/media_player/volume_set
```

### 5. Upload to Flic Hub Studio

1. Open your Flic Hub Studio web interface
2. Navigate to the Scripts section
3. Upload `home-assistant-flic-integration.js`
4. Save and run the script

### 6. Configure Virtual Devices in Flic App

Create these virtual devices in the Flic app:

1. **Living Room TV**:
   - Device ID: `livingroom_tv`
   - Type: `Speaker`
   - Name: "Living Room TV"

2. **Bedroom Speaker**:
   - Device ID: `bedroom_speaker`
   - Type: `Speaker`
   - Name: "Bedroom Speaker"

3. **Kitchen Radio**:
   - Device ID: `kitchen_radio`
   - Type: `Speaker`
   - Name: "Kitchen Radio"

4. **Playback Control**:
   - Device ID: `playback_control`
   - Type: `Speaker`
   - Name: "Playback Control"

### 7. Set Up Action Messages

Configure these action messages in the Flic app:

**Device-Specific Controls:**
- `{device-id} volume up` - Increase volume by 10% (e.g., "livingroom_tv volume up")
- `{device-id} volume down` - Decrease volume by 10% (e.g., "livingroom_tv volume down")
- `{device-id} mute` - Toggle mute (e.g., "livingroom_tv mute")
- `{device-id} power` - Toggle power on/off (e.g., "livingroom_tv power")
- `{device-id} on` - Turn device on (e.g., "livingroom_tv on")
- `{device-id} off` - Turn device off (e.g., "livingroom_tv off")

**Examples:**
- `livingroom_tv volume up` - Increase Living Room TV volume
- `bedroom_speaker mute` - Toggle Bedroom Speaker mute
- `kitchen_radio power` - Toggle Kitchen Radio power
- `livingroom_tv on` - Turn Living Room TV on

### 8. Configure Flic Twist Controllers

1. **Volume Control**: Set up Flic Twist controllers for your media devices
2. **Playback Control**: Set up a Flic Twist controller for the "playback_control" device
3. The script will automatically handle volume updates and playback control

## Usage

### Volume Control

- **Flic Twist**: Rotate to adjust volume (0-100%)
- **Action Messages**: Use "livingroom_tv volume up" or "bedroom_speaker volume down"
- **Automatic Sync**: Virtual devices stay in sync with actual device states

### Playback Control

- **Flic Twist Down**: Pause playback
- **Flic Twist Up**: 
  - If paused → Resume playback
  - If playing → Skip to next track
- **Cooldown**: 2.5-second cooldown prevents rapid commands

### Power Control

- **Toggle**: `{device-id} power` - Smart toggle (checks current state)
- **Direct On**: `{device-id} on` - Turn device on immediately
- **Direct Off**: `{device-id} off` - Turn device off immediately

### Mute Control

- **Smart Toggle**: `{device-id} mute` - Checks current mute state and toggles

## API Reference

### Home Assistant REST API Endpoints

The integration uses these Home Assistant API endpoints:

**State Queries:**
- `GET /api/states/<entity_id>` - Get current state of a device

**Service Calls:**
- `POST /api/services/media_player/volume_set` - Set volume level
- `POST /api/services/media_player/turn_on` - Turn device on
- `POST /api/services/media_player/turn_off` - Turn device off
- `POST /api/services/media_player/volume_mute` - Mute/unmute device
- `POST /api/services/media_player/media_play` - Resume playback
- `POST /api/services/media_player/media_pause` - Pause playback
- `POST /api/services/media_player/media_next_track` - Skip to next track

**Authentication:**
- `Authorization: Bearer YOUR_TOKEN` header required for all requests

### Volume Format

- **Input**: 0-100% (percentage)
- **Home Assistant**: 0-1 (decimal)
- **Auto-Conversion**: Script automatically converts between formats
- **Auto-Sync**: Actual volume fetched and virtual device updated

## Cooldown System

### 2.5-Second Cooldown

All playback commands and volume changes are protected by a 2.5-second cooldown:

- **Playback Commands**: Pause, resume, skip
- **Volume Changes**: All volume adjustments (Twist controllers and action messages)
- **Global Protection**: Applies to all devices simultaneously
- **Smart Detection**: Only intentional movements trigger cooldown

### Cooldown Behavior

```
Playback Command → 2.5s Cooldown → All volume/playback commands blocked
Volume Change → Blocked during cooldown (doesn't trigger cooldown)
Small Movement → Ignored (doesn't trigger cooldown)
```

## Troubleshooting

### Common Issues

1. **"Authentication Failed"**:
   - Verify your long-lived access token is correct
   - Check token hasn't expired
   - Ensure token has proper permissions

2. **"Connection Failed"**:
   - Verify Home Assistant IP address is correct
   - Check network connectivity
   - Ensure Home Assistant is running

3. **"Entity Not Found"**:
   - Verify entity IDs are correct
   - Check devices are configured in Home Assistant
   - Test with curl command above

4. **"Volume Not Changing"**:
   - Check device is not muted
   - Verify device supports volume control
   - Check device is powered on

5. **"Playback Control Not Working"**:
   - Ensure device supports media controls
   - Check device is on a media input
   - Verify playback device is configured correctly

### Debug Commands

```bash
# Test basic connectivity
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://YOUR_HA_IP:8123/api/

# Test getting device state
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     http://YOUR_HA_IP:8123/api/states/media_player.living_room_tv

# Test volume control
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"entity_id": "media_player.living_room_tv", "volume_level": 0.5}' \
     http://YOUR_HA_IP:8123/api/services/media_player/volume_set

# Test power control
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"entity_id": "media_player.living_room_tv"}' \
     http://YOUR_HA_IP:8123/api/services/media_player/turn_on
```

### Debug Information

The script provides clean, minimal logging:

```
⏸️ Living Room TV playback paused
▶️ Living Room TV playback resumed
⏭️ Living Room TV skipped to next track
⏳ Playback command ignored - cooldown active (2s remaining)
```

## Supported Home Assistant Media Devices

This integration works with any media device that supports the `media_player` domain in Home Assistant, including:

- **Smart TVs**: Samsung, LG, Sony, etc.
- **Smart Speakers**: Sonos, Google Home, Amazon Echo
- **Media Players**: Chromecast, Apple TV, Roku
- **AV Receivers**: Denon, Yamaha, Onkyo
- **Streaming Devices**: Fire TV, Roku, Apple TV
- **Custom Media Players**: Any device with media_player integration

## Advanced Features

### Multi-Device Support

Control multiple devices simultaneously:

```javascript
mediaDevices: [
    { id: 'livingroom_tv', entityId: 'media_player.living_room_tv', name: 'Living Room TV' },
    { id: 'bedroom_speaker', entityId: 'media_player.bedroom_speaker', name: 'Bedroom Speaker' },
    { id: 'kitchen_radio', entityId: 'media_player.kitchen_radio', name: 'Kitchen Radio' },
    { id: 'playback_control', entityId: 'media_player.living_room_tv', name: 'Playback Control' }
]
```

### State Synchronization

Virtual devices automatically sync with actual device states:

- **Volume Changes**: Actual volume fetched after each change
- **Power States**: Current power status checked before toggling
- **Mute States**: Current mute status checked before toggling

### Error Handling

Comprehensive error handling with detailed logging:

```javascript
try {
    await setMediaVolume(deviceId, volume);
} catch (error) {
    console.error(`❌ Error setting volume for ${device.name}:`, error);
}
```

## Contributing

To extend this integration:

1. Add new action handlers for additional features
2. Implement status polling for real-time updates
3. Add support for other Home Assistant domains (light, switch, etc.)
4. Create custom volume presets
5. Add support for media selection and input switching

## License

This integration is provided as-is for educational and personal use. Modify and extend as needed for your specific requirements. 