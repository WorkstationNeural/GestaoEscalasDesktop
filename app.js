// === Persistência de Dados via LocalStorage ===
const Storage = {
    get: (key, defaultValue = null) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    },
    set: (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
    }
};

// --- Estado Global ---
let technicians = Storage.get('technicians', []);
let sites = Storage.get('sites', []);
let modes = Storage.get('modes', ['Presencial', 'Remoto']); // Presets iniciais

// Agora armazenaremos as tabelas baseadas numa data específica
// { "2024-09-04": { N1: [...], N2: [...], GA: [...] } }
let dailyScales = Storage.get('daily_scales', {});
let currentSelectedDate = ''; // 'YYYY-MM-DD'

const MAIN_TABLES = ['N1', 'N2', 'GA'];

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    initDatePicker();
    loadMainTables(currentSelectedDate);
    renderSettingsLists();
    setupEventListeners();
});

function initDatePicker() {
    const picker = document.getElementById('current-date-picker');

    // Set for current day if nothing selected
    const now = new Date();
    // Ajuste fuso local
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    currentSelectedDate = `${y}-${m}-${d}`;

    picker.value = currentSelectedDate;
    updateSubtitles(currentSelectedDate);

    picker.addEventListener('change', (e) => {
        currentSelectedDate = e.target.value;
        updateSubtitles(currentSelectedDate);
        loadMainTables(currentSelectedDate); // Refresh screens with new data
    });
}

function updateSubtitles(dateStr) {
    if (!dateStr) return;
    const parts = dateStr.split('-');
    const formatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    document.getElementById('daily-subtitle').textContent = `Escala do dia ${formatted}`;
}

function formatLocalDateStr(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function formatBR(dateStr) {
    const parts = dateStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function setupEventListeners() {
    // Modal Ajustes
    document.getElementById('btn-open-techs').addEventListener('click', () => toggleModal(true));
    document.getElementById('btn-close-modal').addEventListener('click', () => toggleModal(false));
    document.getElementById('tech-modal-backdrop').addEventListener('click', () => toggleModal(false));

    // Adição Listas
    document.getElementById('btn-add-tech').addEventListener('click', addTechnician);
    document.getElementById('new-tech-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTechnician();
    });


    document.getElementById('btn-add-mode').addEventListener('click', addMode);
    document.getElementById('new-mode-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addMode();
    });

    document.getElementById('btn-add-site').addEventListener('click', addSite);
    document.getElementById('new-site-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSite();
    });

    // Navegação Visões
    document.getElementById('btn-show-monthly').addEventListener('click', showMonthlyView);
    document.getElementById('btn-show-main').addEventListener('click', showMainView);

    // Adicionar Linha Botões (Apenas na diária agora)
    document.querySelectorAll('.btn-add-row').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tableId = e.target.getAttribute('data-table');
            addRow(`view-main-${tableId}`, document.querySelector(`table[data-table="${tableId}"] tbody`));
            saveDailyScale();
        });
    });

    // Publicar na Web
    document.getElementById('btn-publish-web').addEventListener('click', publishScale);

    // Auto-Save listeners
    document.body.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            if (e.target.classList.contains('date-picker')) return; // ignora inputs do sistema

            if (document.getElementById('view-main').classList.contains('hidden')) {
                saveMonthlyScale(); // Visão mensal salva multiplas datas
            } else {
                saveDailyScale();   // Visão dia salva a data atual
            }
        }
    });

    // Import e Export via PyWebview Bridge
    document.getElementById('btn-export-backup').addEventListener('click', async () => {
        if (!window.pywebview) return alert("API nativa indisponível. Rode pelo executável main.py");

        const backupData = {
            version: '2.0',
            technicians,
            sites,
            daily_scales: dailyScales
        };
        const jsonStr = JSON.stringify(backupData, null, 2);
        const filename = `backup_escala_${currentSelectedDate}.json`;

        const success = await window.pywebview.api.export_backup_dialog(jsonStr, filename);
        if (success) {
            alert("Backup exportado com sucesso!");
        }
    });

    document.getElementById('btn-import-backup').addEventListener('click', async () => {
        if (!window.pywebview) return alert("API nativa indisponível. Rode pelo executável main.py");

        const content = await window.pywebview.api.import_backup_dialog();
        if (content) {
            try {
                const parsed = JSON.parse(content);
                if (parsed.technicians) {
                    technicians = parsed.technicians;
                    Storage.set('technicians', technicians);
                }
                if (parsed.sites) {
                    sites = parsed.sites;
                    Storage.set('sites', sites);
                }
                if (parsed.daily_scales) {
                    // Mescla com as escalas existentes
                    dailyScales = { ...dailyScales, ...parsed.daily_scales };
                    Storage.set('daily_scales', dailyScales);
                }

                alert("Backup importado com sucesso! Recarregando sistema...");
                renderSettingsLists();
                loadMainTables(currentSelectedDate);
                updateAllSelects();
                toggleModal(false);

            } catch (err) {
                alert("Arquivo inválido ou corrompido.");
                console.error(err);
            }
        }
    });
}

