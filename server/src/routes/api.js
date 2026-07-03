const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { AccessToken } = require('livekit-server-sdk');

const prisma = new PrismaClient();

// Helper to normalize doctor search (matches speciality or name)
async function findDoctor(doctorQuery) {
  if (!doctorQuery) return null;
  const query = doctorQuery.toLowerCase();

  // Try matching by speciality first
  let doctors = await prisma.doctor.findMany();
  let match = doctors.find(
    (d) =>
      d.speciality.toLowerCase().includes(query) ||
      query.includes(d.speciality.toLowerCase())
  );

  // If no speciality match, try matching by name
  if (!match) {
    match = doctors.find(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        query.includes(d.name.toLowerCase())
    );
  }

  return match;
}

// Helper to normalize relative date strings to YYYY-MM-DD
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  const clean = dateStr.toLowerCase().trim();

  // Use the system current local date as 2026-07-03 based on metadata
  const baseDate = new Date('2026-07-03T00:00:00');

  if (clean === 'today') {
    return '2026-07-03';
  } else if (clean === 'tomorrow') {
    const tomorrow = new Date(baseDate);
    tomorrow.setDate(baseDate.getDate() + 1);
    return tomorrow.toISOString().split('T')[0]; // '2026-07-04'
  } else if (clean === 'day after tomorrow') {
    const dayAfter = new Date(baseDate);
    dayAfter.setDate(baseDate.getDate() + 2);
    return dayAfter.toISOString().split('T')[0]; // '2026-07-05'
  }

  // Parse standard date formats (like "July 4", "4th July", or "2026-07-04")
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    // Ensure year is 2026 if not specified
    if (d.getFullYear() < 2026) {
      d.setFullYear(2026);
    }
    return d.toISOString().split('T')[0];
  }

  return dateStr; // Fallback to raw string if unrecognized
}

