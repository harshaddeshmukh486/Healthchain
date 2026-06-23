const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const files = fs.readdirSync(rootDir);
const htmlFiles = files.filter(f => f.endsWith('.html'));

const headInjection = `
  <!-- PWA Manifest -->
  <link rel="manifest" href="/manifest.json" />
  
  <!-- Global Error Handler -->
  <script type="module" src="/src/js/error-handler.js"></script>
  
  <!-- Service Worker Registration -->
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(registration => {
          console.log('SW registered: ', registration.scope);
        }).catch(registrationError => {
          console.log('SW registration failed: ', registrationError);
        });
      });
    }
  </script>
`;

htmlFiles.forEach(file => {
  const filePath = path.join(rootDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if already injected
  if (!content.includes('service-worker.js') && content.includes('</head>')) {
    content = content.replace('</head>', headInjection + '</head>');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Injected into ' + file);
  }
});
