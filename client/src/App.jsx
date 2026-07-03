import React, { useState, useEffect } from 'react';
import { 
  Mic, MicOff, Phone, PhoneOff, Check, AlertCircle, 
  Calendar, Clock, User, PhoneCall, Globe, ChevronRight, Activity, Eye, ShieldAlert
} from 'lucide-react';
import { Room, RoomEvent } from 'livekit-client';

const BACKEND_URL = 'http://localhost:5000/api';

export default function App() {
  const [language, setLanguage] = useState(null); // 'en', 'hi', 'ta'
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [room, setRoom] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [activeTab, setActiveTab] = useState('agent'); // 'agent' | 'schedule'
  
  // Real-time doctor & appointment data
  const [doctors, setDoctors] = useState([]);
  const [clinicInfo, setClinicInfo] = useState(null);
  
  // Audio state visualizers
  const [agentState, setAgentState] = useState('idle'); // 'idle' | 'speaking'
  const [userState, setUserState] = useState('idle'); // 'idle' | 'speaking'

  // Fetch doctors and clinic info
  const fetchData = async () => {
    try {
      const resDocs = await fetch(`${BACKEND_URL}/doctors`);
      const dataDocs = await resDocs.json();
      setDoctors(dataDocs);

      const resClinic = await fetch(`${BACKEND_URL}/clinic`);
      const dataClinic = await resClinic.json();
      setClinicInfo(dataClinic);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000); // Poll every 4 seconds to show booking updates instantly!
    return () => clearInterval(interval);
  }, []);

  // Handle Voice Connection
  const startCall = async () => {
    if (!language) return;
    setIsConnecting(true);

    try {
      const roomName = `medical-room-${Math.random().toString(36).substring(7)}`;
      const participantName = `Patient-${Math.random().toString(36).substring(7)}`;

      // 1. Fetch token from backend
      const res = await fetch(`${BACKEND_URL}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName })
      });
      const { token, url } = await res.json();

      // 2. Initialize LiveKit Room
      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // 3. Setup event listeners for audio indicators
      lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        let isAgentSpeaking = false;
        let isUserSpeaking = false;

        speakers.forEach((speaker) => {
          if (speaker.identity.startsWith('Patient-')) {
            isUserSpeaking = true;
          } else {
            isAgentSpeaking = true;
          }
        });

        setUserState(isUserSpeaking ? 'speaking' : 'idle');
        setAgentState(isAgentSpeaking ? 'speaking' : 'idle');
      });

      lkRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setRoom(null);
      });

      // 4. Connect to Room
      await lkRoom.connect(url, token);
      await lkRoom.localParticipant.enableCameraAndMicrophone();
      // Ensure only audio is published
      await lkRoom.localParticipant.setMicrophoneEnabled(true);
      await lkRoom.localParticipant.setCameraEnabled(false);

      setRoom(lkRoom);
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      console.error("LiveKit connection failed:", err);
      alert("Failed to connect to LiveKit. Please make sure LiveKit Server is running and URL/Credentials are configured.");
      setIsConnecting(false);
    }
  };

  const endCall = async () => {
    if (room) {
      await room.disconnect();
    }
    setIsConnected(false);
    setRoom(null);
  };

  const toggleMute = async () => {
    if (room) {
      const enabled = room.localParticipant.isMicrophoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(!enabled);
      setIsMuted(enabled);
    }
  };

  // Language display names
  const langNames = {
    en: 'English',
    hi: 'हिन्दी (Hindi)',
    ta: 'தமிழ் (Tamil)'
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-900 bg-slate-950/80 sticky top-0 z-50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Activity className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              Trikon AI Voice Agent
            </h1>
            <p className="text-xs text-slate-500 font-medium">Smart Medical Scheduling Assistant</p>
          </div>
        </div>

        {language && (
          <button 
            onClick={() => { endCall(); setLanguage(null); }}
            className="flex items-center space-x-2 text-xs text-slate-400 hover:text-white transition bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Language: {langNames[language]}</span>
            <span className="text-sky-500 underline ml-1 text-[10px]">Change</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Language Selection Overlay / First Step */}
        {!language ? (
          <div className="col-span-12 flex flex-col items-center justify-center py-20 px-4">
            <div className="glass-panel-glow max-w-md w-full p-8 rounded-3xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mx-auto mb-2">
                <Globe className="w-8 h-8 text-sky-400" />
              </div>
              <h2 className="text-2xl font-bold">Choose Your Language</h2>
              <p className="text-sm text-slate-400">
                Please select a language for the AI Medical Voice Assistant to speak and understand.
              </p>

              <div className="flex flex-col space-y-3 pt-4">
                <button 
                  onClick={() => setLanguage('en')}
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-sky-500/50 transition duration-300 text-left group"
                >
                  <span className="font-semibold text-lg">English</span>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition" />
                </button>
                <button 
                  onClick={() => setLanguage('hi')}
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-sky-500/50 transition duration-300 text-left group"
                >
                  <span className="font-semibold text-lg">हिन्दी</span>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition" />
                </button>
                <button 
                  onClick={() => setLanguage('ta')}
                  className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800/80 rounded-2xl border border-slate-800 hover:border-sky-500/50 transition duration-300 text-left group"
                >
                  <span className="font-semibold text-lg">தமிழ்</span>
                  <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 group-hover:translate-x-1 transition" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Left Side - Voice Room / Dialer */}
            <div className="col-span-12 lg:col-span-5 flex flex-col space-y-6">
              
              <div className="glass-panel-glow p-6 rounded-3xl flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden min-h-[380px]">
                
                {/* Decorative glowing background */}
                <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />

                {/* State Indicators / Visualizer */}
                <div className="relative">
                  {/* Outer breathing ring */}
                  <div className={`absolute -inset-4 rounded-full border border-sky-500/30 blur-sm transition-all duration-1000 ${
                    isConnected && agentState === 'speaking' ? 'animate-ping scale-110 opacity-60' : 'scale-100 opacity-20'
                  }`} />
                  
                  {/* Mid audio visualizer rings */}
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    isConnected 
                      ? agentState === 'speaking' 
                        ? 'bg-sky-500/10 border-sky-400 shadow-[0_0_30px_rgba(2,132,199,0.3)]'
                        : userState === 'speaking'
                          ? 'bg-emerald-500/10 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                          : 'bg-indigo-500/5 border-indigo-500/20'
                      : 'bg-slate-900 border-slate-800'
                  }`}>
                    {isConnected ? (
                      agentState === 'speaking' ? (
                        <div className="flex space-x-1 items-end h-8">
                          <span className="w-1.5 bg-sky-400 rounded-full animate-[bounce_0.8s_infinite_100ms] h-6" />
                          <span className="w-1.5 bg-sky-400 rounded-full animate-[bounce_0.8s_infinite_300ms] h-8" />
                          <span className="w-1.5 bg-sky-400 rounded-full animate-[bounce_0.8s_infinite_200ms] h-4" />
                          <span className="w-1.5 bg-sky-400 rounded-full animate-[bounce_0.8s_infinite_400ms] h-7" />
                        </div>
                      ) : userState === 'speaking' ? (
                        <div className="flex space-x-1 items-end h-8">
                          <span className="w-1.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_100ms] h-5" />
                          <span className="w-1.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_300ms] h-7" />
                          <span className="w-1.5 bg-emerald-400 rounded-full animate-[bounce_0.6s_infinite_200ms] h-4" />
                        </div>
                      ) : (
                        <Mic className="w-10 h-10 text-indigo-400" />
                      )
                    ) : (
                      <PhoneCall className="w-10 h-10 text-slate-500" />
                    )}
                  </div>
                </div>

                <div className="space-y-2 relative z-10">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {!isConnected ? 'Ready to Call' : agentState === 'speaking' ? 'Agent Speaking...' : userState === 'speaking' ? 'Listening to You...' : 'Silent / Connected'}
                  </h3>
                  <p className="text-sm text-slate-400 max-w-xs mx-auto">
                    {!isConnected 
                      ? `Connect to start speaking with our AI hospital booking receptionist in ${langNames[language]}.` 
                      : 'You can speak naturally. To interrupt the assistant, simply start speaking.'
                    }
                  </p>
                </div>

                {/* Call Controls */}
                <div className="flex items-center space-x-4 pt-4 relative z-10">
                  {!isConnected ? (
                    <button
                      onClick={startCall}
                      disabled={isConnecting}
                      className="px-8 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold rounded-2xl shadow-xl shadow-sky-500/20 hover:shadow-sky-400/30 flex items-center space-x-3 transition transform active:scale-95 duration-200"
                    >
                      <Phone className="w-5 h-5 animate-bounce" />
                      <span>{isConnecting ? 'Connecting...' : 'Start Voice Call'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={toggleMute}
                        className={`p-4 rounded-2xl border transition ${
                          isMuted 
                            ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' 
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                        title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                      >
                        {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>
                      
                      <button
                        onClick={endCall}
                        className="px-8 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-2xl shadow-xl shadow-red-500/20 flex items-center space-x-3 transition transform active:scale-95 duration-200"
                      >
                        <PhoneOff className="w-5 h-5" />
                        <span>Hang Up</span>
                      </button>
                    </>
                  )}
                </div>

              </div>

              {/* Tips / Guidelines */}
              <div className="glass-panel p-5 rounded-2xl space-y-3">
                <h4 className="font-semibold text-xs text-sky-400 uppercase tracking-wider">How to interact</h4>
                <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
                  <li>Say: <span className="text-slate-200">"I need to book an appointment tomorrow with a dermatologist."</span></li>
                  <li>Ask: <span className="text-slate-200">"Is Dr. Priya Singh available?"</span></li>
                  <li>Say: <span className="text-slate-200">"Reschedule my booking to 10:00 AM."</span></li>
                  <li>Say: <span className="text-slate-200">"Cancel my appointment."</span></li>
                </ul>
              </div>

            </div>

            {/* Right Side - Schedule / Doctors Board */}
            <div className="col-span-12 lg:col-span-7 flex flex-col space-y-6">
              
              <div className="glass-panel rounded-3xl p-6 flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
                  <h3 className="text-lg font-bold flex items-center space-x-2">
                    <Calendar className="w-5 h-5 text-indigo-400" />
                    <span>Clinic Status Board</span>
                  </h3>
                  <div className="text-xs text-slate-500">Auto-refreshing in real-time</div>
                </div>

                {/* Tab select */}
                <div className="flex space-x-1 bg-slate-900/60 p-1.5 rounded-xl border border-slate-900 mb-6">
                  <button 
                    onClick={() => setActiveTab('agent')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                      activeTab === 'agent' 
                        ? 'bg-slate-800 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Doctors & Availabilities
                  </button>
                  <button 
                    onClick={() => setActiveTab('schedule')}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${
                      activeTab === 'schedule' 
                        ? 'bg-slate-800 text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Active Booked Appointments
                  </button>
                </div>

                {/* Tab content 1 - Doctors & Slots */}
                {activeTab === 'agent' && (
                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                    {doctors.map((doc) => (
                      <div key={doc.id} className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-lg text-slate-200">{doc.name}</h4>
                            <p className="text-xs text-sky-400 font-medium">{doc.speciality}</p>
                          </div>
                          <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                            {doc.experience} Years Exp.
                          </span>
                        </div>

                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Available Slots</p>
                          <div className="flex flex-wrap gap-2">
                            {doc.availabilities && doc.availabilities.length > 0 ? (
                              doc.availabilities.map((slot) => (
                                <span 
                                  key={slot.id}
                                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center space-x-1 ${
                                    slot.isBooked 
                                      ? 'bg-slate-950/60 border-slate-900 text-slate-600 line-through' 
                                      : 'bg-sky-500/5 border-sky-500/20 text-sky-400'
                                  }`}
                                >
                                  <Clock className="w-3 h-3 mr-1" />
                                  <span>{slot.date} ({slot.startTime})</span>
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">No slots available.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab content 2 - Booked list */}
                {activeTab === 'schedule' && (
                  <div className="space-y-4 flex-1 overflow-y-auto max-h-[500px]">
                    {doctors.some(d => d.appointments && d.appointments.length > 0) ? (
                      doctors.flatMap(d => (d.appointments || []).map(app => ({...app, doctorName: d.name, speciality: d.speciality})))
                        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                        .map((app) => (
                          <div key={app.id} className="bg-slate-900/40 border border-slate-900 rounded-2xl p-5 flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <span className={`text-[10px] uppercase px-2 py-0.5 rounded-md font-bold tracking-wider ${
                                  app.status === 'BOOKED' 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : app.status === 'RESCHEDULED'
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                  {app.status}
                                </span>
                                <span className="text-xs text-slate-500">ID: #{app.id}</span>
                              </div>

                              <div className="flex items-center space-x-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-semibold text-sm text-slate-200">{app.patientName}</span>
                                <span className="text-xs text-slate-500">({app.phone})</span>
                              </div>

                              <div className="text-xs text-slate-400">
                                Doctor: <span className="text-slate-200 font-medium">{app.doctorName} ({app.speciality})</span>
                              </div>

                              <div className="flex items-center space-x-3 text-xs text-slate-500 pt-1">
                                <span className="flex items-center">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  {app.appointmentDate}
                                </span>
                                <span className="flex items-center">
                                  <Clock className="w-3 h-3 mr-1" />
                                  {app.appointmentTime}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-600" />
                        <p>No booked appointments yet.</p>
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          </>
        )}

      </main>
    </div>
  );
}
