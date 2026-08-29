// ============================================================
// 🐼 华语乐园 (Chinese for Kids) — Core Application Logic
// ============================================================

const App = (() => {
  // ---- State ----
  let state = {
    currentView: 'levels',
    currentLevel: null,
    currentCardIndex: 0,
    currentWriteIndex: 0,
    currentColor: '#2D3436',
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    quizQuestions: [],
    currentQuizIndex: 0,
    quizScore: 0,
    quizAnswers: [],
    speakQuestions: [],
    currentSpeakIndex: 0,
    speakScore: 0,
    speakAnswers: [],
    progress: {},
    isRecording: false,
    userName: '',
    lastMode: 'quiz',
  };

  let currentAudio = null;
  let recognition = null;
  let canvasCtx = null;

  // Mascot encouraging quotes
  const PANDA_PRAISES = [
    "太棒了！你真聪明！(Awesome! You're so smart!) 🌟",
    "哇！答对啦，真厉害！(Wow! Correct, great job!) 🎉",
    "超级棒！继续加油哦！(Superb! Keep it up!) 💪",
    "好厉害呀！熊猫宝宝为你鼓掌！(Panda is cheering for you!) 👏",
    "满分表现！华语小天才就是你！(You are a Chinese superstar!) 👑"
  ];

  // Mascot writing praises
  const PANDA_WRITE_PRAISES = [
    "字写得真漂亮！一笔一画都很工整！(Beautiful handwriting!) 👏",
    "太棒啦！小小书法家诞生了！(Great job, little calligrapher!) 🎨",
    "真聪明！这个字写得真端正！(Neat and pretty character!) ⭐",
    "哇！写得好棒，熊猫宝宝给你点赞！(Panda Bao Bao gives you thumbs up!) 🐼✨"
  ];

  // ---- Progress & LocalStorage ----
  function loadProgress() {
    try {
      const saved = localStorage.getItem('chineseLearnerProgress');
      if (saved) {
        state.progress = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Could not load progress:', e);
    }

    LEVELS.forEach(level => {
      if (!state.progress[level.id]) {
        state.progress[level.id] = {
          bestScore: 0,
          completed: false,
          unlocked: level.id === 1 // Level 1 is always unlocked
        };
      }
    });

    updateOverallProgress();
  }

  function saveProgress() {
    try {
      localStorage.setItem('chineseLearnerProgress', JSON.stringify(state.progress));
    } catch (e) {
      console.warn('Could not save progress:', e);
    }
    updateOverallProgress();
  }

  function updateOverallProgress() {
    const totalLevels = LEVELS.length;
    const completedLevels = LEVELS.filter(l => state.progress[l.id]?.completed).length;
    const pct = Math.round((completedLevels / totalLevels) * 100);

    const fill = document.getElementById('overall-progress-fill');
    const text = document.getElementById('overall-progress-text');
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.textContent = `学习进度 (Progress): ${pct}% (${completedLevels}/${totalLevels} Levels)`;

    // Calculate total stars
    let totalStars = 0;
    LEVELS.forEach(l => {
      const score = state.progress[l.id]?.bestScore || 0;
      if (score >= 100) totalStars += 3;
      else if (score >= 90) totalStars += 2;
      else if (score >= 80) totalStars += 1;
    });

    const starCountEl = document.getElementById('total-stars-count');
    if (starCountEl) starCountEl.textContent = totalStars;
  }

  function unlockNextLevel(currentLevelId) {
    const nextId = currentLevelId + 1;
    if (nextId <= LEVELS.length && state.progress[nextId]) {
      state.progress[nextId].unlocked = true;
      saveProgress();
    }
  }

  // ---- Dynamic Speech Synthesis (reads custom sentences with child name) ----
  function speakDynamic(text) {
    if (!text || typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.cancel(); } catch(e) {}
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.9;
      utter.pitch = 1.1; // Gentle friendly pitch
      const voices = speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang && (v.lang.startsWith('zh') || v.lang.includes('CN') || v.lang.includes('Mandarin')));
      if (zhVoice) utter.voice = zhVoice;
      speechSynthesis.speak(utter);
    }, 120);
  }

  // ---- User Profile ----
  function loadUserProfile() {
    try {
      const savedName = localStorage.getItem('chineseLearnerUserName');
      if (savedName && savedName.trim()) {
        state.userName = savedName.trim();
        updateUserGreeting();
      } else {
        showProfileModal(true);
      }
    } catch(e) {
      console.warn('Could not load user profile:', e);
    }
  }

  function saveUserProfile(name) {
    const cleanName = (name || '').trim();
    if (!cleanName) return;
    state.userName = cleanName;
    try {
      localStorage.setItem('chineseLearnerUserName', cleanName);
    } catch(e) {}
    updateUserGreeting();
    hideProfileModal();

    // Friendly panda sound & read out child's name in Chinese!
    SoundEffects.playCorrect();
    setTimeout(() => {
      speakDynamic(`你好，${cleanName}！欢迎来到华语乐园！`);
    }, 300);
  }

  function updateUserGreeting() {
    const el = document.getElementById('user-greeting-text');
    const speechEl = document.getElementById('mascot-speech');
    if (el) {
      if (state.userName) {
        el.innerHTML = `👋 你好 (Hello), <strong>${escapeHtml(state.userName)}</strong>!`;
        if (speechEl) {
          speechEl.innerHTML = `<p><strong>${escapeHtml(state.userName)}</strong>，欢迎来到华语乐园！(Welcome to Chinese for Kids!) 🐼✨</p>`;
        }
      } else {
        el.innerHTML = `👋 你好 (Hello), 小朋友 (Student)!`;
      }
    }
  }

  function showProfileModal() {
    const modal = document.getElementById('profile-modal');
    const input = document.getElementById('user-name-input');
    if (modal && input) {
      input.value = state.userName || '';
      modal.classList.remove('hidden');
      setTimeout(() => input.focus(), 150);
    }
  }

  function hideProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.add('hidden');
  }

  // ---- Text-to-Speech (Neural Mandarin Voice) ----
  function speak(text) {
    if (!text) return;
    const cleanText = text.trim();
    console.log('[TTS] Speaking:', cleanText);

    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch(e) {}
    }

    // 1. Play pre-generated Neural AI audio
    if (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST[cleanText]) {
      const audioPath = AUDIO_MANIFEST[cleanText];
      currentAudio = new Audio(audioPath);
      currentAudio.play().catch(err => {
        console.warn('[TTS] Audio playback fallback:', err);
        speakFallback(cleanText);
      });
      return;
    }

    // 2. Fallback
    speakFallback(cleanText);
  }

  function speakFallback(text) {
    if (typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.cancel(); } catch(e) {}
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'zh-CN';
      utter.rate = 0.85;
      const voices = speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang && (v.lang.startsWith('zh') || v.lang.includes('CN')));
      if (zhVoice) utter.voice = zhVoice;
      speechSynthesis.speak(utter);
    }, 150);
  }

  // ---- Speech Recognition (Mandarin) ----
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return false;
    }
    recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = true;
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

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { recognition.stop(); } catch(e) {}
          state.isRecording = false;
          updateMicButton();
          if (interimResult) {
            resolve([interimResult]);
          } else {
            reject('no-speech');
          }
        }
      }, 8000);

      let autoStopTimer = null;
      recognition.lang = 'zh-CN';

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
          if (autoStopTimer) clearTimeout(autoStopTimer);
          autoStopTimer = setTimeout(() => {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              try { recognition.stop(); } catch(e) {}
              state.isRecording = false;
              updateMicButton();
              resolve([interimResult]);
            }
          }, 1600);
        }

        if (finalTranscript && !settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          const results = [];
          if (event.results[0]) {
            for (let i = 0; i < event.results[0].length; i++) {
              results.push(event.results[0][i].transcript.trim());
            }
          }
          if (results.length === 0) results.push(finalTranscript);
          try { recognition.stop(); } catch(e) {}
          resolve(results);
        }
      };

      recognition.onerror = (event) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          reject(event.error);
        }
      };

      recognition.onend = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          if (interimResult) resolve([interimResult]);
          else reject('no-speech');
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
        }, 200);
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

  function updateMicButton() {
    const micBtn = document.getElementById('mic-btn');
    if (!micBtn) return;
    if (state.isRecording) {
      micBtn.classList.add('recording');
      micBtn.innerHTML = '<span class="mic-emoji">🎙️</span><span class="mic-text">正在听... (Listening)</span>';
    } else {
      micBtn.classList.remove('recording');
      micBtn.innerHTML = '<span class="mic-emoji">🎤</span><span class="mic-text">点我说话 (Tap & Speak)</span>';
    }
  }

  function normalizeChinese(text) {
    return text
      .replace(/\s+/g, '')
      .replace(/[，。！？、]/g, '')
      .toLowerCase()
      .trim();
  }

  function chineseMatch(spoken, expectedWord) {
    const expected = expectedWord.hanzi;
    const pinyin = expectedWord.pinyin ? expectedWord.pinyin.replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, (m) => {
      // Normalize tone vowels for fallback
      const map = {
        'ā':'a','á':'a','ǎ':'a','à':'a',
        'ē':'e','é':'e','ě':'e','è':'e',
        'ī':'i','í':'i','ǐ':'i','ì':'i',
        'ō':'o','ó':'o','ǒ':'o','ò':'o',
        'ū':'u','ú':'u','ǔ':'u','ù':'u'
      };
      return map[m] || m;
    }) : '';

    const normSpoken = normalizeChinese(spoken);
    const normExpected = normalizeChinese(expected);
    const normPinyin = normalizeChinese(pinyin);

    // 1. Exact match
    if (normSpoken === normExpected) return true;

    // 2. Contains expected Hanzi
    if (normSpoken.includes(normExpected)) return true;

    // 3. Pinyin match
    if (normPinyin && (normSpoken.includes(normPinyin) || normPinyin.includes(normSpoken))) return true;

    // 4. Number match (e.g. 1 vs 一, 10 vs 十)
    const numberMap = { '一':'1', '二':'2', '三':'3', '四':'4', '五':'5', '六':'6', '七':'7', '八':'8', '九':'9', '十':'10' };
    if (numberMap[normExpected] && normSpoken.includes(numberMap[normExpected])) return true;

    return false;
  }

  // ---- Navigation Views ----
  function showView(viewId) {
    state.currentView = viewId;
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---- View 1: Level Worlds ----
  function renderLevelSelect() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';

    LEVELS.forEach(level => {
      const prog = state.progress[level.id] || { bestScore: 0, completed: false, unlocked: level.id === 1 };
      const card = document.createElement('div');
      card.className = `level-card ${prog.unlocked ? '' : 'locked'}`;
      card.style.setProperty('--level-color', level.color);

      let starsHtml = '☆☆☆';
      if (prog.bestScore >= 100) starsHtml = '⭐⭐⭐';
      else if (prog.bestScore >= 90) starsHtml = '⭐⭐☆';
      else if (prog.bestScore >= 80) starsHtml = '⭐☆☆';

      card.innerHTML = `
        <div class="level-card-header">
          <div class="level-card-icon">${level.icon}</div>
          <div>
            <span class="level-badge-tag">${level.grade}</span>
            <h3 class="level-card-name">${prog.unlocked ? '' : '🔒 '}第 ${level.id} 关: ${level.name}</h3>
          </div>
        </div>
        <p class="level-card-desc">${level.description}</p>
        <div class="level-card-footer">
          <span class="level-words-count">📚 ${level.vocabulary.length} 个词汇 (${level.vocabulary.length} Words)</span>
          <span class="level-stars-display">${starsHtml}</span>
        </div>
      `;

      if (prog.unlocked) {
        card.addEventListener('click', () => {
          SoundEffects.playBubble();
          selectLevel(level);
        });
      }

      grid.appendChild(card);
    });

    showView('levels');
  }

  function selectLevel(level) {
    state.currentLevel = level;
    document.getElementById('mode-level-badge').textContent = `${level.icon} ${level.grade}`;
    document.getElementById('mode-level-title').textContent = level.name;
    document.getElementById('mode-level-desc').textContent = level.description;
    showView('modes');
  }

  // ---- View 3: Learn Flashcards ----
  function startLearnMode() {
    state.lastMode = 'learn';
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
    document.getElementById('learn-category').textContent = word.category || '词汇 Vocabulary';
    document.getElementById('learn-emoji').textContent = word.emoji || '📖';
    document.getElementById('learn-pinyin').textContent = word.pinyin;
    document.getElementById('learn-hanzi').textContent = word.hanzi;
    document.getElementById('learn-english').textContent = word.english;

    // Navigation buttons
    document.getElementById('learn-prev').disabled = idx === 0;
    document.getElementById('learn-next').disabled = idx === total - 1;

    // Progress dots
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

    // Auto-play Mandarin sound
    setTimeout(() => {
      if (state.currentView === 'learn') {
        speak(word.hanzi);
      }
    }, 200);
  }

  function learnNext() {
    if (state.currentCardIndex < state.currentLevel.vocabulary.length - 1) {
      SoundEffects.playBubble();
      state.currentCardIndex++;
      renderLearnCard();
    }
  }

  function learnPrev() {
    if (state.currentCardIndex > 0) {
      SoundEffects.playBubble();
      state.currentCardIndex--;
      renderLearnCard();
    }
  }

  // ---- View 7: Write & Trace Mode ----
  function startWriteMode() {
    state.lastMode = 'write';
    state.currentWriteIndex = 0;
    showView('write');
    setTimeout(() => {
      initWritingCanvas();
      renderWriteCard();
    }, 50);
  }

  function initWritingCanvas() {
    const canvas = document.getElementById('write-canvas');
    if (!canvas) return;
    canvasCtx = canvas.getContext('2d');
    
    // Support HiDPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const size = rect.width || 320;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvasCtx.scale(dpr, dpr);
    
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';
    canvasCtx.lineWidth = 14;
    canvasCtx.strokeStyle = state.currentColor;

    // Mouse handlers
    canvas.onmousedown = (e) => startDraw(e.offsetX, e.offsetY);
    canvas.onmousemove = (e) => {
      if (state.isDrawing) draw(e.offsetX, e.offsetY);
    };
    canvas.onmouseup = () => stopDraw();
    canvas.onmouseleave = () => stopDraw();

    // Touch handlers for tablets/phones
    canvas.ontouchstart = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const box = canvas.getBoundingClientRect();
      startDraw(touch.clientX - box.left, touch.clientY - box.top);
    };
    canvas.ontouchmove = (e) => {
      e.preventDefault();
      if (!state.isDrawing) return;
      const touch = e.touches[0];
      const box = canvas.getBoundingClientRect();
      draw(touch.clientX - box.left, touch.clientY - box.top);
    };
    canvas.ontouchend = (e) => {
      e.preventDefault();
      stopDraw();
    };
  }

  function startDraw(x, y) {
    state.isDrawing = true;
    state.lastX = x;
    state.lastY = y;
    if (canvasCtx) {
      canvasCtx.strokeStyle = state.currentColor;
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, 7, 0, Math.PI * 2);
      canvasCtx.fillStyle = state.currentColor;
      canvasCtx.fill();
    }
  }

  function draw(x, y) {
    if (!state.isDrawing || !canvasCtx) return;
    canvasCtx.strokeStyle = state.currentColor;
    canvasCtx.beginPath();
    canvasCtx.moveTo(state.lastX, state.lastY);
    canvasCtx.lineTo(x, y);
    canvasCtx.stroke();
    state.lastX = x;
    state.lastY = y;
  }

  function stopDraw() {
    state.isDrawing = false;
  }

  function clearCanvas() {
    SoundEffects.playBubble();
    const canvas = document.getElementById('write-canvas');
    if (canvas && canvasCtx) {
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  function toggleGuide() {
    SoundEffects.playBubble();
    const watermark = document.getElementById('write-watermark');
    if (watermark) {
      watermark.classList.toggle('hidden-guide');
    }
  }

  function finishWriting() {
    SoundEffects.playCorrect();
    const word = state.currentLevel.vocabulary[state.currentWriteIndex];
    speakDynamic(`太棒了！${state.userName ? state.userName : '小朋友'}，你写的“${word.hanzi}”真好看！`);
    
    // Auto advance
    setTimeout(() => {
      if (state.currentWriteIndex < state.currentLevel.vocabulary.length - 1) {
        writeNext();
      }
    }, 1800);
  }

  function renderWriteCard() {
    const level = state.currentLevel;
    const word = level.vocabulary[state.currentWriteIndex];
    const total = level.vocabulary.length;
    const idx = state.currentWriteIndex;

    document.getElementById('write-card-counter').textContent = `${idx + 1} / ${total}`;
    document.getElementById('write-emoji').textContent = word.emoji || '✍️';
    document.getElementById('write-pinyin').textContent = word.pinyin;
    document.getElementById('write-english').textContent = word.english;

    const watermark = document.getElementById('write-watermark');
    watermark.textContent = word.hanzi;
    if (word.hanzi.length >= 4) {
      watermark.style.fontSize = '4.5rem';
    } else if (word.hanzi.length >= 2) {
      watermark.style.fontSize = '7.5rem';
    } else {
      watermark.style.fontSize = '13rem';
    }

    clearCanvas();

    document.getElementById('write-prev').disabled = idx === 0;
    document.getElementById('write-next').disabled = idx === total - 1;

    // Dots
    const dotsContainer = document.getElementById('write-dots');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = `dot ${i === idx ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        state.currentWriteIndex = i;
        renderWriteCard();
      });
      dotsContainer.appendChild(dot);
    }

    // Auto-play sound
    setTimeout(() => {
      if (state.currentView === 'write') {
        speak(word.hanzi);
      }
    }, 200);
  }

  function writeNext() {
    if (state.currentWriteIndex < state.currentLevel.vocabulary.length - 1) {
      SoundEffects.playBubble();
      state.currentWriteIndex++;
      renderWriteCard();
    }
  }

  function writePrev() {
    if (state.currentWriteIndex > 0) {
      SoundEffects.playBubble();
      state.currentWriteIndex--;
      renderWriteCard();
    }
  }

  // ---- View 4: Picture Quiz ----
  function startQuizMode() {
    state.lastMode = 'quiz';
    state.quizQuestions = generateQuizQuestions(state.currentLevel);
    state.currentQuizIndex = 0;
    state.quizScore = 0;
    state.quizAnswers = [];
    renderQuizQuestion();
    showView('quiz');
  }

  function generateQuizQuestions(level) {
    const vocab = [...level.vocabulary];
    // Shuffle
    const shuffled = vocab.sort(() => Math.random() - 0.5);
    const count = Math.min(15, shuffled.length);
    const questions = [];

    for (let i = 0; i < count; i++) {
      const target = shuffled[i];
      // Pick 3 random distractors
      const others = vocab.filter(w => w.hanzi !== target.hanzi).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [target, ...others].sort(() => Math.random() - 0.5);

      questions.push({
        word: target,
        options: options
      });
    }

    return questions;
  }

  function renderQuizQuestion() {
    const q = state.quizQuestions[state.currentQuizIndex];
    const total = state.quizQuestions.length;

    document.getElementById('quiz-progress-text').textContent = `第 ${state.currentQuizIndex + 1} 题 / 共 ${total} 题 (Question ${state.currentQuizIndex + 1} of ${total})`;
    document.getElementById('quiz-score-badge').textContent = `⭐ ${state.quizScore}/${state.currentQuizIndex}`;

    // Auto-play question audio
    setTimeout(() => speak(q.word.hanzi), 300);

    const grid = document.getElementById('quiz-options-grid');
    grid.innerHTML = '';

    q.options.forEach(opt => {
      const card = document.createElement('button');
      card.className = 'picture-option-card';
      card.innerHTML = `
        <div class="option-emoji">${opt.emoji || '✨'}</div>
        <div class="option-hanzi">${opt.hanzi}</div>
        <div class="option-pinyin">${opt.pinyin}</div>
        <div class="option-english">${opt.english}</div>
      `;

      card.addEventListener('click', () => handleQuizSelection(opt, q, card, grid));
      grid.appendChild(card);
    });

    document.getElementById('quiz-replay-btn').onclick = () => {
      SoundEffects.playBubble();
      speak(q.word.hanzi);
    };
  }

  function handleQuizSelection(selected, question, clickedCard, container) {
    const isCorrect = selected.hanzi === question.word.hanzi;

    container.querySelectorAll('.picture-option-card').forEach(card => {
      card.disabled = true;
      if (card.querySelector('.option-hanzi').textContent === question.word.hanzi) {
        card.classList.add('correct');
      }
      if (card === clickedCard && !isCorrect) {
        card.classList.add('wrong');
      }
    });

    if (isCorrect) {
      SoundEffects.playCorrect();
      state.quizScore++;
    } else {
      SoundEffects.playTryAgain();
    }

    state.quizAnswers.push({
      word: question.word,
      correct: isCorrect,
      userAnswer: selected.hanzi
    });

    setTimeout(() => {
      state.currentQuizIndex++;
      if (state.currentQuizIndex < state.quizQuestions.length) {
        renderQuizQuestion();
      } else {
        showQuizResults('quiz');
      }
    }, isCorrect ? 900 : 1600);
  }

  // ---- View 5: Speak with Panda ----
  function startSpeakMode() {
    state.lastMode = 'speak';
    if (!recognition) {
      const ok = initSpeechRecognition();
      if (!ok) {
        alert('您的浏览器不支持语音识别功能，推荐使用 Chrome 或 Edge 浏览器！(Please use Chrome or Edge for speech features!)');
        return;
      }
    }
    state.speakQuestions = generateQuizQuestions(state.currentLevel);
    state.currentSpeakIndex = 0;
    state.speakScore = 0;
    state.speakAnswers = [];
    renderSpeakQuestion();
    showView('speak');
  }

  function renderSpeakQuestion() {
    const q = state.speakQuestions[state.currentSpeakIndex];
    const total = state.speakQuestions.length;

    document.getElementById('speak-progress-text').textContent = `第 ${state.currentSpeakIndex + 1} 题 / 共 ${total} 题 (Question ${state.currentSpeakIndex + 1} of ${total})`;
    document.getElementById('speak-score-badge').textContent = `⭐ ${state.speakScore}/${state.currentSpeakIndex}`;

    document.getElementById('speak-target-emoji').textContent = q.word.emoji || '📖';
    document.getElementById('speak-target-english').textContent = q.word.english;

    document.getElementById('speak-hint-pinyin').textContent = q.word.pinyin;
    document.getElementById('speak-hint-hanzi').textContent = q.word.hanzi;
    document.getElementById('speak-hint-box').classList.add('hidden');

    document.getElementById('speak-feedback').classList.add('hidden');
    document.getElementById('speak-retry-btn').classList.add('hidden');
    document.getElementById('speak-next-btn').classList.add('hidden');

    const micBtn = document.getElementById('mic-btn');
    micBtn.disabled = false;
  }

  async function handleMicClick() {
    if (state.isRecording) {
      stopListening();
      return;
    }

    const q = state.speakQuestions[state.currentSpeakIndex];
    const feedbackEl = document.getElementById('speak-feedback');
    const retryBtn = document.getElementById('speak-retry-btn');
    const nextBtn = document.getElementById('speak-next-btn');

    try {
      const results = await startListening();
      let isMatch = false;
      let heard = results[0] || '';

      for (const res of results) {
        if (chineseMatch(res, q.word)) {
          isMatch = true;
          heard = res;
          break;
        }
      }

      feedbackEl.classList.remove('hidden');

      if (isMatch) {
        SoundEffects.playCorrect();
        state.speakScore++;
        const randomPraise = PANDA_PRAISES[Math.floor(Math.random() * PANDA_PRAISES.length)];
        feedbackEl.innerHTML = `
          <div class="feedback-success">
            🎉 <strong>太棒啦！读得很准确！(Accurate pronunciation!)</strong>
            <p>${randomPraise}</p>
            <small>你说的是 (You said): "${heard}"</small>
          </div>
        `;

        state.speakAnswers.push({
          word: q.word,
          correct: true,
          userAnswer: heard
        });

        document.getElementById('mic-btn').disabled = true;

        setTimeout(() => {
          state.currentSpeakIndex++;
          if (state.currentSpeakIndex < state.speakQuestions.length) {
            renderSpeakQuestion();
          } else {
            showQuizResults('speak');
          }
        }, 1500);

      } else {
        SoundEffects.playTryAgain();
        feedbackEl.innerHTML = `
          <div class="feedback-retry">
            🤔 <strong>发音不够准确哦，再试试看！(Not quite right, try again!)</strong>
            <p>你说的是 (You said): "${heard}" | 正确发音 (Correct): <strong>${q.word.hanzi} (${q.word.pinyin})</strong></p>
          </div>
        `;
        retryBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
      }

    } catch (err) {
      feedbackEl.classList.remove('hidden');
      feedbackEl.innerHTML = `<div class="feedback-retry">🎤 没听清，请靠近麦克风大声读出来哦！(Didn't catch that, please speak clearly into mic!)</div>`;
      retryBtn.classList.remove('hidden');
      nextBtn.classList.remove('hidden');
    }
  }

  function speakRetry() {
    SoundEffects.playBubble();
    document.getElementById('speak-feedback').classList.add('hidden');
    document.getElementById('speak-retry-btn').classList.add('hidden');
    document.getElementById('speak-next-btn').classList.add('hidden');
    document.getElementById('mic-btn').disabled = false;
  }

  function speakNext() {
    SoundEffects.playBubble();
    const q = state.speakQuestions[state.currentSpeakIndex];
    state.speakAnswers.push({
      word: q.word,
      correct: false,
      userAnswer: '(跳过)'
    });

    state.currentSpeakIndex++;
    if (state.currentSpeakIndex < state.speakQuestions.length) {
      renderSpeakQuestion();
    } else {
      showQuizResults('speak');
    }
  }

  // ---- View 6: Results Celebration ----
  function showQuizResults(mode) {
    state.lastMode = mode;
    const answers = mode === 'quiz' ? state.quizAnswers : state.speakAnswers;
    const score = mode === 'quiz' ? state.quizScore : state.speakScore;
    const total = answers.length || 1;
    const pct = Math.round((score / total) * 100);
    const passed = pct >= state.currentLevel.requiredScore;

    // Save Progress
    const levelProg = state.progress[state.currentLevel.id];
    if (pct > levelProg.bestScore) {
      levelProg.bestScore = pct;
    }
    if (passed && !levelProg.completed) {
      levelProg.completed = true;
      unlockNextLevel(state.currentLevel.id);
    }
    saveProgress();

    // Render Stats
    document.getElementById('results-pct').textContent = `${pct}%`;
    document.getElementById('results-detail').textContent = `答对 (Correct): ${score} / ${total} 题 (Questions)`;

    // Stars
    const starsRow = document.getElementById('results-stars-row');
    starsRow.innerHTML = '';
    let starsCount = 0;
    if (pct >= 100) starsCount = 3;
    else if (pct >= 90) starsCount = 2;
    else if (pct >= 80) starsCount = 1;

    for (let i = 0; i < 3; i++) {
      const star = document.createElement('span');
      star.className = 'big-star';
      star.textContent = i < starsCount ? '⭐' : '☆';
      star.style.animationDelay = `${i * 0.2}s`;
      starsRow.appendChild(star);
    }

    const titleEl = document.getElementById('results-title');
    const encourageEl = document.getElementById('results-encouragement');
    const nextBtn = document.getElementById('results-next-btn');

    if (passed) {
      SoundEffects.playVictory();
      titleEl.textContent = '🎉 恭喜闯关成功！(Level Passed!)';
      encourageEl.textContent = `${state.userName ? state.userName + '，' : ''}你真是个华语小达人！已解锁下一关！(You're a Chinese superstar! Next level unlocked!) 🚀`;
      
      if (state.currentLevel.id < LEVELS.length) {
        nextBtn.classList.remove('hidden');
        const nextLevel = LEVELS[state.currentLevel.id];
        nextBtn.textContent = `🚀 挑战第 ${state.currentLevel.id + 1} 关 (Challenge Level ${state.currentLevel.id + 1} - ${nextLevel.titleEn || nextLevel.name})`;
        nextBtn.onclick = () => selectLevel(nextLevel);
      } else {
        nextBtn.classList.remove('hidden');
        nextBtn.textContent = `🏆 全部通关！你是超级冠军！(All Levels Completed!)`;
        nextBtn.onclick = () => renderLevelSelect();
      }
    } else {
      SoundEffects.playTryAgain();
      titleEl.textContent = '📚 再接再厉哦！(Keep Trying!)';
      encourageEl.textContent = `需要达到 ${state.currentLevel.requiredScore}% 才能通关，再玩一次肯定能赢！(Need ${state.currentLevel.requiredScore}% to pass, play again to win!) 💪`;
      nextBtn.classList.add('hidden');
    }

    // Mistakes Review
    const mistakesSection = document.getElementById('results-mistakes-section');
    const mistakesList = document.getElementById('results-mistakes-list');
    const mistakes = answers.filter(a => !a.correct);

    if (mistakes.length > 0) {
      mistakesSection.classList.remove('hidden');
      mistakesList.innerHTML = mistakes.map(m => `
        <div class="mistake-item">
          <span class="mistake-emoji">${m.word.emoji || '📖'}</span>
          <span class="mistake-hanzi">${m.word.hanzi}</span>
          <span class="mistake-pinyin">${m.word.pinyin}</span>
          <span class="mistake-english">${m.word.english}</span>
          <button class="mistake-sound-btn" onclick="App.speak('${m.word.hanzi}')">🔊</button>
        </div>
      `).join('');
    } else {
      mistakesSection.classList.add('hidden');
    }

    showView('results');
  }

  function retryCurrentMode() {
    SoundEffects.playBubble();
    if (currentAudio) {
      try { currentAudio.pause(); } catch(e) {}
    }
    stopListening();

    if (state.lastMode === 'speak') {
      startSpeakMode();
    } else if (state.lastMode === 'learn') {
      startLearnMode();
    } else {
      startQuizMode();
    }
  }

  function goToLevels() {
    SoundEffects.playBubble();
    if (currentAudio) {
      try { currentAudio.pause(); } catch(e) {}
    }
    stopListening();
    renderLevelSelect();
  }

  function goToModes() {
    SoundEffects.playBubble();
    if (currentAudio) {
      try { currentAudio.pause(); } catch(e) {}
    }
    stopListening();
    showView('modes');
  }

  function resetProgress() {
    if (confirm('小朋友/家长，确定要重新清空所有学习记录吗？')) {
      localStorage.removeItem('chineseLearnerProgress');
      state.progress = {};
      loadProgress();
      renderLevelSelect();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Initialization ----
  function init() {
    loadProgress();
    loadUserProfile();
    initSpeechRecognition();

    // Event Listeners
    document.getElementById('learn-prev').addEventListener('click', learnPrev);
    document.getElementById('learn-next').addEventListener('click', learnNext);
    document.getElementById('learn-speak-btn').addEventListener('click', () => {
      const word = state.currentLevel.vocabulary[state.currentCardIndex];
      speak(word.hanzi);
    });

    document.getElementById('mode-learn-btn').addEventListener('click', startLearnMode);
    document.getElementById('mode-quiz-btn').addEventListener('click', startQuizMode);
    document.getElementById('mode-speak-btn').addEventListener('click', startSpeakMode);
    document.getElementById('mode-write-btn').addEventListener('click', startWriteMode);

    // Write mode controls
    document.getElementById('write-prev').addEventListener('click', writePrev);
    document.getElementById('write-next').addEventListener('click', writeNext);
    document.getElementById('write-speak-btn').addEventListener('click', () => {
      const word = state.currentLevel.vocabulary[state.currentWriteIndex];
      speak(word.hanzi);
    });
    document.getElementById('write-clear-btn').addEventListener('click', clearCanvas);
    document.getElementById('write-guide-toggle').addEventListener('click', toggleGuide);
    document.getElementById('write-finish-btn').addEventListener('click', finishWriting);

    // Color palette
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.currentColor = btn.getAttribute('data-color');
        SoundEffects.playBubble();
      });
    });

    document.getElementById('mic-btn').addEventListener('click', handleMicClick);
    document.getElementById('speak-retry-btn').addEventListener('click', speakRetry);
    document.getElementById('speak-next-btn').addEventListener('click', speakNext);
    document.getElementById('speak-hint-btn').addEventListener('click', () => {
      document.getElementById('speak-hint-box').classList.toggle('hidden');
    });
    document.getElementById('speak-hint-listen-btn').addEventListener('click', () => {
      const q = state.speakQuestions[state.currentSpeakIndex];
      speak(q.word.hanzi);
    });

    document.getElementById('results-retry-btn').addEventListener('click', retryCurrentMode);
    document.getElementById('results-home-btn').addEventListener('click', goToLevels);
    document.getElementById('reset-progress-btn').addEventListener('click', resetProgress);

    // Profile listeners
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('user-name-input');
        saveUserProfile(input.value);
      });
    }

    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showProfileModal();
      });
    }

    const profileBadge = document.getElementById('user-profile-badge');
    if (profileBadge) {
      profileBadge.addEventListener('click', () => {
        if (state.userName) {
          SoundEffects.playBubble();
          speakDynamic(`你好，${state.userName}！欢迎来到华语乐园！`);
        }
      });
    }

    // Back buttons
    document.querySelectorAll('.back-to-levels').forEach(btn => btn.addEventListener('click', goToLevels));
    document.querySelectorAll('.back-to-modes').forEach(btn => btn.addEventListener('click', goToModes));

    // Keyboard support for flashcards
    document.addEventListener('keydown', (e) => {
      if (state.currentView === 'learn') {
        if (e.key === 'ArrowLeft') learnPrev();
        if (e.key === 'ArrowRight') learnNext();
        if (e.key === ' ') {
          e.preventDefault();
          const word = state.currentLevel.vocabulary[state.currentCardIndex];
          speak(word.hanzi);
        }
      }
    });

    renderLevelSelect();
  }

  return {
    init,
    speak,
    goToLevels,
    goToModes
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
