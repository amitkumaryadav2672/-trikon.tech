const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.appointment.deleteMany({});
  await prisma.availability.deleteMany({});
  await prisma.doctor.deleteMany({});

  console.log('Seeding doctors...');
  const drSharma = await prisma.doctor.create({
    data: {
      name: 'Dr. Raj Sharma',
      speciality: 'Cardiologist',
      experience: 15,
      language: 'English, Hindi',
    },
  });

  const drSingh = await prisma.doctor.create({
    data: {
      name: 'Dr. Priya Singh',
      speciality: 'Dentist',
      experience: 8,
      language: 'English, Hindi, Tamil',
    },
  });

  const drMehta = await prisma.doctor.create({
    data: {
      name: 'Dr. Mehta',
      speciality: 'Dermatologist',
      experience: 12,
      language: 'English, Hindi',
    },
  });

  const today = '2026-07-03';
  const tomorrow = '2026-07-04';
  const dayAfter = '2026-07-05';

  console.log('Seeding availabilities...');
  const slots = [
    // Dr. Sharma (Cardiologist)
    { doctorId: drSharma.id, date: today, startTime: '09:00 AM', endTime: '09:30 AM' },
    { doctorId: drSharma.id, date: today, startTime: '10:00 AM', endTime: '10:30 AM' },
    { doctorId: drSharma.id, date: tomorrow, startTime: '09:00 AM', endTime: '09:30 AM' },
    { doctorId: drSharma.id, date: tomorrow, startTime: '11:00 AM', endTime: '11:30 AM' },
    { doctorId: drSharma.id, date: dayAfter, startTime: '02:00 PM', endTime: '02:30 PM' },

    // Dr. Singh (Dentist)
    { doctorId: drSingh.id, date: today, startTime: '11:00 AM', endTime: '11:30 AM' },
    { doctorId: drSingh.id, date: tomorrow, startTime: '10:00 AM', endTime: '10:30 AM' },
    { doctorId: drSingh.id, date: tomorrow, startTime: '03:00 PM', endTime: '03:30 PM' },
    { doctorId: drSingh.id, date: dayAfter, startTime: '11:00 AM', endTime: '11:30 AM' },

    // Dr. Mehta (Dermatologist)
    { doctorId: drMehta.id, date: today, startTime: '01:00 PM', endTime: '01:30 PM' },
    { doctorId: drMehta.id, date: tomorrow, startTime: '11:30 AM', endTime: '12:00 PM' },
    { doctorId: drMehta.id, date: tomorrow, startTime: '04:00 PM', endTime: '04:30 PM' },
    { doctorId: drMehta.id, date: dayAfter, startTime: '10:30 AM', endTime: '11:00 AM' },
  ];

  for (const slot of slots) {
    await prisma.availability.create({
      data: slot,
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
