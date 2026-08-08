// ==========================================
// 1. Firebase 설정 및 초기화
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
    if (statusElem) statusElem.innerText = `${user.displayName}님`;
    if (loginBtn) loginBtn.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    await loadDataFromCloud();
  } else {
    if (statusElem) statusElem.innerText = '로그인이 필요합니다.';
    if (loginBtn) loginBtn.style.display = 'inline-block';
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
  const clockElem = document.getElementById('clockTime');
  if (clockElem) {
    clockElem.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }
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

// ==========================================
// 5. 통합 설정 및 메뉴 서랍 (Drawer) 제어
// ==========================================
window.openSettingsDrawer = function() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  document.getElementById('themeToggleSwitch').checked = isLight;
  document.getElementById('themeModeLabel').innerText = isLight ? 'Light' : 'Dark';

  const drawer = document.getElementById('settingsSideDrawer');
  const overlay = document.getElementById('settingsModalOverlay');
  if (drawer && overlay) {
    drawer.style.transform = '';
    overlay.classList.add('active');
    setTimeout(() => {
      drawer.classList.add('active');
    }, 10);
  }
};

window.closeSettingsDrawer = function() {
  const drawer = document.getElementById('settingsSideDrawer');
  const overlay = document.getElementById('settingsModalOverlay');
  if (drawer && overlay) {
    drawer.classList.remove('active');
    drawer.style.transform = 'translateX(-100%)';
    setTimeout(() => {
      overlay.classList.remove('active');
      drawer.style.transform = '';
    }, 400);
  }
};

function makeLeftDrawerDraggable(drawerId, closeFn) {
  const drawer = document.getElementById(drawerId);
  if (!drawer) return;
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
    drawer.style.transition = 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)';
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

// ==========================================
// 6. 검색 바텀 시트 및 검색 기능
// ==========================================
window.openSearchSheet = function() {
  const sheet = document.getElementById('ui-search-sheet');
  const overlay = document.getElementById('ui-search-overlay');
  const input = document.getElementById('ui-search-input');
  if (sheet && overlay) {
    overlay.classList.add('active');
    sheet.classList.add('active');
    if (input) setTimeout(() => input.focus(), 300);
  }
};

window.closeSearchSheet = function() {
  const sheet = document.getElementById('ui-search-sheet');
  const overlay = document.getElementById('ui-search-overlay');
  const input = document.getElementById('ui-search-input');
  const list = document.getElementById('ui-search-list');
  const emptyState = document.querySelector('.ui-empty-state');
  if (sheet && overlay) {
    sheet.classList.remove('active');
    overlay.classList.remove('active');
    if (input) {
      input.value = '';
      input.blur();
    }
    if (list) list.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('ui-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      const searchList = document.getElementById('ui-search-list');
      const emptyState = document.querySelector('.ui-empty-state');

      if (!searchList || !emptyState) return;

      if (keyword.length > 0) {
        const filtered = events.filter(ev => 
          ev.title.toLowerCase().includes(keyword) || 
          (ev.details && ev.details.toLowerCase().includes(keyword))
        );

        if (filtered.length > 0) {
          emptyState.style.display = 'none';
          searchList.innerHTML = filtered.map(ev => `
            <li class="ui-search-item" onclick="closeSearchSheet(); openDetailModalById(${ev.id});">
              <div class="ui-search-date">${ev.startDate}</div>
              <div class="ui-search-title">${ev.title}</div>
            </li>
          `).join('');
        } else {
          emptyState.style.display = 'none';
          searchList.innerHTML = `
            <li class="ui-search-item" style="cursor: default;">
              <div class="ui-search-title" style="color: var(--text-muted); font-size: 14px;">검색 결과가 없습니다.</div>
            </li>
          `;
        }
      } else {
        searchList.innerHTML = '';
        emptyState.style.display = 'block';
      }
    });
  }
});

window.openDetailModalById = function(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (ev) openDetailModal(ev);
};

// ==========================================
// 7. 캘린더 보기 및 조작 로직
// ==========================================
window.switchView = function(view) {
  if (navigator.vibrate) navigator.vibrate(10);
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
  if (navigator.vibrate) navigator.vibrate(10);
  if (currentView === 'month') {
    currentDate.setMonth(currentDate.getMonth() + delta);
  } else {
    currentDate.setDate(currentDate.getDate() + (delta * 7));
  }
  renderCalendar();
};

window.handleToggleChange = function(changed) {
  if (navigator.vibrate) navigator.vibrate(10);
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
  if (navigator.vibrate) navigator.vibrate(10);
  const isShow = document.getElementById('detailsToggle').checked;
  document.getElementById('detailsGroup').style.display = isShow ? 'block' : 'none';
};

