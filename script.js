/* ========================================================
   1. 데이터 및 초기 상태
======================================================== */
let currentDate = new Date();
let currentView = 'month'; // 'month' or 'week'
let selectedDateStr = getLocalDateStr(new Date());

let categories = [
    { id: 'cat1', name: '기본', color: '#007AFF' },
    { id: 'cat2', name: '업무', color: '#FF9500' },
    { id: 'cat3', name: '개인', color: '#34C759' },
    { id: 'cat4', name: '중요', color: '#FF3B30' }
];
let events = []; // 일정 데이터 배열

/* ========================================================
   2. 유틸리티 함수
======================================================== */
function getLocalDateStr(date) {
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - tzOffset)).toISOString().slice(0, 10);
    return localISOTime;
}

function updateClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    document.getElementById('clockTime').innerText = timeString;
}
setInterval(updateClock, 1000);
updateClock();

/* ========================================================
   3. 캘린더 렌더링 로직 (단차/끊김 해결 Absolute Overlay)
======================================================== */
function updateCalendar() {
    document.getElementById('monthDisplay').innerText = `${currentDate.getFullYear()}년 ${currentDate.getMonth() + 1}월`;

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
    let targetMonth = baseDate.getMonth();
    let targetYear = baseDate.getFullYear();
    let days = [];

    if (currentView === 'month') {
        let firstDay = new Date(targetYear, targetMonth, 1).getDay();
        let lastDate = new Date(targetYear, targetMonth + 1, 0).getDate();
        let prevMonthLastDate = new Date(targetYear, targetMonth, 0).getDate();
        
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({ date: new Date(targetYear, targetMonth - 1, prevMonthLastDate - i), isOther: true });
        }
        for (let i = 1; i <= lastDate; i++) {
            days.push({ date: new Date(targetYear, targetMonth, i), isOther: false });
        }
        let remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ date: new Date(targetYear, targetMonth + 1, i), isOther: true });
        }
    } else {
        let currentDay = baseDate.getDay();
        let startOfWeek = new Date(baseDate);
        startOfWeek.setDate(baseDate.getDate() - currentDay);
        for (let i = 0; i < 7; i++) {
            let d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push({ date: d, isOther: d.getMonth() !== targetMonth });
        }
    }

    // 주 단위(Week Row)로 잘라서 렌더링
    for (let i = 0; i < days.length; i += 7) {
        let weekDays = days.slice(i, i + 7);
        let weekStartStr = getLocalDateStr(weekDays[0].date);
        let weekEndStr = getLocalDateStr(weekDays[6].date);
        
        const weekRow = document.createElement('div');
        weekRow.className = 'week-row';
        
        // 배경선 (Background Grid)
        const bgGrid = document.createElement('div');
        bgGrid.className = 'week-bg-grid';
        weekDays.forEach((dayInfo) => {
            const cell = document.createElement('div');
            cell.className = `day-cell ${dayInfo.isOther ? 'other-month' : ''}`;
            if (getLocalDateStr(dayInfo.date) === getLocalDateStr(new Date())) cell.classList.add('today');
            
            const dayNum = document.createElement('div');
            dayNum.className = 'day-number';
            dayNum.innerText = dayInfo.date.getDate();
            
            cell.appendChild(dayNum);
            cell.onclick = () => { 
                selectedDateStr = getLocalDateStr(dayInfo.date);
                document.getElementById('endDateInput').value = selectedDateStr;
                openAddModal(); 
            };
            bgGrid.appendChild(cell);
        });
        weekRow.appendChild(bgGrid);

        // 이벤트 오버레이 (Absolute Positioning)
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'events-overlay';
        
        // 해당 주에 겹치는 이벤트만 필터링 후 정렬
        let weekEvents = events.filter(e => e.endDate >= weekStartStr && e.startDate <= weekEndStr);
        weekEvents.sort((a, b) => {
            if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
            return new Date(b.endDate) - new Date(b.startDate); // 긴 일정을 위로
        });

        let lanes = []; // 겹치는 일정을 밑으로 내리기 위한 레인 배열
        weekEvents.forEach(ev => {
            let placed = false;
            for (let l = 0; l < lanes.length; l++) {
                if (lanes[l] < ev.startDate) {
                    ev._lane = l; lanes[l] = ev.endDate; placed = true; break;
                }
            }
            if (!placed) { ev._lane = lanes.length; lanes.push(ev.endDate); }

            let wsObj = weekDays[0].date; wsObj.setHours(0,0,0,0);
            let weObj = weekDays[6].date; weObj.setHours(0,0,0,0);
            let evStartObj = new Date(ev.startDate); evStartObj.setHours(0,0,0,0);
            let evEndObj = new Date(ev.endDate); evEndObj.setHours(0,0,0,0);
            
            let renderStart = evStartObj < wsObj ? wsObj : evStartObj;
            let renderEnd = evEndObj > weObj ? weObj : evEndObj;
            
            let diffStart = Math.floor((renderStart - wsObj) / (1000 * 60 * 60 * 24));
            let duration = Math.floor((renderEnd - renderStart) / (1000 * 60 * 60 * 24)) + 1;

            const item = document.createElement('div');
            item.className = 'abs-event-item';
            
            // 🌟 단차 방지 핵심: 날짜 숫자를 피하기 위한 top 여백 28px + 레인(lane) 높이
            item.style.top = `${28 + (ev._lane * 19)}px`; 
            
            // 🌟 세로줄 이어짐 해결: 폭과 위치를 1주(100%) 기준으로 할당
            item.style.left = `calc((100% / 7) * ${diffStart} + 2px)`;
            item.style.width = `calc((100% / 7) * ${duration} - 4px)`;
            
            const cat = categories.find(c => c.id === ev.catId) || categories[0];
            
            if (ev.isAllDay) {
                item.className += ' allday';
                item.style.backgroundColor = cat.color;
                item.innerHTML = ev.title;
                
                // 이어지는 느낌을 주기 위해 좌우 둥근 모서리 및 간격 제거
                if (evStartObj < wsObj) { 
                    item.style.borderTopLeftRadius = '0'; item.style.borderBottomLeftRadius = '0'; 
                    item.style.marginLeft = '-2px'; item.style.width = `calc((100% / 7) * ${duration} - 2px)`; 
                }
                if (evEndObj > weObj) { 
                    item.style.borderTopRightRadius = '0'; item.style.borderBottomRightRadius = '0'; 
                    item.style.width = `calc((100% / 7) * ${duration} - 2px)`; 
                }
                if (evStartObj < wsObj && evEndObj > weObj) { 
                    item.style.width = `calc((100% / 7) * ${duration})`; 
                }
            } else {
                item.className += ' timed';
                item.innerHTML = `<span style="color:${cat.color}">●</span> ${ev.title}`;
            }

            item.onclick = (e) => { e.stopPropagation(); openDetailModal(ev); };
            eventsContainer.appendChild(item);
        });

        weekRow.appendChild(eventsContainer);
        gridElem.appendChild(weekRow);
    }
}

