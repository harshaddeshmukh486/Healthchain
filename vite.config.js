import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

const force404Plugin = () => ({
  name: 'force-404',
  configureServer(server) {
    server.middlewares.use((req, res) => {
      res.statusCode = 404;
      res.end('Site is currently down for maintenance.');
    });
  }
});

export default defineConfig({
  plugins: [tailwindcss(), force404Plugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        patient: resolve(__dirname, 'patient.html'),
        doctor: resolve(__dirname, 'doctor.html'),
        doctorVerify: resolve(__dirname, 'doctor-verify.html'),
        appointments: resolve(__dirname, 'appointments.html'),
        vault: resolve(__dirname, 'vault.html'),
        childVaccine: resolve(__dirname, 'child-vaccine.html'),
        blockchain: resolve(__dirname, 'blockchain.html'),
        emergency: resolve(__dirname, 'emergency.html'),
        family: resolve(__dirname, 'family.html'),
        hospital: resolve(__dirname, 'hospital.html'),
        labTests: resolve(__dirname, 'lab-tests.html'),
        medicines: resolve(__dirname, 'medicines.html'),
        periodTracker: resolve(__dirname, 'period-tracker.html'),
        pharmacy: resolve(__dirname, 'pharmacy.html'),
        profile: resolve(__dirname, 'profile.html'),
        reminders: resolve(__dirname, 'reminders.html'),
        symptoms: resolve(__dirname, 'symptoms.html'),
        aiAgent: resolve(__dirname, 'ai-agent.html')
      }
    }
  }
});
