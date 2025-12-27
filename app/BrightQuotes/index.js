
/**
 * BrightQuotes - External Database Version
 * Fetches quotes from quotes.json
 */

let QUOTE_LIBRARY = null;

// --- State ---
let currentCategory = 'Success';
let isLoading = false;
let lastUsedQuoteIndex = -1;

// --- DOM Elements ---
const categoryNav = document.getElementById('category-nav');
const envelopeView = document.getElementById('envelope-view');
const contentView = document.getElementById('content-view');
const envelopeBody = document.getElementById('envelope-body');
const envelopeFlap = document.getElementById('envelope-flap');
const letterCard = document.getElementById('letter-card');
const statusText = document.getElementById('status-text');

// Content elements
const quoteCatBadge = document.getElementById('quote-cat-badge');
const quoteTranslation = document.getElementById('quote-translation');
const quoteOriginal = document.getElementById('quote-original');
const quoteAuthor = document.getElementById('quote-author');
const quoteInterpretation = document.getElementById('quote-interpretation');
const quoteActions = document.getElementById('quote-actions');

const CATEGORY_MAP = [
  { id: 'Success', label: '成功' },
  { id: 'Resilience', label: '逆境' },
  { id: 'Wisdom', label: '知恵' },
  { id: 'Happiness', label: '幸福' },
  { id: 'Courage', label: '勇気' }
];

// --- Initialization ---
async function init() {
  renderCategoryButtons();
  injectShuffleButton();
  window.addEventListener('resize', () => updateIndicator(currentCategory));
  
  // Load database from external file
  try {
    statusText.innerText = "名言集を読み込み中...";
    const response = await fetch('quotes.json');
    if (!response.ok) throw new Error('Failed to load quotes.json');
    QUOTE_LIBRARY = await response.json();
    fetchQuote(currentCategory);
  } catch (error) {
    console.error(error);
    statusText.innerText = "データの読み込みに失敗しました。";
  }
}

function renderCategoryButtons() {
  categoryNav.innerHTML = '<div id="indicator" class="category-indicator absolute bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl sm:rounded-[22px] shadow-lg shadow-indigo-200/50 z-0 pointer-events-none opacity-0"></div>';
  CATEGORY_MAP.forEach(cat => {
    const btn = document.createElement('button');
    btn.id = `btn-${cat.id}`;
    btn.className = "relative z-10 px-5 py-2.5 sm:px-8 sm:py-3.5 rounded-xl sm:rounded-[22px] text-xs sm:text-sm font-black transition-all duration-300 flex items-center justify-center whitespace-nowrap flex-shrink-0 text-slate-500 hover:text-slate-800 hover:bg-white/50";
    btn.innerText = cat.label;
    btn.onclick = () => handleCategoryChange(cat.id);
    categoryNav.appendChild(btn);
  });
  setTimeout(() => updateIndicator(currentCategory), 100);
}

function updateIndicator(catId) {
  const btn = document.getElementById(`btn-${catId}`);
  const indicator = document.getElementById('indicator');
  if (!btn || !indicator) return;
  indicator.style.width = `${btn.offsetWidth}px`;
  indicator.style.height = `${btn.offsetHeight}px`;
  indicator.style.left = `${btn.offsetLeft}px`;
  indicator.style.top = `${btn.offsetTop}px`;
  indicator.style.opacity = '1';
  CATEGORY_MAP.forEach(c => {
    const b = document.getElementById(`btn-${c.id}`);
    if (b) {
      if (c.id === catId) {
        b.classList.add('text-white');
        b.classList.remove('text-slate-500');
      } else {
        b.classList.remove('text-white');
        b.classList.add('text-slate-500');
      }
    }
  });
  btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function handleCategoryChange(catId) {
  if (isLoading || !QUOTE_LIBRARY || (catId === currentCategory && !contentView.classList.contains('hidden'))) {
    if (catId === currentCategory) fetchQuote(catId);
    return;
  }
  currentCategory = catId;
  lastUsedQuoteIndex = -1; 
  updateIndicator(catId);
  fetchQuote(catId);
}

async function fetchQuote(category) {
  if (!QUOTE_LIBRARY) return;
  isLoading = true;
  showEnvelope();
  await sleep(600);
  const categoryQuotes = QUOTE_LIBRARY[category];
  let randomIndex;
  do {
    randomIndex = Math.floor(Math.random() * categoryQuotes.length);
  } while (randomIndex === lastUsedQuoteIndex && categoryQuotes.length > 1);
  lastUsedQuoteIndex = randomIndex;
  const data = categoryQuotes[randomIndex];
  await playRevealAnimation(data);
}

function showEnvelope() {
  contentView.classList.add('hidden');
  envelopeView.classList.remove('hidden');
  envelopeBody.classList.remove('animate-envelope-float');
  envelopeFlap.classList.remove('animate-flap-open');
  letterCard.classList.add('hidden');
  letterCard.classList.remove('animate-letter-out');
  statusText.innerText = "メッセージを準備中...";
  void envelopeBody.offsetWidth; 
  envelopeBody.classList.add('animate-envelope-float');
}

async function playRevealAnimation(data) {
  await sleep(300);
  statusText.innerText = "手紙を開いています...";
  envelopeFlap.classList.add('animate-flap-open');
  letterCard.classList.remove('hidden');
  letterCard.classList.add('animate-letter-out');
  await sleep(1100);
  updateContent(data);
  envelopeView.classList.add('hidden');
  contentView.classList.remove('hidden');
  contentView.scrollIntoView({ behavior: 'smooth', block: 'start' });
  isLoading = false;
}

function updateContent(data) {
  quoteCatBadge.innerText = data.category;
  quoteTranslation.innerText = data.translation;
  quoteOriginal.innerText = `"${data.quote}"`;
  quoteAuthor.innerText = data.author;
  quoteInterpretation.innerText = data.interpretation;
  quoteActions.innerHTML = "";
  data.actions.forEach((action, idx) => {
    const li = document.createElement('li');
    li.className = "flex items-start group";
    li.innerHTML = `<span class="flex-shrink-0 w-8 h-8 rounded-full bg-white text-amber-600 text-xs font-black flex items-center justify-center mr-5 shadow-sm group-hover:scale-110 transition-transform border border-amber-100">${idx + 1}</span><span class="text-slate-600 font-bold leading-relaxed pt-1 text-sm sm:text-base">${action}</span>`;
    quoteActions.appendChild(li);
  });
}

function injectShuffleButton() {
  const container = document.getElementById('shuffle-container');
  if (!container) return;
  
  container.innerHTML = `
    <button id="shuffle-btn" class="group flex items-center space-x-3 px-10 py-5 rounded-[24px] bg-violet-50 border border-violet-100 text-violet-700 hover:bg-violet-100 transition-all duration-500 shadow-xl shadow-violet-100/50 hover:shadow-violet-200/50 hover:-translate-y-1 active:scale-95">
      <div class="bg-violet-200/50 p-1.5 rounded-lg group-hover:rotate-180 transition-transform duration-700">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
      </div>
      <span class="font-black text-sm tracking-widest uppercase">もう一通読む</span>
    </button>
  `;
  document.getElementById('shuffle-btn')?.addEventListener('click', () => fetchQuote(currentCategory));
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
init();
