// Paystack Payment Integration Module
(function () {
  'use strict';

  // Initialize Paystack payment
  window.initializePaystackPayment = function(options) {
    return new Promise(function(resolve, reject) {
      // Wait for PaystackPop to be available
      let attempts = 0;
      const maxAttempts = 150; // 15 seconds with 100ms intervals
      
      const checkPaystack = setInterval(function() {
        attempts++;
        
        if (window.PaystackPop && window.__PAYSTACK_READY__) {
          clearInterval(checkPaystack);
          
          // Validate email before sending to Paystack
          if (!options.email || !options.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            reject(new Error('Invalid email format. Please provide a valid email address.'));
            return;
          }
          
          try {
            const handler = window.PaystackPop.setup({
              key: window.__PAYSTACK_CONFIG__.publicKey,
              email: options.email,
              amount: options.amount * 100, // Paystack uses kobo (cents)
              currency: window.__PAYSTACK_CONFIG__.currency,
              ref: 'WorkLink_' + Date.now(), // Unique reference
              custom_fields: [
                {
                  display_name: 'Permit Count',
                  variable_name: 'permit_count',
                  value: options.permitCount
                },
                {
                  display_name: 'Username',
                  variable_name: 'username',
                  value: options.username
                }
              ],
              onClose: function() {
                reject(new Error('Payment window closed'));
              },
              callback: function(response) {
                // Payment successful - verify and record
                recordPaystackPayment(response, options).then(resolve).catch(reject);
              }
            });
            
            handler.openIframe();
          } catch (err) {
            reject(new Error('Failed to initialize payment: ' + err.message));
          }
        } else if (attempts >= maxAttempts) {
          clearInterval(checkPaystack);
          reject(new Error('Paystack SDK failed to load. Please refresh the page and try again.'));
        }
      }, 100);
    });
  };

  // Record the payment (prefer using app APIs so Firestore sync happens)
  async function recordPaystackPayment(paystackResponse, options) {
    try {
      // If the app exposes LH helpers, prefer them (they will sync to Firestore)
      if (window.LH && typeof window.LH.createPayment === 'function' && typeof window.LH.purchasePermit === 'function') {
        const p = await window.LH.createPayment(null, options.username, 'platform', options.amount);
        try { await window.LH.purchasePermit(options.username, options.permitCount); } catch(e) { /* non-fatal */ }
        // augment with Paystack metadata
        if (p) {
          p.paymentMethod = 'paystack';
          p.paystackReference = paystackResponse.reference;
          p.paystackAccessCode = paystackResponse.access_code;
        }
        return p;
      }

      // Fallback: localStorage only
      const payments = JSON.parse(localStorage.getItem('lh_payments') || '[]');
      const payment = {
        id: Date.now() + Math.floor(Math.random() * 999),
        taskId: null,
        from: options.username,
        to: 'platform',
        amount: options.amount,
        permitCount: options.permitCount,
        status: 'completed',
        paymentMethod: 'paystack',
        paystackReference: paystackResponse.reference,
        paystackAccessCode: paystackResponse.access_code,
        createdAt: new Date().toISOString()
      };
      payments.push(payment);
      localStorage.setItem('lh_payments', JSON.stringify(payments));
      // Update user permits in local fallback
      updateUserPermitsAfterPayment(options.username, options.permitCount);
      return payment;
    } catch (err) {
      throw err;
    }
  }

  // Update user's permit count after successful payment (local fallback only)
  function updateUserPermitsAfterPayment(username, permitCount) {
    try {
      const users = JSON.parse(localStorage.getItem('lh_users') || '[]');
      const userIndex = users.findIndex(u => u.username === username);
      if (userIndex !== -1) {
        users[userIndex].permits = (users[userIndex].permits || 0) + permitCount;
        localStorage.setItem('lh_users', JSON.stringify(users));
      }
    } catch (err) {
      console.error('Error updating permits:', err);
    }
  }

  // Verify payment with Paystack (client-side check)
  window.verifyPaystackPayment = function(reference) {
    return fetch(window.__PAYSTACK_CONFIG__.baseURL + '/transaction/verify/' + reference, {
      headers: {
        'Authorization': 'Bearer ' + window.__PAYSTACK_CONFIG__.publicKey
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data.status && data.data.status === 'success') {
        return data.data;
      } else {
        throw new Error('Payment verification failed');
      }
    });
  };

})();
