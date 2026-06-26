// n8n webhook stubs — set window.CONFIG.N8N_BASE_URL in config.js to activate
// All calls are silent no-ops when URL is empty
window.webhooks = (function () {
  function post(path, payload) {
    var base = window.CONFIG && window.CONFIG.N8N_BASE_URL;
    if (!base) return;
    fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(function (e) { console.warn('[n8n]', path, e.message); });
  }

  return {
    // After payment slip is approved
    orderConfirmed: function (order)             { post('/webhook/order-confirmed', order); },
    // After new items added to inventory → triggers wishlist broadcast via LINE
    newArrivals:    function (items)             { post('/webhook/new-arrivals',    { items: items }); },
    // Day before return date
    returnReminder: function (rentalId, lineUid) { post('/webhook/return-reminder', { rental_id: rentalId, line_uid: lineUid }); },
    // After ops marks item returned & clean
    requestReview:  function (rentalId, lineUid) { post('/webhook/request-review',  { rental_id: rentalId, line_uid: lineUid }); },
  };
})();
