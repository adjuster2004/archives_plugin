// Текущая версия этого файла
const CURRENT_VERSION = "1.1.0";
// Ссылка на "сырой" файл настроек на вашем GitHub
const INFO_URL = "https://raw.githubusercontent.com/adjuster2004/archives_plugin/main/info.json";

// Словарь названий архивов
const ARCHIVE_NAMES = {
  "anro.ryazan.gov.ru": "Рязанский архив"
};

function initPlugin() {
  if (document.getElementById('archive-toggle-btn')) return;

  const currentHost = window.location.hostname;
  const panelTitle = ARCHIVE_NAMES[currentHost] || "Скачивание картинок";

  const toggleBtn = document.createElement('button');
  toggleBtn.id = 'archive-toggle-btn';
  toggleBtn.innerHTML = '📥'; 
  toggleBtn.title = 'Меню скачивания';
  document.body.appendChild(toggleBtn);

  const panel = document.createElement('div');
  panel.id = 'archive-panel';
  panel.innerHTML = `
    <h3>${panelTitle}</h3>
    <div id="archive-remote-message" style="display:none; color: #856404; background-color: #fff3cd; padding: 8px; margin-bottom: 10px; border-radius: 4px; font-size: 11px; line-height: 1.3; border: 1px solid #ffeeba;"></div>
    <button id="archive-start-btn">Запустить</button>
    <div id="archive-counter-display">Загружено: <span id="archive-count">0</span></div>
    <div class="footer">
      Разработано <a href="https://github.com/adjuster2004" target="_blank" style="color: #007bff; text-decoration: none;">@adjuster2004</a><br>
      2026 v ${CURRENT_VERSION} <span id="archive-update-badge" style="display:none;"><br><a href="https://github.com/adjuster2004/archives_plugin" target="_blank" style="color: red; font-weight: bold; text-decoration: none;">🆕 Доступно обновление!</a></span>
    </div>
  `;
  document.body.appendChild(panel);

  toggleBtn.addEventListener('click', () => {
    panel.style.display = (panel.style.display === 'block') ? 'none' : 'block';
  });

  fetchUpdateInfo();
  setupLogic();
}

function fetchUpdateInfo() {
  fetch(INFO_URL + '?t=' + new Date().getTime())
    .then(response => response.json())
    .then(data => {
      if (data.message && data.message.trim() !== "") {
        const msgDiv = document.getElementById('archive-remote-message');
        msgDiv.textContent = data.message;
        msgDiv.style.display = 'block';
      }
      if (data.latest_version && isNewerVersion(data.latest_version, CURRENT_VERSION)) {
        document.getElementById('archive-update-badge').style.display = 'inline';
      }
    })
    .catch(error => {
      console.log('Archive Plugin: Не удалось проверить обновления', error);
    });
}

function isNewerVersion(latest, current) {
  const v1 = latest.split('.').map(Number);
  const v2 = current.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    let num1 = v1[i] || 0;
    let num2 = v2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}