// === GERENCIAMENTO DE AJUSTES (Técnicos e Sites) ===

function toggleModal(show) {
    const modal = document.getElementById('tech-modal');
    const backdrop = document.getElementById('tech-modal-backdrop');
    if (show) {
        modal.classList.remove('hidden');
        backdrop.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
        backdrop.classList.add('hidden');
    }
}

function addTechnician() {
    const input = document.getElementById('new-tech-name');
    const name = input.value.trim();
    if (name && !technicians.includes(name)) {
        technicians.push(name);
        technicians.sort();
        Storage.set('technicians', technicians);
        input.value = '';
        renderSettingsLists();
        updateAllSelects();
    }
}
function removeTechnician(name) {
    technicians = technicians.filter(t => t !== name);
    Storage.set('technicians', technicians);
    renderSettingsLists();
    updateAllSelects();
}

function addMode() {
    const input = document.getElementById('new-mode-name');
    const name = input.value.trim();
    if (name && !modes.includes(name)) {
        modes.push(name);
        modes.sort();
        Storage.set('modes', modes);
        input.value = '';
        renderSettingsLists();
        updateAllSelects();
    }
}
function removeMode(name) {
    modes = modes.filter(m => m !== name);
    Storage.set('modes', modes);
    renderSettingsLists();
    updateAllSelects();
}

function addSite() {
    const input = document.getElementById('new-site-name');
    const name = input.value.trim();
    if (name && !sites.includes(name)) {
        sites.push(name);
        sites.sort();
        Storage.set('sites', sites);
        input.value = '';
        renderSettingsLists();
        updateAllSelects();
    }
}
function removeSite(name) {
    sites = sites.filter(s => s !== name);
    Storage.set('sites', sites);
    renderSettingsLists();
    updateAllSelects();
}

function renderSettingsLists() {
    const techList = document.getElementById('tech-list');
    techList.innerHTML = '';
    technicians.forEach(tech => {
        const li = document.createElement('li');
        li.textContent = tech;
        const btn = document.createElement('button');
        btn.textContent = 'X';
        btn.onclick = () => removeTechnician(tech);
        li.appendChild(btn);
        techList.appendChild(li);
    });

    const modeList = document.getElementById('mode-list');
    modeList.innerHTML = '';
    modes.forEach(m => {
        const li = document.createElement('li');
        li.textContent = m;
        const btn = document.createElement('button');
        btn.textContent = 'X';
        btn.onclick = () => removeMode(m);
        li.appendChild(btn);
        modeList.appendChild(li);
    });

    const siteList = document.getElementById('site-list');
    siteList.innerHTML = '';
    sites.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s;
        const btn = document.createElement('button');
        btn.textContent = 'X';
        btn.onclick = () => removeSite(s);
        li.appendChild(btn);
        siteList.appendChild(li);
    });
}

