# HSK Master (Simplified)

A streamlined Chinese pronunciation practice app for personal use. This simplified version focuses on core functionality without complex offline storage or progress tracking.

## Features

- Practice Chinese pronunciation with immediate feedback
- View vocabulary words with filtering options
- Configure server connection settings

## Setup and Usage

### 1. Running the Backend

Make sure your backend server is running first. This app expects a WebSocket endpoint at `/ws/api` for communication.

### 2. Running the Frontend

```bash
# Install dependencies
npm install

# Start the development server for local use
npm run dev -- --host

# Build for production
npm run build
```

### 3. Accessing from Mobile Devices

For iPhone and other mobile devices, there are several options:

#### Local Network Access

1. Start the frontend with `npm run dev -- --host`
2. Access using your computer's local IP address: `http://192.168.x.x:5173`
3. In the Settings page, set the WebSocket URL to `ws://192.168.x.x:8000/ws/api`

Note: For iOS microphone access, you need to:
- Use Safari (Chrome on iOS has limitations with audio)
- Be on the same local network
- Or use one of the secure connection methods below

#### Using ngrok for Secure Access

For the best experience on iOS, create a secure tunnel:

1. Install ngrok: `npm install -g ngrok`
2. Start your backend server on port 8000
3. Create a tunnel: `ngrok http 8000`
4. Use the HTTPS URL ngrok provides in your settings page
5. Update the WebSocket URL to: `wss://[ngrok-subdomain].ngrok.io/ws/api`

### 4. Troubleshooting

- **WebSocket Connection Issues**: If you're having connection issues, check your firewall settings and ensure the backend server is accessible from your device.
- **Microphone Access**: On iOS, only Safari provides reliable access to the microphone, and it requires either a secure context (HTTPS) or being on the same local network.
- **Audio Quality**: If audio quality is poor, try decreasing background noise and speaking clearly into the microphone.

## Project Structure

The project has been simplified to focus on the core functionality:

- `App.jsx`: Main application component
- `PracticePage.jsx`: Page for practicing pronunciation
- `VocabularyPage.jsx`: Simplified vocab display
- `SettingsPage.jsx`: Connection settings
- `AudioRecorder.jsx`: Component for recording audio
- `websocket-utils.js`: Utilities for WebSocket communication

## Customization

You can customize this app in several ways:

1. **Server URL**: Change the WebSocket URL in the Settings page
2. **HSK Levels**: Modify the levels array in PracticePage.jsx
3. **UI Theme**: Adjust the Tailwind classes in the components

This simplified version removes the complex offline database functionality, progress tracking, and other features to focus on the core pronunciation practice workflow.