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
// 2. 앱 전역 변수 (색상 통합 - iOS Blue & Red)
// ==========================================
let currentDate = new Date();
let selectedDateStr = getLocalDateStr(new Date());
let currentView = 'month';

// 카테고리 색상 2가지로 통합
let categories = [
  { id: 'cat_work', name: '업무', color: '#007AFF', isDefault: true },
  { id: 'cat_personal', name: '개인', color: '#FF3B30', isDefault: true }
];
let selectedCatId = categories[0].id;
let selectedCatColor = '#007AFF';
let events = [];
let activeDetailEventId = null;
let pendingDeleteAction = null;

// ==========================================
// 3. Firebase 및 데이터 로직
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
  try { await auth.signInWithPopup(provider); } catch (err) { alert("구글 로그인 실패: " + err.message); }
};
window.logoutGoogle = async function() {
  try { await auth.signOut(); } catch (err) { alert("로그아웃 실패: " + err.message); }
};
async function saveDataToCloud() {
  if (!currentUser) return;
  try { await db.collection("users").doc(currentUser.uid).set({ events, categories }); } catch (err) { console.error("클라우드 저장 실패:", err); }
}
async function loadDataFromCloud() {
  if (!currentUser) return;
  try {
    const doc = await db.collection("users").doc(currentUser.uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data.events) events = data.events;
      if (data.categories) categories = data.categories;
      renderCalendar();
    }
  } catch (err) { console.error("클라우드 불러오기 실패:", err); }
}

