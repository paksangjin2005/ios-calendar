// ==========================================
// 1. Firebase 설정 및 초기화 (본인 값으로 변경!)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAy-056YIhiMKQDM8Mp-ZNvG3mNS2lcS8U",
  authDomain: "calendar-project-by-army.firebaseapp.com",
  projectId: "calendar-project-by-army",
  storageBucket: "calendar-project-by-army.firebasestorage.app",
  messagingSenderId: "376616584546",
  appId: "1:376616584546:web:6121f2bcb08edca601d83b",
  measurementId: "G-DVLNHG67EP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;

// ==========================================
// 2. 앱 전역 변수
// ==========================================
let currentDate = new Date();
let selectedDateStr = getLocalDateStr(new Date());
let currentView = 'month';

let categories = [
  { id: 'cat_work', name: '업무', color: '#38BDF8', isDefault: true },
  { id: 'cat_personal', name: '개인일정', color: '#FF9500', isDefault: true },
  { id: 'cat_vacation', name: '휴가', color: '#34C759', isDefault: true }
];
let selectedCatId = categories[0].id;
let selectedCatColor = '#FF2D55';
let events = [];
let activeDetailEventId = null;
let pendingDeleteAction = null;

// ==========================================
// 3. Firebase 구글 로그인 및 DB 동기화 연동
// ==========================================
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  const statusElem = document.getElementById('googleUserStatus');
  const loginBtn = document.getElementById('btnLoginGoogle');
  const logoutBtn = document.getElementById('btnLogoutGoogle');

  if (user) {
    if (statusElem) statusElem.innerText = `${user.displayName}님 로그인 중`;
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'block';
    await loadDataFromCloud();
  } else {
    if (statusElem) statusElem.innerText = '로그인이 필요합니다.';
    if (loginBtn) loginBtn.style.display = 'block';
    if (logoutBtn) logoutBtn.style.display = 'none';
    events = [];
    renderCalendar();
  }
});

window.loginWithGoogle = async function() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    alert("구글 로그인 실패: " + err.message);
  }
};

window.logoutGoogle = async function() {
  try {
    await auth.signOut();
  } catch (err) {
    alert("로그아웃 실패: " + err.message);
  }
};

async function saveDataToCloud() {
  if (!currentUser) return;
  try {
    await db.collection("users").doc(currentUser.uid).set({
      events: events,
      categories: categories
    });
  } catch (err) {
    console.error("클라우드 저장 실패:", err);
  }
}

async function loadDataFromCloud() {
  if (!currentUser) return;
  try {
    const doc = await db.collection("users").doc(currentUser.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.events) events = data.events;
      if (data.categories) categories = data.categories;
      renderCategories();
      renderCalendar();
    }
  } catch (err) {
    console.error("클라우드 불러오기 실패:", err);
  }
}

// ==========================================
// 4. 유틸리티 및 캘린더 핵심 로직
// ==========================================
function getLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function updateClock() {
  const now = new Date();
  document.getElementById('clockTime').innerText = 
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getHolidayName(dateObj) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  const day = dateObj.getDate();
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  if (month === 1 && day === 1) return '신정';
  if (month === 3 && day === 1) return '삼일절';
  if (month === 5 && day === 5) return '어린이날';
  if (month === 6 && day === 6) return '현충일';
  if (month === 8 && day === 15) return '광복절';
  if (month === 10 && day === 3) return '개천절';
  if (month === 10 && day === 9) return '한글날';
  if (month === 12 && day === 25) return '성탄절';

  const holidayMap = {
    '2024-02-09': '설날연휴', '2024-02-10': '설날', '2024-02-11': '설날연휴', '2024-02-12': '대체공휴일',
    '2024-05-06': '대체공휴일', '2024-05-15': '부처님오신날',
    '2024-09-16': '추석연휴', '2024-09-17': '추석', '2024-09-18': '추석연휴',
    '2025-01-28': '설날연휴', '2025-01-29': '설날', '2025-01-30': '설날연휴', '2025-03-03': '대체공휴일',
    '2025-05-05': '부처님오신날', '2025-05-06': '대체공휴일',
    '2025-10-05': '추석연휴', '2025-10-06': '추석', '2025-10-07': '추석연휴', '2025-10-08': '대체공휴일',
    '2026-02-16': '설날연휴', '2026-02-17': '설날', '2026-02-18': '설날연휴',
    '2026-03-02': '대체공휴일', '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일',
    '2026-08-17': '대체공휴일', '2026-09-24': '추석연휴', '2026-09-25': '추석', '2026-09-26': '추석연휴',
    '2026-10-05': '대체공휴일'
  };

  return holidayMap[dateStr] || null;
}

