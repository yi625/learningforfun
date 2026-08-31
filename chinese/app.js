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
    quadBoxStrokes: { 1: 0, 2: 0, 3: 0, 4: 0 },
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
    userAvatar: '🐼',
    lastMode: 'quiz',
    familyVoiceMode: 'bilingual',
  };

  let currentAudio = null;
  let recognition = null;
  let quadCanvases = [null, null, null, null];
  let quadContexts = [null, null, null, null];
  let quizWriterInstance = null;
  let quizBoxPassed = false;
  let quizTotalMistakes = 0;

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

    const chosenAvatar = avatar || state.userAvatar || '🐼';
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
      state.userAvatar = p.avatar || '🐼';
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
        state.userAvatar = '🐼';
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
      avatarEl.textContent = state.userAvatar || '🐼';
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

  function selectAvatar(avatarChar) {
    const avatar = avatarChar || '🐼';
    state.userAvatar = avatar;
    const hiddenInput = document.getElementById('selected-avatar-input');
    if (hiddenInput) hiddenInput.value = avatar;

    const btns = document.querySelectorAll('.avatar-choice-btn');
    btns.forEach(btn => {
      const btnAv = btn.getAttribute('data-avatar');
      if (btnAv === avatar) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (typeof SoundEffects !== 'undefined' && SoundEffects.playPop) {
      SoundEffects.playPop();
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

      const isEditingExisting = !!(state.profileId && profiles[state.profileId]);

      if (idInput) idInput.value = isEditingExisting ? state.profileId : '';
      if (nameInput) nameInput.value = isEditingExisting ? state.userName : '';
      if (formTitle) {
        formTitle.textContent = isEditingExisting ? `✏️ 编辑 ${state.userName} 的档案 (Edit Profile)` : '➕ 添加新学生档案 (Add New Kid)';
      }

      if (deleteFormBtn) {
        if (isEditingExisting) {
          deleteFormBtn.classList.remove('hidden');
        } else {
          deleteFormBtn.classList.add('hidden');
        }
      }

      // If new profile, CLEAR NAME and default to Panda 🐼
      const defaultAvatar = isEditingExisting ? (state.userAvatar || '🐼') : '🐼';
      selectAvatar(defaultAvatar);
      setTimeout(() => nameInput && nameInput.focus(), 100);
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
              selectAvatar(targetP.avatar || '👧');
              setTimeout(() => nameInput && nameInput.focus(), 100);
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

    // 1. Play pre-generated Neural AI audio
    if (typeof AUDIO_MANIFEST !== 'undefined' && AUDIO_MANIFEST[cleanText]) {
      playPreRecordedAudio(AUDIO_MANIFEST[cleanText]);
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

  // ---- Comprehensive Chinese Homophone & Phonetic Map for All Words ----
  const CHINESE_HOMOPHONES = {
    // Level 1: Numbers & Basics
    '一': ['一', '1', '11', 'yi', 'yī', 'one', '依', '衣', '医', '已', '以', '亿', '幺', '壹'],
    '二': ['二', '2', '22', 'er', 'èr', 'two', '两', '贰', '儿', '耳', '饿', '而', '俩'],
    '三': ['三', '3', '33', 'san', 'sān', 'three', '叁', '山', '伞', '散', '珊', '杉'],
    '四': ['四', '4', '44', 'si', 'sì', 'four', '肆', '是', '事', '市', '十', '视', '死', '试', '寺'],
    '五': ['五', '5', '55', 'wu', 'wǔ', 'five', '伍', '屋', '武', '物', '舞', '无', '午', '捂'],
    '六': ['六', '6', '66', '666', 'liu', 'liù', 'six', '陆', '留', '流', '柳', '溜', '路', '楼', '露'],
    '七': ['七', '7', '77', 'qi', 'qī', 'seven', '柒', '期', '妻', '齐', '起', '气', '奇', '漆', '旗'],
    '八': ['八', '8', '88', 'ba', 'bā', 'eight', '捌', '吧', '爸', '巴', '把', '拔', '发', '罢'],
    '九': ['九', '9', '99', 'jiu', 'jiǔ', 'nine', '玖', '酒', '久', '就', '救', '旧', '纠', '舅'],
    '十': ['十', '10', '1010', 'shi', 'shí', 'ten', '拾', '石', '实', '识', '时', '事', '是', '师', '食'],
    '手': ['手', 'shou', 'shǒu', 'hand', '首', '守', '寿', '授', '受', '收', '兽', '小手', '手手', '一只手'],
    '眼睛': ['眼睛', 'yanjing', 'yǎnjing', 'eyes', 'eye', '眼', '睛', '小眼', '大眼', 'yan', 'jing', '双眼'],
    '猫': ['猫', 'mao', 'māo', 'cat', '小猫', '毛', '帽', '冒', '喵', '猫猫', '一只猫'],
    '狗': ['狗', 'gou', 'gǒu', 'dog', '小狗', '够', '购', '勾', '狗狗', '一只狗'],
    '鸟': ['鸟', 'niao', 'niǎo', 'bird', '小鸟', '袅', '鸟儿', '鸟鸟', '一只鸟'],
    '爸爸': ['爸爸', 'baba', 'bà ba', 'dad', 'father', '爸', '阿爸', '老爸', '八八'],
    '妈妈': ['妈妈', 'mama', 'mā ma', 'mom', 'mother', '妈', '阿妈', '老妈', '麻麻'],
    '哥哥': ['哥哥', 'gege', 'gē ge', 'brother', '哥', '大哥', '表哥'],
    '姐姐': ['姐姐', 'jiejie', 'jiě jie', 'sister', '姐', '大姐', '表姐'],
    '弟弟': ['弟弟', 'didi', 'dì di', 'brother', '弟', '小弟', '表弟'],
    '妹妹': ['妹妹', 'meimei', 'mèi mei', 'sister', '妹', '小妹', '表妹'],
    '红色': ['红色', '红', 'hongse', 'hóng sè', 'hong', 'red', '红红', '大红'],
    '蓝色': ['蓝色', '蓝', 'lanse', 'lán sè', 'lan', 'blue', '蓝蓝', '浅蓝'],
    '黄色': ['黄色', '黄', 'huangse', 'huáng sè', 'huang', 'yellow', '金黄'],
    '太阳': ['太阳', 'taiyang', 'tài yáng', 'sun', '阳光', '日头', '太阳公公'],
    '月亮': ['月亮', 'yueliang', 'yuè liang', 'moon', '月', '月球', '弯月', '明月'],
    // Personal Pronouns (人称代词)
    '我': ['我', 'wo', 'wǒ', 'me', 'i', '我的', '我和你', '我们', '俺'],
    '你': ['你', 'ni', 'nǐ', 'you', '你的', '你好', '你们'],
    '他': ['他', 'ta', 'tā', 'he', 'him', '他的', '他们', '他人'],
    '她': ['她', 'ta', 'tā', 'she', 'her', '她的', '她们'],
    '它': ['它', 'ta', 'tā', 'it', '它的', '它们'],
    '我们': ['我们', 'women', 'wǒ men', 'we', 'us', '咱们', '偶们', '我哋'],
    '你们': ['你们', 'nimen', 'nǐ men', 'you', '大家', '诸位'],
    '他们': ['他们', 'tamen', 'tā men', 'they', 'them'],
    '她们': ['她们', 'tamen', 'tā men', 'they', 'them'],

    // Level 2: School & Life
    '老师': ['老师', 'laoshi', 'lǎo shī', 'teacher', '师', '老实'],
    '同学': ['同学', 'tongxue', 'tóng xué', 'classmate', '学', '学友'],
    '书包': ['书包', 'shubao', 'shū bāo', 'schoolbag', '包', '书袋'],
    '铅笔': ['铅笔', 'qianbi', 'qiān bǐ', 'pencil', '笔', '木笔'],
    '尺子': ['尺子', 'chizi', 'chǐ zi', 'ruler', '尺', '直尺'],
    '橡皮': ['橡皮', 'xiangpi', 'xiàng pí', 'eraser', '皮', '橡皮擦'],
    '早上好': ['早上好', 'zaoshanghao', 'zǎo shang hǎo', 'good morning', '早安', '早上', '早'],
    '谢谢': ['谢谢', 'xiexie', 'xiè xie', 'thank you', 'thanks', '谢', '感谢'],
    '对不起': ['对不起', 'duibuqi', 'duì bu qǐ', 'sorry', '不好意思', '抱歉'],
    '没关系': ['没关系', 'meiguanxi', 'méi guān xi', 'its okay', '没事', '无所谓', '不用谢'],
    '再见': ['再见', 'zaijian', 'zài jiàn', 'goodbye', 'bye', '拜拜', '再会'],
    '读书': ['读书', 'dushu', 'dú shū', 'read book', '读', '看书', '念书'],
    '写字': ['写字', 'xiezi', 'xiě zì', 'write', '写', '写书法'],
    '画画': ['画画', 'huahua', 'huà huà', 'draw', 'paint', '画', '画图'],
    '吃饭': ['吃饭', 'chifan', 'chī fàn', 'eat', '吃', '吃米饭'],
    '喝水': ['喝水', 'heshui', 'hē shuǐ', 'drink water', '喝', '喝茶'],
    '苹果': ['苹果', 'pingguo', 'píng guǒ', 'apple', '果', '红苹果'],
    '香蕉': ['香蕉', 'xiangjiao', 'xiāng jiāo', 'banana', '蕉', '大香蕉'],
    '西瓜': ['西瓜', 'xigua', 'xī guā', 'watermelon', '瓜', '甜西瓜'],
    '面包': ['面包', 'mianbao', 'miàn bāo', 'bread', '吐司'],
    '牛奶': ['牛奶', 'niunai', 'niú nǎi', 'milk', '奶', '鲜奶'],

    // Level 3: Feelings & Opposites
    '开心': ['开心', 'kaixin', 'kāi xīn', 'happy', '快乐', '高兴'],
    '伤心': ['伤心', 'shangxin', 'shāng xīn', 'sad', '难过', '哭'],
    '生气': ['生气', 'shengqi', 'shēng qì', 'angry', '发火', '气'],
    '害怕': ['害怕', 'haipa', 'hài pà', 'scared', '怕', '恐惧'],
    '勇敢': ['勇敢', 'yonggan', 'yǒng gǎn', 'brave', '勇', '不害怕'],
    '晴天': ['晴天', 'qingtian', 'qíng tiān', 'sunny', '晴', '好天气'],
    '下雨': ['下雨', 'xiayu', 'xià yǔ', 'rain', '雨', '下雨天'],
    '刮风': ['刮风', 'guafeng', 'guā fēng', 'wind', '风', '大风'],
    '今天': ['今天', 'jintian', 'jīn tiān', 'today', '今日'],
    '明天': ['明天', 'mingtian', 'míng tiān', 'tomorrow', '明日'],
    '大': ['大', 'da', 'dà', 'big', '达', '打', '搭', '答', '哒', '大大', '巨大'],
    '小': ['小', 'xiao', 'xiǎo', 'small', '消', '销', '笑', '效', '校', '晓', '小小', '微小'],
    '多': ['多', 'duo', 'duō', 'many', 'much', '朵', '躲', '夺', '堕', '好多'],
    '少': ['少', 'shao', 'shǎo', 'few', 'little', '烧', '稍', '勺', '绍', '哨', '很少'],
    '高': ['高', 'gao', 'gāo', 'tall', 'high', '搞', '告', '稿', '膏', '糕', '个子高'],
    '矮': ['矮', 'ai', 'ǎi', 'short', '哎', '爱', '哀', '埃', '挨', '矮小'],
    '快': ['快', 'kuai', 'kuài', 'fast', 'quick', '块', '筷', '会', '快速'],
    '慢': ['慢', 'man', 'màn', 'slow', '满', '曼', '漫', '慢慢', '缓慢'],
    '唱歌': ['唱歌', 'changge', 'chàng gē', 'sing', '歌', '唱'],
    '跳舞': ['跳舞', 'tiaowu', 'tiào wǔ', 'dance', '舞', '跳'],
    '游泳': ['游泳', 'youyong', 'yóu yǒng', 'swim', '游', '游水'],
    '跑步': ['跑步', 'paobu', 'pǎo bù', 'run', '跑', '快跑'],

    // Level 4: Community & Idioms
    '学校': ['学校', 'xuexiao', 'xué xiào', 'school', '校'],
    '公园': ['公园', 'gongyuan', 'gōng yuán', 'park', '园'],
    '医院': ['医院', 'yiyuan', 'yī yuàn', 'hospital', '医'],
    '图书馆': ['图书馆', 'tushuguan', 'tú shū guǎn', 'library', '书馆'],
    '超市': ['超市', 'chaoshi', 'chāo shì', 'supermarket', '市场'],
    '汽车': ['汽车', 'qiche', 'qì chē', 'car', '车', '小车'],
    '巴士': ['巴士', 'bashi', 'bā shì', 'bus', '公车', '公交车'],
    '飞机': ['飞机', 'feiji', 'fēi jī', 'airplane', '机', '客机'],
    '火车': ['火车', 'huoche', 'huǒ chē', 'train', '铁道', '高铁'],
    '自行车': ['自行车', 'zixingche', 'zì xíng chē', 'bicycle', '单车', '脚踏车'],
    '礼貌': ['礼貌', 'limao', 'lǐ mào', 'polite', '有礼貌', '礼'],
    '诚实': ['诚实', 'chengshi', 'chéng shí', 'honest', '诚', '老实'],
    '勤劳': ['勤劳', 'qinlao', 'qín láo', 'hardworking', '勤奋', '勤'],
    '团结': ['团结', 'tuanjie', 'tuán jié', 'united', '齐心'],
    '爱护公物': ['爱护公物', 'aihugongwu', 'ài hù gōng wù', '公物', '爱护'],
    '一心一意': ['一心一意', 'yixinyiyi', 'yī xīn yī yì', '专心', '一心'],
    '助人为乐': ['助人为乐', 'zhurenweile', 'zhù rén wéi lè', '助人', '热心'],
    '井井有条': ['井井有条', 'jingjingyoutiao', 'jǐng jǐng yǒu tiáo', '整齐', '有条理'],
    '自强不息': ['自强不息', 'ziqiangbuxi', 'zì qiáng bù xī', '努力', '自强'],

    // Special Edition: Family Tree & Relatives
    '爷爷': ['爷爷', 'yeye', 'yé ye', 'grandfather', 'grandpa', '爷', '阿爷', '祖父'],
    '奶奶': ['奶奶', 'nainai', 'nǎi nai', 'grandmother', 'grandma', '奶', '阿奶', '祖母'],
    '外公': ['外公', 'waigong', 'wài gōng', 'grandfather', 'grandpa', '公公', '姥爷', '外祖父'],
    '外婆': ['外婆', 'waipo', 'wài pó', 'grandmother', 'grandma', '婆婆', '姥姥', '外祖母'],
    '大伯': ['大伯', 'dabo', 'dà bó', 'uncle', '伯伯', '大爷', '伯父'],
    '叔叔': ['叔叔', 'shushu', 'shū shu', 'uncle', '叔', '小叔', '叔父'],
    '舅舅': ['舅舅', 'jiujiu', 'jiù jiu', 'uncle', '舅', '大舅', '小舅', '舅父'],
    '姑姑': ['姑姑', 'gugu', 'gū gu', 'aunt', '姑', '大姑', '小姑', '姑妈', '姑母'],
    '阿姨': ['阿姨', 'ayi', 'ā yí', 'aunt', '姨', '大姨', '小姨', '姨妈', '姨母'],
    '伯母': ['伯母', 'bomu', 'bó mǔ', 'aunt', '大娘', '大妈'],
    '婶婶': ['婶婶', 'shenshen', 'shěn shen', 'aunt', '婶', '小婶', '婶母'],
    '舅妈': ['舅妈', 'jiuma', 'jiù mā', 'aunt', '舅母', '大舅妈'],
    '姑丈': ['姑丈', 'guzhang', 'gū zhàng', 'uncle', '姑父', '姑爷'],
    '姨丈': ['姨丈', 'yizhang', 'yí zhàng', 'uncle', '姨夫', '姨父'],
    '堂哥': ['堂哥', 'tangge', 'táng gē', 'cousin', '堂兄'],
    '堂姐': ['堂姐', 'tangjie', 'táng jiě', 'cousin'],
    '堂弟': ['堂弟', 'tangdi', 'táng dì', 'cousin'],
    '堂妹': ['堂妹', 'tangmei', 'táng mèi', 'cousin'],
    '表哥': ['表哥', 'biaoge', 'biǎo gē', 'cousin', '表兄'],
    '表姐': ['表姐', 'biaojie', 'biǎo jiě', 'cousin'],
    '表弟': ['表弟', 'biaodi', 'biǎo dì', 'cousin'],
    '表妹': ['表妹', 'biaomei', 'biǎo mèi', 'cousin']
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
    const englishRaw = expectedWord.english || '';

    const normSpoken = normalizeChinese(spoken);
    const normExpected = normalizeChinese(expected);
    const cleanPinyin = normalizeTonePinyin(pinyinRaw);
    const spokenPinyin = normalizeTonePinyin(spoken);

    if (!normSpoken) return false;

    // 1. Direct exact or substring containment (e.g. "六" in "66" or "手" in "这是手")
    if (normSpoken === normExpected || normSpoken.includes(normExpected) || normExpected.includes(normSpoken)) {
      return true;
    }

    // 2. Number digit-to-word match (e.g. 6 -> 六, 66 -> 六, 1 -> 一, etc.)
    const numberDigits = { '一':'1', '二':'2', '三':'3', '四':'4', '五':'5', '六':'6', '七':'7', '八':'8', '九':'9', '十':'10' };
    if (numberDigits[normExpected]) {
      const digit = numberDigits[normExpected];
      if (normSpoken.includes(digit) || normSpoken === digit) return true;
    }

    // 3. Comprehensive homophone & phonetic table match
    if (CHINESE_HOMOPHONES[expected]) {
      const homophones = CHINESE_HOMOPHONES[expected];
      for (const h of homophones) {
        const normH = normalizeChinese(h);
        if (normH && (normSpoken === normH || normSpoken.includes(normH) || normH.includes(normSpoken))) {
          return true;
        }
      }
    }

    // 4. Pinyin phonetic match (with & without tone marks)
    if (cleanPinyin && spokenPinyin) {
      if (spokenPinyin === cleanPinyin || spokenPinyin.includes(cleanPinyin) || cleanPinyin.includes(spokenPinyin)) {
        return true;
      }
    }

    // 5. English keyword match (e.g. child says "hand" for "手" or "six" for "六")
    if (englishRaw) {
      const engWords = englishRaw.toLowerCase().split(/[\s,()\/]+/);
      for (const ew of engWords) {
        if (ew.length >= 2 && normSpoken.toLowerCase().includes(ew)) {
          return true;
        }
      }
    }

    return false;
  }

  // ---- Speech Recognition (Mandarin) with Silent Auto-Restart ----
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
      // Free audio channel before listening
      if (typeof speechSynthesis !== 'undefined') {
        try { speechSynthesis.cancel(); } catch(e) {}
      }
      if (currentAudio) {
        try { currentAudio.pause(); } catch(e) {}
      }

      if (!recognition) {
        const ok = initSpeechRecognition();
        if (!ok) { reject('not-supported'); return; }
      }

      let settled = false;
      let interimResult = '';
      const startTime = Date.now();
      let restartAttempts = 0;
      const MAX_RESTARTS = 3;

      // Generous 8.5s window so children are never rushed
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
      }, 8500);

      recognition.lang = 'zh-CN';

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        const allCandidates = [];

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          for (let j = 0; j < res.length; j++) {
            const tr = res[j].transcript.trim();
            if (tr) allCandidates.push(tr);
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

          // INSTANT 1-WORD MATCH CHECK (Matches immediately on first word!)
          if (targetWord) {
            for (const cand of allCandidates) {
              if (chineseMatch(cand, targetWord)) {
                settled = true;
                clearTimeout(timeoutId);
                try { recognition.stop(); } catch(e) {}
                state.isRecording = false;
                updateMicButton();
                resolve([cand]);
                return;
              }
            }
          }
        }

        if (finalTranscript && !settled) {
          settled = true;
          clearTimeout(timeoutId);
          try { recognition.stop(); } catch(e) {}
          state.isRecording = false;
          updateMicButton();
          resolve(allCandidates.length ? allCandidates : [finalTranscript]);
        }
      };

      recognition.onerror = (event) => {
        if (settled) return;
        const err = event.error;
        const elapsed = Date.now() - startTime;

        // Auto-restart on mobile false silence / early timeout
        if ((err === 'no-speech' || err === 'aborted') && elapsed < 5500 && restartAttempts < MAX_RESTARTS) {
          restartAttempts++;
          setTimeout(() => {
            if (!settled && state.isRecording) {
              try { recognition.start(); } catch(e) {}
            }
          }, 150);
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          settled = true;
          clearTimeout(timeoutId);
          state.isRecording = false;
          updateMicButton();
          reject('permission-denied');
          return;
        }

        if (elapsed >= 5500) {
          settled = true;
          clearTimeout(timeoutId);
          state.isRecording = false;
          updateMicButton();
          if (interimResult) resolve([interimResult]);
          else reject(err);
        }
      };

      recognition.onend = () => {
        if (settled) {
          state.isRecording = false;
          updateMicButton();
          return;
        }

        const elapsed = Date.now() - startTime;
        // If ended early without speech on mobile, keep listening
        if (elapsed < 5500 && restartAttempts < MAX_RESTARTS && state.isRecording) {
          restartAttempts++;
          setTimeout(() => {
            if (!settled && state.isRecording) {
              try { recognition.start(); } catch(e) {}
            }
          }, 150);
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        state.isRecording = false;
        updateMicButton();
        if (interimResult) resolve([interimResult]);
        else reject('no-speech');
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
            state.isRecording = false;
            updateMicButton();
            reject('aborted');
          }
        }, 150);
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
    if (!text) return '';
    return text
      .toString()
      .replace(/\s+/g, '')
      .replace(/[，。！？、“”‘’（）,.!?:;'"_~`@#$%^&*()-+=/\\|<>[\]{}]/g, '')
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
      const isSpecial = !!level.isSpecial;
      const prog = isSpecial
        ? { bestScore: (state.progress[level.id] && state.progress[level.id].bestScore) || 0, completed: false, unlocked: true }
        : (state.progress[level.id] || { bestScore: 0, completed: false, unlocked: level.id === 1 });

      const card = document.createElement('div');
      card.className = `level-card ${isSpecial ? 'special-level-card' : ''} ${prog.unlocked ? '' : 'locked'}`;
      card.style.setProperty('--level-color', level.color);

      let starsHtml = '☆☆☆';
      if (prog.bestScore >= 100) starsHtml = '⭐⭐⭐';
      else if (prog.bestScore >= 90) starsHtml = '⭐⭐☆';
      else if (prog.bestScore >= 80) starsHtml = '⭐☆☆';

      const specialTreeButton = isSpecial ? `
        <div style="margin-top: 0.6rem;">
          <button type="button" class="btn-open-family-tree" id="btn-quick-family-tree">
            🌳 打开亲戚称谓树 (Explore Family Tree) ➔
          </button>
        </div>
      ` : '';

      card.innerHTML = `
        <div class="level-card-header">
          <div class="level-card-icon">${level.icon}</div>
          <div>
            <span class="level-badge-tag">${level.grade}</span>
            <h3 class="level-card-name">${prog.unlocked ? '' : '🔒 '}${isSpecial ? '特别篇: ' : `第 ${level.id} 关: `}${level.name}</h3>
          </div>
        </div>
        <p class="level-card-desc">${level.description}</p>
        ${specialTreeButton}
        <div class="level-card-footer" style="margin-top: 0.6rem;">
          <span class="level-words-count">📚 ${level.vocabulary.length} 个词汇 (${level.vocabulary.length} Words)</span>
          <span class="level-stars-display">${starsHtml}</span>
        </div>
      `;

      if (prog.unlocked) {
        card.addEventListener('click', (e) => {
          if (e.target.closest('#btn-quick-family-tree')) {
            e.stopPropagation();
            SoundEffects.playBubble();
            startFamilyTreeMode();
            return;
          }
          SoundEffects.playBubble();
          selectLevel(level);
        });
      }

      grid.appendChild(card);
    });

    showView('levels');
  }

  // ---- View 8: Special Edition Family Tree Explorer ----
  let currentTreeTab = 'paternal';

  // AI Speech Explanations for all Family Tree Relatives
  const FAMILY_TREE_SPEECH = {
    'yeye': {
      zh: '爷爷，爸爸的爸爸！',
      en: "Grandfather, Dad's Father!"
    },
    'nainai': {
      zh: '奶奶，爸爸的妈妈！',
      en: "Grandmother, Dad's Mother!"
    },
    'waigong': {
      zh: '外公，也可以叫公公或姥爷，妈妈的爸爸！',
      en: "Grandfather, Mom's Father!"
    },
    'waipo': {
      zh: '外婆，也可以叫婆婆或姥姥，妈妈的妈妈！',
      en: "Grandmother, Mom's Mother!"
    },
    'dabo': {
      zh: '大伯，爸爸的哥哥，英语叫 Uncle！',
      en: "Uncle, Dad's elder brother!"
    },
    'bomu': {
      zh: '伯母，大伯的妻子，英语叫 Aunt！',
      en: "Aunt, elder uncle's wife!"
    },
    'baba': {
      zh: '爸爸，我的父亲！',
      en: "Father, Dad!"
    },
    'shushu': {
      zh: '叔叔，爸爸的弟弟，英语叫 Uncle！',
      en: "Uncle, Dad's younger brother!"
    },
    'shenshen': {
      zh: '婶婶，叔叔的妻子，英语叫 Aunt！',
      en: "Aunt, younger uncle's wife!"
    },
    'gugu': {
      zh: '姑姑，爸爸的姐妹，英语叫 Aunt！',
      en: "Aunt, Dad's sister!"
    },
    'guzhang': {
      zh: '姑丈，姑姑的丈夫，英语叫 Uncle！',
      en: "Uncle, Aunt's husband!"
    },
    'jiujiu': {
      zh: '舅舅，妈妈的兄弟，英语叫 Uncle！',
      en: "Uncle, Mom's brother!"
    },
    'jiuma': {
      zh: '舅妈，舅舅的妻子，英语叫 Aunt！',
      en: "Aunt, Mom's brother's wife!"
    },
    'mama': {
      zh: '妈妈，我的母亲！',
      en: "Mother, Mom!"
    },
    'ayi': {
      zh: '阿姨，也可以叫姨妈，妈妈的姐妹，英语叫 Aunt！',
      en: "Aunt, Mom's sister!"
    },
    'yizhang': {
      zh: '姨丈，阿姨的丈夫，英语叫 Uncle！',
      en: "Uncle, Mom's sister's husband!"
    },
    'tangge': {
      zh: '堂哥，大伯或叔叔的儿子，比我大，同姓氏！',
      en: "Cousin, Dad's brother's elder son!"
    },
    'tangjie': {
      zh: '堂姐，大伯或叔叔的女儿，比我大，同姓氏！',
      en: "Cousin, Dad's brother's elder daughter!"
    },
    'tangdi': {
      zh: '堂弟，大伯或叔叔的儿子，比我小，同姓氏！',
      en: "Cousin, Dad's brother's younger son!"
    },
    'tangmei': {
      zh: '堂妹，大伯或叔叔的女儿，比我小，同姓氏！',
      en: "Cousin, Dad's brother's younger daughter!"
    },
    'biaoge_p': {
      zh: '表哥，姑姑的儿子，比我大！',
      en: "Cousin, Dad's sister's elder son!"
    },
    'biaomei_p': {
      zh: '表妹，姑姑的女儿，比我小！',
      en: "Cousin, Dad's sister's younger daughter!"
    },
    'biaoge_m': {
      zh: '表哥，舅舅或阿姨的儿子，比我大！',
      en: "Cousin, Mom's sibling's elder son!"
    },
    'biaojie_m': {
      zh: '表姐，舅舅或阿姨的女儿，比我大！',
      en: "Cousin, Mom's sibling's elder daughter!"
    },
    'biaodi_m': {
      zh: '表弟，舅舅或阿姨的儿子，比我小！',
      en: "Cousin, Mom's sibling's younger son!"
    },
    'biaomei_m': {
      zh: '表妹，舅舅或阿姨的女儿，比我小！',
      en: "Cousin, Mom's sibling's younger daughter!"
    }
  };

  // Dedicated audio player instance with debouncing to prevent mobile interruption
  let globalAudioPlayer = null;
  let lastAudioPlayTime = 0;
  let lastAudioPlayKey = null;
  let audioSequenceTimer = null;

  function setFamilyVoiceMode(mode) {
    state.familyVoiceMode = mode;
    if (typeof SoundEffects !== 'undefined' && SoundEffects.playBubble) {
      try { SoundEffects.playBubble(); } catch(e) {}
    }
    document.querySelectorAll('.voice-pill-btn').forEach(btn => {
      if (btn.getAttribute('data-voice-lang') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  function playPreRecordedAudio(audioPath, onEndedCallback) {
    if (!audioPath) {
      if (onEndedCallback) onEndedCallback();
      return;
    }
    try {
      if (audioSequenceTimer) {
        clearTimeout(audioSequenceTimer);
        audioSequenceTimer = null;
      }
      if (!globalAudioPlayer) {
        globalAudioPlayer = new Audio();
      }
      globalAudioPlayer.pause();
      globalAudioPlayer.currentTime = 0;
      globalAudioPlayer.src = audioPath;
      
      globalAudioPlayer.onended = null;
      if (onEndedCallback) {
        globalAudioPlayer.onended = () => {
          onEndedCallback();
        };
      }

      const playPromise = globalAudioPlayer.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('[Audio] Playback issue:', err);
          if (onEndedCallback) onEndedCallback();
        });
      }
      currentAudio = globalAudioPlayer;
    } catch(e) {
      console.warn('[Audio] Exception during playback:', e);
      if (onEndedCallback) onEndedCallback();
    }
  }

  function playTabAudio(zhKey, enKey) {
    const mode = state.familyVoiceMode || 'bilingual';
    const zhAudio = typeof AUDIO_MANIFEST !== 'undefined' ? AUDIO_MANIFEST[zhKey] : null;
    const enAudio = typeof AUDIO_MANIFEST !== 'undefined' ? AUDIO_MANIFEST[enKey] : null;

    if (mode === 'zh') {
      if (zhAudio) playPreRecordedAudio(zhAudio);
    } else if (mode === 'en') {
      if (enAudio) playPreRecordedAudio(enAudio);
    } else {
      // Bilingual mode: Chinese first, then English
      if (zhAudio) {
        playPreRecordedAudio(zhAudio, () => {
          if (enAudio) {
            audioSequenceTimer = setTimeout(() => {
              playPreRecordedAudio(enAudio);
            }, 300);
          }
        });
      } else if (enAudio) {
        playPreRecordedAudio(enAudio);
      }
    }
  }

  function playRelativeCard(personId, hanzi, specificLang) {
    const now = Date.now();
    const actionKey = personId + '_' + (specificLang || 'auto');
    // Debounce duplicate click/touch calls within 250ms
    if (now - lastAudioPlayTime < 250 && lastAudioPlayKey === actionKey) {
      return;
    }
    lastAudioPlayTime = now;
    lastAudioPlayKey = actionKey;

    if (typeof SoundEffects !== 'undefined' && SoundEffects.playPop) {
      try { SoundEffects.playPop(); } catch(e) {}
    }

    // Highlight card with glowing border
    const allCards = document.querySelectorAll(`.relative-card[data-person-id="${personId}"]`);
    allCards.forEach(c => {
      c.classList.add('playing');
      setTimeout(() => c.classList.remove('playing'), 3000);
    });

    const mode = specificLang || state.familyVoiceMode || 'bilingual';
    const zhKey = (personId === 'me_m' ? 'me_m_desc' : (personId === 'me_p' ? 'me_p_desc' : personId + '_desc'));
    const enKey = (personId === 'me_m' ? 'me_m_en' : (personId === 'me_p' ? 'me_p_en' : personId + '_en'));

    const zhAudio = typeof AUDIO_MANIFEST !== 'undefined' ? (AUDIO_MANIFEST[zhKey] || AUDIO_MANIFEST[hanzi]) : null;
    const enAudio = typeof AUDIO_MANIFEST !== 'undefined' ? AUDIO_MANIFEST[enKey] : null;

    if (mode === 'zh') {
      if (zhAudio) {
        playPreRecordedAudio(zhAudio);
      } else {
        speak(hanzi);
      }
      return;
    }

    if (mode === 'en') {
      if (enAudio) {
        playPreRecordedAudio(enAudio);
      } else {
        const speechInfo = FAMILY_TREE_SPEECH[personId];
        if (speechInfo) speakFallback(speechInfo.en);
      }
      return;
    }

    // Bilingual Mode: Play Chinese explanation, followed immediately by English explanation!
    if (zhAudio) {
      playPreRecordedAudio(zhAudio, () => {
        if (enAudio) {
          audioSequenceTimer = setTimeout(() => {
            playPreRecordedAudio(enAudio);
          }, 300);
        }
      });
    } else if (enAudio) {
      playPreRecordedAudio(enAudio);
    } else {
      const speechInfo = FAMILY_TREE_SPEECH[personId];
      if (speechInfo) {
        speakBilingual(speechInfo.zh, speechInfo.en);
      } else if (hanzi) {
        speak(hanzi);
      }
    }
  }

  function startFamilyTreeMode() {
    currentTreeTab = 'paternal';
    showView('family-tree');
    renderFamilyTree();
    playTabAudio('tab_paternal', 'tab_paternal_en');
  }

  function renderFamilyTree() {
    const tabs = document.querySelectorAll('.tree-tab-btn');
    tabs.forEach(btn => {
      if (btn.getAttribute('data-tab') === currentTreeTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update voice mode active pills
    const mode = state.familyVoiceMode || 'bilingual';
    document.querySelectorAll('.voice-pill-btn').forEach(btn => {
      if (btn.getAttribute('data-voice-lang') === mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    const container = document.getElementById('tree-tab-content');
    if (!container) return;

    if (currentTreeTab === 'guide') {
      renderFamilyTreeGuide(container);
      return;
    }

    const sideData = FAMILY_TREE_DATA[currentTreeTab];
    if (!sideData) return;

    let html = `
      <div class="tree-diagram-container">
        <!-- Tier 1: Grandparents (祖辈) -->
        <div class="tree-tier-title">👑 祖辈 (Grandparents)</div>
        <div class="tree-tier grandparents">
          ${sideData.grandparents.map(person => renderRelativeCard(person)).join('')}
        </div>

        <div class="tree-connector"></div>

        <!-- Tier 2: Parents & Uncles / Aunts (父辈 / 叔伯姑舅姨) -->
        <div class="tree-tier-title">👨‍👩‍👧‍👦 父辈 / 叔伯姑姨 (Parents, Uncles & Aunts)</div>
        <div class="tree-tier parents-uncles">
          ${sideData.parentsAndUncles.map(person => renderRelativeCard(person)).join('')}
        </div>

        <div class="tree-connector"></div>

        <!-- Tier 3: Cousins & Me (同辈 / 堂表兄弟姐妹) -->
        <div class="tree-tier-title">👶 同辈与堂表亲 (Me, Siblings & Cousins)</div>
        <div class="tree-tier cousins">
          ${sideData.cousins.map(person => renderRelativeCard(person)).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  function renderRelativeCard(person) {
    const isMe = person.hanzi === '我';
    const avatar = isMe ? (state.userAvatar || '🐼') : person.emoji;
    const nameDisplay = isMe ? (state.userName || '我') : person.hanzi;

    return `
      <div class="relative-card ${isMe ? 'is-me' : ''}" data-person-id="${person.id}" data-hanzi="${person.hanzi}" onclick="App.playRelativeCard('${person.id}', '${person.hanzi}')" title="点击听讲解 (Click to listen)">
        <span class="relative-sound-icon">🔊</span>
        <div class="relative-avatar">${avatar}</div>
        <div class="relative-hanzi">${nameDisplay}</div>
        <div class="relative-pinyin">${person.pinyin}</div>
        <div class="relative-english">${person.english}</div>
        <div class="relative-relation-pill">${person.relation || person.role}</div>
        <div class="card-lang-btns">
          <button type="button" class="card-lang-btn zh" onclick="event.stopPropagation(); App.playRelativeCard('${person.id}', '${person.hanzi}', 'zh');" title="听中文讲解 (Chinese)">🇨🇳 中文</button>
          <button type="button" class="card-lang-btn en" onclick="event.stopPropagation(); App.playRelativeCard('${person.id}', '${person.hanzi}', 'en');" title="Listen English Explanation">🇬🇧 ENG</button>
        </div>
      </div>
    `;
  }

  function playGuideCard(pointId, specificLang) {
    const now = Date.now();
    const actionKey = pointId + '_' + (specificLang || 'auto');
    if (now - lastAudioPlayTime < 250 && lastAudioPlayKey === actionKey) {
      return;
    }
    lastAudioPlayTime = now;
    lastAudioPlayKey = actionKey;

    if (typeof SoundEffects !== 'undefined' && SoundEffects.playPop) {
      try { SoundEffects.playPop(); } catch(e) {}
    }

    const card = document.querySelector(`.guide-point-card[data-point-id="${pointId}"]`);
    if (card) {
      card.classList.add('playing');
      setTimeout(() => card.classList.remove('playing'), 3000);
    }

    const mode = specificLang || state.familyVoiceMode || 'bilingual';
    const zhKey = pointId + '_zh';
    const enKey = pointId + '_en';

    const zhAudio = typeof AUDIO_MANIFEST !== 'undefined' ? AUDIO_MANIFEST[zhKey] : null;
    const enAudio = typeof AUDIO_MANIFEST !== 'undefined' ? AUDIO_MANIFEST[enKey] : null;

    if (mode === 'zh') {
      if (zhAudio) playPreRecordedAudio(zhAudio);
      return;
    }

    if (mode === 'en') {
      if (enAudio) playPreRecordedAudio(enAudio);
      return;
    }

    // Bilingual Mode: Play Chinese first, then English!
    if (zhAudio) {
      playPreRecordedAudio(zhAudio, () => {
        if (enAudio) {
          audioSequenceTimer = setTimeout(() => {
            playPreRecordedAudio(enAudio);
          }, 300);
        }
      });
    } else if (enAudio) {
      playPreRecordedAudio(enAudio);
    }
  }

  function renderFamilyTreeGuide(container) {
    const tips = FAMILY_TREE_DATA.comparisonTips;
    let html = `<div class="guide-comparison-wrap">`;

    tips.forEach(tip => {
      html += `
        <div class="guide-box">
          <div class="guide-box-header">
            <div class="guide-box-title">${tip.title}</div>
            <div class="guide-box-desc">${tip.desc}</div>
          </div>
          <div class="guide-points-grid">
            ${tip.points.map(pt => `
              <div class="guide-point-card" data-point-id="${pt.id}" onclick="App.playGuideCard('${pt.id}')" title="点击听讲解 (Click to listen)">
                <div class="guide-point-header">
                  <span class="guide-point-label">🔊 ${pt.label}</span>
                  <div class="card-lang-btns mini">
                    <button type="button" class="card-lang-btn zh" onclick="event.stopPropagation(); App.playGuideCard('${pt.id}', 'zh');" title="听中文讲解 (Chinese)">🇨🇳 中文</button>
                    <button type="button" class="card-lang-btn en" onclick="event.stopPropagation(); App.playGuideCard('${pt.id}', 'en');" title="Listen English Explanation">🇬🇧 ENG</button>
                  </div>
                </div>
                <span class="guide-point-meaning">${pt.meaning}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
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
    // Personal Pronouns (人称代词)
    '我': ['丿 (平撇 ↙)', '一 (横 ➔)', '亅 (竖钩 ↓)', '㇀ (提 ↗)', '㇂ (斜钩 ↘)', '丿 (撇 ↙)', '丶 (点 ↘)'],
    '你': ['丿 (撇 ↙)', '丨 (竖 ↓)', '丿 (短撇 ↙)', '㇇ (横撇 ➔↙)', '亅 (竖钩 ↓)', '丿 (撇 ↙)', '丶 (点 ↘)'],
    '他': ['丿 (撇 ↙)', '丨 (竖 ↓)', '𠃌 (横折钩 ➔↳)', '丨 (竖 ↓)', '乚 (竖弯钩 ↳)'],
    '她': ['𡿨 (撇点 ↙↘)', '丿 (撇 ↙)', '一 (提 ↗)', '𠃌 (横折钩 ➔↳)', '丨 (竖 ↓)', '乚 (竖弯钩 ↳)'],
    '它': ['丶 (点 ↘)', '丶 (点 ↘)', '乛 (横钩 ➔↙)', '丿 (撇 ↙)', '乚 (竖弯钩 ↳)'],
    '们': ['丿 (撇 ↙)', '丨 (竖 ↓)', '丶 (点 ↘)', '丨 (竖 ↓)', '𠃍 (横折钩 ➔↓)'],
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
      if (i === 2) continue; // Box 2 is HanziWriter quiz — skip raw canvas init
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

  // ---- HanziWriter Quiz Box (Box 2) ----
  function destroyQuizBox() {
    if (quizWriterInstance) {
      try { quizWriterInstance.cancelQuiz(); } catch(e) {}
      quizWriterInstance = null;
    }
    quizBoxPassed = false;
    quizTotalMistakes = 0;
    const target = document.getElementById('hanzi-quiz-target');
    if (target) target.innerHTML = '';
    const feedback = document.getElementById('quiz-stroke-feedback');
    if (feedback) feedback.innerHTML = '';
    const star = document.getElementById('quad-star-2');
    if (star) star.textContent = '☆';
    const card = document.getElementById('quad-card-2');
    if (card) card.classList.remove('completed');
    const box = document.getElementById('quad-box-2');
    if (box) box.classList.remove('pass-glow', 'shake-error');
    state.quadCompleted[2] = false;
  }

  function initQuizBox(char) {
    destroyQuizBox();

    const target = document.getElementById('hanzi-quiz-target');
    if (!target || typeof HanziWriter === 'undefined') return;

    // Size quiz to fit the box
    const parentBox = document.getElementById('quad-box-2');
    const boxRect = parentBox ? parentBox.getBoundingClientRect() : { width: 220, height: 220 };
    const size = Math.min(boxRect.width, boxRect.height) || 220;

    quizWriterInstance = HanziWriter.create('hanzi-quiz-target', char, {
      width: size,
      height: size,
      padding: 10,
      showCharacter: false,
      showOutline: true,
      strokeColor: '#2D3436',
      drawingColor: '#10B981',
      outlineColor: '#CBD5E1',
      highlightColor: '#3B82F6',
      showHintAfterMisses: 2,
      highlightOnComplete: true,
      drawingWidth: 18,
      strokeHighlightSpeed: 1.5,
    });

    const feedback = document.getElementById('quiz-stroke-feedback');

    quizWriterInstance.quiz({
      onCorrectStroke: function(strokeData) {
        if (typeof SoundEffects !== 'undefined' && SoundEffects.playPop) {
          try { SoundEffects.playPop(); } catch(e) {}
        }
        if (feedback) {
          feedback.innerHTML = `<span class="quiz-fb-correct">✓ 第 ${strokeData.strokeNum + 1} 画正确！(Stroke ${strokeData.strokeNum + 1} correct!)</span>`;
          feedback.className = 'quiz-stroke-feedback show correct';
        }
      },
      onMistake: function(strokeData) {
        quizTotalMistakes++;
        if (typeof SoundEffects !== 'undefined' && SoundEffects.playTryAgain) {
          try { SoundEffects.playTryAgain(); } catch(e) {}
        }
        if (feedback) {
          const hint = strokeData.mistakesOnStroke >= 2
            ? '💡 看提示吧！(Look at the hint!)'
            : '🤔 笔画不对哦，再试一次！(Wrong stroke, try again!)';
          feedback.innerHTML = `<span class="quiz-fb-wrong">${hint}</span>`;
          feedback.className = 'quiz-stroke-feedback show wrong';
        }
      },
      onComplete: function(summaryData) {
        quizBoxPassed = true;
        quizTotalMistakes = summaryData.totalMistakes;
        state.quadCompleted[2] = true;

        if (typeof SoundEffects !== 'undefined' && SoundEffects.playVictory) {
          try { SoundEffects.playVictory(); } catch(e) {}
        }

        const star = document.getElementById('quad-star-2');
        if (star) star.textContent = '⭐';
        const card = document.getElementById('quad-card-2');
        if (card) card.classList.add('completed');
        const box = document.getElementById('quad-box-2');
        if (box) box.classList.add('pass-glow');

        if (feedback) {
          const praise = summaryData.totalMistakes === 0
            ? '🌟 满分！笔画全对！(Perfect! All strokes correct!)'
            : `🎉 写完啦！错了 ${summaryData.totalMistakes} 次 (Done! ${summaryData.totalMistakes} mistakes)`;
          feedback.innerHTML = `<span class="quiz-fb-complete">${praise}</span>`;
          feedback.className = 'quiz-stroke-feedback show complete';
        }
      }
    });
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
    if (!state.quadBoxStrokes) state.quadBoxStrokes = { 1: 0, 2: 0, 3: 0, 4: 0 };
    state.quadBoxStrokes[boxNum] = (state.quadBoxStrokes[boxNum] || 0) + 1;

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

    if (idx === 2) {
      // Re-initialize the HanziWriter quiz for Box 2
      const word = state.currentLevel.vocabulary[state.currentWriteIndex];
      const chars = Array.from(word.hanzi);
      const currentChar = chars[state.currentCharIndex] || word.hanzi;
      initQuizBox(currentChar);
      const fb = document.getElementById('write-feedback');
      if (fb) fb.classList.add('hidden');
      return;
    }

    const canvas = quadCanvases[idx - 1];
    const ctx = quadContexts[idx - 1];
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    state.quadCompleted[idx] = false;
    if (state.quadBoxStrokes) state.quadBoxStrokes[idx] = 0;

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
    state.quadBoxStrokes = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (let i = 1; i <= 4; i++) {
      if (i === 2) continue; // Skip quiz box, handled separately
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
    // Re-init quiz box
    const word = state.currentLevel ? state.currentLevel.vocabulary[state.currentWriteIndex] : null;
    if (word) {
      const chars = Array.from(word.hanzi);
      const currentChar = chars[state.currentCharIndex] || word.hanzi;
      initQuizBox(currentChar);
    } else {
      destroyQuizBox();
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

    // Multi-char tabs (deduplicate identical chars like 妈妈 → just 妈)
    const chars = Array.from(word.hanzi);
    const uniqueChars = [...new Set(chars)];
    const charTabsRow = document.getElementById('write-char-tabs');
    if (uniqueChars.length > 1) {
      charTabsRow.classList.remove('hidden');
      charTabsRow.innerHTML = uniqueChars.map((c, i) => `
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

    const currentChar = uniqueChars[state.currentCharIndex] || word.hanzi;

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

  // NOTE: Old CHAR_STROKE_COUNT and verifyWritingAccuracy pixel heuristic removed.
  // Box 2 now uses HanziWriter quiz() for real stroke-by-stroke AI validation.


  function showWriteFeedback(message, type) {
    const el = document.getElementById('write-feedback');
    if (!el) return;

    el.textContent = message;
    el.className = `write-feedback ${type}`;
    el.classList.remove('hidden');
  }

  // Basic shape check for free practice boxes (not as strict as AI quiz, but catches random scribbles)
  function basicShapeCheck(canvas, expectedChar) {
    if (!canvas) return { drawn: false, pass: false };
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Count drawn pixels
    const drawnData = ctx.getImageData(0, 0, w, h).data;
    let drawnPts = [];
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        if (drawnData[(y * w + x) * 4 + 3] > 40) {
          drawnPts.push({ x, y });
        }
      }
    }

    if (drawnPts.length < 15) {
      return { drawn: false, pass: false, msg: '✏️ 还没写字哦！(Please write first!)' };
    }

    // Render expected character on offscreen canvas for comparison
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const oc = off.getContext('2d');
    const fontSize = Math.round(w * 0.65);
    oc.fillStyle = '#000';
    oc.font = `900 ${fontSize}px 'Noto Sans SC', 'Microsoft YaHei', sans-serif`;
    oc.textAlign = 'center';
    oc.textBaseline = 'middle';
    oc.fillText(expectedChar, w / 2, h / 2);

    const refData = oc.getImageData(0, 0, w, h).data;
    let refPts = [];
    for (let y = 0; y < h; y += 4) {
      for (let x = 0; x < w; x += 4) {
        if (refData[(y * w + x) * 4 + 3] > 30) {
          refPts.push({ x, y });
        }
      }
    }

    if (refPts.length === 0) return { drawn: true, pass: true, msg: '' };

    // Check overlap with generous tolerance
    const TOL = Math.max(18, Math.round(w * 0.09));
    const TOL_SQ = TOL * TOL;

    // Accuracy: how many drawn pixels are near the reference?
    let nearRef = 0;
    for (const dp of drawnPts) {
      for (const rp of refPts) {
        if ((dp.x - rp.x) ** 2 + (dp.y - rp.y) ** 2 <= TOL_SQ) { nearRef++; break; }
      }
    }
    const accuracy = nearRef / drawnPts.length;

    // Coverage: how much of the reference is covered by drawing?
    let covered = 0;
    for (const rp of refPts) {
      for (const dp of drawnPts) {
        if ((dp.x - rp.x) ** 2 + (dp.y - rp.y) ** 2 <= TOL_SQ) { covered++; break; }
      }
    }
    const coverage = covered / refPts.length;

    // Require 45% accuracy and 30% coverage — lenient but catches random circles
    if (accuracy < 0.45 || coverage < 0.30) {
      return {
        drawn: true, pass: false,
        msg: `🤔 写的不太像'${expectedChar}'哦，请认真写！(Doesn't look like '${expectedChar}', try again!)`
      };
    }

    return { drawn: true, pass: true, msg: '' };
  }

  function finishWriting() {
    const word = state.currentLevel.vocabulary[state.currentWriteIndex];
    const chars = Array.from(word.hanzi);
    const uniqueChars = [...new Set(chars)];
    const currentChar = uniqueChars[state.currentCharIndex] || word.hanzi;

    // ---- CHECK BOX 2: AI QUIZ (MANDATORY) ----
    if (!quizBoxPassed) {
      SoundEffects.playTryAgain();
      const box2 = document.getElementById('quad-box-2');
      if (box2) box2.classList.add('shake-error');
      setTimeout(() => { if (box2) box2.classList.remove('shake-error'); }, 600);
      showWriteFeedback('🤖 请先完成第 2 格 AI 验证！用正确笔画写完字哦！(Please complete the AI Quiz in Box 2 first!)', 'retry');
      return;
    }

    // ---- CHECK FREE PRACTICE BOXES (1, 3, 4): basic shape check ----
    let freeBoxesDone = 0;
    let firstFail = null;
    for (const i of [1, 3, 4]) {
      const canvas = quadCanvases[i - 1];
      const box = document.getElementById(`quad-box-${i}`);
      const star = document.getElementById(`quad-star-${i}`);
      const card = document.getElementById(`quad-card-${i}`);

      if (box) box.classList.remove('pass-glow', 'shake-error');

      const check = basicShapeCheck(canvas, currentChar);

      if (check.drawn && check.pass) {
        freeBoxesDone++;
        state.quadCompleted[i] = true;
        if (star) star.textContent = '⭐';
        if (card) card.classList.add('completed');
        if (box) box.classList.add('pass-glow');
      } else if (check.drawn && !check.pass) {
        // Drawn but doesn't look right
        state.quadCompleted[i] = false;
        if (star) star.textContent = '☆';
        if (card) card.classList.remove('completed');
        if (box) box.classList.add('shake-error');
        if (!firstFail) firstFail = { box: i, msg: check.msg };
      } else {
        // Not drawn yet
        state.quadCompleted[i] = false;
        if (star) star.textContent = '☆';
        if (card) card.classList.remove('completed');
      }
    }

    if (firstFail) {
      SoundEffects.playTryAgain();
      showWriteFeedback(`第 ${firstFail.box} 格：${firstFail.msg}`, 'retry');
      return;
    }

    // All 4 boxes done (quiz passed + 3 free boxes with shape check)
    if (freeBoxesDone >= 3) {
      SoundEffects.playVictory();
      const mistakeText = quizTotalMistakes === 0
        ? '满分！AI 验证全对！'
        : `AI 验证通过 (${quizTotalMistakes} 次修改)`;
      showWriteFeedback(`🎉 太棒了！4个格子全部完成！${mistakeText} (All 4 boxes completed! Excellent!) ⭐⭐⭐⭐`, 'success');
      speakDynamic('太棒了！');

      // If multi-character word and has remaining unique character
      if (state.currentCharIndex < uniqueChars.length - 1) {
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
    } else {
      SoundEffects.playPop();
      const remaining = 3 - freeBoxesDone;
      showWriteFeedback(`👍 AI 验证已通过！请把剩下 ${remaining} 个练习格也写完吧！(AI passed! Please fill the remaining ${remaining} practice boxes!)`, 'success');
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

    if (feedbackEl) feedbackEl.classList.add('hidden');
    if (retryBtn) retryBtn.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');

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
        const avatarInput = document.getElementById('selected-avatar-input');
        const chosenAvatar = (avatarInput && avatarInput.value) ? avatarInput.value : (state.userAvatar || '👧');
        saveUserProfile(idInput ? idInput.value : '', nameInput.value, chosenAvatar);
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

    // Avatar choice buttons with instant touch & click delegation
    const avatarGrid = document.getElementById('avatar-picker-grid');
    if (avatarGrid) {
      const handleAvatarSelect = (e) => {
        const btn = e.target.closest('.avatar-choice-btn');
        if (btn) {
          e.preventDefault();
          const av = btn.getAttribute('data-avatar');
          if (av) selectAvatar(av);
        }
      };
      avatarGrid.addEventListener('click', handleAvatarSelect);
      avatarGrid.addEventListener('touchend', handleAvatarSelect);
    }

    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', (e) => {
        const idInput = document.getElementById('profile-id-input');
        const nameInput = document.getElementById('user-name-input');
        const avatarInput = document.getElementById('selected-avatar-input');
        if (nameInput && nameInput.value.trim()) {
          e.preventDefault();
          const chosenAvatar = (avatarInput && avatarInput.value) ? avatarInput.value : (state.userAvatar || '👧');
          saveUserProfile(idInput ? idInput.value : '', nameInput.value, chosenAvatar);
        }
      });
    }

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

    // Family Tree Tab Buttons
    document.querySelectorAll('.tree-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        SoundEffects.playBubble();
        const tab = btn.getAttribute('data-tab');
        if (tab) {
          currentTreeTab = tab;
          renderFamilyTree();
          if (tab === 'paternal') {
            playTabAudio('tab_paternal', 'tab_paternal_en');
          } else if (tab === 'maternal') {
            playTabAudio('tab_maternal', 'tab_maternal_en');
          } else if (tab === 'guide') {
            playTabAudio('tab_guide', 'tab_guide_en');
          }
        }
      });
    });

    const familyTreeBackBtn = document.getElementById('family-tree-back-btn');
    if (familyTreeBackBtn) {
      familyTreeBackBtn.addEventListener('click', goToLevels);
    }

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
    speakBilingual,
    goToLevels,
    goToModes,
    selectAvatar,
    startFamilyTreeMode,
    playRelativeCard,
    playGuideCard,
    setFamilyVoiceMode
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
