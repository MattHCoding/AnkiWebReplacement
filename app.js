const sampleCards = [
  {
    id: '1',
    front: 'What is the powerhouse of the cell?',
    back: 'The mitochondrion.',
    deck: 'Biology',
    tags: ['science', 'easy'],
  },
  {
    id: '2',
    front: '2 + 2 = ?',
    back: '4',
    deck: 'Math',
    tags: ['arithmetic'],
  },
  {
    id: '3',
    front: 'Capital of Japan?',
    back: 'Tokyo',
    deck: 'Geography',
    tags: ['capitals'],
  },
  {
    id: '4',
    front: 'Define photosynthesis.',
    back: 'Process by which plants convert light, water, and CO₂ into glucose and oxygen.',
    deck: 'Biology',
    tags: ['science'],
  },
];

const state = {
  cards: [],
  sessionCards: [],
  currentIndex: 0,
  showingAnswer: false,
};

const elements = {
  fileInput: document.querySelector('#file-input'),
  loadStatus: document.querySelector('#load-status'),
  loadSample: document.querySelector('#load-sample'),
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
    front: String(rawCard.front ?? ''),
    back: String(rawCard.back ?? ''),
    deck: String(rawCard.deck ?? 'Default'),
    tags: Array.isArray(rawCard.tags) ? rawCard.tags.map(String) : [],
  };
}

function updateFilterOptions() {
  const decks = [...new Set(state.cards.map((card) => card.deck))].sort();
  const tags = [...new Set(state.cards.flatMap((card) => card.tags))].sort();

  elements.deckFilter.innerHTML = '<option value="">All decks</option>';
  decks.forEach((deck) => {
    elements.deckFilter.insertAdjacentHTML('beforeend', `<option value="${deck}">${deck}</option>`);
  });

  elements.tagFilter.innerHTML = '<option value="">All tags</option>';
  tags.forEach((tag) => {
    elements.tagFilter.insertAdjacentHTML('beforeend', `<option value="${tag}">${tag}</option>`);
  });
}

function loadCards(cards) {
  state.cards = cards.map(normalizeCard).filter((card) => card.front && card.back);
  updateFilterOptions();
  elements.loadStatus.textContent = `Loaded ${state.cards.length} card(s).`;
  elements.sessionStatus.textContent = '';
  resetSession();
}

function shuffle(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function createTemporarySession() {
  if (!state.cards.length) {
    elements.sessionStatus.textContent = 'Import cards first.';
    return;
  }

  const deck = elements.deckFilter.value;
  const tag = elements.tagFilter.value;
  const maxCards = Number.parseInt(elements.maxCards.value, 10);

  let filtered = state.cards.filter((card) => {
    const matchesDeck = !deck || card.deck === deck;
    const matchesTag = !tag || card.tags.includes(tag);
    return matchesDeck && matchesTag;
  });

  if (elements.randomizeToggle.checked) {
    filtered = shuffle(filtered);
  }

  if (Number.isFinite(maxCards) && maxCards > 0) {
    filtered = filtered.slice(0, maxCards);
  }

  state.sessionCards = filtered;
  state.currentIndex = 0;
  state.showingAnswer = false;

  if (!filtered.length) {
    elements.sessionStatus.textContent = 'No cards matched your one-off study filter.';
    elements.reviewPanel.classList.add('hidden');
    return;
  }

  elements.sessionStatus.textContent = `Session created with ${filtered.length} card(s).`;
  renderCard();
  elements.reviewPanel.classList.remove('hidden');
}

function resetSession() {
  state.sessionCards = [];
  state.currentIndex = 0;
  state.showingAnswer = false;
  elements.reviewPanel.classList.add('hidden');
  elements.sessionStatus.textContent = 'Session cleared.';
}

function currentCard() {
  return state.sessionCards[state.currentIndex];
}

function renderCard() {
  const card = currentCard();
  if (!card) {
    elements.reviewPanel.classList.add('hidden');
    elements.sessionStatus.textContent = 'Done! Create another temporary session to continue.';
    return;
  }

  const progress = ((state.currentIndex + 1) / state.sessionCards.length) * 100;
  elements.progressText.textContent = `Card ${state.currentIndex + 1} of ${state.sessionCards.length}`;
  elements.progressBar.value = progress;
  elements.progressBar.max = 100;

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

  if (requeue) {
    state.sessionCards.push(card);
  }

  state.currentIndex += 1;
  state.showingAnswer = false;
  renderCard();
}

elements.fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!Array.isArray(payload)) throw new Error('JSON root must be an array of cards.');
    loadCards(payload);
  } catch (error) {
    elements.loadStatus.textContent = `Failed to import cards: ${error.message}`;
  }
});

elements.loadSample.addEventListener('click', () => loadCards(sampleCards));
elements.createSession.addEventListener('click', createTemporarySession);
elements.resetSession.addEventListener('click', resetSession);
elements.showAnswer.addEventListener('click', () => {
  state.showingAnswer = true;
  renderCard();
});
elements.markAgain.addEventListener('click', () => moveToNextCard(true));
elements.markGood.addEventListener('click', () => moveToNextCard(false));

loadCards(sampleCards);
