import logging
import os
import requests
from dotenv import load_dotenv
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import openai, deepgram, elevenlabs, silero

load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

logger = logging.getLogger("voice-agent")
logger.setLevel(logging.INFO)

# Define backend URL (default to local Express backend)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000/api")

@llm.function_tool(description="Check the availability of a doctor or speciality for a specific date.")
def check_availability(doctor: str, date: str) -> str:
    logger.info(f"Tool called: check_availability for {doctor} on {date}")
    try:
        r = requests.post(f"{BACKEND_URL}/check-availability", json={
            "doctor": doctor,
            "date": date
        })
        logger.info(f"Backend response: {r.text}")
        return r.text
    except Exception as e:
        logger.error(f"Error checking availability: {e}")
        return f"Error connecting to backend: {str(e)}"

@llm.function_tool(description="Book a new medical appointment. Requires doctor/speciality, date, time, patient name, and phone.")
def book_appointment(doctor: str, date: str, time: str, patient_name: str, phone: str) -> str:
    logger.info(f"Tool called: book_appointment for {doctor} on {date} at {time} for {patient_name} ({phone})")
    try:
        r = requests.post(f"{BACKEND_URL}/book", json={
            "doctor": doctor,
            "date": date,
            "time": time,
            "patientName": patient_name,
            "phone": phone
        })
        logger.info(f"Backend response: {r.text}")
        return r.text
    except Exception as e:
        logger.error(f"Error booking appointment: {e}")
        return f"Error connecting to backend: {str(e)}"

@llm.function_tool(description="Cancel an active appointment using patient's phone number or appointment ID.")
def cancel_appointment(phone: str = None, appointment_id: int = None) -> str:
    logger.info(f"Tool called: cancel_appointment with phone: {phone}, id: {appointment_id}")
    try:
        r = requests.post(f"{BACKEND_URL}/cancel", json={
            "appointmentId": appointment_id,
            "phone": phone
        })
        logger.info(f"Backend response: {r.text}")
        return r.text
    except Exception as e:
        logger.error(f"Error cancelling appointment: {e}")
        return f"Error connecting to backend: {str(e)}"

@llm.function_tool(description="Reschedule an existing appointment to a new date and time.")
def reschedule_appointment(new_date: str, new_time: str, phone: str = None, appointment_id: int = None) -> str:
    logger.info(f"Tool called: reschedule_appointment to {new_date} at {new_time}")
    try:
        r = requests.post(f"{BACKEND_URL}/reschedule", json={
            "appointmentId": appointment_id,
            "phone": phone,
            "newDate": new_date,
            "newTime": new_time
        })
        logger.info(f"Backend response: {r.text}")
        return r.text
    except Exception as e:
        logger.error(f"Error rescheduling appointment: {e}")
        return f"Error connecting to backend: {str(e)}"

@llm.function_tool(description="Get general information about the clinic, including list of doctors, address, contact, and hours.")
def get_clinic_info() -> str:
    logger.info("Tool called: get_clinic_info")
    try:
        r = requests.get(f"{BACKEND_URL}/clinic")
        logger.info(f"Backend response: {r.text}")
        return r.text
    except Exception as e:
        logger.error(f"Error getting clinic info: {e}")
        return f"Error connecting to backend: {str(e)}"


