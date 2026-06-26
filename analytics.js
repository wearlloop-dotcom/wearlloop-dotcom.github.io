// GA4 analytics for LLOOP LIFF — plain script, auto-inits on load
// Set window.CONFIG.GA4_ID in config.js (GA4 > Admin > Data Streams > Measurement ID)
(function () {
  var id = window.CONFIG && window.CONFIG.GA4_ID;
  if (!id || id === 'G-XXXXXXXXXX') return;

  var s = document.createElement('script');
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  s.async = true;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', id, { send_page_view: true });
})();

// Call after liff.getProfile() — passes only last 6 chars, never full UID
window.analyticsIdentify = function (lineUid) {
  if (!window.gtag) return;
  window.gtag('set', 'user_properties', { line_uid_suffix: lineUid ? lineUid.slice(-6) : '' });
};

window.analyticsTrack = function (eventName, params) {
  if (!window.gtag) return;
  window.gtag('event', eventName, params || {});
};

// Convenience shorthands
window.gaEvents = {
  wishlistView:     function (n)      { window.analyticsTrack('wishlist_view',     { item_count: n }); },
  wishlistAdd:      function (id, nm) { window.analyticsTrack('wishlist_add',      { item_id: id, item_name: nm }); },
  wishlistRemove:   function (id)     { window.analyticsTrack('wishlist_remove',   { item_id: id }); },
  checkoutStart:    function (oid)    { window.analyticsTrack('begin_checkout',    { order_id: oid }); },
  paymentInitiated: function (m, amt) { window.analyticsTrack('payment_initiated', { payment_method: m, value: amt, currency: 'THB' }); },
  contractViewed:   function ()       { window.analyticsTrack('contract_viewed'); },
  contractSigned:   function ()       { window.analyticsTrack('contract_signed'); },
  forecastViewed:   function ()       { window.analyticsTrack('forecast_viewed'); },
};