function updateAllSelects() {
    document.querySelectorAll('.cell-name').forEach(select => {
        const currentVal = select.value;
        let optionsHtml = `<option value="">Selecione...</option>`;
        technicians.forEach(t => optionsHtml += `<option value="${t}" ${currentVal === t ? 'selected' : ''}>${t}</option>`);
        if (currentVal && !technicians.includes(currentVal)) {
            optionsHtml += `<option value="${currentVal}" selected>${currentVal}</option>`;
        }
        select.innerHTML = optionsHtml;
    });

    document.querySelectorAll('.cell-mode').forEach(select => {
        const currentVal = select.value;
        let optionsHtml = `<option value="">Selecione...</option>`;
        modes.forEach(m => optionsHtml += `<option value="${m}" ${currentVal === m ? 'selected' : ''}>${m}</option>`);
        if (currentVal && !modes.includes(currentVal)) {
            optionsHtml += `<option value="${currentVal}" selected>${currentVal}</option>`;
        }
        select.innerHTML = optionsHtml;
    });

    document.querySelectorAll('.cell-site').forEach(select => {
        const currentVal = select.value;
        let optionsHtml = `<option value="">Selecione...</option>`;
        sites.forEach(s => optionsHtml += `<option value="${s}" ${currentVal === s ? 'selected' : ''}>${s}</option>`);
        if (currentVal && !sites.includes(currentVal)) {
            optionsHtml += `<option value="${currentVal}" selected>${currentVal}</option>`;
        }
        select.innerHTML = optionsHtml;
    });
}


// === GERAÇÃO E LÓGICA DAS TABELAS (VIEW DIÁRIA E MENSAL) ===

function createRowHtml(rowData = {}, contextId, enforceDate = false) {
    // Horário
    const timeVal = rowData.time || '';
    const timeHtml = `<input type="time" list="time-suggestions" class="cell-time" value="${timeVal}">`;

    // Nome
    let nameOptions = `<option value="">Selecione...</option>`;
    technicians.forEach(t => nameOptions += `<option value="${t}" ${rowData.name === t ? 'selected' : ''}>${t}</option>`);
    if (rowData.name && !technicians.includes(rowData.name)) {
        nameOptions += `<option value="${rowData.name}" selected>${rowData.name}</option>`;
    }
    const nameHtml = `<select class="cell-name">${nameOptions}</select>`;

    // Data (Se view mensal, forçamos a string do dia)
    const dateVal = rowData.date || (enforceDate ? enforceDate : '');
    const dateHtml = `<input type="text" placeholder="DD/MM/AAAA" class="cell-date" value="${dateVal}">`;

    // Modalidade (Novo `<select>`)
    let modeOptions = `<option value="">Selecione...</option>`;
    modes.forEach(m => modeOptions += `<option value="${m}" ${rowData.mode === m ? 'selected' : ''}>${m}</option>`);
    if (rowData.mode && !modes.includes(rowData.mode)) {
        modeOptions += `<option value="${rowData.mode}" selected>${rowData.mode}</option>`;
    }
    const modeHtml = `<select class="cell-mode">${modeOptions}</select>`;

    // Site (Novo `<select>`)
    let siteOptions = `<option value="">Selecione...</option>`;
    sites.forEach(s => siteOptions += `<option value="${s}" ${rowData.site === s ? 'selected' : ''}>${s}</option>`);
    if (rowData.site && !sites.includes(rowData.site)) {
        siteOptions += `<option value="${rowData.site}" selected>${rowData.site}</option>`;
    }
    const siteHtml = `<select class="cell-site">${siteOptions}</select>`;

    return `
        <td>${timeHtml}</td>
        <td>${nameHtml}</td>
        <td>${dateHtml}</td>
        <td>${modeHtml}</td>
        <td>${siteHtml}</td>
        <td class="no-capture"><button class="btn-delete" onclick="deleteRow(this, '${contextId}')">Excluir</button></td>
    `;
}

function addRow(contextId, tbody, rowData = {}, enforceDate = false) {
    const tr = document.createElement('tr');
    tr.innerHTML = createRowHtml(rowData, contextId, enforceDate);
    tbody.appendChild(tr);
}

