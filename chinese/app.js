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
    activeQuadIndex: 1,
    activeDrawingBox: 1,
    quadCompleted: { 1: false, 2: false, 3: false, 4: false },
    currentCharIndex: 0,
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
    profileId: '',
    userName: '',
    userAvatar: '👧',
    lastMode: 'quiz',
  };

  let currentAudio = null;
  let recognition = null;
  let quadCanvases = [null, null, null, null];
  let quadContexts = [null, null, null, null];

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

  // ---- Multi-Child Profiles & Progress (基于唯一ID的多学生独立档案系统) ----
  function getProfilesDirectory() {
    try {
      const raw = localStorage.getItem('chineseLearnerProfiles');
      let profiles = raw ? JSON.parse(raw) : {};

      // Migrate legacy string-keyed profiles if any
      let needsMigration = false;
      const migrated = {};
      Object.keys(profiles).forEach((key, idx) => {
        const p = profiles[key];
        if (p && typeof p === 'object') {
          const id = p.id || ('kid_' + (idx + 1) + '_' + Date.now());
          if (!p.id) {
            p.id = id;
            needsMigration = true;
          }
          migrated[id] = p;
        }
      });

      if (needsMigration) {
        saveProfilesDirectory(migrated);
        return migrated;
      }
      return profiles;
    } catch(e) {
      return {};
    }
  }

  function saveProfilesDirectory(dir) {
    try {
      localStorage.setItem('chineseLearnerProfiles', JSON.stringify(dir));
    } catch(e) {}
  }

  function loadProgress() {
    if (state.profileId) {
      const profiles = getProfilesDirectory();
      if (profiles[state.profileId] && profiles[state.profileId].progress) {
        state.progress = profiles[state.profileId].progress;
      } else {
        state.progress = {};
      }
    } else {
      try {
        const saved = localStorage.getItem('chineseLearnerProgress');
        if (saved) state.progress = JSON.parse(saved);
      } catch (e) {}
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
    if (state.profileId) {
      const profiles = getProfilesDirectory();
      if (profiles[state.profileId]) {
        profiles[state.profileId].progress = state.progress;
        profiles[state.profileId].lastActive = Date.now();
        saveProfilesDirectory(profiles);
      }
    }
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

  // Voice Selectors (Ensures pleasant, friendly female/girl voice)
  function getFemaleEnglishVoice(voices) {
    if (!voices || voices.length === 0) return null;

    // 1. Preferred Female Voice Names (Edge / Chrome / Windows / Mac / iOS)
    const preferredFemaleNames = [
      'jenny', 'aria', 'zira', 'samantha', 'victoria', 'karen',
      'google us english', 'female', 'natural (female)', 'eva', 'ana', 'sonia', 'libby'
    ];

    for (const name of preferredFemaleNames) {
      const match = voices.find(v => {
        const vName = (v.name || '').toLowerCase();
        const vLang = (v.lang || '').toLowerCase();
        return vLang.startsWith('en') && vName.includes(name);
      });
      if (match) return match;
    }

    // 2. Filter out male voices ('david', 'george', 'mark', 'guy', 'male', 'richard')
    const maleNames = ['david', 'george', 'mark', 'guy', 'male', 'richard', 'james', 'alex'];
    const nonMaleEn = voices.find(v => {
      const vName = (v.name || '').toLowerCase();
      const vLang = (v.lang || '').toLowerCase();
      const isMale = maleNames.some(m => vName.includes(m));
      return vLang.startsWith('en') && !isMale;
    });

    if (nonMaleEn) return nonMaleEn;

    // 3. Fallback to any English voice
    return voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || null;
  }

  function getFemaleChineseVoice(voices) {
    if (!voices || voices.length === 0) return null;
    const preferredFemaleNames = ['xiaoxiao', 'huihui', 'yaoyao', 'google 普通话', 'tingting', 'meijia', 'female'];
    for (const name of preferredFemaleNames) {
      const match = voices.find(v => {
        const vName = (v.name || '').toLowerCase();
        const vLang = (v.lang || '').toLowerCase();
        return (vLang.startsWith('zh') || vLang.includes('cn')) && vName.includes(name);
      });
      if (match) return match;
    }

    const maleNames = ['kangkang', 'yunxi', 'yunyang', 'male'];
    const nonMaleZh = voices.find(v => {
      const vName = (v.name || '').toLowerCase();
      const vLang = (v.lang || '').toLowerCase();
      const isMale = maleNames.some(m => vName.includes(m));
      return (vLang.startsWith('zh') || vLang.includes('cn')) && !isMale;
    });

    return nonMaleZh || voices.find(v => (v.lang || '').toLowerCase().startsWith('zh')) || null;
  }

  // ---- Dynamic Bilingual Speech Synthesis (reads Chinese + English translation) ----
  function speakBilingual(chineseText, englishText) {
    if (typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.cancel(); } catch(e) {}

    setTimeout(() => {
      const voices = speechSynthesis.getVoices();

      // 1. Chinese Speech (Female / Teacher voice)
      if (chineseText) {
        const utterZh = new SpeechSynthesisUtterance(chineseText);
        utterZh.lang = 'zh-CN';
        utterZh.rate = 0.88;
        utterZh.pitch = 1.1;
        const zhVoice = getFemaleChineseVoice(voices);
        if (zhVoice) utterZh.voice = zhVoice;

        if (englishText) {
          utterZh.onend = () => {
            setTimeout(() => {
              const utterEn = new SpeechSynthesisUtterance(englishText);
              utterEn.lang = 'en-US';
              utterEn.rate = 0.9;
              utterEn.pitch = 1.2; // Cheerful girl pitch
              const enVoice = getFemaleEnglishVoice(voices);
              if (enVoice) utterEn.voice = enVoice;
              speechSynthesis.speak(utterEn);
            }, 250);
          };
        }

        speechSynthesis.speak(utterZh);
      } else if (englishText) {
        const utterEn = new SpeechSynthesisUtterance(englishText);
        utterEn.lang = 'en-US';
        utterEn.rate = 0.9;
        utterEn.pitch = 1.2; // Cheerful girl pitch
        const enVoice = getFemaleEnglishVoice(voices);
        if (enVoice) utterEn.voice = enVoice;
        speechSynthesis.speak(utterEn);
      }
    }, 120);
  }

  function speakDynamic(text) {
    speakBilingual(text, null);
  }

  // ---- User Profile (基于唯一ID的多学生独立档案系统) ----
  function loadUserProfile() {
    try {
      const profiles = getProfilesDirectory();
      let activeId = localStorage.getItem('chineseLearnerActiveProfileId');

      // Fallback: Check legacy username
      if (!activeId || !profiles[activeId]) {
        const legacyName = localStorage.getItem('chineseLearnerUserName');
        if (legacyName) {
          const matchId = Object.keys(profiles).find(k => profiles[k].name === legacyName);
          if (matchId) {
            activeId = matchId;
          } else if (legacyName.trim()) {
            activeId = 'kid_' + Date.now();
            let legacyProg = {};
            try {
              const savedProg = localStorage.getItem('chineseLearnerProgress');
              if (savedProg) legacyProg = JSON.parse(savedProg);
            } catch(e) {}
            profiles[activeId] = {
              id: activeId,
              name: legacyName.trim(),
              avatar: localStorage.getItem('chineseLearnerUserAvatar') || '👧',
              progress: legacyProg,
              createdAt: Date.now(),
              lastActive: Date.now()
            };
            saveProfilesDirectory(profiles);
          }
        }
      }

      if (activeId && profiles[activeId]) {
        const p = profiles[activeId];
        state.profileId = p.id;
        state.userName = p.name || '小朋友';
        state.userAvatar = p.avatar || '👧';
        state.progress = p.progress || {};

        LEVELS.forEach(level => {
          if (!state.progress[level.id]) {
            state.progress[level.id] = {
              bestScore: 0,
              completed: false,
              unlocked: level.id === 1
            };
          }
        });

        p.lastActive = Date.now();
        saveProfilesDirectory(profiles);
        localStorage.setItem('chineseLearnerActiveProfileId', activeId);
        localStorage.setItem('chineseLearnerUserName', state.userName);
        localStorage.setItem('chineseLearnerUserAvatar', state.userAvatar);

        updateUserGreeting();
        updateOverallProgress();
        renderLevelSelect();
      } else {
        const pKeys = Object.keys(profiles);
        if (pKeys.length > 0) {
          switchProfile(pKeys[0]);
        } else {
          showProfileModal('edit');
        }
      }
    } catch(e) {
      console.warn('Could not load user profile:', e);
    }
  }

  function saveUserProfile(profileId, name, avatar) {
    const cleanName = (name || '').trim();
    if (!cleanName) return;

    const chosenAvatar = avatar || state.userAvatar || '👧';
    const profiles = getProfilesDirectory();
    const isNew = !profileId || !profiles[profileId];
    const targetId = isNew ? ('kid_' + Date.now()) : profileId;

    let targetProgress = {};
    if (!isNew && profiles[targetId] && profiles[targetId].progress) {
      // PRESERVE ALL PROGRESS & STARS WHEN CHANGING AVATAR OR NAME!
      targetProgress = profiles[targetId].progress;
    } else {
      LEVELS.forEach(level => {
        targetProgress[level.id] = {
          bestScore: 0,
          completed: false,
          unlocked: level.id === 1
        };
      });
    }

    state.profileId = targetId;
    state.userName = cleanName;
    state.userAvatar = chosenAvatar;
    state.progress = targetProgress;

    profiles[targetId] = {
      id: targetId,
      name: cleanName,
      avatar: chosenAvatar,
      progress: targetProgress,
      createdAt: (!isNew && profiles[targetId].createdAt) ? profiles[targetId].createdAt : Date.now(),
      lastActive: Date.now()
    };

    saveProfilesDirectory(profiles);
    localStorage.setItem('chineseLearnerActiveProfileId', targetId);
    localStorage.setItem('chineseLearnerUserName', cleanName);
    localStorage.setItem('chineseLearnerUserAvatar', chosenAvatar);
    localStorage.setItem('chineseLearnerProgress', JSON.stringify(targetProgress));

    updateUserGreeting();
    updateOverallProgress();
    renderLevelSelect();
    hideProfileModal();

    // Friendly panda sound & read out bilingual welcome in Chinese + English!
    SoundEffects.playCorrect();
    setTimeout(() => {
      speakBilingual(
        `你好，${cleanName}！欢迎来到华语乐园！`,
        `Hello ${cleanName}! Welcome to Chinese for Kids!`
      );
    }, 300);
  }

  function switchProfile(profileId) {
    SoundEffects.playBubble();
    const profiles = getProfilesDirectory();
    const p = profiles[profileId];
    if (p) {
      state.profileId = p.id;
      state.userName = p.name;
      state.userAvatar = p.avatar || '👧';
      state.progress = p.progress || {};

      LEVELS.forEach(level => {
        if (!state.progress[level.id]) {
          state.progress[level.id] = {
            bestScore: 0,
            completed: false,
            unlocked: level.id === 1
          };
        }
      });

      p.lastActive = Date.now();
      saveProfilesDirectory(profiles);
      localStorage.setItem('chineseLearnerActiveProfileId', p.id);
      localStorage.setItem('chineseLearnerUserName', p.name);
      localStorage.setItem('chineseLearnerUserAvatar', state.userAvatar);
      localStorage.setItem('chineseLearnerProgress', JSON.stringify(state.progress));

      updateUserGreeting();
      updateOverallProgress();
      renderLevelSelect();
      hideProfileModal();

      SoundEffects.playPop();
      setTimeout(() => {
        speakBilingual(
          `切换到 ${p.name} 的学习档案！`,
          `Switched to ${p.name}'s profile!`
        );
      }, 250);
    }
  }

  function deleteProfile(profileId, e) {
    if (e) e.stopPropagation();
    const profiles = getProfilesDirectory();
    const p = profiles[profileId];
    if (!p) return;

    if (confirm(`确定要删除学生 ${p.name} 的档案和学习记录吗？(Delete ${p.name}'s profile?)`)) {
      SoundEffects.playBubble();
      delete profiles[profileId];
      saveProfilesDirectory(profiles);

      const remainingIds = Object.keys(profiles);
      if (remainingIds.length > 0) {
        switchProfile(remainingIds[0]);
      } else {
        state.profileId = '';
        state.userName = '';
        state.progress = {};
        showProfileModal('edit');
      }
    }
  }

  function updateUserGreeting() {
    const el = document.getElementById('user-greeting-text');
    const avatarEl = document.getElementById('user-avatar-display');
    const speechEl = document.getElementById('mascot-speech');
    if (avatarEl) {
      avatarEl.textContent = state.userAvatar || '👧';
    }
    if (el) {
      if (state.userName) {
        el.innerHTML = `👋 你好 (Hello), <strong>${escapeHtml(state.userName)}</strong>!`;
        if (speechEl) {
          speechEl.innerHTML = `<p><strong>${escapeHtml(state.userName)}</strong>, 欢迎来到华语乐园！(Welcome to Chinese for Kids!) 🐼✨</p>`;
        }
      } else {
        el.innerHTML = `👋 你好 (Hello), 小朋友 (Student)!`;
      }
    }
  }

  function showProfileModal(viewMode) {
    const modal = document.getElementById('profile-modal');
    const listSection = document.getElementById('profiles-list-section');
    const formSection = document.getElementById('profile-form-section');
    const formTitle = document.getElementById('profile-form-title');
    const idInput = document.getElementById('profile-id-input');
    const nameInput = document.getElementById('user-name-input');
    const grid = document.getElementById('profiles-list-grid');

    if (!modal) return;

    const profiles = getProfilesDirectory();
    const profileIds = Object.keys(profiles);
    const deleteFormBtn = document.getElementById('btn-delete-profile-form');

    // If viewMode is 'edit', open edit form directly
    if (viewMode === 'edit' || profileIds.length === 0) {
      if (listSection) listSection.style.display = 'none';
      if (formSection) formSection.classList.add('active');

      if (idInput) idInput.value = state.profileId || '';
      if (nameInput) nameInput.value = state.userName || '';
      if (formTitle) {
        formTitle.textContent = state.profileId ? `✏️ 编辑 ${state.userName} 的档案 (Edit Profile)` : '➕ 添加新学生档案 (Add New Kid)';
      }

      if (deleteFormBtn) {
        if (state.profileId && profiles[state.profileId]) {
          deleteFormBtn.classList.remove('hidden');
        } else {
          deleteFormBtn.classList.add('hidden');
        }
      }

      // Highlight current avatar
      document.querySelectorAll('.avatar-choice-btn').forEach(btn => {
        if (btn.getAttribute('data-avatar') === (state.userAvatar || '👧')) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
      setTimeout(() => nameInput && nameInput.focus(), 150);
    } else {
      // Show list of profiles
      if (formSection) formSection.classList.remove('active');
      if (listSection) listSection.style.display = 'block';

      if (grid) {
        grid.innerHTML = profileIds.map(id => {
          const p = profiles[id];
          let stars = 0;
          if (p.progress) {
            LEVELS.forEach(l => {
              const sc = p.progress[l.id]?.bestScore || 0;
              if (sc >= 100) stars += 3;
              else if (sc >= 90) stars += 2;
              else if (sc >= 80) stars += 1;
            });
          }
          const isActive = id === state.profileId;
          return `
            <div class="profile-kid-card ${isActive ? 'active' : ''}" data-profile-id="${p.id}">
              <div class="profile-kid-info">
                <span class="profile-kid-avatar">${p.avatar || '👧'}</span>
                <div>
                  <div style="display:flex; align-items:center;">
                    <span class="profile-kid-name">${escapeHtml(p.name)}</span>
                    ${isActive ? '<span class="profile-kid-badge">在学 Active</span>' : ''}
                  </div>
                  <span class="profile-kid-stars">⭐ ${stars} 颗星 (Stars)</span>
                </div>
              </div>
              <div class="profile-kid-actions">
                <button type="button" class="btn-card-edit" data-edit-id="${p.id}" title="修改形象与名字 (Edit Name/Avatar)">✏️</button>
                <button type="button" class="btn-card-delete" data-delete-id="${p.id}" title="删除此档案 (Delete Profile)">🗑️</button>
              </div>
            </div>
          `;
        }).join('');

        // Wire click handlers for cards & buttons
        grid.querySelectorAll('.profile-kid-card').forEach(card => {
          card.addEventListener('click', () => {
            const pId = card.getAttribute('data-profile-id');
            if (pId) switchProfile(pId);
          });
        });

        grid.querySelectorAll('.btn-card-edit').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const editId = btn.getAttribute('data-edit-id');
            const targetP = profiles[editId];
            if (targetP) {
              if (listSection) listSection.style.display = 'none';
              if (formSection) formSection.classList.add('active');
              if (idInput) idInput.value = targetP.id;
              if (nameInput) nameInput.value = targetP.name;
              if (formTitle) formTitle.textContent = `✏️ 编辑 ${targetP.name} 的形象与名字`;
              if (deleteFormBtn) deleteFormBtn.classList.remove('hidden');
              state.userAvatar = targetP.avatar || '👧';
              document.querySelectorAll('.avatar-choice-btn').forEach(b => {
                if (b.getAttribute('data-avatar') === state.userAvatar) b.classList.add('active');
                else b.classList.remove('active');
              });
              setTimeout(() => nameInput && nameInput.focus(), 150);
            }
          });
        });

        grid.querySelectorAll('.btn-card-delete').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const delId = btn.getAttribute('data-delete-id');
            deleteProfile(delId, e);
          });
        });
      }
    }

    modal.classList.remove('hidden');
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

  // Comprehensive Single-Word Homophone & Phonetic Map for Kids
  const CHINESE_HOMOPHONES = {
    '少': ['少', '烧', '稍', '勺', '绍', '哨', '稍后', '多少', '减少', 'shao', 'show', 'shall'],
    '多': ['多', '朵', '躲', '夺', '堕', '多久', '多少', 'duo', 'door'],
    '大': ['大', '达', '打', '搭', '答', '哒', '大人', '大家', 'da', 'big'],
    '小': ['小', '消', '销', '笑', '效', '校', '晓', '小孩', 'xiao', 'small'],
    '高': ['高', '搞', '告', '稿', '膏', '糕', '个子高', 'gao', 'tall'],
    '矮': ['矮', '哎', '爱', '哀', '埃', '挨', '矮小', 'ai', 'eye', 'short'],
    '快': ['快', '块', '筷', '会', '快速', 'kuai', 'fast'],
    '慢': ['慢', '满', '曼', '漫', '慢慢', 'man', 'slow'],
    '冷': ['冷', '愣', 'leng', 'cold'],
    '热': ['热', '惹', 're', 'hot'],
    '晴': ['晴', '情', '请', '清', 'qing', 'sunny'],
    '雨': ['雨', '语', '与', '羽', '下雨', 'yu', 'rain'],
    '风': ['风', '封', '丰', '刮风', 'feng', 'wind'],
    '雪': ['雪', '学', '血', '下雪', 'xue', 'snow'],
    '跑': ['跑', '泡', '跑步', 'pao', 'run'],
    '跳': ['跳', '条', '跳绳', 'tiao', 'jump'],
    '游': ['游', '由', '游泳', 'you', 'swim'],
    '书': ['书', '树', '叔', '看书', 'shu', 'book'],
    '笔': ['笔', '比', '币', '铅笔', 'bi', 'pen'],
    '本': ['本', '笨', '课本', 'ben', 'book'],
    '尺': ['尺', '吃', '齿', '尺子', 'chi', 'ruler'],
    '读': ['读', '独', '毒', '度', '读书', 'du', 'read'],
    '写': ['写', '鞋', '谢', '邪', '写字', 'xie', 'write'],
    '吃': ['吃', '痴', '池', '吃饭', 'chi', 'eat'],
    '喝': ['喝', '合', '河', '何', '喝水', 'he', 'drink'],
    '一': ['一', '1', '依', '衣', '医', '已', '以', '亿', 'yi', 'one'],
    '二': ['二', '2', '两', '饿', '而', '儿', 'er', 'liang', 'two'],
    '三': ['三', '3', '山', '伞', '散', 'san', 'three'],
    '四': ['四', '4', '是', '事', '市', '十', 'si', 'four'],
    '五': ['五', '5', '屋', '武', '物', '舞', 'wu', 'five'],
    '六': ['六', '6', '留', '流', '柳', 'liu', 'six'],
    '七': ['七', '7', '期', '妻', '齐', '起', '气', 'qi', 'seven'],
    '八': ['八', '8', '吧', '爸', '巴', '把', '拔', 'ba', 'eight'],
    '九': ['九', '9', '酒', '久', '就', '救', 'jiu', 'nine'],
    '十': ['十', '10', '石', '拾', '实', '识', '时', 'shi', 'ten'],
    '猫': ['猫', '毛', '冒', '帽', '小猫', 'mao', 'cat'],
    '狗': ['狗', '够', '购', '勾', '小狗', 'gou', 'go', 'dog'],
    '鸟': ['鸟', '袅', '小鸟', 'niao', 'bird'],
    '鱼': ['鱼', '于', '余', '小鱼', 'yu', 'fish'],
    '爸': ['爸', '八', '吧', '爸爸', 'ba', 'baba', 'dad'],
    '妈': ['妈', '麻', '马', '妈妈', 'ma', 'mama', 'mom'],
    '红': ['红', '洪', '鸿', '宏', '红色', 'hong', 'red'],
    '蓝': ['蓝', '兰', '篮', '蓝色', 'lan', 'blue'],
    '黄': ['黄', '皇', '黄色', 'huang', 'yellow']
  };

  function normalizeTonePinyin(str) {
    if (!str) return '';
    return str
      .replace(/[āáǎà]/g, 'a')
      .replace(/[ēéěè]/g, 'e')
      .replace(/[īíǐì]/g, 'i')
      .replace(/[ōóǒò]/g, 'o')
      .replace(/[ūúǔù]/g, 'u')
      .replace(/[ǖǘǚǜ]/g, 'v')
      .replace(/[^a-z0-9]/gi, '')
      .toLowerCase();
  }

  function chineseMatch(spoken, expectedWord) {
    if (!spoken || !expectedWord) return false;
    const expected = expectedWord.hanzi || expectedWord;
    const pinyinRaw = expectedWord.pinyin || '';
    const normSpoken = normalizeChinese(spoken);
    const normExpected = normalizeChinese(expected);
    const cleanPinyin = normalizeTonePinyin(pinyinRaw);
    const spokenPinyin = normalizeTonePinyin(spoken);

    // 1. Direct exact or substring match
    if (normSpoken === normExpected || normSpoken.includes(normExpected) || normExpected.includes(normSpoken)) return true;

    // 2. Single-character homophone table match
    if (CHINESE_HOMOPHONES[expected]) {
      const homophones = CHINESE_HOMOPHONES[expected];
      for (const h of homophones) {
        const normH = normalizeChinese(h);
        if (normSpoken === normH || normSpoken.includes(normH) || normH.includes(normSpoken)) {
          return true;
        }
      }
    }

    // 3. Pinyin phonetic match (with & without tone marks)
    if (cleanPinyin && (spokenPinyin.includes(cleanPinyin) || cleanPinyin.includes(spokenPinyin))) {
      return true;
    }

    // 4. Number match
    const numberMap = { '一':'1', '二':'2', '三':'3', '四':'4', '五':'5', '六':'6', '七':'7', '八':'8', '九':'9', '十':'10' };
    if (numberMap[normExpected] && (normSpoken.includes(numberMap[normExpected]) || normSpoken === numberMap[normExpected])) {
      return true;
    }

    return false;
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

  function startListening(targetWord) {
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
        const allCandidates = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          for (let j = 0; j < res.length; j++) {
            allCandidates.push(res[j].transcript.trim());
          }
          if (res.isFinal) {
            finalTranscript += res[0].transcript.trim();
          } else {
            interimTranscript += res[0].transcript.trim();
          }
        }

        const candidateText = finalTranscript || interimTranscript;
        if (candidateText) {
          interimResult = candidateText;

          // Instant real-time match for single words & phrases!
          if (targetWord) {
            for (const cand of allCandidates) {
              if (chineseMatch(cand, targetWord)) {
                settled = true;
                clearTimeout(timeoutId);
                if (autoStopTimer) clearTimeout(autoStopTimer);
                try { recognition.stop(); } catch(e) {}
                state.isRecording = false;
                updateMicButton();
                resolve([cand]);
                return;
              }
            }
          }

          if (autoStopTimer) clearTimeout(autoStopTimer);
          autoStopTimer = setTimeout(() => {
            if (!settled) {
              settled = true;
              clearTimeout(timeoutId);
              try { recognition.stop(); } catch(e) {}
              state.isRecording = false;
              updateMicButton();
              resolve(allCandidates.length ? allCandidates : [interimResult]);
            }
          }, 1200);
        }

        if (finalTranscript && !settled) {
          settled = true;
          clearTimeout(timeoutId);
          if (autoStopTimer) clearTimeout(autoStopTimer);
          try { recognition.stop(); } catch(e) {}
          resolve(allCandidates.length ? allCandidates : [finalTranscript]);
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

  // ---- Stroke Order Breakdown Dictionary ----
  const STROKE_DATA = {
    '一': ['一 (横 Horizontal ➔)'],
    '二': ['一 (上横 Top ➔)', '一 (下横 Bottom ➔)'],
    '三': ['一 (上横 ➔)', '一 (中横 ➔)', '一 (下长横 ➔)'],
    '四': ['丨 (竖 Down ↓)', '𠃍 (横折 Across & Down ➔↓)', '丿 (撇 Left Slant ↙)', '乚 (竖折 Down & Right └)', '一 (底横 Bottom ➔)'],
    '五': ['一 (上横 ➔)', '丨 (竖 ↓)', '𠃍 (横折 ➔↓)', '一 (底横 ➔)'],
    '六': ['丶 (点 Dot ↘)', '一 (横 ➔)', '丿 (撇 ↙)', '丶 (点 ↘)'],
    '七': ['一 (横 ➔)', '乚 (竖弯钩 ↳)'],
    '八': ['丿 (撇 ↙)', '丶 (捺 ↘)'],
    '九': ['丿 (撇 ↙)', '𠃌 (横折弯钩 ➔↳)'],
    '十': ['一 (横 ➔)', '丨 (竖 ↓)'],
    '大': ['一 (横 ➔)', '丿 (撇 ↙)', '丶 (捺 ↘)'],
    '小': ['亅 (竖钩 ↓)', '丿 (撇 ↙)', '丶 (点 ↘)'],
    '多': ['丿 (撇 ↙)', '㇇ (横撇 ➔↙)', '丶 (点 ↘)', '丿 (撇 ↙)', '㇇ (横撇 ➔↙)', '丶 (点 ↘)'],
    '少': ['丨 (中竖 ↓)', '丿 (左撇 ↙)', '丶 (右点 ↘)', '丿 (长撇 ↙)'],
    '高': ['丶 (点 ↘)', '一 (横 ➔)', '丨 (竖 ↓)', '𠃍 (横折 ➔↓)', '一 (横 ➔)', '丨 (竖 ↓)', '𠃍 (横折 ➔↓)', '一 (横 ➔)'],
    '矮': ['丿 (撇 ↙)', '一 (横 ➔)', '丨 (竖 ↓)', '丿 (撇 ↙)', '丶 (点 ↘)', '丿 (撇 ↙)', '一 (横 ➔)', '丨 (竖 ↓)', '𠃍 (横折 ➔↓)', '一 (横 ➔)', '女 (女部 3画)'],
    '快': ['丶 (点 ↘)', '丨 (竖 ↓)', '丶 (点 ↘)', '𠃍 (横折 ➔↓)', '一 (横 ➔)', '丿 (撇 ↙)', '丶 (捺 ↘)'],
    '慢': ['丶 (点 ↘)', '丨 (竖 ↓)', '丶 (点 ↘)', '日 (4画)', '罒 (5画)', '又 (2画)'],
    '猫': ['丿 (撇 ↙)', '㇁ (弯钩 ↳)', '丿 (撇 ↙)', '艹 (3画)', '田 (5画)'],
    '狗': ['丿 (撇 ↙)', '㇁ (弯钩 ↳)', '丿 (撇 ↙)', '勹 (2画)', '口 (3画)'],
    '鸟': ['丿 (撇 ↙)', '𠃍 (横折 ➔↓)', '丶 (点 ↘)', '𠃍 (横折 ➔↓)', '一 (底横 ➔)'],
    '鱼': ['丿 (撇 ↙)', '𠃍 (横折 ➔↓)', '田 (5画)', '一 (长横 ➔)'],
    '爸': ['丿 (撇 ↙)', '丶 (捺 ↘)', '丿 (撇 ↙)', '丶 (捺 ↘)', '巴 (4画)'],
    '妈': ['女 (3画)', '马 (3画)'],
    '红': ['𠃋 (撇折 ↙➔)', '𠃋 (撇折 ↙➔)', '㇀ (提 ↗)', '一 (横 ➔)', '丨 (竖 ↓)', '一 (横 ➔)'],
    '蓝': ['艹 (3画)', '监 (10画)'],
    '黄': ['廿 (4画)', '一 (1画)', '由 (5画)', '八 (2画)'],
    '吃': ['口 (3画)', '乞 (3画)'],
    '喝': ['口 (3画)', '日 (4画)', '勹 (2画)', '人 (2画)'],
    '读': ['讠 (2画)', '十 (2画)', '买 (6画)'],
    '写': ['冖 (2画)', '与 (3画)'],
    '手': ['丿 (平撇 ↙)', '一 (短横 ➔)', '一 (长横 ➔)', '亅 (弯竖钩 亅)']
  };

  let hanziWriterInstance = null;

  function updateStrokeAnimation(char) {
    const container = document.getElementById('stroke-anim-target');
    if (!container) return;
    container.innerHTML = '';

    if (typeof HanziWriter !== 'undefined') {
      try {
        hanziWriterInstance = HanziWriter.create('stroke-anim-target', char, {
          width: 110,
          height: 110,
          padding: 8,
          showOutline: true,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 220,
          strokeColor: '#FF6B6B',
          radicalColor: '#6C5CE7',
          strokeHighlightSpeed: 2
        });
        hanziWriterInstance.animateCharacter();
      } catch(e) {
        console.warn('HanziWriter init:', e);
      }
    }

    // Render stroke list
    const stepsListEl = document.getElementById('stroke-steps-list');
    const strokeCountTag = document.getElementById('stroke-count-tag');
    if (stepsListEl) {
      const strokes = STROKE_DATA[char];
      if (strokes && strokes.length > 0) {
        if (strokeCountTag) strokeCountTag.textContent = `✏️ “${char}” 笔画顺序 (${strokes.length} 画 / ${strokes.length} Strokes)`;
        stepsListEl.innerHTML = strokes.map((s, idx) => `<span class="stroke-step-pill">${idx + 1}. ${s}</span>`).join('');
      } else {
        if (strokeCountTag) strokeCountTag.textContent = `✏️ “${char}” 笔画顺序 (Stroke Order)`;
        stepsListEl.innerHTML = `<span class="stroke-step-pill">▶ 点击播放动画 (Click Play Strokes)</span>`;
      }
    }
  }

  // ---- View 7: 4-Box Write & Trace Mode ----
  function startWriteMode() {
    state.lastMode = 'write';
    state.currentWriteIndex = 0;
    state.currentCharIndex = 0;
    state.activeQuadIndex = 1;
    showView('write');
    setTimeout(() => {
      initQuadCanvases();
      renderWriteCard();
    }, 50);
  }

  function initQuadCanvases() {
    const dpr = window.devicePixelRatio || 1;
    for (let i = 1; i <= 4; i++) {
      const canvas = document.getElementById(`write-canvas-${i}`);
      if (!canvas) continue;
      const ctx = canvas.getContext('2d');
      const rect = canvas.getBoundingClientRect();
      const size = rect.width || 220;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = state.currentColor || '#2D3436';

      quadCanvases[i - 1] = canvas;
      quadContexts[i - 1] = ctx;

      // Mouse drawing
      canvas.onmousedown = (e) => {
        setActiveQuadBox(i);
        startQuadDraw(i, e.offsetX, e.offsetY);
      };
      canvas.onmousemove = (e) => {
        if (state.isDrawing && state.activeDrawingBox === i) {
          drawQuad(i, e.offsetX, e.offsetY);
        }
      };
      canvas.onmouseup = () => stopDraw();
      canvas.onmouseleave = () => stopDraw();

      // Touch drawing (phones/tablets)
      canvas.ontouchstart = (e) => {
        e.preventDefault();
        setActiveQuadBox(i);
        const touch = e.touches[0];
        const box = canvas.getBoundingClientRect();
        startQuadDraw(i, touch.clientX - box.left, touch.clientY - box.top);
      };
      canvas.ontouchmove = (e) => {
        e.preventDefault();
        if (!state.isDrawing || state.activeDrawingBox !== i) return;
        const touch = e.touches[0];
        const box = canvas.getBoundingClientRect();
        drawQuad(i, touch.clientX - box.left, touch.clientY - box.top);
      };
      canvas.ontouchend = (e) => {
        e.preventDefault();
        stopDraw();
      };
    }
  }

  function setActiveQuadBox(boxNum) {
    state.activeQuadIndex = boxNum;
    for (let i = 1; i <= 4; i++) {
      const card = document.getElementById(`quad-card-${i}`);
      if (card) {
        if (i === boxNum) card.classList.add('active');
        else card.classList.remove('active');
      }
    }
  }

  function startQuadDraw(boxNum, x, y) {
    state.isDrawing = true;
    state.activeDrawingBox = boxNum;
    state.lastX = x;
    state.lastY = y;
    const ctx = quadContexts[boxNum - 1];
    if (ctx) {
      ctx.strokeStyle = state.currentColor;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = state.currentColor;
      ctx.fill();
    }
  }

  function drawQuad(boxNum, x, y) {
    if (!state.isDrawing || !quadContexts[boxNum - 1]) return;
    const ctx = quadContexts[boxNum - 1];
    ctx.strokeStyle = state.currentColor;
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    state.lastX = x;
    state.lastY = y;
  }

  function stopDraw() {
    state.isDrawing = false;
    state.activeDrawingBox = null;
  }

  function clearActiveBox() {
    SoundEffects.playBubble();
    const idx = state.activeQuadIndex;
    const canvas = quadCanvases[idx - 1];
    const ctx = quadContexts[idx - 1];
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    state.quadCompleted[idx] = false;
    const star = document.getElementById(`quad-star-${idx}`);
    if (star) star.textContent = '☆';
    const card = document.getElementById(`quad-card-${idx}`);
    if (card) card.classList.remove('completed');
    const box = document.getElementById(`quad-box-${idx}`);
    if (box) box.classList.remove('pass-glow', 'shake-error');

    const fb = document.getElementById('write-feedback');
    if (fb) fb.classList.add('hidden');
  }

  function clearAllBoxes() {
    SoundEffects.playBubble();
    for (let i = 1; i <= 4; i++) {
      const canvas = quadCanvases[i - 1];
      const ctx = quadContexts[i - 1];
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      state.quadCompleted[i] = false;
      const star = document.getElementById(`quad-star-${i}`);
      if (star) star.textContent = '☆';
      const card = document.getElementById(`quad-card-${i}`);
      if (card) card.classList.remove('completed');
      const box = document.getElementById(`quad-box-${i}`);
      if (box) box.classList.remove('pass-glow', 'shake-error');
    }
    const fb = document.getElementById('write-feedback');
    if (fb) fb.classList.add('hidden');
  }

  function toggleGuide() {
    SoundEffects.playBubble();
    const watermark = document.getElementById('write-watermark-1');
    if (watermark) {
      watermark.classList.toggle('hidden-guide');
    }
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

    // Multi-char tabs
    const chars = Array.from(word.hanzi);
    const charTabsRow = document.getElementById('write-char-tabs');
    if (chars.length > 1) {
      charTabsRow.classList.remove('hidden');
      charTabsRow.innerHTML = chars.map((c, i) => `
        <button type="button" class="char-tab-btn ${i === state.currentCharIndex ? 'active' : ''}" data-char-idx="${i}">
          ${c}
        </button>
      `).join('');
      charTabsRow.querySelectorAll('.char-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          SoundEffects.playBubble();
          state.currentCharIndex = parseInt(btn.getAttribute('data-char-idx'), 10);
          renderWriteCard();
        });
      });
    } else {
      charTabsRow.classList.add('hidden');
      state.currentCharIndex = 0;
    }

    const currentChar = chars[state.currentCharIndex] || word.hanzi;

    // Update stroke demo
    updateStrokeAnimation(currentChar);

    // Update Box 1 guide watermark
    const watermark1 = document.getElementById('write-watermark-1');
    if (watermark1) {
      watermark1.textContent = currentChar;
      watermark1.style.opacity = '0.45';
    }

    // Reset all 4 canvases and stars
    clearAllBoxes();
    setActiveQuadBox(1);

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
        state.currentCharIndex = 0;
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

  // ---- AI Handwriting Verification Engine for Quad Boxes ----
  function verifyWritingAccuracy(canvas, expectedChar) {
    if (!canvas) return { pass: false, drawn: false, message: '请在田字格里写字哦！(Please write on canvas!)' };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Check if canvas has drawn strokes
    const drawnData = ctx.getImageData(0, 0, w, h).data;
    let drawnPoints = [];

    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const idx = (y * w + x) * 4 + 3; // alpha channel
        if (drawnData[idx] > 40) {
          drawnPoints.push({ x, y });
        }
      }
    }

    if (drawnPoints.length < 25) {
      return {
        pass: false,
        drawn: false,
        reason: 'too_empty',
        message: '✏️ 还没有写字哦！(Please write first!)'
      };
    }

    // Render reference character on offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = w;
    offCanvas.height = h;
    const offCtx = offCanvas.getContext('2d');
    offCtx.fillStyle = '#000000';

    const fontSize = expectedChar.length >= 2 ? Math.round(w * 0.45) : Math.round(w * 0.68);
    offCtx.font = `900 ${fontSize}px 'Noto Sans SC', 'Kaiti', 'STKaiti', sans-serif`;
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(expectedChar, w / 2, h / 2);

    const targetData = offCtx.getImageData(0, 0, w, h).data;
    let targetPoints = [];
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        const idx = (y * w + x) * 4 + 3;
        if (targetData[idx] > 40) {
          targetPoints.push({ x, y });
        }
      }
    }

    if (targetPoints.length === 0) {
      return { pass: true, drawn: true, message: '🎉 写好了！(Done!)' };
    }

    // Tolerance distance (in canvas pixels): 24px
    const TOLERANCE_SQ = 24 * 24;

    let inBoundsCount = 0;
    let outOfBoundsCount = 0;

    for (const p of drawnPoints) {
      let isNear = false;
      for (const tp of targetPoints) {
        const distSq = (p.x - tp.x) * (p.x - tp.x) + (p.y - tp.y) * (p.y - tp.y);
        if (distSq <= TOLERANCE_SQ) {
          isNear = true;
          break;
        }
      }
      if (isNear) inBoundsCount++;
      else outOfBoundsCount++;
    }

    let coveredTargetCount = 0;
    for (const tp of targetPoints) {
      let isCovered = false;
      for (const p of drawnPoints) {
        const distSq = (p.x - tp.x) * (p.x - tp.x) + (p.y - tp.y) * (p.y - tp.y);
        if (distSq <= TOLERANCE_SQ) {
          isCovered = true;
          break;
        }
      }
      if (isCovered) coveredTargetCount++;
    }

    const accuracy = inBoundsCount / (inBoundsCount + outOfBoundsCount + 1e-5);
    const coverage = coveredTargetCount / (targetPoints.length + 1e-5);

    // Reject wild scribbles
    if (accuracy < 0.48) {
      return {
        pass: false,
        drawn: true,
        reason: 'inaccurate',
        message: `🤔 笔画写偏啦！请沿着字形认真书写！(Strokes went outside, please write carefully!)`
      };
    }

    if (coverage < 0.25) {
      return {
        pass: false,
        drawn: true,
        reason: 'incomplete',
        message: `✏️ 笔画还没写完整哦，继续把字写完吧！(Incomplete strokes, please finish the character!)`
      };
    }

    return {
      pass: true,
      drawn: true,
      accuracy: Math.round(accuracy * 100),
      message: `🌟 写得非常标准漂亮！(Accurate handwriting!)`
    };
  }

  function showWriteFeedback(message, type) {
    const el = document.getElementById('write-feedback');
    if (!el) return;

    el.textContent = message;
    el.className = `write-feedback ${type}`;
    el.classList.remove('hidden');
  }

  function finishWriting() {
    const word = state.currentLevel.vocabulary[state.currentWriteIndex];
    const chars = Array.from(word.hanzi);
    const currentChar = chars[state.currentCharIndex] || word.hanzi;

    let anyDrawn = false;
    let anyFailed = false;
    let failedBoxIndex = null;
    let passedCount = 0;

    for (let i = 1; i <= 4; i++) {
      const canvas = quadCanvases[i - 1];
      const box = document.getElementById(`quad-box-${i}`);
      const card = document.getElementById(`quad-card-${i}`);
      const star = document.getElementById(`quad-star-${i}`);

      if (box) box.classList.remove('pass-glow', 'shake-error');

      const check = verifyWritingAccuracy(canvas, currentChar);

      if (check.drawn) {
        anyDrawn = true;
        if (check.pass) {
          state.quadCompleted[i] = true;
          passedCount++;
          if (star) star.textContent = '⭐';
          if (card) card.classList.add('completed');
          if (box) box.classList.add('pass-glow');
        } else {
          state.quadCompleted[i] = false;
          anyFailed = true;
          if (!failedBoxIndex) failedBoxIndex = i;
          if (box) box.classList.add('shake-error');
          if (star) star.textContent = '☆';
          if (card) card.classList.remove('completed');
        }
      } else {
        // Not drawn yet
        state.quadCompleted[i] = false;
        if (star) star.textContent = '☆';
        if (card) card.classList.remove('completed');
      }
    }

    if (!anyDrawn) {
      SoundEffects.playTryAgain();
      showWriteFeedback('✏️ 请先在田字格里书写汉字哦！(Please write in the boxes first!)', 'retry');
      return;
    }

    if (anyFailed && failedBoxIndex) {
      SoundEffects.playTryAgain();
      showWriteFeedback(`🤔 第 ${failedBoxIndex} 格笔画写偏啦！请认真书写！(Box ${failedBoxIndex} strokes are inaccurate!)`, 'retry');
      return;
    }

    if (passedCount < 4) {
      SoundEffects.playPop();
      showWriteFeedback(`👍 很棒！已写好 ${passedCount} / 4 格！继续把剩下 ${4 - passedCount} 格也写完吧！(Completed ${passedCount}/4 boxes, keep going!)`, 'success');
      return;
    }

    // ALL 4 BOXES COMPLETED!
    SoundEffects.playVictory();
    showWriteFeedback(`🎉 太棒了！4个格子全部写完啦！(All 4 boxes completed! Excellent!) ⭐⭐⭐⭐`, 'success');
    speakDynamic('太棒了！');

    // If multi-character word and has remaining character
    if (state.currentCharIndex < chars.length - 1) {
      setTimeout(() => {
        state.currentCharIndex++;
        renderWriteCard();
        const fb = document.getElementById('write-feedback');
        if (fb) fb.classList.add('hidden');
      }, 1300);
    } else {
      // Move to next word
      setTimeout(() => {
        if (state.currentWriteIndex < state.currentLevel.vocabulary.length - 1) {
          writeNext();
        } else {
          showQuizResults('write');
        }
        const fb = document.getElementById('write-feedback');
        if (fb) fb.classList.add('hidden');
      }, 1300);
    }
  }

  function writeNext() {
    if (state.currentWriteIndex < state.currentLevel.vocabulary.length - 1) {
      SoundEffects.playBubble();
      state.currentWriteIndex++;
      state.currentCharIndex = 0;
      renderWriteCard();
    }
  }

  function writePrev() {
    if (state.currentWriteIndex > 0) {
      SoundEffects.playBubble();
      state.currentWriteIndex--;
      state.currentCharIndex = 0;
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
    if (typeof speechSynthesis !== 'undefined') {
      try { speechSynthesis.cancel(); } catch(e) {}
    }
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
      const results = await startListening(q.word);
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
        feedbackEl.innerHTML = `
          <div class="feedback-success">
            🎉 <strong>太棒啦！(Well done!)</strong>
            <small>你说的是 (You said): "${heard}"</small>
          </div>
        `;

        state.speakAnswers.push({
          word: q.word,
          correct: true,
          userAnswer: heard
        });

        document.getElementById('mic-btn').disabled = true;

        if (typeof speechSynthesis !== 'undefined') {
          try { speechSynthesis.cancel(); } catch(e) {}
        }

        setTimeout(() => {
          state.currentSpeakIndex++;
          if (state.currentSpeakIndex < state.speakQuestions.length) {
            renderSpeakQuestion();
          } else {
            showQuizResults('speak');
          }
        }, 1000);

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
    const name = state.userName || '当前学生';
    if (confirm(`确定要清空 ${name} 的学习记录吗？其他宝贝的记录将不受影响！(Reset progress for ${name}?)`)) {
      state.progress = {};
      LEVELS.forEach(level => {
        state.progress[level.id] = {
          bestScore: 0,
          completed: false,
          unlocked: level.id === 1
        };
      });
      saveProgress();
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
    document.getElementById('write-clear-btn').addEventListener('click', clearActiveBox);
    const clearAllBtn = document.getElementById('write-clear-all-btn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllBoxes);

    document.getElementById('write-guide-toggle').addEventListener('click', toggleGuide);
    document.getElementById('write-finish-btn').addEventListener('click', finishWriting);

    const strokePlayBtn = document.getElementById('stroke-play-btn');
    if (strokePlayBtn) {
      strokePlayBtn.addEventListener('click', () => {
        SoundEffects.playBubble();
        if (hanziWriterInstance) {
          hanziWriterInstance.animateCharacter();
        }
      });
    }

    // 4-Box card click selectors
    document.querySelectorAll('.tianzige-quad-card').forEach(card => {
      card.addEventListener('click', () => {
        const boxNum = parseInt(card.getAttribute('data-box'), 10);
        if (boxNum) setActiveQuadBox(boxNum);
      });
    });

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

    // Profile modal & form listeners
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const idInput = document.getElementById('profile-id-input');
        const nameInput = document.getElementById('user-name-input');
        saveUserProfile(idInput ? idInput.value : '', nameInput.value, state.userAvatar);
      });
    }

    const closeProfileBtn = document.getElementById('profile-modal-close-btn');
    if (closeProfileBtn) {
      closeProfileBtn.addEventListener('click', () => {
        SoundEffects.playBubble();
        hideProfileModal();
      });
    }

    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
      profileModal.addEventListener('click', (e) => {
        if (e.target === profileModal && state.userName) {
          hideProfileModal();
        }
      });
    }

    const btnShowAddProfile = document.getElementById('btn-show-add-profile');
    if (btnShowAddProfile) {
      btnShowAddProfile.addEventListener('click', () => {
        SoundEffects.playBubble();
        state.profileId = ''; // New child
        showProfileModal('edit');
      });
    }

    const btnCancelProfileEdit = document.getElementById('btn-cancel-profile-edit');
    if (btnCancelProfileEdit) {
      btnCancelProfileEdit.addEventListener('click', () => {
        SoundEffects.playBubble();
        const profiles = getProfilesDirectory();
        if (Object.keys(profiles).length > 0) {
          showProfileModal('list');
        } else {
          hideProfileModal();
        }
      });
    }

    const btnDeleteProfileForm = document.getElementById('btn-delete-profile-form');
    if (btnDeleteProfileForm) {
      btnDeleteProfileForm.addEventListener('click', () => {
        const idInput = document.getElementById('profile-id-input');
        if (idInput && idInput.value) {
          deleteProfile(idInput.value);
        }
      });
    }

    // Avatar choice buttons
    document.querySelectorAll('.avatar-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundEffects.playPop();
        document.querySelectorAll('.avatar-choice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.userAvatar = btn.getAttribute('data-avatar') || '👧';
      });
    });

    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
      editProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundEffects.playBubble();
        showProfileModal('list');
      });
    }

    const profileBadge = document.getElementById('user-profile-badge');
    if (profileBadge) {
      profileBadge.addEventListener('click', () => {
        SoundEffects.playBubble();
        showProfileModal('list');
      });
    }

    const mascotAvatar = document.getElementById('mascot-avatar');
    const mascotSpeech = document.getElementById('mascot-speech');
    const triggerMascotVoice = () => {
      SoundEffects.playBubble();
      const name = state.userName || '小朋友';
      speakBilingual(`你好，${name}！我是熊猫宝宝，一起来快乐学华语吧！`, `Hello ${name}! I am Panda Bao Bao, welcome to our Chinese learning playgroup!`);
    };

    if (mascotAvatar) mascotAvatar.addEventListener('click', triggerMascotVoice);
    if (mascotSpeech) mascotSpeech.addEventListener('click', triggerMascotVoice);

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
