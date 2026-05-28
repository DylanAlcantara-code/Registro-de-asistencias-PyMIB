// ═══════════════════════════════════════
//  scanner.js — QR code scanner
//  PyMIB Attendance System
// ═══════════════════════════════════════

let html5QrScanner  = null;
let scannedQRData   = null;
let scannerRunning  = false;

/**
 * Initialize and start the QR scanner
 */
async function startScanner() {
  if (scannerRunning) return;

  const statusEl = document.getElementById('scan-status');
  statusEl.textContent = 'Iniciando cámara...';
  statusEl.className   = 'scan-status';

  try {
    html5QrScanner = new Html5Qrcode('qr-reader');

    const config = {
      fps:          10,
      qrbox:        { width: 240, height: 240 },
      aspectRatio:  1.0,
      disableFlip:  false
    };

    await html5QrScanner.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      onScanFailure
    );

    scannerRunning = true;
    statusEl.textContent = 'Apunta la cámara al código QR del supervisor';
    console.log('[PyMIB Scanner] Cámara iniciada ✓');

  } catch (err) {
    console.warn('[PyMIB Scanner] Error con cámara trasera, intentando frontal...', err);
    try {
      await html5QrScanner.start(
        { facingMode: 'user' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onScanSuccess,
        onScanFailure
      );
      scannerRunning = true;
    } catch (err2) {
      console.error('[PyMIB Scanner] No se pudo iniciar la cámara:', err2);
      statusEl.textContent = '⚠ No se pudo acceder a la cámara';
      statusEl.className   = 'scan-status error';
      showToast('Error al acceder a la cámara. Verifica permisos.', 'error');
    }
  }
}

/**
 * Stop the QR scanner
 */
async function stopScanner() {
  if (html5QrScanner && scannerRunning) {
    try {
      await html5QrScanner.stop();
      html5QrScanner.clear();
    } catch (e) {
      // ignore
    }
    scannerRunning = false;
    html5QrScanner = null;
    console.log('[PyMIB Scanner] Cámara detenida');
  }
}

/**
 * Called on successful scan
 */
function onScanSuccess(decodedText) {
  const data = validateQRPayload(decodedText);

  if (!data) {
    const statusEl = document.getElementById('scan-status');
    statusEl.textContent = '⚠ QR inválido o expirado — pide uno nuevo al supervisor';
    statusEl.className   = 'scan-status error';
    showToast('QR expirado o inválido', 'error');
    // keep scanning
    return;
  }

  // Valid QR — stop scanner and show name step
  stopScanner();
  showScannedQRData(data);
}

function showScannedQRData(data) {
  scannedQRData = data;

  const statusEl = document.getElementById('scan-status');
  statusEl.textContent = '✓ QR escaneado correctamente';
  statusEl.className   = 'scan-status success';

  // Show brief confirmation
  const infoEl = document.getElementById('scanned-info');
  infoEl.classList.remove('hidden');
  infoEl.innerHTML =
    `✓ SUPERVISOR: ${escHtml(data.supervisor)}<br>` +
    `✓ PROYECTO: ${escHtml(data.proyecto)}`;

  // Transition to name step after short delay
  setTimeout(() => {
    // Populate info display
    document.getElementById('qr-info-display').innerHTML =
      `<span class="label">SUPERVISOR</span><br>` +
      `<span class="value">${escHtml(data.supervisor)}</span><br>` +
      `<span class="label">PROYECTO</span><br>` +
      `<span class="value">${escHtml(data.proyecto)}</span>`;

    document.getElementById('step-scan').classList.add('hidden');
    document.getElementById('step-name').classList.remove('hidden');
    document.getElementById('worker-name').focus();
  }, 900);
}

function decodeQRQueryPayload(payload) {
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
    const raw = decodeURIComponent(escape(atob(padded)));
    return validateQRPayload(raw);
  } catch {
    return null;
  }
}

/**
 * Called on each failed scan attempt (normal — just means no QR yet)
 */
function onScanFailure(error) {
  // Silence expected "no QR found" messages
}

/**
 * Reset scanner back to step 1
 */
function resetScan() {
  scannedQRData = null;

  document.getElementById('step-name').classList.add('hidden');
  document.getElementById('step-scan').classList.remove('hidden');
  document.getElementById('step-confirm').classList.add('hidden');

  const statusEl = document.getElementById('scan-status');
  statusEl.textContent = 'Apunta la cámara al código QR del supervisor';
  statusEl.className   = 'scan-status';

  const infoEl = document.getElementById('scanned-info');
  infoEl.classList.add('hidden');
  infoEl.innerHTML = '';

  document.getElementById('worker-name').value = '';

  startScanner();
}

/**
 * Reset the worker view completely
 */
function resetWorker() {
  scannedQRData = null;

  document.getElementById('step-confirm').classList.add('hidden');
  document.getElementById('step-name').classList.add('hidden');
  document.getElementById('step-scan').classList.remove('hidden');

  document.getElementById('scan-status').textContent = 'Apunta la cámara al código QR del supervisor';
  document.getElementById('scan-status').className   = 'scan-status';
  document.getElementById('scanned-info').classList.add('hidden');
  document.getElementById('worker-name').value = '';

  startScanner();
}