window.openSettingsModal = function() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.getElementById('themeToggleSwitch').checked = isLight;
  document.getElementById('themeModeLabel').innerText = isLight ? 'Light' : 'Dark';

  const drawer = document.getElementById('settingsSideDrawer');
  drawer.style.transform = '';
  document.getElementById('settingsModalOverlay').classList.add('active');
  setTimeout(() => {
    drawer.classList.add('active');
  }, 10);
};

window.closeSettingsModal = function() {
  const drawer = document.getElementById('settingsSideDrawer');
  drawer.classList.remove('active');
  drawer.style.transform = 'translateX(-100%)';
  
  setTimeout(() => {
    document.getElementById('settingsModalOverlay').classList.remove('active');
    drawer.style.transform = '';
  }, 300);
};

function makeLeftDrawerDraggable(drawerId, closeFn) {
  const drawer = document.getElementById(drawerId);
  let startX = 0, currentX = 0, isDragging = false;

  drawer.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
    drawer.style.transition = 'none';
  }, { passive: true });

  drawer.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
    let deltaX = currentX - startX;
    if (deltaX < 0) {
      drawer.style.transform = `translateX(${deltaX}px)`;
    }
  }, { passive: true });

  drawer.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    let deltaX = currentX - startX;
    drawer.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    if (deltaX < -60) {
      closeFn();
    } else {
      drawer.style.transform = 'translateX(0)';
    }
    startX = 0; currentX = 0;
  });
}

window.toggleThemeFromSettings = function() {
  const isLight = document.getElementById('themeToggleSwitch').checked;
  const newTheme = isLight ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  document.getElementById('themeModeLabel').innerText = isLight ? 'Light' : 'Dark';
};

window.switchView = function(view) {
  currentView = view;
  document.getElementById('btnMonth').classList.toggle('active', view === 'month');
  document.getElementById('btnWeek').classList.toggle('active', view === 'week');
  
  ['gridPrev', 'gridCurrent', 'gridNext'].forEach(id => {
    const grid = document.getElementById(id);
    if (view === 'week') grid.classList.add('week-view');
    else grid.classList.remove('week-view');
  });

  renderCalendar();
};

window.changeMonth = function(delta) {
  if (currentView === 'month') {
    currentDate.setMonth(currentDate.getMonth() + delta);
  } else {
    currentDate.setDate(currentDate.getDate() + (delta * 7));
  }
  renderCalendar();
};

window.handleToggleChange = function(changed) {
  const singleToggle = document.getElementById('singleDayToggle');
  const allDayToggle = document.getElementById('allDayToggle');

  if (!singleToggle.checked && !allDayToggle.checked) {
    if (changed === 'single') singleToggle.checked = true;
    else allDayToggle.checked = true;
  }

  document.getElementById('endDateGroup').style.display = singleToggle.checked ? 'none' : 'block';
  document.getElementById('timeGroup').style.display = allDayToggle.checked ? 'none' : 'block';
};

window.toggleDetailsVisibility = function() {
  const isShow = document.getElementById('detailsToggle').checked;
  document.getElementById('detailsGroup').style.display = isShow ? 'block' : 'none';
};

function makeSheetDraggable(sheetId, closeFn) {
  const sheet = document.getElementById(sheetId);
  let startY = 0, currentY = 0, isDragging = false;

  sheet.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    let deltaY = currentY - startY;
    if (deltaY > 0) sheet.style.transform = `translateY(${deltaY}px)`;
  }, { passive: true });

  sheet.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    let deltaY = currentY - startY;
    sheet.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
    if (deltaY > 70) closeFn();
    else sheet.style.transform = 'translateY(0)';
    startY = 0; currentY = 0;
  });
}

