# Trikon AI Voice Assistant

A complete web application featuring a real-time AI Voice Medical Appointment Assistant powered by LiveKit. It allows patients to check availability, book, reschedule, or cancel appointments via natural voice interaction.

## Project Structure

The project is split into three main components:

1. **`client/`**: A React frontend application (Vite, TailwindCSS) that provides a user interface to interact with the voice assistant and view appointments.
2. **`server/`**: An Express.js backend server with Prisma ORM connecting to a local SQLite database to manage appointment bookings and availability.
3. **`voice/`**: A LiveKit Python voice agent utilizing OpenAI (LLM), Deepgram (STT), ElevenLabs (TTS), and Silero (VAD) for fluid, low-latency voice conversations.

---

## Prerequisites

Ensure you have the following installed:
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Python](https://www.python.org/) (v3.10 or higher)
* A [LiveKit Cloud](https://livekit.io/) account or self-hosted server.

---

## Configuration

Create a `.env` file in the root directory (and/or in the `server` and `voice` folders as required) containing your API keys and configuration:

```env
# LiveKit Credentials
LIVEKIT_URL=wss://your-livekit-url.com
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret

# AI Models & Services
OPENAI_API_KEY=your-openai-api-key
DEEPGRAM_API_KEY=your-deepgram-api-key
ELEVEN_API_KEY=your-elevenlabs-api-key

# Backend Configuration
PORT=5000
DATABASE_URL="file:./dev.db"
```

---

## Setup & Running the Application

You can start the entire stack easily using the helper script in the root directory:

### Run Everything Together (Windows)
Double-click or run:
```cmd
.\start-project.bat
```
This script automatically starts the backend server, client application, and Python voice agent in separate windows.

---

### Manual Setup (Step-by-step)

#### 1. Backend Server
```bash
cd server
npm install
npx prisma db push   # Set up SQLite database
npm run dev          # Runs on http://localhost:5000
```

#### 2. Frontend Client
```bash
cd client
npm install
npm run dev          # Runs on http://localhost:3000
```

#### 3. Voice Agent
Create and activate a virtual environment, install requirements, and run the agent:
```bash
cd voice
python -m venv venv
# Activate on Windows:
.\venv\Scripts\activate
# Activate on macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python agent.py dev
```

---

## Features
* **Real-time Voice Conversation**: Low-latency voice interface using WebRTC via LiveKit.
* **Function Calling / Tools**: The voice agent checks appointment availability, books appointments, and cancels/reschedules them dynamically by calling backend APIs.
* **Multilingual Support**: Supports English, Hindi, and Tamil greetings and conversations based on metadata configuration.