/* ========================================================
   4. 자연스러운 스와이프 (월 변경 제스처)
======================================================== */
let startX = 0, startY = 0;
let isSwiping = false;
const viewport = document.querySelector('.calendar-viewport');
const track = document.getElementById('calendarTrack');

viewport.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    track.style.transition = 'none'; // 터치 중엔 애니메이션 제거
}, {passive: true});

viewport.addEventListener('touchmove', (e) => {
    if (!startX) return;
    let deltaX = e.touches[0].clientX - startX;
    let deltaY = e.touches[0].clientY - startY;

    if (!isSwiping) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            isSwiping = true; // 가로 방향 스와이프 감지
        } else {
            startX = 0; return; // 세로 스크롤 허용
        }
    }
    
    if (isSwiping) {
        // 손가락을 따라 뷰포트가 실시간으로 움직이도록 처리 (33.33% = 100% / 3)
        track.style.transform = `translateX(calc(-33.3333% + ${deltaX}px))`;
    }
}, {passive: true});

viewport.addEventListener('touchend', (e) => {
    if (!startX) return;
    let deltaX = e.changedTouches[0].clientX - startX;
    
    if (isSwiping) {
        track.style.transition = 'transform 0.3s var(--spring-easing)';
        if (deltaX > 60) {
            // 오른쪽 스와이프 -> 이전 달
            track.style.transform = 'translateX(0%)';
            setTimeout(() => changeMonth(-1, true), 300);
        } else if (deltaX < -60) {
            // 왼쪽 스와이프 -> 다음 달
            track.style.transform = 'translateX(-66.6666%)';
            setTimeout(() => changeMonth(1, true), 300);
        } else {
            // 원위치 복귀
            track.style.transform = 'translateX(-33.3333%)';
        }
    }
    startX = 0; startY = 0; isSwiping = false;
});