// 1. Get doctors
router.get('/doctors', async (req, res) => {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        availabilities: true,
        appointments: true,
      },
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Check availability
router.post('/check-availability', async (req, res) => {
  try {
    const { doctor, date } = req.body;
    console.log(`Checking availability for ${doctor} on ${date}`);

    const dbDoctor = await findDoctor(doctor);
    if (!dbDoctor) {
      return res.status(404).json({ error: 'Doctor/Speciality not found' });
    }

    const targetDate = normalizeDate(date);
    console.log(`Normalized date to: ${targetDate}`);

    const availabilities = await prisma.availability.findMany({
      where: {
        doctorId: dbDoctor.id,
        date: targetDate,
        isBooked: false,
      },
    });

    res.json({
      doctor: dbDoctor.name,
      speciality: dbDoctor.speciality,
      date: targetDate,
      available: availabilities.length > 0,
      slots: availabilities.map((a) => ({ id: a.id, startTime: a.startTime })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Book appointment
router.post('/book', async (req, res) => {
  try {
    const { doctor, date, time, patientName, phone } = req.body;
    console.log(`Booking request:`, req.body);

    const dbDoctor = await findDoctor(doctor);
    if (!dbDoctor) {
      return res.status(404).json({ error: 'Doctor/Speciality not found' });
    }

    const targetDate = normalizeDate(date);

    // Find if the slot is available
    const availability = await prisma.availability.findFirst({
      where: {
        doctorId: dbDoctor.id,
        date: targetDate,
        startTime: time,
        isBooked: false,
      },
    });

    if (!availability) {
      return res.status(400).json({
        error: 'Slot is not available or already booked.',
        success: false,
      });
    }

    // Mark slot as booked
    await prisma.availability.update({
      where: { id: availability.id },
      data: { isBooked: true },
    });

    // Create Appointment
    const appointment = await prisma.appointment.create({
      data: {
        patientName: patientName || 'Guest Patient',
        phone: phone || '9999999999',
        doctorId: dbDoctor.id,
        appointmentDate: targetDate,
        appointmentTime: time,
        status: 'BOOKED',
      },
      include: {
        doctor: true,
      },
    });

    res.json({
      success: true,
      appointment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Cancel appointment
router.post('/cancel', async (req, res) => {
  try {
    const { appointmentId, phone } = req.body;

    let appointment;
    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: { doctor: true },
      });
    } else if (phone) {
      // Find latest booked appointment by phone
      appointment = await prisma.appointment.findFirst({
        where: { phone, status: 'BOOKED' },
        orderBy: { createdAt: 'desc' },
        include: { doctor: true },
      });
    }

    if (!appointment || appointment.status !== 'BOOKED') {
      return res.status(404).json({ error: 'No active appointment found to cancel.' });
    }

    // Cancel appointment
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED' },
    });

    // Free up availability slot
    const availability = await prisma.availability.findFirst({
      where: {
        doctorId: appointment.doctorId,
        date: appointment.appointmentDate,
        startTime: appointment.appointmentTime,
      },
    });

    if (availability) {
      await prisma.availability.update({
        where: { id: availability.id },
        data: { isBooked: false },
      });
    }

    res.json({
      success: true,
      message: 'Appointment cancelled successfully.',
      appointment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Reschedule appointment
router.post('/reschedule', async (req, res) => {
  try {
    const { appointmentId, phone, newDate, newTime } = req.body;

    let appointment;
    if (appointmentId) {
      appointment = await prisma.appointment.findUnique({
        where: { id: parseInt(appointmentId) },
        include: { doctor: true },
      });
    } else if (phone) {
      appointment = await prisma.appointment.findFirst({
        where: { phone, status: 'BOOKED' },
        orderBy: { createdAt: 'desc' },
        include: { doctor: true },
      });
    }

    if (!appointment || appointment.status !== 'BOOKED') {
      return res.status(404).json({ error: 'No active booking found to reschedule.' });
    }

    const targetDate = normalizeDate(newDate);

    // Verify new slot availability
    const newAvailability = await prisma.availability.findFirst({
      where: {
        doctorId: appointment.doctorId,
        date: targetDate,
        startTime: newTime,
        isBooked: false,
      },
    });

    if (!newAvailability) {
      return res.status(400).json({ error: 'The requested new slot is not available.' });
    }

    // Free up old slot
    const oldAvailability = await prisma.availability.findFirst({
      where: {
        doctorId: appointment.doctorId,
        date: appointment.appointmentDate,
        startTime: appointment.appointmentTime,
      },
    });

    if (oldAvailability) {
      await prisma.availability.update({
        where: { id: oldAvailability.id },
        data: { isBooked: false },
      });
    }

    // Book new slot
    await prisma.availability.update({
      where: { id: newAvailability.id },
      data: { isBooked: true },
    });

    // Update appointment
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        appointmentDate: targetDate,
        appointmentTime: newTime,
        status: 'RESCHEDULED',
      },
      include: {
        doctor: true,
      },
    });

    res.json({
      success: true,
      message: 'Appointment rescheduled successfully.',
      appointment: updatedAppointment,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Clinic Info
router.get('/clinic', (req, res) => {
  res.json({
    name: 'Trikon Medical Clinic',
    address: '101 Wellness Boulevard, Health City',
    phone: '+1 (555) 019-9000',
    hours: 'Monday to Saturday: 9:00 AM - 5:00 PM',
    specialities: ['Cardiology', 'Dentistry', 'Dermatology'],
    doctors: [
      { name: 'Dr. Raj Sharma', speciality: 'Cardiologist', languages: ['English', 'Hindi'] },
      { name: 'Dr. Priya Singh', speciality: 'Dentist', languages: ['English', 'Hindi', 'Tamil'] },
      { name: 'Dr. Mehta', speciality: 'Dermatologist', languages: ['English', 'Hindi'] },
    ],
  });
});

// 7. LiveKit Token generation
router.post('/token', async (req, res) => {
  try {
    const { roomName, participantName } = req.body;
    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({
        error: 'LiveKit API key or secret not configured on the server',
      });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    res.json({ token, url: process.env.LIVEKIT_URL });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
