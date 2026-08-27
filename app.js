// ============================================================
// Thai Language Learning App — Core Logic
// ============================================================

const App = (() => {
  // ---- State ----
  let state = {
    currentView: 'levels',    // 'levels' | 'learn' | 'quiz' | 'speak' | 'results'
    currentLevel: null,        // level object
    currentLevelIndex: 0,
    currentCardIndex: 0,
    quizQuestions: [],
    currentQuizIndex: 0,
    quizScore: 0,
    quizAnswers: [],           // { word, correct, userAnswer }
    speakQuestions: [],
    currentSpeakIndex: 0,
    speakScore: 0,
    speakAnswers: [],
    progress: {},              // { levelId: { bestScore, completed, unlocked } }
    isRecording: false,
  };

  // ---- Progress Persistence ----
  function loadProgress() {
    try {
      const saved = localStorage.getItem('thaiLearnerProgress');
      if (saved) {
        state.progress = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load progress:', e);
    }
    // Ensure level 1 is always unlocked
    if (!state.progress[1]) {
      state.progress[1] = { bestScore: 0, completed: false, unlocked: true };
    }
    // Ensure all levels have entries
    LEVELS.forEach(level => {
      if (!state.progress[level.id]) {
        state.progress[level.id] = { bestScore: 0, completed: false, unlocked: level.id === 1 };
      }
    });
  }

  function saveProgress() {
    try {
      localStorage.setItem('thaiLearnerProgress', JSON.stringify(state.progress));
    } catch (e) {
      console.warn('Could not save progress:', e);
    }
  }

  function unlockNextLevel(currentLevelId) {
    const nextId = currentLevelId + 1;
    if (nextId <= LEVELS.length && state.progress[nextId]) {
      state.progress[nextId].unlocked = true;
      saveProgress();
    }
  }

  function getOverallProgress() {
    const total = LEVELS.length;
    const completed = LEVELS.filter(l => state.progress[l.id]?.completed).length;
    return Math.round((completed / total) * 100);
  }

  // ---- Text-to-Speech (High Fidelity Neural AI Voice) ----
  let currentAudio = null;

  function initTTS() {
    console.log('[TTS] Audio initialized. Pre-generated AI audio clips available:', typeof AUDIO_MANIFEST !== 'undefined' ? Object.keys(AUDIO_MANIFEST).length : 0);
  }

  function speak(text) {
    if (!text) return;
    const cleanText = text.trim();
    console.log('[TTS] speak() called with:', cleanText);

    // Stop previous audio if playing
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch(e) {}
    }

    // Method 1: Instant High-Quality Pre-generated AI Audio (Premwadee Neural)
    if (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST[cleanText]) {
      const audioPath = AUDIO_MANIFEST[cleanText];
      console.log('[TTS] Playing pre-generated AI audio from:', audioPath);
      currentAudio = new Audio(audioPath);
      currentAudio.volume = 1.0;
      currentAudio.play()
        .then(() => console.log('[TTS] Audio playing successfully!'))
        .catch(err => {
          console.warn('[TTS] Manifest audio playback failed, trying fallback:', err);
          speakFallback(cleanText);
        });
      return;
    }

    // Method 2: Fallback
    speakFallback(cleanText);
  }

  function speakFallback(text) {
    // Fallback A: ResponsiveVoice if available
    try {
      if (typeof responsiveVoice !== 'undefined' && responsiveVoice.voiceSupport()) {
        responsiveVoice.cancel();
        responsiveVoice.speak(text, "Thai Female", { rate: 0.9 });
        return;
      }
    } catch(e) {}

    // Fallback B: Web Speech API
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.cancel(); } catch(e) {}
      setTimeout(() => {
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'th-TH';
        utter.rate = 0.85;
        const voices = speechSynthesis.getVoices();
        const thaiVoice = voices.find(v => v.lang && v.lang.startsWith('th'));
        if (thaiVoice) utter.voice = thaiVoice;
        speechSynthesis.speak(utter);
      }, 200);
    }
  }

  // ---- Speech Recognition ----
  let recognition = null;

  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported.');
      return false;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'th';
    recognition.interimResults = true;   // Get results as user speaks
    recognition.maxAlternatives = 10;
    recognition.continuous = false;
    return true;
  }

  function startListening() {
    return new Promise((resolve, reject) => {
      if (!recognition) {
        const ok = initSpeechRecognition();
        if (!ok) { reject('not-supported'); return; }
      }

      let settled = false;
      let interimResult = '';

      // Timeout: if no result in 6 seconds, stop
      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { recognition.stop(); } catch(e) {}
          state.isRecording = false;
          updateMicButton();
          if (interimResult) {
            resolve([interimResult]); // Return whatever we got
          } else {
            reject('no-speech');
          }
        }
      }, 6000);

      // Auto-stop timer: stops 1.2s after last speech detected
      let autoStopTimer = null;

      recognition.lang = 'th';
      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (interimTranscript) {
          interimResult = interimTranscript;
          // Reset auto-stop timer on each new interim result
          if (autoStopTimer) clearTimeout(autoStopTimer);
          autoStopTimer = setTimeout(() => {
            // No new speech for 1.2s — stop and use what we have
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              try { recognition.stop(); } catch(e) {}
              state.isRecording = false;
              updateMicButton();
              resolve([interimResult]);
            }
          }, 1200);
        }

        if (finalTranscript && !settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          // Collect all alternatives
          const results = [];
          if (event.results[0]) {
            for (let i = 0; i < event.results[0].length; i++) {
              results.push(event.results[0][i].transcript.trim());
            }
          }
          if (results.length === 0) results.push(finalTranscript);
          console.log('[Speech] Final results:', results);
          try { recognition.stop(); } catch(e) {}
          resolve(results);
        }
      };

      recognition.onerror = (event) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          console.warn('[Speech] Error:', event.error);
          reject(event.error);
        }
      };

      recognition.onend = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          if (interimResult) {
            resolve([interimResult]);
          } else {
            reject('no-speech');
          }
        }
        state.isRecording = false;
        updateMicButton();
      };

      try {
        state.isRecording = true;
        updateMicButton();
        recognition.start();
      } catch(e) {
        try { recognition.abort(); } catch(e2) {}
        setTimeout(() => {
          try {
            state.isRecording = true;
            updateMicButton();
            recognition.start();
          } catch(e3) {
            settled = true;
            clearTimeout(timeoutId);
            reject('aborted');
          }
        }, 300);
      }
    });
  }

  function stopListening() {
    if (recognition && state.isRecording) {
      try { recognition.stop(); } catch(e) {}
      state.isRecording = false;
      updateMicButton();
    }
  }

  // ---- Quiz Engine ----
  function generateQuizQuestions(level) {
    const vocab = [...level.vocabulary];
    const questions = [];
    const shuffled = shuffleArray([...vocab]);

    shuffled.forEach(word => {
      // Get 3 wrong answers from the same level
      const wrongOptions = vocab
        .filter(w => w.english !== word.english)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.english);

      const options = shuffleArray([word.english, ...wrongOptions]);

      questions.push({
        word: word,
        options: options,
        correctAnswer: word.english,
      });
    });

    return questions;
  }

  function generateSpeakQuestions(level) {
    const vocab = [...level.vocabulary];
    return shuffleArray(vocab).map(word => ({
      word: word,
      expectedThai: word.thai,
    }));
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // ---- Rendering ----
  function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) {
      view.classList.remove('hidden');
      // Trigger re-flow for animation
      void view.offsetWidth;
      view.classList.add('fade-in');
      setTimeout(() => view.classList.remove('fade-in'), 400);
    }
    state.currentView = viewName;
  }

  function renderLevelSelect() {
    const grid = document.getElementById('level-grid');
    const overallBar = document.getElementById('overall-progress-fill');
    const overallText = document.getElementById('overall-progress-text');

    const overallPct = getOverallProgress();
    overallBar.style.width = `${overallPct}%`;
    overallText.textContent = `${overallPct}% Complete`;

    grid.innerHTML = '';
    LEVELS.forEach(level => {
      const prog = state.progress[level.id] || { bestScore: 0, completed: false, unlocked: false };
      const card = document.createElement('div');
      card.className = `level-card ${prog.unlocked ? '' : 'locked'} ${prog.completed ? 'completed' : ''} ${state.currentLevelIndex === level.id - 1 && prog.unlocked && !prog.completed ? 'current' : ''}`;

      const scoreDisplay = prog.bestScore > 0 ? `Best: ${prog.bestScore}%` : '';
      const starsHtml = prog.completed ? getStarsHtml(prog.bestScore) : '';

      card.innerHTML = `
        <div class="level-icon">${level.icon}</div>
        <div class="level-info">
          <h3 class="level-name">${prog.unlocked ? '' : '🔒 '}Level ${level.id}: ${level.name}</h3>
          <p class="level-desc">${level.description}</p>
          <div class="level-meta">
            <span class="level-words">${level.vocabulary.length} words</span>
            ${scoreDisplay ? `<span class="level-score">${scoreDisplay}</span>` : ''}
          </div>
          ${starsHtml}
          <div class="progress-bar-small">
            <div class="progress-bar-fill-small" style="width: ${prog.bestScore}%"></div>
          </div>
        </div>
      `;

      if (prog.unlocked) {
        card.addEventListener('click', () => selectLevel(level));
        card.style.cursor = 'pointer';
      }

      grid.appendChild(card);
    });

    showView('levels');
  }

  function getStarsHtml(score) {
    let stars = 0;
    if (score >= 80) stars = 1;
    if (score >= 90) stars = 2;
    if (score >= 100) stars = 3;
    const filled = '⭐'.repeat(stars);
    const empty = '☆'.repeat(3 - stars);
    return `<div class="stars">${filled}${empty}</div>`;
  }

  function selectLevel(level) {
    state.currentLevel = level;
    state.currentLevelIndex = level.id - 1;
    renderModeSelect();
  }

  function renderModeSelect() {
    const levelTitle = document.getElementById('mode-level-title');
    const levelDesc = document.getElementById('mode-level-desc');
    levelTitle.textContent = `${state.currentLevel.icon} Level ${state.currentLevel.id}: ${state.currentLevel.name}`;
    levelDesc.textContent = state.currentLevel.description;
    showView('modes');
  }

  // ---- Learn Mode ----
  function startLearnMode() {
    state.currentCardIndex = 0;
    renderLearnCard();
    showView('learn');
  }

  function renderLearnCard() {
    const level = state.currentLevel;
    const word = level.vocabulary[state.currentCardIndex];
    const total = level.vocabulary.length;
    const idx = state.currentCardIndex;

    document.getElementById('learn-card-counter').textContent = `${idx + 1} / ${total}`;
    document.getElementById('learn-thai').textContent = word.thai;
    document.getElementById('learn-romanized').textContent = word.romanized;
    document.getElementById('learn-english').textContent = word.english;
    document.getElementById('learn-tone').textContent = word.tone;
    document.getElementById('learn-type').textContent = word.type === 'phrase' ? '📝 Phrase' : '📖 Word';

    // Update nav buttons
    document.getElementById('learn-prev').disabled = idx === 0;
    document.getElementById('learn-next').disabled = idx === total - 1;

    // Update progress dots
    const dotsContainer = document.getElementById('learn-dots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = `dot ${i === idx ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        state.currentCardIndex = i;
        renderLearnCard();
      });
      dotsContainer.appendChild(dot);
    }

    // Auto-play Thai sound on card change
    setTimeout(() => {
      if (state.currentView === 'learn') {
        speak(word.thai);
      }
    }, 200);
  }

  function learnNext() {
    if (state.currentCardIndex < state.currentLevel.vocabulary.length - 1) {
      state.currentCardIndex++;
      renderLearnCard();
    }
  }

  function learnPrev() {
    if (state.currentCardIndex > 0) {
      state.currentCardIndex--;
      renderLearnCard();
    }
  }

  function learnSpeak() {
    const word = state.currentLevel.vocabulary[state.currentCardIndex];
    speak(word.thai);
  }

  // ---- Listen & Translate Quiz ----
  function startQuizMode() {
    state.quizQuestions = generateQuizQuestions(state.currentLevel);
    state.currentQuizIndex = 0;
    state.quizScore = 0;
    state.quizAnswers = [];
    renderQuizQuestion();
    showView('quiz');
  }

  function renderQuizQuestion() {
    const q = state.quizQuestions[state.currentQuizIndex];
    const total = state.quizQuestions.length;

    document.getElementById('quiz-progress-text').textContent = `Question ${state.currentQuizIndex + 1} of ${total}`;
    document.getElementById('quiz-progress-fill').style.width = `${((state.currentQuizIndex) / total) * 100}%`;
    document.getElementById('quiz-score').textContent = `Score: ${state.quizScore}/${state.currentQuizIndex}`;
    document.getElementById('quiz-instruction').textContent = '🎧 Listen and select the correct meaning:';
    document.getElementById('quiz-thai-text').textContent = q.word.thai;
    document.getElementById('quiz-romanized-text').textContent = q.word.romanized;

    // Auto-play the word
    setTimeout(() => speak(q.word.thai), 500);

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    q.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.textContent = option;
      btn.addEventListener('click', () => handleQuizAnswer(option, q, btn, optionsContainer));
      optionsContainer.appendChild(btn);
    });

    // Re-listen button
    document.getElementById('quiz-replay-btn').onclick = () => speak(q.word.thai);
  }

  function handleQuizAnswer(selected, question, clickedBtn, container) {
    const isCorrect = selected === question.correctAnswer;

    // Disable all buttons
    container.querySelectorAll('.answer-btn').forEach(btn => {
      btn.disabled = true;
      if (btn.textContent === question.correctAnswer) {
        btn.classList.add('correct');
      }
      if (btn === clickedBtn && !isCorrect) {
        btn.classList.add('wrong');
      }
    });

    if (isCorrect) {
      state.quizScore++;
    }

    state.quizAnswers.push({
      word: question.word,
      correct: isCorrect,
      userAnswer: selected,
      correctAnswer: question.correctAnswer,
    });

    // Move to next question after delay
    setTimeout(() => {
      state.currentQuizIndex++;
      if (state.currentQuizIndex < state.quizQuestions.length) {
        renderQuizQuestion();
      } else {
        showQuizResults('quiz');
      }
    }, isCorrect ? 800 : 1500);
  }

  // ---- Speak & Match Mode ----
  function startSpeakMode() {
    if (!recognition) {
      const supported = initSpeechRecognition();
      if (!supported) {
        alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
        return;
      }
    }
    state.speakQuestions = generateSpeakQuestions(state.currentLevel);
    state.currentSpeakIndex = 0;
    state.speakScore = 0;
    state.speakAnswers = [];
    renderSpeakQuestion();
    showView('speak');
  }

  function renderSpeakQuestion() {
    const q = state.speakQuestions[state.currentSpeakIndex];
    const total = state.speakQuestions.length;

    document.getElementById('speak-progress-text').textContent = `Word ${state.currentSpeakIndex + 1} of ${total}`;
    document.getElementById('speak-progress-fill').style.width = `${((state.currentSpeakIndex) / total) * 100}%`;
    document.getElementById('speak-score').textContent = `Score: ${state.speakScore}/${state.currentSpeakIndex}`;

    document.getElementById('speak-english').textContent = q.word.english;
    document.getElementById('speak-hint-romanized').textContent = q.word.romanized;
    document.getElementById('speak-hint-thai').textContent = q.word.thai;
    document.getElementById('speak-result').classList.add('hidden');
    document.getElementById('speak-hint').classList.add('hidden');
    document.getElementById('speak-next-btn').classList.add('hidden');
    document.getElementById('speak-next-btn').textContent = 'Next →';
    document.getElementById('speak-retry-btn').classList.add('hidden');

    // Reset mic button
    const micBtn = document.getElementById('mic-btn');
    micBtn.classList.remove('recording', 'success', 'error');
    micBtn.disabled = false;
  }

  function updateMicButton() {
    const micBtn = document.getElementById('mic-btn');
    if (state.isRecording) {
      micBtn.classList.add('recording');
      micBtn.innerHTML = '<span class="mic-icon">🎙️</span><span class="mic-label">Listening...</span>';
    } else {
      micBtn.classList.remove('recording');
      micBtn.innerHTML = '<span class="mic-icon">🎤</span><span class="mic-label">Tap to Speak</span>';
    }
  }

  // Normalize Thai text for comparison
  function normalizeThai(text) {
    return text
      .replace(/\s+/g, '')         // remove spaces
      .replace(/ๆ+/g, '')         // remove repetition marks
      .replace(/\u200B/g, '')      // remove zero-width spaces
      .replace(/ฯ/g, '')          // remove abbreviation marks
      .trim();
  }

  function thaiMatch(spoken, expected) {
    const normSpoken = normalizeThai(spoken);
    const normExpected = normalizeThai(expected);

    // Exact match after normalization
    if (normSpoken === normExpected) return true;

    // Spoken contains the expected word (user repeated it)
    if (normSpoken.includes(normExpected)) return true;

    // Expected contains the spoken word (user said part of it - ok for short words)
    if (normExpected.length <= 4 && normExpected.includes(normSpoken) && normSpoken.length >= 1) return true;

    // Spoken starts with expected
    if (normSpoken.startsWith(normExpected)) return true;

    return false;
  }

  async function handleMicClick() {
    if (state.isRecording) {
      stopListening();
      return;
    }

    const q = state.speakQuestions[state.currentSpeakIndex];
    const resultDiv = document.getElementById('speak-result');

    try {
      const results = await startListening();
      const expected = q.word.thai.trim();
      let isMatch = false;
      let bestMatch = results[0] || '';

      for (const result of results) {
        if (thaiMatch(result, expected)) {
          isMatch = true;
          bestMatch = result;
          break;
        }
      }

      // Show result
      resultDiv.classList.remove('hidden');
      const micBtn = document.getElementById('mic-btn');

      if (isMatch) {
        state.speakScore++;
        micBtn.classList.add('success');
        micBtn.disabled = true;
        resultDiv.innerHTML = `
          <div class="speak-result-match">
            <span class="result-icon">✅</span>
            <div class="result-text">
              <strong>Correct! 🎉</strong>
              <p>You said: "${bestMatch}"</p>
            </div>
          </div>`;

        state.speakAnswers.push({
          word: q.word,
          correct: true,
          userAnswer: bestMatch,
        });

        // Auto-advance after correct answer
        document.getElementById('speak-next-btn').classList.remove('hidden');
        document.getElementById('speak-retry-btn').classList.add('hidden');

      } else {
        micBtn.classList.add('error');
        resultDiv.innerHTML = `
          <div class="speak-result-no-match">
            <span class="result-icon">❌</span>
            <div class="result-text">
              <strong>Not quite right</strong>
              <p>You said: "${bestMatch}"</p>
              <p>Expected: "${expected}" (${q.word.romanized})</p>
            </div>
          </div>`;

        // Show BOTH retry and skip buttons
        document.getElementById('speak-retry-btn').classList.remove('hidden');
        document.getElementById('speak-next-btn').classList.remove('hidden');
        document.getElementById('speak-next-btn').textContent = 'Skip →';
      }

    } catch (error) {
      resultDiv.classList.remove('hidden');
      if (error === 'no-speech') {
        resultDiv.innerHTML = `
          <div class="speak-result-no-match">
            <span class="result-icon">🔇</span>
            <div class="result-text">
              <strong>No speech detected</strong>
              <p>Tap the mic and speak clearly into your microphone.</p>
            </div>
          </div>`;
        // Allow retry on no speech
        document.getElementById('speak-retry-btn').classList.remove('hidden');
      } else if (error === 'not-allowed') {
        resultDiv.innerHTML = `
          <div class="speak-result-no-match">
            <span class="result-icon">🚫</span>
            <div class="result-text">
              <strong>Microphone access denied</strong>
              <p>Please allow microphone access in your browser settings and reload.</p>
            </div>
          </div>`;
      } else {
        resultDiv.innerHTML = `
          <div class="speak-result-no-match">
            <span class="result-icon">⚠️</span>
            <div class="result-text">
              <strong>Error: ${error}</strong>
              <p>Tap the mic to try again.</p>
            </div>
          </div>`;
        document.getElementById('speak-retry-btn').classList.remove('hidden');
      }
    }
  }

  function speakRetry() {
    // Reset for retry — don't count as wrong yet
    const resultDiv = document.getElementById('speak-result');
    resultDiv.classList.add('hidden');
    document.getElementById('speak-retry-btn').classList.add('hidden');
    document.getElementById('speak-next-btn').classList.add('hidden');

    const micBtn = document.getElementById('mic-btn');
    micBtn.classList.remove('recording', 'success', 'error');
    micBtn.disabled = false;
    micBtn.innerHTML = '<span class="mic-icon">🎤</span><span class="mic-label">Tap to Speak</span>';
  }

  function speakNext() {
    // If user is skipping (didn't get it right), record as wrong
    const q = state.speakQuestions[state.currentSpeakIndex];
    const alreadyAnswered = state.speakAnswers.some(a => a.word.thai === q.word.thai);
    if (!alreadyAnswered) {
      state.speakAnswers.push({
        word: q.word,
        correct: false,
        userAnswer: '(skipped)',
      });
    }
    // Reset Next button text
    document.getElementById('speak-next-btn').textContent = 'Next →';

    state.currentSpeakIndex++;
    if (state.currentSpeakIndex < state.speakQuestions.length) {
      renderSpeakQuestion();
    } else {
      showQuizResults('speak');
    }
  }

  function toggleSpeakHint() {
    const hint = document.getElementById('speak-hint');
    hint.classList.toggle('hidden');
  }

  function speakHintAudio() {
    const q = state.speakQuestions[state.currentSpeakIndex];
    speak(q.word.thai);
  }

  // ---- Results ----
  function showQuizResults(mode) {
    const answers = mode === 'quiz' ? state.quizAnswers : state.speakAnswers;
    const score = mode === 'quiz' ? state.quizScore : state.speakScore;
    const total = answers.length;
    const pct = Math.round((score / total) * 100);
    const passed = pct >= state.currentLevel.requiredScore;

    // Update progress
    const levelProg = state.progress[state.currentLevel.id];
    if (pct > levelProg.bestScore) {
      levelProg.bestScore = pct;
    }
    if (passed && !levelProg.completed) {
      levelProg.completed = true;
      unlockNextLevel(state.currentLevel.id);
    }
    saveProgress();

    // Render results
    document.getElementById('results-score-number').textContent = `${pct}%`;
    document.getElementById('results-score-detail').textContent = `${score} out of ${total} correct`;
    document.getElementById('results-score-circle').className = `score-circle ${passed ? 'passed' : 'failed'}`;

    const messageEl = document.getElementById('results-message');
    if (passed) {
      if (pct === 100) {
        messageEl.innerHTML = '🎉 Perfect Score! Amazing!';
      } else if (pct >= 90) {
        messageEl.innerHTML = '🌟 Excellent! Great mastery!';
      } else {
        messageEl.innerHTML = '✅ Level Passed! Well done!';
      }
    } else {
      messageEl.innerHTML = `📚 Keep practicing! Need ${state.currentLevel.requiredScore}% to pass.`;
    }

    // Stars
    document.getElementById('results-stars').innerHTML = getStarsHtml(pct);

    // Next level / retry buttons
    const nextBtn = document.getElementById('results-next-btn');
    if (passed && state.currentLevel.id < LEVELS.length) {
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = `Next: Level ${state.currentLevel.id + 1} →`;
      nextBtn.onclick = () => {
        selectLevel(LEVELS[state.currentLevel.id]);
      };
    } else if (passed && state.currentLevel.id === LEVELS.length) {
      nextBtn.classList.remove('hidden');
      nextBtn.textContent = '🏆 All Levels Complete!';
      nextBtn.disabled = true;
    } else {
      nextBtn.classList.add('hidden');
    }

    // Mistakes summary
    const mistakesList = document.getElementById('results-mistakes');
    const mistakes = answers.filter(a => !a.correct);
    if (mistakes.length > 0) {
      document.getElementById('results-mistakes-section').classList.remove('hidden');
      mistakesList.innerHTML = mistakes.map(m => `
        <div class="mistake-item">
          <span class="mistake-thai">${m.word.thai}</span>
          <span class="mistake-romanized">(${m.word.romanized})</span>
          <span class="mistake-arrow">→</span>
          <span class="mistake-english">${m.word.english}</span>
          <button class="mistake-listen-btn" onclick="App.speak('${m.word.thai.replace(/'/g, "\\'")}')">🔊</button>
        </div>
      `).join('');
    } else {
      document.getElementById('results-mistakes-section').classList.add('hidden');
    }

    showView('results');
  }

  // ---- Navigation ----
  function goToLevels() {
    speechSynthesis.cancel();
    stopListening();
    renderLevelSelect();
  }

  function goToModes() {
    speechSynthesis.cancel();
    stopListening();
    renderModeSelect();
  }

  // ---- Reset Progress ----
  function resetProgress() {
    if (confirm('Are you sure you want to reset ALL progress? This cannot be undone.')) {
      localStorage.removeItem('thaiLearnerProgress');
      state.progress = {};
      loadProgress();
      renderLevelSelect();
    }
  }

  // ---- Initialization ----
  function init() {
    loadProgress();
    initTTS();
    initSpeechRecognition();

    // Event listeners
    document.getElementById('learn-prev').addEventListener('click', learnPrev);
    document.getElementById('learn-next').addEventListener('click', learnNext);
    document.getElementById('learn-speak-btn').addEventListener('click', learnSpeak);

    document.getElementById('mic-btn').addEventListener('click', handleMicClick);
    document.getElementById('speak-next-btn').addEventListener('click', speakNext);
    document.getElementById('speak-retry-btn').addEventListener('click', speakRetry);
    document.getElementById('speak-hint-btn').addEventListener('click', toggleSpeakHint);
    document.getElementById('speak-hint-listen-btn').addEventListener('click', speakHintAudio);

    document.getElementById('mode-learn-btn').addEventListener('click', startLearnMode);
    document.getElementById('mode-quiz-btn').addEventListener('click', startQuizMode);
    document.getElementById('mode-speak-btn').addEventListener('click', startSpeakMode);

    document.getElementById('results-retry-btn').addEventListener('click', goToModes);
    document.getElementById('results-home-btn').addEventListener('click', goToLevels);
    document.getElementById('reset-progress-btn').addEventListener('click', resetProgress);

    // Back buttons
    document.querySelectorAll('.back-to-levels').forEach(btn =>
      btn.addEventListener('click', goToLevels)
    );
    document.querySelectorAll('.back-to-modes').forEach(btn =>
      btn.addEventListener('click', goToModes)
    );

    // Keyboard navigation for learn mode
    document.addEventListener('keydown', (e) => {
      if (state.currentView === 'learn') {
        if (e.key === 'ArrowLeft') learnPrev();
        if (e.key === 'ArrowRight') learnNext();
        if (e.key === ' ') { e.preventDefault(); learnSpeak(); }
      }
    });

    renderLevelSelect();
  }

  // Public API
  return {
    init,
    speak,
    goToLevels,
    goToModes,
  };
})();

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