function initCalendarSwipe() {
  const calBody = document.getElementById('calendarBody');
  const track = document.getElementById('calendarTrack');
  let startX = 0, startY = 0, deltaX = 0, deltaY = 0;
  let isTouching = false;
  let isHorizontalSwipe = false;

  calBody.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    deltaX = 0; deltaY = 0;
    isTouching = true;
    isHorizontalSwipe = false;
    track.style.transition = 'none';
  }, { passive: true });

  calBody.addEventListener('touchmove', (e) => {
    if (!isTouching) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    deltaX = currentX - startX;
    deltaY = currentY - startY;

    if (!isHorizontalSwipe) {
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 8) {
        isHorizontalSwipe = true;
      } else if (Math.abs(deltaY) > 8) {
        isTouching = false;
        return;
      }
    }

    if (isHorizontalSwipe) {
      track.style.transform = `translateX(${deltaX}px)`;
    }
  }, { passive: true });

  calBody.addEventListener('touchend', () => {
    if (!isTouching || !isHorizontalSwipe) {
      isTouching = false;
      return;
    }
    isTouching = false;

    const threshold = window.innerWidth * 0.22;

    if (deltaX < -threshold) {
      track.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
      track.style.transform = `translateX(-${window.innerWidth}px)`;

      setTimeout(() => {
        changeMonth(1);
        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
      }, 250);

    } else if (deltaX > threshold) {
      track.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)';
      track.style.transform = `translateX(${window.innerWidth}px)`;

      setTimeout(() => {
        changeMonth(-1);
        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
      }, 250);

    } else {
      track.style.transition = 'transform 0.20s ease-out';
      track.style.transform = 'translateX(0px)';
    }
  });
}

function renderCategories() {
  const container = document.getElementById('categoryContainer');
  container.innerHTML = '';

  categories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = 'cat-chip';
    chip.innerHTML = `<div class="cat-dot" style="background:${cat.color}"></div><span>${cat.name}</span>`;
    
    if (!cat.isDefault) {
      attachLongPress(chip, () => {
        openDeleteModal(`'${cat.name}' 카테고리를 삭제하시겠습니까?`, () => {
          categories = categories.filter(c => c.id !== cat.id);
          renderCategories();
          renderModalCategories();
          saveDataToCloud();
        });
      });
    }
    container.appendChild(chip);
  });
}

function openCatModal() {
  document.getElementById('catModalOverlay').classList.add('active');
  document.getElementById('catBottomSheet').style.transform = 'translateY(0)';
  const colors = ['#FF2D55', '#AF52DE', '#5856D6', '#FFCC00', '#00C7BE', '#FF9500'];
  const picker = document.getElementById('colorPickerGroup');
  picker.innerHTML = '';
  selectedCatColor = colors[0];

  colors.forEach((c, idx) => {
    const dot = document.createElement('div');
    dot.className = `color-dot-opt ${idx === 0 ? 'selected' : ''}`;
    dot.style.background = c;
    dot.onclick = () => {
      document.querySelectorAll('.color-dot-opt').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedCatColor = c;
    };
    picker.appendChild(dot);
  });
}

window.closeCatModal = function() {
  const sheet = document.getElementById('catBottomSheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('catModalOverlay').classList.remove('active');
  }, 200);
};

window.saveCategory = function() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return alert('카테고리 이름을 입력해주세요.');

  categories.push({
    id: 'cat_' + Date.now(),
    name,
    color: selectedCatColor,
    isDefault: false
  });

  document.getElementById('newCatName').value = '';
  closeCatModal();
  renderCategories();
  renderModalCategories();
  saveDataToCloud();
};

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  document.getElementById('monthDisplay').innerText = `${year}년 ${month + 1}월`;

  let prevDate = new Date(currentDate);
  let nextDate = new Date(currentDate);

  if (currentView === 'month') {
    prevDate.setMonth(prevDate.getMonth() - 1);
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else {
    prevDate.setDate(prevDate.getDate() - 7);
    nextDate.setDate(nextDate.getDate() + 7);
  }

  renderGridContent(document.getElementById('gridPrev'), prevDate);
  renderGridContent(document.getElementById('gridCurrent'), currentDate);
  renderGridContent(document.getElementById('gridNext'), nextDate);
}

function renderGridContent(gridElem, baseDate) {
  gridElem.innerHTML = '';
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  if (currentView === 'month') {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();

    const totalCells = firstDay + lastDate;
    const numWeeks = Math.ceil(totalCells / 7);

    gridElem.style.setProperty('--row-count', numWeeks);

    for (let i = firstDay - 1; i >= 0; i--) createCell(gridElem, new Date(year, month - 1, prevLastDate - i), true);
    for (let day = 1; day <= lastDate; day++) createCell(gridElem, new Date(year, month, day), false);
    
    const remainingCells = (numWeeks * 7) - totalCells;
    for (let day = 1; day <= remainingCells; day++) createCell(gridElem, new Date(year, month + 1, day), true);

  } else {
    gridElem.style.setProperty('--row-count', 1);
    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(year, month, baseDate.getDate() - dayOfWeek);
    for (let i = 0; i < 7; i++) {
      const day = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i);
      createCell(gridElem, day, false);
    }
  }
}

