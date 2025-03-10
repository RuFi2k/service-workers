if ('serviceWorker' in navigator) {
    // Register the service worker
    navigator.serviceWorker.register('/sw.js')
      .then(function(registration) {
        console.log('Service Worker registered with scope:', registration.scope);
      })
      .catch(function(error) {
        console.log('Service Worker registration failed:', error);
      });
  }
  