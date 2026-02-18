// Content script injected into Amazon.com pages.
// Handles requests from background to extract HTML or submit forms.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'EXTRACT_HTML') {
    sendResponse({ html: document.documentElement.outerHTML });
    return true;
  }

  if (message.action === 'SUBMIT_FORM') {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = window.location.href;
    form.style.display = 'none';

    var ws = document.createElement('input');
    ws.type = 'hidden';
    ws.name = 'ppw-widgetState';
    ws.value = message.widgetState;
    form.appendChild(ws);

    var ie = document.createElement('input');
    ie.type = 'hidden';
    ie.name = 'ie';
    ie.value = 'UTF-8';
    form.appendChild(ie);

    var ev = document.createElement('input');
    ev.type = 'hidden';
    ev.name = message.eventName;
    ev.value = '';
    form.appendChild(ev);

    document.body.appendChild(form);
    form.submit();
    sendResponse({ submitted: true });
    return true;
  }
});