function deleteRow(btn, contextId) {
    const tr = btn.closest('tr');
    tr.remove();
    if (contextId.includes('view-monthly')) {
        saveMonthlyScale();
    } else {
        saveDailyScale();
    }
}

// ==== MAIN VIEW ====

function loadMainTables(dateStr) {
    if (!dateStr) return;
    const data = dailyScales[dateStr] || { N1: [], N2: [], GA: [] };

    MAIN_TABLES.forEach(tableId => {
        const tbody = document.querySelector(`table[data-table="${tableId}"] tbody`);
        tbody.innerHTML = '';
        const rows = data[tableId] || [];

        if (rows.length === 0) {
            // Em branco, já preenche a column data com a data atual
            addRow(`view-main-${tableId}`, tbody, {}, formatBR(dateStr));
        } else {
            rows.forEach(r => addRow(`view-main-${tableId}`, tbody, r));
        }
    });
}

function saveDailyScale() {
    if (!currentSelectedDate) return;

    if (!dailyScales[currentSelectedDate]) {
        dailyScales[currentSelectedDate] = { N1: [], N2: [], GA: [] };
    }

    MAIN_TABLES.forEach(tableId => {
        const tbody = document.querySelector(`table[data-table="${tableId}"] tbody`);
        dailyScales[currentSelectedDate][tableId] = Array.from(tbody.querySelectorAll('tr')).map(tr => ({
            time: tr.querySelector('.cell-time').value,
            name: tr.querySelector('.cell-name').value,
            date: tr.querySelector('.cell-date').value,
            mode: tr.querySelector('.cell-mode').value,
            site: tr.querySelector('.cell-site').value
        }));
    });

    Storage.set('daily_scales', dailyScales);
}


// ==== MONTHLY VIEW ====