function makeSheetDraggable(sheetId, closeFn) {
  const sheet = document.getElementById(sheetId);
  if (!sheet) return;
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
    sheet.style.transition = 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)';
    if (deltaY > 70) closeFn();
    else sheet.style.transform = 'translateY(0)';
    startY = 0; currentY = 0;
  });
}

function initCalendarSwipe() {
  const calBody = document.getElementById('calendarBody');
  const track = document.getElementById('calendarTrack');
  if (!calBody || !track) return;
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
      track.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      track.style.transform = `translateX(-${window.innerWidth}px)`;

      setTimeout(() => {
        changeMonth(1);
        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
      }, 300);

    } else if (deltaX > threshold) {
      track.style.transition = 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)';
      track.style.transform = `translateX(${window.innerWidth}px)`;

      setTimeout(() => {
        changeMonth(-1);
        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
      }, 300);

    } else {
      track.style.transition = 'transform 0.25s ease-out';
      track.style.transform = 'translateX(0px)';
    }
  });
}

function renderCategories() {
  const container = document.getElementById('categoryContainer');
  if (!container) return;
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
          renderCatManageList();
          renderModalCategories();
          saveDataToCloud();
        });
      });
    }
    container.appendChild(chip);
  });
}

function renderCatManageList() {
  const list = document.getElementById('catManageList');
  const empty = document.getElementById('catManageEmpty');
  if (!list) return;

  list.innerHTML = '';
  if (categories.length === 0) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  categories.forEach(cat => {
    const chip = document.createElement('div');
    chip.className = `cat-manage-chip${cat.isDefault ? ' is-default' : ''}`;
    chip.innerHTML = `<div class="cat-dot" style="background:${cat.color}"></div><span>${cat.name}</span>`;

    if (!cat.isDefault) {
      attachLongPress(chip, () => {
        openDeleteModal(`'${cat.name}' 카테고리를 삭제하시겠습니까?`, () => {
          categories = categories.filter(c => c.id !== cat.id);
          renderCategories();
          renderCatManageList();
          renderModalCategories();
          saveDataToCloud();
        });
      });
    }
    list.appendChild(chip);
  });
}

window.openCatManageModal = function() {
  renderCatManageList();

  const overlay = document.getElementById('catModalOverlay');
  const sheet = document.getElementById('catBottomSheet');
  if (overlay && sheet) {
    overlay.classList.add('active');
    sheet.style.transform = 'translateY(0)';
  }

  const nameInput = document.getElementById('newCatName');
  if (nameInput) nameInput.value = '';

  const colors = ['#FF2D55', '#AF52DE', '#5856D6', '#FFCC00', '#34C759', '#FF9500', '#0a84ff', '#ff3b30'];
  const picker = document.getElementById('colorPickerGroup');
  if (!picker) return;
  picker.innerHTML = '';
  selectedCatColor = colors[0];

  colors.forEach((c, idx) => {
    const dot = document.createElement('div');
    dot.className = `color-dot-opt ${idx === 0 ? 'selected' : ''}`;
    dot.style.background = c;
    dot.onclick = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      document.querySelectorAll('#colorPickerGroup .color-dot-opt').forEach(d => d.classList.remove('selected'));
      dot.classList.add('selected');
      selectedCatColor = c;
    };
    picker.appendChild(dot);
  });
};

window.openCatModal = window.openCatManageModal;

window.closeCatModal = function() {
  const sheet = document.getElementById('catBottomSheet');
  const overlay = document.getElementById('catModalOverlay');
  if (sheet && overlay) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 400);
  }
};

window.saveCategory = function() {
  const nameInput = document.getElementById('newCatName');
  if (!nameInput) return;
  const name = nameInput.value.trim();
  if (!name) return alert('카테고리 이름을 입력해주세요.');

  categories.push({
    id: 'cat_' + Date.now(),
    name,
    color: selectedCatColor,
    isDefault: false
  });

  nameInput.value = '';
  renderCategories();
  renderCatManageList();
  renderModalCategories();
  saveDataToCloud();
};

function renderCalendar() {
  const monthDisplay = document.getElementById('monthDisplay');
  if (!monthDisplay) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  monthDisplay.innerText = `${year}년 ${month + 1}월`;

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
  if (!gridElem) return;
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
    if (navigator.vibrate) navigator.vibrate(10);
    selectedDateStr = dateStr;
    openAddModal();
  };

  container.appendChild(cell);
}

