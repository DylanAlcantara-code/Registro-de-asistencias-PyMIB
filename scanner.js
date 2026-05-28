// QR scanner controller

let html5QrScanner = null;
let scannedQRData = null;
let scannerRunning = false;

function setCameraButtonVisible(visible) {
  const btn = document.getElementById('btn-start-camera');
  if (btn) btn.classList.toggle('hidden', !visible);
}

function prepareScannerPrompt() {
  if (scannedQRData || scannerRunning) return;

  const statusEl = document.getElementById('scan-status');
  if (statusEl) {
    statusEl.textContent = 'Toca el boton para activar la camara';
    statusEl.className = 'scan-status';
  }

  const reader = document.getElementById('qr-reader');
  if (reader && !reader.dataset.ready) {
    reader.innerHTML = '';
  }

  setCameraButtonVisible(true);
}

function userStartScanner() {
  startScanner();
}

async function startScanner() {
  if (scannerRunning) return;

  const statusEl = document.getElementById('scan-status');
  statusEl.textContent = 'Iniciando camara...';
  statusEl.className = 'scan-status';
  setCameraButtonVisible(false);

  if (typeof Html5Qrcode === 'undefined') {
    statusEl.textContent = 'No se cargo el lector QR. Abre la app con internet una vez y vuelve a intentar.';
    statusEl.className = 'scan-status error';
    setCameraButtonVisible(true);
    return;
  }

  if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    statusEl.textContent = 'La camara requiere HTTPS. Abre la app desde GitHub Pages con https://';
    statusEl.className = 'scan-status error';
    setCameraButtonVisible(true);
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    statusEl.textContent = 'Este navegador no permite acceso a camara.';
    statusEl.className = 'scan-status error';
    setCameraButtonVisible(true);
    return;
  }

  try {
    const reader = document.getElementById('qr-reader');
    reader.innerHTML = '';
    reader.dataset.ready = '1';

    html5QrScanner = new Html5Qrcode('qr-reader');

    const config = {
      fps: 10,
      qrbox: { width: 240, height: 240 },
      aspectRatio: 1.0,
      disableFlip: false
    };

    let cameraConfig = { facingMode: 'environment' };
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length) {
        const rear = cameras.find(c => /back|rear|environment|trasera|posterior/i.test(c.label));
        cameraConfig = (rear || cameras[cameras.length - 1]).id;
      }
    } catch (cameraListErr) {
      console.warn('[PyMIB Scanner] No se pudieron listar camaras:', cameraListErr);
    }

    await html5QrScanner.start(cameraConfig, config, onScanSuccess, onScanFailure);

    scannerRunning = true;
    statusEl.textContent = 'Apunta la camara al codigo QR del supervisor';
    statusEl.className = 'scan-status';
    console.log('[PyMIB Scanner] Camara iniciada');
  } catch (err) {
    console.warn('[PyMIB Scanner] Error con camara principal, intentando frontal...', err);

    try {
      if (!html5QrScanner) html5QrScanner = new Html5Qrcode('qr-reader');
      await html5QrScanner.start(
        { facingMode: 'user' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        onScanSuccess,
        onScanFailure
      );
      scannerRunning = true;
      statusEl.textContent = 'Apunta la camara al codigo QR del supervisor';
      statusEl.className = 'scan-status';
    } catch (err2) {
      console.error('[PyMIB Scanner] No se pudo iniciar la camara:', err2);
      statusEl.textContent = 'No se pudo acceder a la camara. Revisa permisos de Chrome > Configuracion del sitio > Camara.';
      statusEl.className = 'scan-status error';
      showToast('Error al acceder a la camara. Verifica permisos.', 'error', 6000);
      setCameraButtonVisible(true);
    }
  }
}

async function stopScanner() {
  if (html5QrScanner && scannerRunning) {
    try {
      await html5QrScanner.stop();
      html5QrScanner.clear();
    } catch (e) {
      // Ignore scanner cleanup errors.
    }
  }

  scannerRunning = false;
  html5QrScanner = null;

  const reader = document.getElementById('qr-reader');
  if (reader) delete reader.dataset.ready;
}

function onScanSuccess(decodedText) {
  const data = validateQRPayload(decodedText);

  if (!data) {
    const statusEl = document.getElementById('scan-status');
    statusEl.textContent = 'QR invalido o expirado. Pide uno nuevo al supervisor.';
    statusEl.className = 'scan-status error';
    showToast('QR expirado o invalido', 'error');
    return;
  }

  stopScanner();
  showScannedQRData(data);
}

function showScannedQRData(data) {
  scannedQRData = data;
  setCameraButtonVisible(false);

  const statusEl = document.getElementById('scan-status');
  statusEl.textContent = 'QR escaneado correctamente';
  statusEl.className = 'scan-status success';

  const infoEl = document.getElementById('scanned-info');
  infoEl.classList.remove('hidden');
  infoEl.innerHTML =
    `SUPERVISOR: ${escHtml(data.supervisor)}<br>` +
    `PROYECTO: ${escHtml(data.proyecto)}`;

  setTimeout(() => {
    document.getElementById('qr-info-display').innerHTML =
      `<span class="label">SUPERVISOR</span><br>` +
      `<span class="value">${escHtml(data.supervisor)}</span><br>` +
      `<span class="label">PROYECTO</span><br>` +
      `<span class="value">${escHtml(data.proyecto)}</span>`;

    document.getElementById('step-scan').classList.add('hidden');
    document.getElementById('step-name').classList.remove('hidden');
    document.getElementById('worker-name').focus();
  }, 500);
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

function onScanFailure(error) {
  // Normal while the camera is looking for a QR.
}

function resetScan() {
  scannedQRData = null;

  document.getElementById('step-name').classList.add('hidden');
  document.getElementById('step-scan').classList.remove('hidden');
  document.getElementById('step-confirm').classList.add('hidden');

  const infoEl = document.getElementById('scanned-info');
  infoEl.classList.add('hidden');
  infoEl.innerHTML = '';

  document.getElementById('worker-name').value = '';
  prepareScannerPrompt();
}

function resetWorker() {
  scannedQRData = null;

  document.getElementById('step-confirm').classList.add('hidden');
  document.getElementById('step-name').classList.add('hidden');
  document.getElementById('step-scan').classList.remove('hidden');
  document.getElementById('scanned-info').classList.add('hidden');
  document.getElementById('worker-name').value = '';

  prepareScannerPrompt();
}