function changeMonth(delta, fromSwipe = false) {
    if (!fromSwipe) {
        track.style.transition = 'transform 0.3s var(--spring-easing)';
        track.style.transform = delta > 0 ? 'translateX(-66.6666%)' : 'translateX(0%)';
        setTimeout(() => processChangeMonth(delta), 300);
    } else {
        processChangeMonth(delta);
    }
}

function processChangeMonth(delta) {
    track.style.transition = 'none';
    track.style.transform = 'translateX(-33.3333%)';
    if (currentView === 'month') {
        currentDate.setMonth(currentDate.getMonth() + delta);
    } else {
        currentDate.setDate(currentDate.getDate() + delta * 7);
    }
    updateCalendar();
}

function switchView(view) {
    currentView = view;
    document.getElementById('btnMonth').classList.toggle('active', view === 'month');
    document.getElementById('btnWeek').classList.toggle('active', view === 'week');
    updateCalendar();
}

/* ========================================================
   5. 모달 및 이벤트 관련 핸들러
======================================================== */
let currentEditingEvent = null;

function openAddModal() {
    document.getElementById('modalOverlay').classList.add('active');
    document.getElementById('bottomSheet').style.transform = 'translateY(0)';
    document.getElementById('eventTitle').value = '';
    // 초기 날짜 세팅
    document.getElementById('endDateInput').value = selectedDateStr;
}

function closeModal() {
    document.getElementById('bottomSheet').style.transform = 'translateY(100%)';
    setTimeout(() => { document.getElementById('modalOverlay').classList.remove('active'); }, 300);
}

function saveEvent() {
    const title = document.getElementById('eventTitle').value.trim();
    if (!title) return alert("제목을 입력해주세요.");
    
    const isAllDay = document.getElementById('allDayToggle').checked;
    
    // 단순 목업 저장 로직 (Firebase 연동 시 대체 가능)
    const newEvent = {
        id: 'ev_' + Date.now(),
        title: title,
        startDate: selectedDateStr,
        endDate: selectedDateStr,
        isAllDay: isAllDay,
        catId: categories[0].id
    };
    
    events.push(newEvent);
    closeModal();
    updateCalendar();
}

function openDetailModal(ev) {
    currentEditingEvent = ev;
    document.getElementById('detailTitle').innerText = ev.title;
    document.getElementById('detailTimeArea').innerText = ev.isAllDay ? '하루 종일' : '시간 설정됨';
    
    document.getElementById('detailModalOverlay').classList.add('active');
    document.getElementById('detailBottomSheet').style.transform = 'translateY(0)';
}

function closeDetailModal() {
    document.getElementById('detailBottomSheet').style.transform = 'translateY(100%)';
    setTimeout(() => { document.getElementById('detailModalOverlay').classList.remove('active'); }, 300);
}

// 🌟 좌측에 배치된 쓰레기통 버튼 클릭 시 호출
function deleteCurrentEventFromDetail() {
    if(confirm('일정을 삭제하시겠습니까?')) {
        events = events.filter(e => e.id !== currentEditingEvent.id);
        closeDetailModal();
        updateCalendar();
    }
}

// 초기 로드 시 캘린더 생성
window.onload = () => {
    updateCalendar();
};
