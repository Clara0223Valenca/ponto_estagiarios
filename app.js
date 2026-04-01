/* ═══════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════ */

const WEEKDAY_ABBREVIATIONS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const ABSENCE_REASON_LABELS = {
  medical:   'ATESTADO',
  optional:  'P. FACULTATIVO',
  holiday:   'FERIADO',
  unexcused: 'FALTA',
};

const TOLERANCE_MAX_OFFSET_MINUTES = 10;

/* ═══════════════════════════════════════════════════════════
   TIME UTILITIES
═══════════════════════════════════════════════════════════ */

/** Left-pads a number to 2 digits (e.g. 7 → "07"). */
function padTwo(number) {
  return String(number).padStart(2, '0');
}

/** Converts "HH:MM" string to total minutes since midnight. */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Converts total minutes since midnight to "HH:MM" string. */
function minutesToTime(totalMinutes) {
  const hours   = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${padTwo(hours)}:${padTwo(minutes)}`;
}

/** Formats a Date object as a "YYYY-MM-DD" key string. */
function formatDateKey(date) {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

/** Returns a new Date shifted by the given number of days. */
function shiftDate(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/* ═══════════════════════════════════════════════════════════
   RANDOM TOLERANCE
   Adds a random 1–10 min offset to check-in time while
   keeping the total shift duration unchanged.
═══════════════════════════════════════════════════════════ */

function toggleToleranceStyle() {
  const toleranceRow      = document.getElementById('tolerance-row');
  const toleranceCheckbox = document.getElementById('chk-tolerance');
  toleranceRow.classList.toggle('active', toleranceCheckbox.checked);
}

/**
 * Given base check-in / check-out times, returns new times where
 * check-in is shifted by a random 1–10 min offset and check-out
 * is shifted by the same amount so shift duration is preserved.
 *
 * @param {string} baseCheckIn  - "HH:MM"
 * @param {string} baseCheckOut - "HH:MM"
 * @returns {{ checkIn: string, checkOut: string }}
 */
function applyRandomTolerance(baseCheckIn, baseCheckOut) {
  const checkInMinutes  = timeToMinutes(baseCheckIn);
  const checkOutMinutes = timeToMinutes(baseCheckOut);
  const shiftDuration   = checkOutMinutes - checkInMinutes;

  const randomOffset     = Math.floor(Math.random() * TOLERANCE_MAX_OFFSET_MINUTES) + 1;
  const adjustedCheckIn  = checkInMinutes  + randomOffset;
  const adjustedCheckOut = adjustedCheckIn + shiftDuration;

  return {
    checkIn:  minutesToTime(adjustedCheckIn),
    checkOut: minutesToTime(adjustedCheckOut),
  };
}

/* ═══════════════════════════════════════════════════════════
   HOLIDAY CALCULATION — MATH FALLBACK (offline)
   Uses the Anonymous Gregorian algorithm for Easter.
═══════════════════════════════════════════════════════════ */

function calculateEasterDate(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/**
 * Computes Brazilian national holidays for the given year
 * using pure math (no API required).
 *
 * @param {number} year
 * @returns {Object.<string, string>} Map of "YYYY-MM-DD" → holiday name
 */
function computeHolidaysMath(year) {
  const holidayMap = {};
  const addHoliday = (date, name) => { holidayMap[formatDateKey(date)] = name; };

  // Fixed-date national holidays
  addHoliday(new Date(year,  0,  1), 'Confraternização Universal');
  addHoliday(new Date(year,  3, 21), 'Tiradentes');
  addHoliday(new Date(year,  4,  1), 'Dia do Trabalho');
  addHoliday(new Date(year,  8,  7), 'Independência do Brasil');
  addHoliday(new Date(year,  9, 12), 'Nossa Senhora Aparecida');
  addHoliday(new Date(year, 10,  2), 'Finados');
  addHoliday(new Date(year, 10, 15), 'Proclamação da República');
  addHoliday(new Date(year, 10, 20), 'Consciência Negra');
  addHoliday(new Date(year, 11, 25), 'Natal');

  // Easter-relative holidays
  const easterDate = calculateEasterDate(year);
  addHoliday(shiftDate(easterDate, -48), 'Carnaval');
  addHoliday(shiftDate(easterDate, -47), 'Carnaval');
  addHoliday(shiftDate(easterDate,  -2), 'Sexta-feira Santa');
  addHoliday(easterDate,                 'Páscoa');
  addHoliday(shiftDate(easterDate,  60), 'Corpus Christi');

  return holidayMap;
}

/* ═══════════════════════════════════════════════════════════
   HOLIDAY FETCHING — BRASILAPI (online, official data)
═══════════════════════════════════════════════════════════ */

/**
 * Fetches official Brazilian national holidays from BrasilAPI.
 *
 * @param {number} year
 * @returns {Promise<Object.<string, string>>} Map of "YYYY-MM-DD" → holiday name
 * @throws {Error} On non-OK HTTP response or network timeout
 */
async function fetchHolidaysFromApi(year) {
  const response = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`BrasilAPI responded with HTTP ${response.status}`);

  const holidayList = await response.json();
  const holidayMap  = {};
  holidayList.forEach(item => { holidayMap[item.date] = item.name; });
  return holidayMap;
}

/* ═══════════════════════════════════════════════════════════
   HOLIDAY CACHE
═══════════════════════════════════════════════════════════ */

/** In-memory cache keyed by year → { holidayMap, source }. */
const _holidayCache = {};

/**
 * Returns holidays for the given year, using cache when available.
 * Falls back to math calculation when the API is unreachable.
 *
 * @param {number} year
 * @returns {Promise<{ holidayMap: Object, source: 'api'|'math' }>}
 */
async function getHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year];

  try {
    const holidayMap    = await fetchHolidaysFromApi(year);
    _holidayCache[year] = { holidayMap, source: 'api' };
  } catch {
    const holidayMap    = computeHolidaysMath(year);
    _holidayCache[year] = { holidayMap, source: 'math' };
  }

  return _holidayCache[year];
}

/* ═══════════════════════════════════════════════════════════
   SETUP FORM — READ VALUES
═══════════════════════════════════════════════════════════ */

/** Reads and returns all user-configured values from the setup form. */
function readSetupForm() {
  return {
    selectedMonth:    parseInt(document.getElementById('sel-month').value),
    selectedYear:     parseInt(document.getElementById('inp-year').value),
    employeeName:     document.getElementById('inp-name').value.trim(),
    department:       document.getElementById('inp-department').value.trim(),
    baseCheckIn:      document.getElementById('inp-check-in').value,
    baseCheckOut:     document.getElementById('inp-check-out').value,
    supervisorName:   document.getElementById('inp-supervisor').value.trim(),
    autoFillEnabled:  document.querySelector('input[name="autofill"]:checked').value === 'yes',
    toleranceEnabled: document.getElementById('chk-tolerance').checked,
  };
}

/* ═══════════════════════════════════════════════════════════
   MAIN FLOW — triggered by the Generate button
═══════════════════════════════════════════════════════════ */

async function handleGenerateClick() {
  const generateButton   = document.getElementById('btn-generate');
  const loadingIndicator = document.getElementById('loading-indicator');
  const statusBadge      = document.getElementById('api-status-badge');

  generateButton.disabled        = true;
  loadingIndicator.style.display = 'flex';
  statusBadge.className          = 'api-badge center';
  statusBadge.textContent        = '';

  const { selectedYear } = readSetupForm();

  try {
    const { holidayMap, source } = await getHolidays(selectedYear);

    if (source === 'api') {
      statusBadge.className   = 'api-badge center online';
      statusBadge.textContent = '✓ Feriados obtidos via BrasilAPI';
      document.getElementById('toolbar-source-badge').textContent = 'BRASILAPI';
    } else {
      statusBadge.className   = 'api-badge center offline';
      statusBadge.textContent = '⚠ Sem conexão — feriados calculados localmente';
      document.getElementById('toolbar-source-badge').textContent = 'MODO OFFLINE';
    }

    await new Promise(resolve => setTimeout(resolve, 600));
    renderTimesheet(holidayMap);

  } catch {
    statusBadge.className   = 'api-badge center offline';
    statusBadge.textContent = 'Erro ao obter feriados. Tente novamente.';
  } finally {
    generateButton.disabled        = false;
    loadingIndicator.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════════════════════
   TIMESHEET RENDERING
═══════════════════════════════════════════════════════════ */

/**
 * Builds and injects all timesheet rows into the DOM,
 * then switches from the setup screen to the sheet screen.
 *
 * @param {Object.<string, string>} holidayMap
 */
function renderTimesheet(holidayMap) {
  const {
    selectedMonth,
    selectedYear,
    employeeName,
    department,
    baseCheckIn,
    baseCheckOut,
    autoFillEnabled,
    toleranceEnabled,
  } = readSetupForm();

  // Populate document header
  document.getElementById('hdr-month').textContent         = `${MONTH_NAMES[selectedMonth]} / ${selectedYear}`;
  document.getElementById('hdr-check-in').textContent      = baseCheckIn;
  document.getElementById('hdr-check-out').textContent     = baseCheckOut;
  document.getElementById('hdr-department').textContent    = department;
  document.getElementById('hdr-employee-name').textContent = employeeName;
  document.getElementById('footer-generated-date').textContent =
    `Gerado em ${new Date().toLocaleDateString('pt-BR')}`;

  const daysInMonth  = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const tableBody    = document.getElementById('table-body');
  tableBody.innerHTML = '';

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
    const currentDate = new Date(selectedYear, selectedMonth, dayNumber);
    const dayOfWeek   = currentDate.getDay();
    const dateKey     = `${selectedYear}-${padTwo(selectedMonth + 1)}-${padTwo(dayNumber)}`;
    const holidayName = holidayMap[dateKey];

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = !!holidayName;
    const isWorkday = !isWeekend && !isHoliday;

    // Determine times for this specific day
    let dayCheckIn  = baseCheckIn;
    let dayCheckOut = baseCheckOut;
    if (isWorkday && autoFillEnabled && toleranceEnabled) {
      const adjusted = applyRandomTolerance(baseCheckIn, baseCheckOut);
      dayCheckIn  = adjusted.checkIn;
      dayCheckOut = adjusted.checkOut;
    }

    const shouldFillTimes = isWorkday && autoFillEnabled;

    const row = document.createElement('tr');
    if (isWeekend) row.classList.add('weekend');
    if (isHoliday) row.classList.add('holiday');

    row.dataset.dayNumber   = dayNumber;
    row.dataset.dateKey     = dateKey;
    row.dataset.isWorkday   = isWorkday ? '1' : '0';
    row.dataset.holidayName = holidayName || '';

    // Day cell
    const dayCell     = document.createElement('td');
    const holidaySpan = isHoliday
      ? `<span class="holiday-info">${holidayName}</span>`
      : '';
    dayCell.innerHTML = `
      <div class="day-cell">
        <span class="day-num">${dayNumber}</span>
        <span class="day-abbr">${WEEKDAY_ABBREVIATIONS[dayOfWeek]}${holidaySpan}</span>
      </div>`;

    // Check-in cell 
    const checkInCell     = document.createElement('td');
    checkInCell.innerHTML = `
      <input class="time-input check-in-input" type="time" required
        value="${shouldFillTimes ? dayCheckIn : ''}"
        ${isWeekend ? 'readonly tabindex="-1"' : ''}>`;

    // Check-in signature cell
    const checkInSigCell     = document.createElement('td');
    checkInSigCell.className = 'sig-td';
    checkInSigCell.innerHTML = `<span class="absence-label"></span>`;

    // Check-out cell
    const checkOutCell     = document.createElement('td');
    checkOutCell.innerHTML = `
      <input class="time-input check-out-input" type="time" required
        value="${shouldFillTimes ? dayCheckOut : ''}"
        ${isWeekend ? 'readonly tabindex="-1"' : ''}>`;

    // Check-out signature cell
    const checkOutSigCell     = document.createElement('td');
    checkOutSigCell.className = 'sig-td';
    checkOutSigCell.innerHTML = `<span class="absence-label"></span>`;

    // Absence reason cell
    const absenceCell          = document.createElement('td');
    absenceCell.style.textAlign = 'center';

    if (!isWeekend) {
      absenceCell.innerHTML = `
        <select class="absence-select" onchange="handleAbsenceChange(this)">
          <option value="">Trabalho Normal</option>
          <option value="medical">Atestado</option>
          <option value="optional">Ponto Facultativo</option>
          <option value="holiday">Feriado</option>
          <option value="unexcused">Falta</option>
        </select>`;
    }

    row.append(dayCell, checkInCell, checkInSigCell, checkOutCell, checkOutSigCell, absenceCell);
    tableBody.appendChild(row);

    // Pre-select "holiday" for official holidays on workdays
    if (isHoliday && !isWeekend) {
      const absenceSelect = row.querySelector('.absence-select');
      absenceSelect.value = 'holiday';
      handleAbsenceChange(absenceSelect);
    }
  }

  updateTotals();
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('sheet-screen').style.display = 'block';

  // Apply mobile sheet scaling after the sheet is visible
  applyMobileSheetScale();
}

/* ═══════════════════════════════════════════════════════════
   ABSENCE REASON HANDLER
═══════════════════════════════════════════════════════════ */

/**
 * Handles a change in the absence reason dropdown.
 * Clears / restores check-in and check-out times and
 * updates the row's visual state accordingly.
 *
 * @param {HTMLSelectElement} selectElement
 */
function handleAbsenceChange(selectElement) {
  const row            = selectElement.closest('tr');
  const checkInInput   = row.querySelector('.check-in-input');
  const checkOutInput  = row.querySelector('.check-out-input');
  const selectedReason = selectElement.value;

  if (selectedReason !== '') {
    // Only save the original values if the row was not already in an absence/holiday state
    if (row.dataset.isAbsent !== '1') {
      row.dataset.savedCheckIn  = checkInInput.value;
      row.dataset.savedCheckOut = checkOutInput.value;
    }

    checkInInput.value  = '';
    checkOutInput.value = '';
    row.dataset.isAbsent = '1';
    row.classList.add('absent');

    const labelText = ABSENCE_REASON_LABELS[selectedReason] || '';
    row.querySelectorAll('.absence-label').forEach(el => el.textContent = labelText);

  } else {
    // Restore saved times
    if (row.dataset.isAbsent === '1') {
      checkInInput.value  = row.dataset.savedCheckIn  || '';
      checkOutInput.value = row.dataset.savedCheckOut || '';
    }

    row.dataset.isAbsent = '0';
    row.classList.remove('absent');
    row.querySelectorAll('.absence-label').forEach(el => el.textContent = '');
  }

  updateTotals();
}

/* ═══════════════════════════════════════════════════════════
   TOTALS SUMMARY
═══════════════════════════════════════════════════════════ */

/** Recalculates and renders the workday summary in the table footer. */
function updateTotals() {
  let workdayCount    = 0;
  let attendanceCount = 0;
  let medicalCount    = 0;
  let unexcusedCount  = 0;
  let manualHolidays  = 0;

  document.querySelectorAll('#table-body tr').forEach(row => {
    // Determine the actual status of the day based on the class (API/Weekend) and the select (Manual)
    const isWeekend = row.classList.contains('weekend');
    const isApiHoliday = row.classList.contains('holiday');
    
    const absenceSelect  = row.querySelector('.absence-select');
    const selectedReason = absenceSelect ? absenceSelect.value : '';

    const isManualHoliday = (selectedReason === 'holiday' || selectedReason === 'optional');

    // 1. Workdays Calculation (Denominator)
    if (!isWeekend && !isApiHoliday && !isManualHoliday) {
      workdayCount++;
    }

    // 2. Occurrences Accounting
    if (selectedReason === 'medical') {
      medicalCount++;
    } else if (selectedReason === 'unexcused') {
      unexcusedCount++;
    } else if (isManualHoliday) {
      manualHolidays++;
    }

    // 3. Attendance Rule (Requires check-in and check-out, only on normal workdays)
    if (!isWeekend && !isApiHoliday && !isManualHoliday && selectedReason === '') {
      const checkIn  = row.querySelector('.check-in-input')?.value.trim();
      const checkOut = row.querySelector('.check-out-input')?.value.trim();
      
      if (checkIn && checkOut) {
        attendanceCount++;
      }
    }
  });

  // Build the summary text (Absences and Medical Certificates always visible)
  let summaryText = `Dias úteis: ${workdayCount}   |   Presenças: ${attendanceCount}   |   Faltas: ${unexcusedCount}   |   Atestados: ${medicalCount}`;
  
  if (manualHolidays > 0) {
    summaryText += `   |   Feriados/ Pontos Facultativos: ${manualHolidays}`;
  }

  const totalsCell = document.getElementById('totals-cell');
  if (totalsCell) totalsCell.textContent = summaryText;
}

/* ═══════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════ */

function goBackToSetup() {
  document.getElementById('setup-screen').style.display = 'flex';
  document.getElementById('sheet-screen').style.display = 'none';
}

/* ═══════════════════════════════════════════════════════════
   EXCEL EXPORT
═══════════════════════════════════════════════════════════ */

/** Exports the current timesheet to an .xlsx file via SheetJS. */
function exportToExcel() {
  const workbook = XLSX.utils.book_new();
  const rows     = [];

  const monthLabel     = document.getElementById('hdr-month').textContent;
  const employeeName   = document.getElementById('hdr-employee-name').textContent || 'Não preenchido';
  const department     = document.getElementById('hdr-department').textContent    || 'Não preenchida';
  const checkInTime    = document.getElementById('hdr-check-in').textContent;
  const checkOutTime   = document.getElementById('hdr-check-out').textContent;
  const supervisorName = document.getElementById('inp-supervisor').value.trim();

  rows.push(['FOLHA DE PONTO — ESTAGIÁRIO']);
  rows.push([`Mês: ${monthLabel}`, `Horário: ${checkInTime} às ${checkOutTime}`]);
  rows.push([`Lotação: ${department}`]);
  rows.push([`Nome: ${employeeName}`]);
  rows.push([]);
  rows.push(['Dia', 'Dia Semana', 'Entrada', 'Saída', 'Observação']);

  document.querySelectorAll('#table-body tr').forEach(row => {
    const dayNumber     = row.dataset.dayNumber;
    const weekdayAbbr   = row.querySelector('.day-abbr')?.textContent?.split(/\s/)[0] || '';
    const checkInValue  = row.querySelector('.check-in-input')?.value  || '';
    const checkOutValue = row.querySelector('.check-out-input')?.value || '';
    const absenceSelect = row.querySelector('.absence-select');
    let observation     = '';

    if (row.classList.contains('weekend')) {
      observation = 'Final de semana';
    } else if (absenceSelect && absenceSelect.value !== '') {
      observation = absenceSelect.options[absenceSelect.selectedIndex].text.toUpperCase();
    } else if (row.dataset.holidayName) {
      observation = `Feriado Oficial — ${row.dataset.holidayName}`;
    }

    rows.push([dayNumber, weekdayAbbr, checkInValue, checkOutValue, observation]);
  });

  // Get the totals summary to include in Excel
  const totalsText = document.getElementById('totals-cell')?.textContent || '';

  rows.push([]);
  rows.push(['RESUMO DO MÊS', totalsText]); // Insert the totals row
  rows.push([]);
  rows.push(['', '', '', '', `Responsável: ${supervisorName}`]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Folha de Ponto');

  const filenameSuffix = `${employeeName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s*\/\s*/g, '_')}`;
  XLSX.writeFile(workbook, `FolhaPonto_${filenameSuffix}.xlsx`);
}

/* ═══════════════════════════════════════════════════════════
   INITIALISATION
═══════════════════════════════════════════════════════════ */

(function init() {
  const today = new Date();
  document.getElementById('sel-month').value = today.getMonth();
  document.getElementById('inp-year').value  = today.getFullYear();
})();

// Recalculate totals whenever any time input changes
document.addEventListener('input', event => {
  if (event.target.classList.contains('time-input')) updateTotals();
});

/* ═══════════════════════════════════════════════════════════
   MOBILE SHEET SCALING
   Scales the A4 document sheet to fit the viewport on small
   screens. Has no effect on desktop (> 680px).
═══════════════════════════════════════════════════════════ */

/**
 * Calculates the correct CSS scale so the 794px-wide document
 * sheet fits within the current viewport, then applies it.
 * Called after render and on resize.
 */
function applyMobileSheetScale() {
  const sheet = document.querySelector('.document-sheet');
  if (!sheet) return;

  const SHEET_NATURAL_WIDTH = 794; // matches width:794px set in CSS for mobile
  const MOBILE_BREAKPOINT   = 680;

  if (window.innerWidth > MOBILE_BREAKPOINT) {
    // Desktop: remove any inline scale so CSS rules take over
    sheet.style.transform    = '';
    sheet.style.marginBottom = '';
    return;
  }

  // Available width = viewport minus document-area horizontal padding (0.5rem each side = ~16px total)
  const availableWidth = window.innerWidth - 16;
  const scale          = availableWidth / SHEET_NATURAL_WIDTH;

  sheet.style.transform    = `scale(${scale})`;
  // After scaling down, the element still occupies its original height in layout.
  // Negative margin-bottom compensates so there is no giant whitespace gap.
  const naturalHeight  = sheet.scrollHeight;
  const scaledHeight   = naturalHeight * scale;
  const excess         = naturalHeight - scaledHeight;
  sheet.style.marginBottom = `-${excess}px`;
}

// Re-apply on resize (e.g. orientation change)
window.addEventListener('resize', applyMobileSheetScale);