// ==========================================
// 4. 유틸리티
// ==========================================
function getLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateClock() {
  const now = new Date();
  const clockElem = document.getElementById('clockTime');
  if (clockElem) clockElem.innerText = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function getHolidayName(dateObj) {
  // 간소화된 공휴일 로직
  const m = dateObj.getMonth() + 1, d = dateObj.getDate();
  if (m === 1 && d === 1) return '신정';
  if (m === 3 && d === 1) return '삼일절';
  if (m === 5 && d === 5) return '어린이날';
  if (m === 6 && d === 6) return '현충일';
  if (m === 8 && d === 15) return '광복절';
  if (m === 10 && d === 3) return '개천절';
  if (m === 10 && d === 9) return '한글날';
  if (m === 12 && d === 25) return '성탄절';
  return null;
}

// ==========================================
// 5. Drawer 및 Sheet UI 제어
// ==========================================
window.openSettingsDrawer = function() {
  document.getElementById('settingsModalOverlay').classList.add('active');
  setTimeout(() => { document.getElementById('settingsSideDrawer').classList.add('active'); }, 10);
};
window.closeSettingsDrawer = function() {
  document.getElementById('settingsSideDrawer').classList.remove('active');
  setTimeout(() => { document.getElementById('settingsModalOverlay').classList.remove('active'); }, 400);
};
window.toggleThemeFromSettings = function() {
  const isLight = document.getElementById('themeToggleSwitch').checked;
  document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
  document.getElementById('themeModeLabel').innerText = isLight ? 'Light' : 'Dark';
};

window.openSearchSheet = function() {
  document.getElementById('ui-search-overlay').classList.add('active');
  document.getElementById('ui-search-sheet').classList.add('active');
  setTimeout(() => document.getElementById('ui-search-input').focus(), 300);
};
window.closeSearchSheet = function() {
  document.getElementById('ui-search-sheet').classList.remove('active');
  document.getElementById('ui-search-overlay').classList.remove('active');
  document.getElementById('ui-search-input').value = '';
  document.getElementById('ui-search-list').innerHTML = '';
  document.querySelector('.ui-empty-state').style.display = 'block';
};

document.getElementById('ui-search-input').addEventListener('input', (e) => {
  const keyword = e.target.value.trim().toLowerCase();
  const list = document.getElementById('ui-search-list');
  const empty = document.querySelector('.ui-empty-state');
  if (keyword.length > 0) {
    const filtered = events.filter(ev => ev.title.toLowerCase().includes(keyword) || (ev.details && ev.details.toLowerCase().includes(keyword)));
    empty.style.display = 'none';
    list.innerHTML = filtered.length > 0 
      ? filtered.map(ev => `<li class="ui-search-item" onclick="closeSearchSheet(); openDetailModalById(${ev.id});"><div class="ui-search-date">${ev.startDate}</div><div class="ui-search-title">${ev.title}</div></li>`).join('')
      : `<li class="ui-search-item"><div class="ui-search-title" style="color:var(--text-muted);">검색 결과가 없습니다.</div></li>`;
  } else {
    list.innerHTML = '';
    empty.style.display = 'block';
  }
});
window.openDetailModalById = function(eventId) {
  const ev = events.find(e => e.id === eventId);
  if (ev) openDetailModal(ev);
};

// ==========================================
// 6. 캘린더 최적화 렌더링 (Lane Assignment)
// ==========================================
window.switchView = function(view) {
  currentView = view;
  document.getElementById('btnMonth').classList.toggle('active', view === 'month');
  document.getElementById('btnWeek').classList.toggle('active', view === 'week');
  ['gridPrev', 'gridCurrent', 'gridNext'].forEach(id => {
    document.getElementById(id).classList.toggle('week-view', view === 'week');
  });
  renderCalendar();
};

window.changeMonth = function(delta) {
  if (currentView === 'month') currentDate.setMonth(currentDate.getMonth() + delta);
  else currentDate.setDate(currentDate.getDate() + (delta * 7));
  renderCalendar();
};

function renderCalendar() {
  const monthDisplay = document.getElementById('monthDisplay');
  monthDisplay.innerText = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

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
  let days = [];

  // 날짜 배열 생성
  if (currentView === 'month') {
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevLastDate = new Date(year, month, 0).getDate();
    const totalCells = firstDay + lastDate;
    const numWeeks = Math.ceil(totalCells / 7);
    gridElem.style.setProperty('--row-count', numWeeks);

    for (let i = firstDay - 1; i >= 0; i--) days.push({ date: new Date(year, month - 1, prevLastDate - i), isOther: true });
    for (let day = 1; day <= lastDate; day++) days.push({ date: new Date(year, month, day), isOther: false });
    const remainingCells = (numWeeks * 7) - totalCells;
    for (let day = 1; day <= remainingCells; day++) days.push({ date: new Date(year, month + 1, day), isOther: true });
  } else {
    gridElem.style.setProperty('--row-count', 1);
    const dayOfWeek = baseDate.getDay();
    const sunday = new Date(year, month, baseDate.getDate() - dayOfWeek);
    for (let i = 0; i < 7; i++) days.push({ date: new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i), isOther: false });
  }

  // ⭐️ 주간(Week) 단위로 일정을 묶고 Lane(위치) 할당 알고리즘 적용
  for (let i = 0; i < days.length; i += 7) {
    let weekDays = days.slice(i, i + 7);
    let weekStart = getLocalDateStr(weekDays[0].date);
    let weekEnd = getLocalDateStr(weekDays[weekDays.length - 1].date);

    let weekEvents = events.filter(e => e.endDate >= weekStart && e.startDate <= weekEnd);
    
    // 시작일 오름차순 -> 기간 내림차순 정렬
    weekEvents.sort((a, b) => {
      if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
      return new Date(b.endDate) - new Date(b.startDate);
    });

    // 레인(Lane) 할당하여 가로 줄맞춤 유지
    let lanes = [];
    weekEvents.forEach(ev => {
      let placed = false;
      for (let l = 0; l < lanes.length; l++) {
        if (lanes[l] < ev.startDate) {
          ev._lane = l;
          lanes[l] = ev.endDate;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev._lane = lanes.length;
        lanes.push(ev.endDate);
      }
    });

    // 각 날짜 셀 생성 및 렌더링
    weekDays.forEach(dayInfo => {
      createCell(gridElem, dayInfo.date, dayInfo.isOther, weekEvents);
    });
  }
}

function createCell(container, dateObj, isOtherMonth, weekEvents) {
  const cell = document.createElement('div');
  cell.className = `day-cell ${isOtherMonth ? 'other-month' : ''}`;
  const dateStr = getLocalDateStr(dateObj);
  if (dateStr === getLocalDateStr(new Date())) cell.classList.add('today');

  const dayNum = document.createElement('div');
  dayNum.className = 'day-number';
  dayNum.innerText = dateObj.getDate();
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 0 || getHolidayName(dateObj)) dayNum.style.color = 'var(--accent-red)';
  else if (dayOfWeek === 6) dayNum.style.color = 'var(--accent-blue)';
  else dayNum.style.color = 'var(--text-main)';
  cell.appendChild(dayNum);

  // 셀 내부에 스크롤 가능한 이벤트 래퍼 추가
  const eventWrapper = document.createElement('div');
  eventWrapper.className = 'event-wrapper';

  let dayEvents = weekEvents.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
  let maxLane = dayEvents.length > 0 ? Math.max(...dayEvents.map(e => e._lane)) : -1;

  for (let l = 0; l <= maxLane; l++) {
    let ev = dayEvents.find(e => e._lane === l);
    if (ev) {
      const isStart = dateStr === ev.startDate;
      const isEnd = dateStr === ev.endDate;
      const cat = categories.find(c => c.id === ev.catId) || categories[0];
      
      const item = document.createElement('div');
      item.className = 'event-item';

      if (!ev.isAllDay) {
        item.classList.add('timed-event');
        item.style.borderColor = cat.color;
        item.innerText = `${ev.eventTime} ${ev.title}`;
      } else {
        item.style.background = cat.color;
        item.classList.add('schedule-bar');
        
        // CSS 처리를 위한 클래스 추가 (막대 끊김 현상 해결)
        if (ev.startDate === ev.endDate) {
          item.classList.add('is-single');
          item.innerText = ev.title;
        } else {
          if (isStart) {
             item.classList.add('is-start');
             item.innerText = ev.title;
          } else if (isEnd) {
             item.classList.add('is-end');
          } else {
             item.classList.add('is-middle');
          }
          // 주의 시작(일요일)일 때 글자 다시 표기
          if (!isStart && dayOfWeek === 0) item.innerText = ev.title;
        }
      }

      item.onclick = (e) => { e.stopPropagation(); openDetailModal(ev); };
      eventWrapper.appendChild(item);
    } else {
      // 위치 유지를 위한 빈 공간(Spacer) 삽입
      const spacer = document.createElement('div');
      spacer.className = 'event-item spacer';
      spacer.innerHTML = '&nbsp;';
      eventWrapper.appendChild(spacer);
    }
  }

  cell.appendChild(eventWrapper);
  cell.onclick = () => { selectedDateStr = dateStr; openAddModal(); };
  container.appendChild(cell);
}