SYSTEM_PROMPTS = {
    "en": (
        "You are 'Trikon Medical Clinic' AI voice assistant.\n"
        "Rules:\n"
        "1. Never invent doctor availability. Always call `check_availability` first.\n"
        "2. If backend returns no slot or says unavailable, inform the user and suggest checking other dates or doctors.\n"
        "3. Always ask for confirmation before calling `book_appointment`.\n"
        "4. If a piece of clinic/doctor information is missing or you don't know it, say: 'I don't have that information.'\n"
        "5. If backend APIs fail or config is missing, say: 'No clinic data configured. Please contact support.'\n"
        "6. Maintain conversation history. Keep replies short, conversational, and voice-appropriate.\n"
        "7. When booking, ask the patient for their name and phone number if not already provided."
    ),
    "hi": (
        "आप 'त्रिकोण मेडिकल क्लिनिक' के एआई वॉयस असिस्टेंट हैं।\n"
        "नियम:\n"
        "1. कभी भी डॉक्टर की उपलब्धता की झूठी कल्पना न करें। हमेशा पहले `check_availability` कॉल करें।\n"
        "2. यदि बैकएंड कोई स्लॉट नहीं देता है या अनुपलब्ध कहता है, तो उपयोगकर्ता को सूचित करें और अन्य तिथियों या डॉक्टरों की जांच करने का सुझाव दें।\n"
        "3. `book_appointment` कॉल करने से पहले हमेशा पुष्टि अवश्य मांगें।\n"
        "4. यदि क्लिनिक/डॉक्टर की कोई जानकारी गायब है या आपको नहीं पता है, तो कहें: 'मेरे पास वह जानकारी नहीं है।'\n"
        "5. यदि बैकएंड विफल होता है, तो कहें: 'कोई क्लिनिक डेटा कॉन्फ़िगर नहीं किया गया है। कृपया सहायता से संपर्क करें।'\n"
        "6. बातचीत का इतिहास बनाए रखें। उत्तरों को छोटा, संवादात्मक और आवाज के अनुकूल रखें।\n"
        "7. बुकिंग करते समय, यदि मरीज का नाम और फोन नंबर पहले से उपलब्ध नहीं है, तो उनसे पूछें।"
    ),
    "ta": (
        "நீங்கள் 'திரிகோண் மருத்துவ மனை'யின் ஏஐ குரல் உதவியாளர் ஆவீர்கள்.\n"
        "விதிகள்:\n"
        "1. டாக்டரின் இருப்பை நீங்களாக கற்பனை செய்ய வேண்டாம். எப்போதும் முதலில் `check_availability` ஐ அழைக்கவும்.\n"
        "2. நியமன நேரம் கிடைக்கவில்லை என்றால் பயனருக்குத் தெரிவித்து மாற்று தேதி அல்லது மருத்துவரை சரிபார்க்க பரிந்துரைக்கவும்.\n"
        "3. நியமனத்தை முன்பதிவு செய்ய `book_appointment` ஐ அழைக்கும் முன் எப்போதும் பயனரின் உறுதிப்படுத்தலைப் பெறவும்.\n"
        "4. மருத்துவமனை அல்லது மருத்துவர் பற்றிய தகவல் இல்லை எனில், 'என்னிடம் அந்த தகவல் இல்லை' என்று கூறவும்.\n"
        "5. பின்நிலை சேவைகள் வேலை செய்யவில்லை என்றால், 'மருத்துவமனை தகவல்கள் இல்லை. ஆதரவை தொடர்பு கொள்ளவும்' என்று கூறவும்.\n"
        "6. உரையாடல் வரலாற்றைப் பேணவும். குரலுக்கு ஏற்றவாறு பதில்களை சுருக்கமாகக் கூறவும்.\n"
        "7. முன்பதிவு செய்யும் போது நோயாளியின் பெயர் மற்றும் தொலைபேசி எண்ணை கேட்டுப் பெறவும்."
    )
}

GREETINGS = {
    "en": "Hello, thank you for calling Trikon Medical Clinic. How can I help you today?",
    "hi": "नमस्ते, त्रिकोण मेडिकल क्लिनिक में कॉल करने के लिए धन्यवाद। आज मैं आपकी क्या सहायता कर सकता हूँ?",
    "ta": "வணக்கம், திரிகோண் மருத்துவ மனைக்கு அழைத்ததற்கு நன்றி. இன்று நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?"
}

async def entrypoint(ctx: JobContext):
    logger.info(f"Connecting to room {ctx.room.name}...")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    logger.info(f"Connected to room: {ctx.room.name}")

    # Determine language from room metadata or participant attributes
    language_code = "en"
    room_metadata = ctx.room.metadata or ""
    
    if "language=hi" in room_metadata:
        language_code = "hi"
    elif "language=ta" in room_metadata:
        language_code = "ta"
    
    # Alternatively, inspect participant metadata
    for participant in ctx.room.remote_participants.values():
        if participant.metadata and "language=" in participant.metadata:
            if "language=hi" in participant.metadata:
                language_code = "hi"
            elif "language=ta" in participant.metadata:
                language_code = "ta"

    logger.info(f"Selected language: {language_code}")

    initial_ctx = llm.ChatContext()
    initial_ctx.add_message(
        role="system",
        content=SYSTEM_PROMPTS.get(language_code, SYSTEM_PROMPTS["en"]),
    )

    agent = Agent(
        instructions=SYSTEM_PROMPTS.get(language_code, SYSTEM_PROMPTS["en"]),
        vad=silero.VAD.load(),
        stt=deepgram.STT(language=language_code),
        llm=openai.LLM(model="gpt-4o"),
        tts=elevenlabs.TTS(),
        chat_ctx=initial_ctx,
        tools=[check_availability, book_appointment, cancel_appointment, reschedule_appointment, get_clinic_info],
        allow_interruptions=True,
    )

    session = AgentSession(agent=agent, room=ctx.room)
    await session.start()
    
    # Introduce assistant
    greeting_text = GREETINGS.get(language_code, GREETINGS["en"])
    await session.say(greeting_text, allow_interruptions=True)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
