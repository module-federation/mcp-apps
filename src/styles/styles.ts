export function injectGlobalStyles() {
  const globalStyle = document.createElement('style');
  globalStyle.textContent = `
    body, html {
      margin: 0 !important;
      padding: 0 !important;
      height: auto !important;
      overflow: visible !important;
    }
    * {
      box-sizing: border-box;
    }
    
    /* Toolbar - visible on hover only, not part of the document flow */
    .mf-toolbar {
      position: fixed;
      top: 8px;
      right: 8px;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.2s ease;
      display: flex;
      gap: 8px;
      pointer-events: none;
    }
    
    .mf-main:hover .mf-toolbar {
      opacity: 1;
    }
    
    /* Tool button styles */
    .mf-tool-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      font-size: 16px;
      background: rgba(255, 255, 255, 0.6);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      pointer-events: auto;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    
    .mf-tool-btn:hover {
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
      transform: translateY(-1px);
    }
    
    .mf-tool-btn.active {
      background: rgba(220, 38, 38, 0.1);
    }
    
    /* Loading spinner animation */
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
    
    .loading-spinner {
      display: inline-block;
      width: 48px;
      height: 48px;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-top-color: #0284c7;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  `;
  document.head.appendChild(globalStyle);
}