// ==========================================
// 7. 일정 추가 / 수정 모달 로직
// ==========================================
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
  
  const list = document.getElementById('modalCategoryList');
  list.innerHTML = categories.map(cat => `
    <div class="cat-select-btn ${cat.id === selectedCatId ? 'selected' : ''}" onclick="selectedCatId='${cat.id}'; openAddModal();">
      <div class="cat-dot" style="background:${cat.color}"></div><span>${cat.name}</span>
    </div>
  `).join('');
};

window.closeModal = function() {
  document.getElementById('bottomSheet').style.transform = 'translateY(100%)';
  setTimeout(() => document.getElementById('modalOverlay').classList.remove('active'), 400);
};

window.handleToggleChange = function(changed) {
  const single = document.getElementById('singleDayToggle');
  const allDay = document.getElementById('allDayToggle');
  if (!single.checked && !allDay.checked) {
    if (changed === 'single') single.checked = true;
    else allDay.checked = true;
  }
  document.getElementById('endDateGroup').style.display = single.checked ? 'none' : 'block';
  document.getElementById('timeGroup').style.display = allDay.checked ? 'none' : 'block';
};
window.toggleDetailsVisibility = function() {
  document.getElementById('detailsGroup').style.display = document.getElementById('detailsToggle').checked ? 'block' : 'none';
};

