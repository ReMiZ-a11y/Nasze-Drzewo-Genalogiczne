// Plik: ui.js

const messageBox = document.getElementById("message-box");
let messageTimeout;

/**
 * Wyświetla komunikat w specjalnym elemencie na stronie.
 * @param {string} msg - Treść komunikatu.
 * @param {'info' | 'error' | 'success'} type - Typ komunikatu (wpływa na styl).
 */
export function showMessage(msg, type = "info") {
  if (!messageBox) {
    console.warn("⚠️ Brak elementu #message-box w DOM.");
    return;
  }
  clearTimeout(messageTimeout);
  messageBox.textContent = msg;
  messageBox.className = `message-box ${type}`;
  messageTimeout = setTimeout(() => {
    messageBox.textContent = "";
    messageBox.className = "message-box";
  }, 5000);
}