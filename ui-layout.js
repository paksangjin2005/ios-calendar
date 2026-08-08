// -----------------------------------------------------
// 1. DOM 요소 선택
// -----------------------------------------------------
const btnDrawer = document.getElementById('ui-btn-drawer');
const btnSearch = document.getElementById('ui-btn-search');
const btnAdd = document.getElementById('ui-btn-add');

const drawer = document.getElementById('ui-drawer');
const drawerOverlay = document.getElementById('ui-drawer-overlay');
const btnCloseDrawer = document.getElementById('ui-btn-close-drawer');

const searchSheet = document.getElementById('ui-search-sheet');
const searchOverlay = document.getElementById('ui-search-overlay');
const searchInput = document.getElementById('ui-search-input');
const searchList = document.getElementById('ui-search-list');
const emptyState = document.querySelector('.ui-empty-state');

// -----------------------------------------------------
// 2. 왼쪽 서랍 (Drawer) 열기/닫기
// -----------------------------------------------------
function openDrawer() {
  drawerOverlay.classList.add('active');
  drawer.classList.add('active');
}

function closeDrawer() {
  drawer.classList.remove('active');
  drawerOverlay.classList.remove('active');
}

btnDrawer.addEventListener('click', openDrawer);
btnCloseDrawer.addEventListener('click', closeDrawer);
drawerOverlay.addEventListener('click', closeDrawer);

// 스와이프로 닫기 지원 (왼쪽으로 밀면 닫힘)
let startX = 0;
drawer.addEventListener('touchstart', e => startX = e.touches[0].clientX);
drawer.addEventListener('touchmove', e => {
  const currentX = e.touches[0].clientX;
  if (currentX < startX - 30) closeDrawer();
});

// -----------------------------------------------------
// 3. 하단 검색 바텀 시트 (Search) 열기/닫기
// -----------------------------------------------------
function openSearch() {
  searchOverlay.classList.add('active');
  searchSheet.classList.add('active');
  // 열릴 때 자동으로 입력창에 포커스 (모바일 키보드 팝업)
  setTimeout(() => searchInput.focus(), 300);
}

function closeSearch() {
  searchSheet.classList.remove('active');
  searchOverlay.classList.remove('active');
  searchInput.value = ''; // 입력창 초기화
  searchList.innerHTML = '';
  emptyState.style.display = 'block';
  searchInput.blur(); // 키보드 내림
}

btnSearch.addEventListener('click', openSearch);
searchOverlay.addEventListener('click', closeSearch);

// 핸들을 아래로 스와이프해서 닫기
const sheetHandle = document.querySelector('.ui-sheet-handle');
let startY = 0;
sheetHandle.addEventListener('touchstart', e => startY = e.touches[0].clientY);
sheetHandle.addEventListener('touchmove', e => {
  const currentY = e.touches[0].clientY;
  if (currentY > startY + 30) closeSearch();
});

// -----------------------------------------------------
// 4. 플로팅 추가 버튼 (FAB) 동작 - 기존 로직 연결
// -----------------------------------------------------
btnAdd.addEventListener('click', () => {
  // 기존 코드에 openAddModal() 함수가 있다고 가정하고 호출합니다.
  if (typeof openAddModal === 'function') {
    openAddModal();
  } else {
    alert('기존 코드의 일정 추가 기능을 연결해주세요!');
  }
});

// -----------------------------------------------------
// 5. 간단한 더미 검색 기능 구현 (선택 사항)
// -----------------------------------------------------
searchInput.addEventListener('input', (e) => {
  const keyword = e.target.value.trim();
  
  if (keyword.length > 0) {
    emptyState.style.display = 'none';
    searchList.innerHTML = `
      <li class="ui-search-item">
        <div class="ui-search-date">8월 24일</div>
        <div class="ui-search-title">🔍 '${keyword}' 검색 결과가 없습니다.</div>
      </li>
    `;
  } else {
    searchList.innerHTML = '';
    emptyState.style.display = 'block';
  }
});

// -----------------------------------------------------
// 6. 스크롤 시 툴바 숨기기 (옵션: 화면 넓게 쓰기)
// -----------------------------------------------------
let lastScrollY = window.scrollY;
const toolbar = document.querySelector('.ui-bottom-toolbar');

window.addEventListener('scroll', () => {
  if (window.scrollY > lastScrollY && window.scrollY > 50) {
    // 아래로 스크롤 시 툴바 숨김
    toolbar.style.transform = 'translateY(100px)';
  } else {
    // 위로 스크롤 시 툴바 나타남
    toolbar.style.transform = 'translateY(0)';
  }
  lastScrollY = window.scrollY;
});