window.saveEvent = function() {
  const title = document.getElementById('eventTitle').value.trim();
  if (!title) return alert('제목을 입력해주세요.');

  const isSingle = document.getElementById('singleDayToggle').checked;
  events.push({
    id: Date.now(),
    title,
    startDate: selectedDateStr,
    endDate: isSingle ? selectedDateStr : (document.getElementById('endDateInput').value || selectedDateStr),
    isSingleDay: isSingle,
    isAllDay: document.getElementById('allDayToggle').checked,
    eventTime: document.getElementById('eventTime').value,
    details: document.getElementById('detailsToggle').checked ? document.getElementById('eventDetails').value.trim() : '',
    catId: selectedCatId,
    createdAtStr: `${getLocalDateStr(new Date())}`
  });

  closeModal();
  renderCalendar();
  saveDataToCloud();
};

// ==========================================
// 8. 세부사항 및 삭제 기능
// ==========================================
function openDetailModal(ev) {
  activeDetailEventId = ev.id;
  const cat = categories.find(c => c.id === ev.catId) || categories[0];
  document.getElementById('detailTitle').innerText = ev.title;
  document.getElementById('detailCatName').innerText = cat.name;
  document.getElementById('detailCatDot').style.background = cat.color;
  document.getElementById('detailTimeArea').innerText = ev.createdAtStr ? `${ev.createdAtStr} 등록` : '';

  const notes = document.getElementById('detailNotesContainer');
  if (ev.details) {
    document.getElementById('detailNotesText').innerText = ev.details;
    notes.style.display = 'block';
  } else notes.style.display = 'none';

  document.getElementById('detailModalOverlay').classList.add('active');
  document.getElementById('detailBottomSheet').style.transform = 'translateY(0)';
}

window.closeDetailModal = function() {
  document.getElementById('detailBottomSheet').style.transform = 'translateY(100%)';
  setTimeout(() => document.getElementById('detailModalOverlay').classList.remove('active'), 400);
};

window.deleteCurrentEventFromDetail = function() {
  openDeleteModal("일정을 삭제하시겠습니까?", () => {
    events = events.filter(e => e.id !== activeDetailEventId);
    closeDetailModal();
    renderCalendar();
    saveDataToCloud();
  });
};

function openDeleteModal(msg, callback) {
  pendingDeleteAction = callback;
  document.getElementById('deleteModalDesc').innerText = msg;
  document.getElementById('deleteModalOverlay').classList.add('active');
  document.getElementById('deleteBottomSheet').style.transform = 'translateY(0)';
}
window.closeDeleteModal = function() {
  document.getElementById('deleteBottomSheet').style.transform = 'translateY(100%)';
  setTimeout(() => document.getElementById('deleteModalOverlay').classList.remove('active'), 400);
};
document.getElementById('confirmDeleteBtn').onclick = function() {
  if (pendingDeleteAction) pendingDeleteAction();
  closeDeleteModal();
};

// 카테고리 관리 생략 (기존 로직 사용)
window.openCatManageModal = function() {
  const list = document.getElementById('catManageList');
  list.innerHTML = categories.map(cat => `<div class="cat-manage-chip ${cat.isDefault?'is-default':''}"><div class="cat-dot" style="background:${cat.color}"></div><span>${cat.name}</span></div>`).join('');
  
  const colors = ['#007AFF', '#FF3B30', '#34C759', '#FF9500', '#AF52DE'];
  document.getElementById('colorPickerGroup').innerHTML = colors.map((c, i) => `<div class="color-dot-opt ${i===0?'selected':''}" style="background:${c}" onclick="document.querySelectorAll('.color-dot-opt').forEach(d=>d.classList.remove('selected')); this.classList.add('selected'); selectedCatColor='${c}';"></div>`).join('');
  
  document.getElementById('catModalOverlay').classList.add('active');
  document.getElementById('catBottomSheet').style.transform = 'translateY(0)';
};
window.closeCatModal = function() {
  document.getElementById('catBottomSheet').style.transform = 'translateY(100%)';
  setTimeout(() => document.getElementById('catModalOverlay').classList.remove('active'), 400);
};
window.saveCategory = function() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return;
  categories.push({ id: 'cat_' + Date.now(), name, color: selectedCatColor, isDefault: false });
  closeCatModal(); saveDataToCloud();
};

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 30000);
  renderCalendar();
});