function createCell(container, dateObj, isOtherMonth) {
  const cell = document.createElement('div');
  cell.className = `day-cell ${isOtherMonth ? 'other-month' : ''}`;
  
  const dateStr = getLocalDateStr(dateObj);
  const todayStr = getLocalDateStr(new Date());
  
  if (dateStr === todayStr) cell.classList.add('today');

  const dayNum = document.createElement('div');
  dayNum.className = 'day-number';
  dayNum.innerText = dateObj.getDate();

  const dayOfWeek = dateObj.getDay();
  const holidayName = getHolidayName(dateObj);

  if (dayOfWeek === 0 || holidayName) {
    dayNum.style.color = 'var(--accent-red)';
  } else if (dayOfWeek === 6) {
    dayNum.style.color = 'var(--accent-blue)';
  } else {
    dayNum.style.color = 'var(--text-main)';
  }

  cell.appendChild(dayNum);

  let dayEvents = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);

  dayEvents.sort((a, b) => {
    const durA = new Date(a.endDate) - new Date(a.startDate);
    const durB = new Date(b.endDate) - new Date(b.startDate);
    if (durB !== durA) return durB - durA;
    return a.id - b.id;
  });

  dayEvents.forEach(ev => {
    const cat = categories.find(c => c.id === ev.catId) || categories[0];
    const item = document.createElement('div');
    item.className = 'event-item';

    const isStart = dateStr === ev.startDate;
    const isEnd = dateStr === ev.endDate;

    if (!ev.isAllDay) {
      item.classList.add('timed-event');
      item.style.borderColor = cat.color;
      item.innerText = `${ev.eventTime} ${ev.title}`;
    } else {
      item.style.background = cat.color;

      if (ev.isSingleDay || (ev.startDate === ev.endDate)) {
        item.style.borderRadius = '4px';
        item.innerText = ev.title;
      } else {
        item.style.marginLeft = '-2px';
        item.style.marginRight = '-2px';
        item.style.borderRadius = '0px';

        if (isStart) {
          item.style.borderTopLeftRadius = '4px';
          item.style.borderBottomLeftRadius = '4px';
          item.style.marginLeft = '0px';
          item.innerText = ev.title;
        } else if (isEnd) {
          item.style.borderTopRightRadius = '4px';
          item.style.borderBottomRightRadius = '4px';
          item.style.marginRight = '0px';
          item.innerText = '';
        } else {
          item.innerText = '';
        }
      }
    }

    item.onclick = (e) => {
      e.stopPropagation();
      openDetailModal(ev);
    };

    attachLongPress(item, () => {
      openDeleteModal(`'${ev.title}' 일정을 삭제하시겠습니까?`, () => {
        events = events.filter(e => e.id !== ev.id);
        renderCalendar();
        saveDataToCloud();
      });
    });

    cell.appendChild(item);
  });

  cell.onclick = () => {
    selectedDateStr = dateStr;
    openAddModal();
  };

  container.appendChild(cell);
}

function attachLongPress(element, callback) {
  let timer = null;
  let isLongPress = false;

  const start = (e) => {
    if (e.type === 'touchstart' && e.touches.length > 1) return;
    isLongPress = false;
    timer = setTimeout(() => {
      isLongPress = true;
      if (navigator.vibrate) navigator.vibrate(40);
      callback();
    }, 450);
  };

  const cancel = () => {
    if (timer) clearTimeout(timer);
  };

  element.addEventListener('touchstart', start, { passive: true });
  element.addEventListener('touchend', (e) => {
    cancel();
    if (isLongPress) {
      e.stopPropagation();
      e.preventDefault();
    }
  });
  element.addEventListener('touchmove', cancel, { passive: true });
  element.addEventListener('mousedown', start);
  element.addEventListener('mouseup', cancel);
  element.addEventListener('mouseleave', cancel);
}

