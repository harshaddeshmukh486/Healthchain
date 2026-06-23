// Global Error Handler for HealthChain
import { showToast } from './toast.js';

window.addEventListener('error', function(event) {
    console.error("Global error caught:", event.error);
    showToast("Oops! Something went wrong, but your data is safe.", "error");
    // Prevent the default browser crash/error logging behavior if desired
    // event.preventDefault();
});

window.addEventListener('unhandledrejection', function(event) {
    console.error("Unhandled promise rejection caught:", event.reason);
    
    // Ignore MetaMask related "user rejected" errors from spamming the global toast
    // if handled locally, but catch anything else that falls through.
    if (event.reason && event.reason.code === 4001) {
        // User rejected the request in MetaMask, no need for a scary global error
        return;
    }
    
    showToast("A network or background task failed. Please try again.", "warning");
});
