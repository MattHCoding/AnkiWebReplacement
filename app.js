const state = {
  cards: [],
  sessionCards: [],
  currentIndex: 0,
  showingAnswer: false,
};

const elements = {
  backendUrl: document.querySelector('#backend-url'),
  checkBackend: document.querySelector('#check-backend'),
  email: document.querySelector('#anki-email'),
  password: document.querySelector('#anki-password'),
  syncDeckFilter: document.querySelector('#sync-deck-filter'),
  syncAnki: document.querySelector('#sync-anki'),
  fileInput: document.querySelector('#file-input'),
  loadStatus: document.querySelector('#load-status'),
  deckFilter: document.querySelector('#deck-filter'),
  tagFilter: document.querySelector('#tag-filter'),
  maxCards: document.querySelector('#max-cards'),
  randomizeToggle: document.querySelector('#randomize-toggle'),
  createSession: document.querySelector('#create-session'),
  resetSession: document.querySelector('#reset-session'),
  sessionStatus: document.querySelector('#session-status'),
  reviewPanel: document.querySelector('#review-panel'),
  progressText: document.querySelector('#progress-text'),
  progressBar: document.querySelector('#progress-bar'),
  cardDeck: document.querySelector('#card-deck'),
  cardTags: document.querySelector('#card-tags'),
  cardFront: document.querySelector('#card-front'),
  cardBack: document.querySelector('#card-back'),
  showAnswer: document.querySelector('#show-answer'),
  markAgain: document.querySelector('#mark-again'),
  markGood: document.querySelector('#mark-good'),
};

function normalizeCard(rawCard) {
  return {
    id: String(rawCard.id ?? crypto.randomUUID()),
    front: String(rawCard.front ?? '').trim(),
    back: String(rawCard.back ?? '').trim(),
    deck: String(rawCard.deck ?? 'Default'),
    tags: Array.isArray(rawCard.tags) ? rawCard.tags.map(String) : [],
  };
}

function updateFilterOptions() {
  const decks = [...new Set(state.cards.map((card) => card.deck))].sort();
  const tags = [...new Set(state.cards.flatMap((card) => card.tags))].sort();

  elements.deckFilter.innerHTML = '<option value="">All decks</option>';
  decks.forEach((deck) => elements.deckFilter.insertAdjacentHTML('beforeend', `<option value="${deck}">${deck}</option>`));

  elements.tagFilter.innerHTML = '<option value="">All tags</option>';
  tags.forEach((tag) => elements.tagFilter.insertAdjacentHTML('beforeend', `<option value="${tag}">${tag}</option>`));
}

function resetSession() {
  state.sessionCards = [];
  state.currentIndex = 0;
  state.showingAnswer = false;
  elements.reviewPanel.classList.add('hidden');
  elements.sessionStatus.textContent = 'Session cleared.';
}

function loadCards(cards) {
  state.cards = cards.map(normalizeCard).filter((card) => card.front && card.back);
  updateFilterOptions();
  elements.loadStatus.textContent = `Loaded ${state.cards.length} card(s).`;
  resetSession();
}