function openDetailModal(ev) {
  activeDetailEventId = ev.id;
  const cat = categories.find(c => c.id === ev.catId) || categories[0];

  document.getElementById('detailTitle').innerText = ev.title;
  document.getElementById('detailCatName').innerText = cat.name;
  document.getElementById('detailCatDot').style.background = cat.color;

  const registeredText = ev.createdAtStr ? `${ev.createdAtStr} 등록` : '2026-08-06 / 10:54 등록';
  document.getElementById('detailTimeArea').innerText = registeredText;

  const notesContainer = document.getElementById('detailNotesContainer');
  const notesText = document.getElementById('detailNotesText');

  if (ev.details && ev.details.trim() !== '') {
    notesText.innerText = ev.details;
    notesContainer.style.display = 'block';
  } else {
    notesContainer.style.display = 'none';
  }

  document.getElementById('detailModalOverlay').classList.add('active');
  document.getElementById('detailBottomSheet').style.transform = 'translateY(0)';
}

window.closeDetailModal = function() {
  const sheet = document.getElementById('detailBottomSheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('detailModalOverlay').classList.remove('active');
  }, 200);
};

window.deleteCurrentEventFromDetail = function() {
  if (activeDetailEventId) {
    events = events.filter(e => e.id !== activeDetailEventId);
    closeDetailModal();
    renderCalendar();
    saveDataToCloud();
  }
};

function openDeleteModal(message, deleteCallback) {
  pendingDeleteAction = deleteCallback;
  document.getElementById('deleteModalDesc').innerText = message;
  document.getElementById('deleteModalOverlay').classList.add('active');
  document.getElementById('deleteBottomSheet').style.transform = 'translateY(0)';
}

window.closeDeleteModal = function() {
  const sheet = document.getElementById('deleteBottomSheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('deleteModalOverlay').classList.remove('active');
    pendingDeleteAction = null;
  }, 200);
};

document.getElementById('confirmDeleteBtn').onclick = function() {
  if (typeof pendingDeleteAction === 'function') {
    pendingDeleteAction();
  }
  closeDeleteModal();
};

window.openAddModal = function() {
  document.getElementById('singleDayToggle').checked = true;
  document.getElementById('allDayToggle').checked = true;
  document.getElementById('detailsToggle').checked = false;

  document.getElementById('endDateGroup').style.display = 'none';
  document.getElementById('timeGroup').style.display = 'none';
  document.getElementById('detailsGroup').style.display = 'none';
  document.getElementById('eventDetails').value = '';

  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('bottomSheet').style.transform = 'translateY(0)';
  document.getElementById('endDateInput').value = selectedDateStr;
  renderModalCategories();
};

window.closeModal = function() {
  const sheet = document.getElementById('bottomSheet');
  sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('modalOverlay').classList.remove('active');
  }, 200);
};

function renderModalCategories() {
  const list = document.getElementById('modalCategoryList');
  list.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('div');
    btn.className = `cat-select-btn ${cat.id === selectedCatId ? 'selected' : ''}`;
    btn.innerHTML = `<div class="cat-dot" style="background:${cat.color}"></div><span>${cat.name}</span>`;
    btn.onclick = () => {
      selectedCatId = cat.id;
      renderModalCategories();
    };
    list.appendChild(btn);
  });
}

window.saveEvent = function() {
  const title = document.getElementById('eventTitle').value.trim();
  if (!title) return alert('제목을 입력해주세요.');

  const isSingle = document.getElementById('singleDayToggle').checked;
  const isAllDay = document.getElementById('allDayToggle').checked;
  const hasDetails = document.getElementById('detailsToggle').checked;
  const detailsVal = document.getElementById('eventDetails').value.trim();

  const endDateVal = document.getElementById('endDateInput').value;
  const eventTimeVal = document.getElementById('eventTime').value;

  const now = new Date();
  const createdDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const createdTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  events.push({
    id: Date.now(),
    title,
    startDate: selectedDateStr,
    endDate: isSingle ? selectedDateStr : (endDateVal || selectedDateStr),
    isSingleDay: isSingle,
    isAllDay: isAllDay,
    eventTime: eventTimeVal,
    details: hasDetails ? detailsVal : '',
    catId: selectedCatId,
    createdAtStr: `${createdDateStr} / ${createdTimeStr}`
  });

  document.getElementById('eventTitle').value = '';
  closeModal();
  renderCalendar();
  saveDataToCloud();
};

// 모달 드래그 이벤트 등록
makeSheetDraggable('bottomSheet', window.closeModal);
makeSheetDraggable('catBottomSheet', window.closeCatModal);
makeSheetDraggable('detailBottomSheet', window.closeDetailModal);
makeSheetDraggable('deleteBottomSheet', window.closeDeleteModal);
makeLeftDrawerDraggable('settingsSideDrawer', window.closeSettingsModal);

initCalendarSwipe();
updateClock();
renderCategories();
renderCalendar();
setInterval(updateClock, 30000);