function getSaturdaysOfSelectedMonth() {
    if (!currentSelectedDate) return [];

    // Ler ano e mês selecionados no navigator
    const targetDate = new Date(currentSelectedDate + 'T12:00:00'); // T12 previne timezone bugs
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const saturdays = [];

    let date = new Date(year, month, 1);
    while (date.getMonth() === month) {
        if (date.getDay() === 6) { // 6 = Sábado
            saturdays.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }
    return saturdays;
}

function showMonthlyView() {
    // Esconder a div do Date Navigator que é inútil no monthly pois pegaremos o Mês a partir da data atual lá selecionada
    document.querySelector('.date-navigator').classList.add('hidden');
    document.getElementById('view-main').classList.add('hidden');
    document.getElementById('view-monthly').classList.remove('hidden');

    const targetDate = new Date(currentSelectedDate + 'T12:00:00');
    const monthN = targetDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('monthly-title').textContent = `Sábados de ${monthN.charAt(0).toUpperCase() + monthN.slice(1)}`;

    renderMonthlyGrid();
}

function showMainView() {
    document.querySelector('.date-navigator').classList.remove('hidden');
    document.getElementById('view-monthly').classList.add('hidden');
    document.getElementById('view-main').classList.remove('hidden');

    // Força recarregar caso tenham editado algo nos sábados
    loadMainTables(currentSelectedDate);
}

function renderMonthlyGrid() {
    const container = document.getElementById('monthly-grid-container');
    container.innerHTML = '';

    const saturdays = getSaturdaysOfSelectedMonth();

    saturdays.forEach((sat) => {
        const fullDateStr = formatLocalDateStr(sat); // YYYY-MM-DD
        const userDateStr = formatBR(fullDateStr); // DD/MM/YYYY

        const panelData = dailyScales[fullDateStr] || { N1: [], N2: [], GA: [] };

        const panel = document.createElement('div');
        panel.className = 'monthly-panel';
        panel.innerHTML = `<h3>Sábado - ${userDateStr}</h3>`;

        MAIN_TABLES.forEach(tableId => {
            const section = document.createElement('div');
            // Full width table no modo Expandido pedido pelo usuario
            section.innerHTML = `
                <h4 style="text-align:center; margin: 15px 0 5px; color:var(--primary-text);">${tableId}</h4>
                <table data-monthly-table="${tableId}" data-date="${fullDateStr}">
                    <thead>
                        <tr>
                            <th>Horário</th>
                            <th>Nome</th>
                            <th>Data</th>
                            <th>Modalidade</th>
                            <th>Site</th>
                            <th class="no-capture">Ações</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                <button class="btn-add-row no-capture" onclick="addMonthlyRow(this, '${fullDateStr}')">+ Linha</button>
            `;

            const tbody = section.querySelector('tbody');
            const rows = panelData[tableId];
            if (!rows || rows.length === 0) {
                addRow(`view-monthly-${fullDateStr}`, tbody, {}, userDateStr);
            } else {
                rows.forEach(r => addRow(`view-monthly-${fullDateStr}`, tbody, r));
            }
            panel.appendChild(section);
        });

        container.appendChild(panel);
    });
}

window.addMonthlyRow = function (btn, fullDateStr) {
    const tbody = btn.previousElementSibling.querySelector('tbody');
    const userDateStr = formatBR(fullDateStr);
    addRow(`view-monthly-${fullDateStr}`, tbody, {}, userDateStr);
    saveMonthlyScale();
}

function saveMonthlyScale() {
    const panels = document.querySelectorAll('.monthly-panel');

    panels.forEach(panel => {
        // Obter data principal em YYYY-MM-DD (armazenada temporariamente na tabela em data-date)
        const dateStr = panel.querySelector('table').getAttribute('data-date');

        if (!dailyScales[dateStr]) {
            dailyScales[dateStr] = { N1: [], N2: [], GA: [] };
        }

        MAIN_TABLES.forEach(tableId => {
            const tbody = panel.querySelector(`table[data-monthly-table="${tableId}"] tbody`);
            dailyScales[dateStr][tableId] = Array.from(tbody.querySelectorAll('tr')).map(tr => ({
                time: tr.querySelector('.cell-time').value,
                name: tr.querySelector('.cell-name').value,
                date: tr.querySelector('.cell-date').value,
                mode: tr.querySelector('.cell-mode').value,
                site: tr.querySelector('.cell-site').value
            }));
        });
    });

    Storage.set('daily_scales', dailyScales);
}


// === CAPTURA DE TELA (HTML2CANVAS) COM API NATIVA PYWEBVIEW ===

window.captureScale = async function (elementId, viewName) {
    if (!window.pywebview) {
        alert("O recurso de salvamento nativo precisa do aplicativo principal (.exe). O WebView API não foi detectado.");
        return;
    }

    const element = document.getElementById(elementId);

    element.classList.add('is-capturing');

    // Sugestão do nome baseada na data que usuário tá vendo
    const formattedD = currentSelectedDate.split('-').reverse().join('_');
    const filename = viewName === 'Mensal'
        ? `VisãoMensal_Mes_${formattedD.substring(3)}.png`
        : `Escala_Diaria_${formattedD}.png`;

    setTimeout(() => {
        const fullHeight = element.scrollHeight + 20;

        html2canvas(element, {
            scale: 2,
            backgroundColor: '#005f73',
            height: fullHeight,
            windowHeight: fullHeight,
            scrollY: -window.scrollY
        }).then(async canvas => {

            element.classList.remove('is-capturing');

            // Obter base64 a enviá-la para o backend Python invocar o diálogo nativo do SO
            const dataUrl = canvas.toDataURL('image/png');

            try {
                // Acessar a classe Api -> save_image_dialog no python
                const saved = await window.pywebview.api.save_image_dialog(dataUrl, filename);
                if (saved) {
                    // Opcional
                    console.log("Arquivo salvo pelo usuário.");
                }
            } catch (e) {
                console.error("Erro na ponte python:", e);
                alert("Falha ao comunicar com recurso de salvamento nativo.");
            }

        }).catch(err => {
            console.error('Erro na captura:', err);
            element.classList.remove('is-capturing');
            alert('Erro ao tentar gerar imagem da escala.');
        });
    }, 150);
};

// === PUBLICAÇÃO WEB (GITHUB PAGES) ===

async function publishScale() {
    if (!window.pywebview) {
        alert("O recurso de publicação nativa precisa do aplicativo principal (.exe).");
        return;
    }

    if (!currentSelectedDate || !dailyScales[currentSelectedDate]) {
        alert("Não há dados para a data selecionada.");
        return;
    }

    const btn = document.getElementById('btn-publish-web');
    const originalText = btn.textContent;
    btn.textContent = "Publicando...";
    btn.disabled = true;

    try {
        const htmlContent = generateStaticHtml(currentSelectedDate);
        const result = await window.pywebview.api.publish_to_github(htmlContent, currentSelectedDate);

        if (result.error) {
            alert("Erro ao publicar: " + result.error);
        } else if (result.url) {
            // Mostrar modal ou alert com o link longo
            prompt("Escala publicada com sucesso! Copie o link abaixo para compartilhar:", result.url);
        }
    } catch (e) {
        console.error("Erro na ponte python:", e);
        alert("Falha de comunicação com o backend.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

function generateStaticHtml(dateStr) {
    const data = dailyScales[dateStr];
    const formattedDate = formatBR(dateStr);

    let tablesHtml = '';

    MAIN_TABLES.forEach(tableId => {
        const rows = data[tableId] || [];
        if (rows.length === 0) return; // Pula tabelas vazias

        let rowsHtml = '';
        rows.forEach(r => {
            rowsHtml += `
            <tr>
                <td>${r.time || '-'}</td>
                <td>${r.name || '-'}</td>
                <td>${r.date || '-'}</td>
                <td>${r.mode || '-'}</td>
                <td>${r.site || '-'}</td>
            </tr>`;
        });

        tablesHtml += `
        <div class="table-section">
            <h2 class="table-title">${tableId}</h2>
            <table>
                <thead>
                    <tr>
                        <th>Horário</th>
                        <th>Nome</th>
                        <th>Data</th>
                        <th>Modalidade</th>
                        <th>Site</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>`;
    });

    // HTML base com CSS embutido minimalista e inspirado no original
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Escala do Dia - ${formattedDate}</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #005f73;
            --text-color: #e0f2f1;
            --primary-color: #0a9396;
            --secondary-color: #94d2bd;
            --table-bg: rgba(255, 255, 255, 0.05);
            --border-color: rgba(255, 255, 255, 0.1);
            --hover-color: rgba(255, 255, 255, 0.1);
        }
        body {
            background: linear-gradient(135deg, var(--bg-color) 0%, #003e4b 100%);
            background-attachment: fixed;
            color: var(--text-color);
            font-family: 'Poppins', sans-serif;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
        }
        .container {
            width: 100%;
            max-width: 1000px;
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(12px);
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            border: 1px solid var(--border-color);
        }
        h1, h2, h3 { color: #fff; text-align: center; }
        .table-section { margin-bottom: 30px; }
        .table-title {
            background-color: var(--primary-color);
            color: #fff;
            padding: 10px;
            margin: 0;
            border-radius: 8px 8px 0 0;
            font-size: 1.1em;
            text-align: center;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: var(--table-bg);
            border: 1px solid var(--border-color);
            border-radius: 0 0 8px 8px;
            overflow: hidden;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }
        th {
            background-color: rgba(255, 255, 255, 0.1);
            font-weight: 500;
            color: var(--secondary-color);
            text-transform: uppercase;
            font-size: 0.9em;
        }
        tr:last-child td { border-bottom: none; }
        tr:hover { background-color: var(--hover-color); }
        .footer { text-align: center; margin-top: 50px; font-size: 0.8em; opacity: 0.6; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Gestão de Escalas</h1>
        <h2>Escala do Dia ${formattedDate}</h2>
        ${tablesHtml}
        <div class="footer">Gerado automaticamente pelo sistema Desktop. Apenas Leitura.</div>
    </div>
</body>
</html>`;
}