function optimizeScheduleLanes(events) {
  // 1. 시작일 오름차순 -> 기간이 긴 순서(내림차순) 정렬
  const sortedEvents = [...events].sort((a, b) => {
    const startDiff = new Date(a.startDate) - new Date(b.startDate);
    if (startDiff !== 0) return startDiff;
    
    const durationA = new Date(a.endDate) - new Date(a.startDate);
    const durationB = new Date(b.endDate) - new Date(b.startDate);
    return durationB - durationA;
  });

  // 2. 레인(트랙) 배열 초기화
  const lanes = []; // 각 레인의 마지막 이벤트 종료일 저장

  return sortedEvents.map(event => {
    let assignedLane = -1;
    const eventStart = new Date(event.startDate).getTime();

    // 빈 레인 찾기 (기존 이벤트의 종료일보다 시작일이 뒤에 있는 경우)
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] < eventStart) {
        assignedLane = i;
        break;
      }
    }

    // 빈 레인이 없으면 새 레인 추가
    if (assignedLane === -1) {
      lanes.push(new Date(event.endDate).getTime());
      assignedLane = lanes.length - 1;
    } else {
      lanes[assignedLane] = new Date(event.endDate).getTime();
    }

    return {
      ...event,
      laneIndex: assignedLane // 막대가 들어갈 vertical 위치 (top: laneIndex * height)
    };
  });
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
  const overlay = document.getElementById('detailModalOverlay');
  if (sheet && overlay) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 400);
  }
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
  const overlay = document.getElementById('deleteModalOverlay');
  if (sheet && overlay) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      overlay.classList.remove('active');
      pendingDeleteAction = null;
    }, 400);
  }
};

const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
if (confirmDeleteBtn) {
  confirmDeleteBtn.onclick = function() {
    if (typeof pendingDeleteAction === 'function') {
      pendingDeleteAction();
    }
    closeDeleteModal();
  };
}

window.openAddModal = function() {
  document.getElementById('singleDayToggle').checked = true;
  document.getElementById('allDayToggle').checked = true;
  document.getElementById('detailsToggle').checked = false;

  document.getElementById('endDateGroup').style.display = 'none';
  document.getElementById('timeGroup').style.display = 'none';
  document.getElementById('detailsGroup').style.display = 'none';
  document.getElementById('eventDetails').value = '';
  document.getElementById('eventTitle').value = '';

  document.getElementById('modalOverlay').classList.add('active');
  document.getElementById('bottomSheet').style.transform = 'translateY(0)';
  document.getElementById('endDateInput').value = selectedDateStr;
  renderModalCategories();
};

window.closeModal = function() {
  const sheet = document.getElementById('bottomSheet');
  const overlay = document.getElementById('modalOverlay');
  if (sheet && overlay) {
    sheet.style.transform = 'translateY(100%)';
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 400);
  }
};

function renderModalCategories() {
  const list = document.getElementById('modalCategoryList');
  if (!list) return;
  list.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('div');
    btn.className = `cat-select-btn ${cat.id === selectedCatId ? 'selected' : ''}`;
    btn.innerHTML = `<div class="cat-dot" style="background:${cat.color}"></div><span>${cat.name}</span>`;
    btn.onclick = () => {
      if (navigator.vibrate) navigator.vibrate(10);
      selectedCatId = cat.id;
      renderModalCategories();
    };
    list.appendChild(btn);
  });
}

window.saveEvent = function() {
  const titleInput = document.getElementById('eventTitle');
  if (!titleInput) return;
  const title = titleInput.value.trim();
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

  titleInput.value = '';
  closeModal();
  renderCalendar();
  saveDataToCloud();
};

document.addEventListener('DOMContentLoaded', () => {
  makeSheetDraggable('bottomSheet', window.closeModal);
  makeSheetDraggable('catBottomSheet', window.closeCatModal);
  makeSheetDraggable('detailBottomSheet', window.closeDetailModal);
  makeSheetDraggable('deleteBottomSheet', window.closeDeleteModal);
  makeLeftDrawerDraggable('settingsSideDrawer', window.closeSettingsDrawer);

  const sheetHandle = document.querySelector('.ui-sheet-handle');
  if (sheetHandle) {
    let startY = 0;
    sheetHandle.addEventListener('touchstart', e => startY = e.touches[0].clientY);
    sheetHandle.addEventListener('touchmove', e => {
      const currentY = e.touches[0].clientY;
      if (currentY > startY + 40) window.closeSearchSheet();
    });
  }

  initCalendarSwipe();
  updateClock();
  renderCategories();
  renderCalendar();
  setInterval(updateClock, 30000);
});
