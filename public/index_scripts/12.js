
  document.getElementById('boot-status').textContent = 'Starting app…';
  if (typeof React === 'undefined') showBootError('React did not load', 'window.React is undefined. Likely a network/CDN block.');
  else if (typeof ReactDOM === 'undefined') showBootError('ReactDOM did not load', 'window.ReactDOM is undefined. Likely a network/CDN block.');