function setupLogic() {
  let isDownloading = false;
  let downloadedFiles = 0;
  let lastDownloadedPath = ""; 
  let waitCycles = 0;

  const startBtn = document.getElementById('archive-start-btn');
  const countSpan = document.getElementById('archive-count');

  startBtn.addEventListener('click', () => {
    if (isDownloading) {
      isDownloading = false;
      startBtn.textContent = 'Запустить';
      startBtn.classList.remove('stop');
      return;
    }

    isDownloading = true;
    downloadedFiles = 0;
    waitCycles = 0;
    lastDownloadedPath = "";
    countSpan.textContent = downloadedFiles;
    
    startBtn.textContent = 'Остановить';
    startBtn.classList.add('stop');
    
    processNextPage();
  });

  function getEffectiveZIndex(element) {
    let z = 0;
    let el = element;
    while (el && el !== document) {
      if (el.nodeType === 1) { 
        const style = window.getComputedStyle(el);
        if (style && style.zIndex && style.zIndex !== 'auto') {
           let currentZ = parseInt(style.zIndex, 10);
           if (!isNaN(currentZ) && currentZ > z) {
             z = currentZ;
           }
        }
      }
      el = el.parentNode;
    }
    return z;
  }

  function getTopmostElement(elements) {
    let topEl = null;
    let maxZ = -1;
    for (let el of elements) {
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue; 
      let z = getEffectiveZIndex(el);
      if (z >= maxZ) {
        maxZ = z;
        topEl = el;
      }
    }
    return topEl;
  }

  function isLoading() {
    const dialogs = document.querySelectorAll('.ui-dialog, .ui-blockui-content');
    const validDialogs = [];
    for (let dialog of dialogs) {
      const style = window.getComputedStyle(dialog);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        if (dialog.innerText && dialog.innerText.toLowerCase().includes('подождите')) {
          validDialogs.push(dialog);
        }
      }
    }
    return getTopmostElement(validDialogs) !== null;
  }

  function getDocumentLabelText() {
    const labels = document.querySelectorAll('label.ui-outputlabel.ui-widget');
    const validLabels = [];
    for (let label of labels) {
      const text = label.textContent.trim();
      if (/\.(jpg|jpeg|png|tif|tiff|pdf)\s*$/i.test(text)) {
        validLabels.push(label);
      }
    }
    const topLabel = getTopmostElement(validLabels);
    if (topLabel) return topLabel.textContent.trim();
    return null;
  }

  function getNextButton() {
    const btns = document.querySelectorAll('a.btn-watermark.btn-right');
    const validBtns = [];
    for (let btn of btns) {
      if (btn.style.display !== 'none' && !btn.classList.contains('ui-state-disabled')) {
        validBtns.push(btn);
      }
    }
    return getTopmostElement(validBtns);
  }

  function getLargestBase64Image() {
    let largestImage = null;
    let maxLength = 0;

    function checkAndSet(str) {
      if (str && str.startsWith('data:image') && str.length > maxLength) {
        maxLength = str.length;
        largestImage = str;
      }
    }

    function extractBase64(urlStr) {
      if (!urlStr) return null;
      let match = urlStr.match(/url\((.*?)\)/i);
      if (match && match[1]) {
        let inner = match[1].trim();
        inner = inner.replace(/^(?:&quot;|['"])+|(?:&quot;|['"])+$/g, '');
        if (inner.startsWith('data:image')) return inner;
      }
      return null;
    }

    const scanImages = document.querySelectorAll('.scanImage');
    for (let div of scanImages) {
      if (div.offsetWidth === 0 && div.offsetHeight === 0) continue; 
      checkAndSet(extractBase64(window.getComputedStyle(div).backgroundImage));
      checkAndSet(extractBase64(div.getAttribute('style')));
    }

    if (largestImage && largestImage.length > 5000) return largestImage;

    const allElements = document.querySelectorAll('*');
    for (let el of allElements) {
      for (let attr of el.attributes) {
        if (attr.value && attr.value.trim().startsWith('data:image')) {
          checkAndSet(attr.value.trim());
        }
      }
      if (el.nodeType === 1) {
          checkAndSet(extractBase64(window.getComputedStyle(el).backgroundImage));
          checkAndSet(extractBase64(el.getAttribute('style')));
      }
    }

    return largestImage;
  }

  function finishDownload(message) {
    alert(message || `Загрузка завершена! Всего загружено файлов: ${downloadedFiles}`);
    isDownloading = false;
    startBtn.textContent = 'Запустить';
    startBtn.classList.remove('stop');
  }

  function processNextPage() {
    if (!isDownloading) return;

    if (isLoading()) {
      setTimeout(processNextPage, 500);
      return;
    }

    let fullText = getDocumentLabelText();
    let folderName = "archive_downloads"; 
    let fileName = `page_${downloadedFiles + 1}.png`;

    if (fullText) {
      const match = fullText.match(/(.*)\s+([^\s]+)$/);
      if (match) {
        folderName = match[1].trim().replace(/[<>:"/\\|?*]/g, ''); 
        fileName = match[2].trim().replace(/[<>:"/\\|?*]/g, '');
      } else {
        fileName = fullText.trim().replace(/[<>:"/\\|?*]/g, '');
      }
    }

    const fullPath = `${folderName}/${fileName}`;

    if (fullPath === lastDownloadedPath && lastDownloadedPath !== "") {
      waitCycles++;
      if (waitCycles > 20) { 
        finishDownload("Таймаут: страница не перелистывается. Завершаем работу.");
        return;
      }
      setTimeout(processNextPage, 500);
      return;
    }

    const imgSrc = getLargestBase64Image();

    if (imgSrc && imgSrc.length > 5000) {
      chrome.runtime.sendMessage({
        action: 'download',
        url: imgSrc,
        filename: fullPath
      });

      lastDownloadedPath = fullPath; 
      downloadedFiles++;
      countSpan.textContent = downloadedFiles;
      waitCycles = 0; 
    } else {
      waitCycles++;
      if (waitCycles > 20) {
        finishDownload("Таймаут: большая картинка не найдена в коде страницы.");
        return;
      }
      setTimeout(processNextPage, 500);
      return;
    }

    const nextBtn = getNextButton();

    if (nextBtn) {
      nextBtn.click();
      setTimeout(processNextPage, 1000); 
    } else {
      finishDownload();
    }
  }
}

if (document.body) {
  initPlugin();
} else {
  document.addEventListener('DOMContentLoaded', initPlugin);
}
