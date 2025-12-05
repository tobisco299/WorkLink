// Paystack Configuration

window.__PAYSTACK_CONFIG__ = {
  publicKey: 'pk_test_ea9b12a803e498c6ff17e81ffc86bb22b980db60', 
  currency: 'NGN',
  baseURL: 'https://api.paystack.co'
};

// Initialize Paystack SDK with proper loading
window.__PAYSTACK_READY__ = false;

if (!window.PaystackPop) {
  const script = document.createElement('script');
  script.src = 'https://js.paystack.co/v1/inline.js';
  script.async = true;
  script.onload = function() {
    window.__PAYSTACK_READY__ = true;
    console.log('Paystack SDK loaded');
  };
  script.onerror = function() {
    console.error('Failed to load Paystack SDK');
  };
  document.head.appendChild(script);
} else {
  window.__PAYSTACK_READY__ = true;
}

