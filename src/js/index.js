import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

document.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Find all CTA links pointing to login.html
      const ctas = document.querySelectorAll('.auth-cta');
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const role = userDoc.exists() && userDoc.data().role ? userDoc.data().role : 'patient';
        const dashboardPage = role === 'doctor' ? 'doctor.html' : 'patient.html';
        
        ctas.forEach(cta => {
          cta.textContent = '🚀 Go to Dashboard';
          cta.href = dashboardPage;
        });
      } catch (e) {
        ctas.forEach(cta => {
          cta.textContent = '🚀 Go to Dashboard';
          cta.href = 'patient.html';
        });
      }
    }
  });
});