function shuffle(cards) {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function createTemporarySession() {
  if (!state.cards.length) {
    elements.sessionStatus.textContent = 'Sync or import cards first.';
    return;
  }

  const deck = elements.deckFilter.value;
  const tag = elements.tagFilter.value;
  const maxCards = Number.parseInt(elements.maxCards.value, 10);

  let filtered = state.cards.filter((card) => (!deck || card.deck === deck) && (!tag || card.tags.includes(tag)));
  if (elements.randomizeToggle.checked) filtered = shuffle(filtered);
  if (Number.isFinite(maxCards) && maxCards > 0) filtered = filtered.slice(0, maxCards);

  state.sessionCards = filtered;
  state.currentIndex = 0;
  state.showingAnswer = false;

  if (!filtered.length) {
    elements.sessionStatus.textContent = 'No cards matched your one-off study filters.';
    elements.reviewPanel.classList.add('hidden');
    return;
  }

  elements.sessionStatus.textContent = `Session created with ${filtered.length} card(s).`;
  elements.reviewPanel.classList.remove('hidden');
  renderCard();
}

function currentCard() {
  return state.sessionCards[state.currentIndex];
}

function renderCard() {
  const card = currentCard();
  if (!card) {
    elements.reviewPanel.classList.add('hidden');
    elements.sessionStatus.textContent = 'Done! Create another temporary session.';
    return;
  }

  const progress = ((state.currentIndex + 1) / state.sessionCards.length) * 100;
  elements.progressText.textContent = `Card ${state.currentIndex + 1} of ${state.sessionCards.length}`;
  elements.progressBar.value = progress;
  elements.cardDeck.textContent = `Deck: ${card.deck}`;
  elements.cardTags.textContent = `Tags: ${card.tags.join(', ') || 'none'}`;
  elements.cardFront.textContent = card.front;
  elements.cardBack.textContent = card.back;
  elements.cardBack.classList.toggle('hidden', !state.showingAnswer);
  elements.showAnswer.disabled = state.showingAnswer;
}

function moveToNextCard(requeue) {
  const card = currentCard();
  if (!card) return;
  if (requeue) state.sessionCards.push(card);
  state.currentIndex += 1;
  state.showingAnswer = false;
  renderCard();
}

function getBackendBaseUrl() {
  const rawInput = elements.backendUrl.value.trim();
  const candidate = rawInput || window.location.origin;
  try {
    const normalized = new URL(candidate).origin;
    return normalized;
  } catch {
    throw new Error('Backend URL is invalid. Example: http://localhost:4173');
  }
}

function getApiUrl(path) {
  return `${getBackendBaseUrl()}${path}`;
}

async function readJsonResponse(response) {
  const rawBody = await response.text();
  try {
    return JSON.parse(rawBody || '{}');
  } catch {
    const startsLikeHtml = rawBody.trim().startsWith('<');
    if (startsLikeHtml) {
      throw new Error(
        'Received HTML instead of API JSON. Point "Backend URL" to the server running npm start (for example http://localhost:4173).'
      );
    }
    throw new Error('Sync service returned an invalid response.');
  }
}

async function checkBackendHealth() {
  elements.checkBackend.disabled = true;
  try {
    const response = await fetch(getApiUrl('/api/health'));
    const payload = await readJsonResponse(response);
    if (!response.ok) throw new Error(payload.error || 'Backend health check failed.');
    elements.loadStatus.textContent = `Backend reachable at ${payload.baseUrl || getBackendBaseUrl()}.`;
  } catch (error) {
    elements.loadStatus.textContent = `Backend check failed: ${error.message}`;
  } finally {
    elements.checkBackend.disabled = false;
  }
}

async function syncFromAnkiWeb() {
  const email = elements.email.value.trim();
  const password = elements.password.value;
  if (!email || !password) {
    elements.loadStatus.textContent = 'Please provide your AnkiWeb email and password.';
    return;
  }

  elements.syncAnki.disabled = true;
  elements.loadStatus.textContent = 'Sync in progress...';

  try {
    const response = await fetch(getApiUrl('/api/sync'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        deckFilter: elements.syncDeckFilter.value.trim(),
      }),
    });

    const payload = await readJsonResponse(response);
    if (!response.ok) throw new Error(payload.error || 'Sync failed.');
    loadCards(payload.cards);
    elements.loadStatus.textContent = `Synced ${payload.cards.length} cards from AnkiWeb.`;
  } catch (error) {
    elements.loadStatus.textContent = `Sync failed: ${error.message}`;
  } finally {
    elements.syncAnki.disabled = false;
  }
}

elements.fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!Array.isArray(payload)) throw new Error('JSON root must be an array.');
    loadCards(payload);
  } catch (error) {
    elements.loadStatus.textContent = `Import failed: ${error.message}`;
  }
});

elements.backendUrl.value = window.location.origin;
elements.checkBackend.addEventListener('click', checkBackendHealth);
elements.syncAnki.addEventListener('click', syncFromAnkiWeb);
elements.createSession.addEventListener('click', createTemporarySession);
elements.resetSession.addEventListener('click', resetSession);
elements.showAnswer.addEventListener('click', () => {
  state.showingAnswer = true;
  renderCard();
});
elements.markAgain.addEventListener('click', () => moveToNextCard(true));
elements.markGood.addEventListener('click', () => moveToNextCard(false));

checkBackendHealth();
