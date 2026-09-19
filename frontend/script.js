/* ==========================================================================
   AI CONTENT ANALYZER - COMPLETE INTERACTIVE FRONTEND LOGIC
   Fully Functional Prototype (Dark/Light Modes, Modals, Tabs, Dynamic Data)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Mock Dataset for Sessions
  const SESSIONS_DATA = {
    'session-1': {
      title: 'How Black Holes Work',
      badgeClass: 'youtube',
      badgeText: '🔴 YouTube',
      date: 'May 12, 2024 • 18:42',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
      overview: 'The video explains what black holes are, how massive stellar collapse forms them, and the physics governing the event horizon. It breaks down complex astrophysics concepts using clear visual simulations.',
      keyPoints: [
        '<strong>Stellar Core Collapse:</strong> Supermassive stars collapse under intense gravity when nuclear fusion ceases.',
        '<strong>Event Horizon:</strong> The boundary where escape velocity exceeds light speed.',
        '<strong>Accretion Disk Dynamics:</strong> Superheated gas and dust orbiting the black hole glow brightly in X-ray spectrums.'
      ],
      timeline: [
        { time: '00:00 — 02:15', title: 'Introduction to Gravitational Collapse', desc: 'Overview of massive stars before stellar death.' },
        { time: '02:15 — 06:40', title: 'Event Horizon Geometry & Schwarzschild Radius', desc: 'Detailed explanation of space curvature and light-bending.' },
        { time: '06:40 — 12:10', title: 'Accretion Disks and Relativistic Jets', desc: 'How superheated matter emits high-energy X-rays.' }
      ],
      speech: 'Narration is paced clearly with precise astrophysics terminology. Analogies like "trampoline bowling balls" are used.',
      visual: 'Combines 3D ray-tracing simulations with infrared telescope captures. High-contrast diagrams highlight photon spheres.',
      entities: ['General Relativity', 'Schwarzschild Radius', 'Event Horizon Telescope', 'Accretion Disk', 'Hawking Radiation']
    },
    'session-2': {
      title: 'The Power of Habits',
      badgeClass: 'facebook',
      badgeText: '🔵 Facebook',
      date: 'May 10, 2024 • 10:15',
      image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80',
      overview: 'An insightful presentation on habit loops (Cue, Craving, Response, Reward) and practical strategies for behavioral change.',
      keyPoints: [
        '<strong>The Habit Loop:</strong> Every habit is triggered by a cue and sustained by rewards.',
        '<strong>Identity-Based Habits:</strong> Focus on who you wish to become rather than outcome goals.',
        '<strong>Environment Design:</strong> Make positive cues obvious and friction-free.'
      ],
      timeline: [
        { time: '00:00 — 03:00', title: 'Neurology of Habits', desc: 'Basal ganglia role in routine formation.' },
        { time: '03:00 — 07:30', title: 'Friction & Environment', desc: 'Optimizing physical environment for focus.' }
      ],
      speech: 'Engaging, conversational tone with actionable self-improvement tips.',
      visual: 'Animated graphics showing cognitive habit loops and flowcharts.',
      entities: ['Habit Loop', 'Dopamine Cycle', 'Behavioral Psychology', 'Atomic Habits']
    },
    'session-3': {
      title: 'Project Design Diagram',
      badgeClass: 'image',
      badgeText: '🖼️ Image',
      date: 'May 8, 2024 • 03:24',
      image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400&q=80',
      overview: 'High-level architecture schema for a distributed cloud application with microservices, Redis caching, and PostgreSQL data stores.',
      keyPoints: [
        '<strong>API Gateway Pattern:</strong> Single entry point for routing and rate limiting.',
        '<strong>Caching Layer:</strong> In-memory Redis cluster reducing DB load by 75%.',
        '<strong>Asynchronous Queues:</strong> Worker nodes processing event logs via RabbitMQ.'
      ],
      timeline: [
        { time: 'Top Left', title: 'Client & Gateway Layer', desc: 'Web & PWA client entrypoints.' },
        { time: 'Center', title: 'Microservices Mesh', desc: 'Decoupled auth, payment, and analysis services.' }
      ],
      speech: 'N/A (Image analysis mode). OCR text extracted accurately.',
      visual: 'Vector diagram with distinct color-coded service boundaries.',
      entities: ['Microservices', 'API Gateway', 'Redis Cache', 'PostgreSQL', 'Docker']
    },
    'session-4': {
      title: 'Architectural History Overview',
      badgeClass: 'youtube',
      badgeText: '🔴 YouTube',
      date: 'May 5, 2024 • 22:17',
      image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
      overview: 'A visual journey through classical, gothic, and modern architectural evolutions, highlighting structural innovations.',
      keyPoints: [
        '<strong>Gothic Vaulting:</strong> Pointed arches allowing taller structures and larger stained glass windows.',
        '<strong>Modernist Steel Frameworks:</strong> Industrial age enabling skyscraper construction.'
      ],
      timeline: [
        { time: '00:00 — 08:00', title: 'Ancient Greco-Roman Pillars', desc: 'Doric, Ionic, and Corinthian order analysis.' },
        { time: '08:00 — 22:17', title: 'Industrial Revolution & Steel', desc: 'Transition to iron and reinforced concrete.' }
      ],
      speech: 'Academic and structured presentation with classical music background.',
      visual: 'High resolution 4K footage of historical basilicas and modern towers.',
      entities: ['Gothic Architecture', 'Flying Buttress', 'Modernism', 'Concrete Vaulting']
    }
  };

  // State Management
  let currentTheme = 'dark';
  let activeTab = 'youtube';
  let activeSessionId = 'session-1';

  // DOM Handles
  const app = document.getElementById('app');
  const sidebar = document.getElementById('sidebar');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const themeToggleLight = document.getElementById('themeToggleLight');
  const themeToggleDark = document.getElementById('themeToggleDark');
  const userProfileBtn = document.getElementById('userProfileBtn');

  // Navigation Items
  const navNewAnalysisBtn = document.getElementById('navNewAnalysisBtn');
  const navHome = document.getElementById('navHome');
  const navSessions = document.getElementById('navSessions');
  const navFavorites = document.getElementById('navFavorites');
  const navSettings = document.getElementById('navSettings');
  const viewAllLink = document.getElementById('viewAllLink');

  // Views
  const viewHome = document.getElementById('viewHome');
  const viewLoading = document.getElementById('viewLoading');
  const viewAnalysis = document.getElementById('viewAnalysis');
  const chatPanel = document.getElementById('chatPanel');

  // Input & Dropzone
  const sourceTabs = document.querySelectorAll('.tab-btn');
  const inputActionCard = document.getElementById('inputActionCard');
  const urlInputField = document.getElementById('urlInputField');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const imageDropzone = document.getElementById('imageDropzone');
  const imageFileInput = document.getElementById('imageFileInput');
  const dropzoneText = document.getElementById('dropzoneText');

  // Dynamic Analysis View Elements
  const sessionHeaderTitle = document.getElementById('sessionHeaderTitle');
  const sessionHeaderDesc = document.getElementById('sessionHeaderDesc');
  const sessionHeaderImage = document.getElementById('sessionHeaderImage');
  const sessionHeaderBadge = document.getElementById('sessionHeaderBadge');
  const sessionHeaderDate = document.getElementById('sessionHeaderDate');
  const analysisOverview = document.getElementById('analysisOverview');
  const analysisKeyPoints = document.getElementById('analysisKeyPoints');
  const analysisTimeline = document.getElementById('analysisTimeline');
  const analysisSpeech = document.getElementById('analysisSpeech');
  const analysisVisual = document.getElementById('analysisVisual');
  const analysisEntities = document.getElementById('analysisEntities');

  // Chat Elements
  const chatMiniTitle = document.getElementById('chatMiniTitle');
  const chatMiniThumb = document.getElementById('chatMiniThumb');
  const chatMiniMeta = document.getElementById('chatMiniMeta');
  const chatMessagesStream = document.getElementById('chatMessagesStream');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatExpandBtn = document.getElementById('chatExpandBtn');
  const chatAttachBtn = document.getElementById('chatAttachBtn');

  // Modals & Toasts
  const modalBackdrop = document.getElementById('modalBackdrop');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalTitle = document.getElementById('modalTitle');
  const settingOwnerInput = document.getElementById('settingOwnerInput');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastNotification = document.getElementById('toastNotification');

  // --- 1. Theme Management ---
  function setTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      themeToggleDark.classList.add('active');
      themeToggleLight.classList.remove('active');
    } else {
      themeToggleLight.classList.add('active');
      themeToggleDark.classList.remove('active');
    }
  }

  themeToggleDark.addEventListener('click', () => {
    setTheme('dark');
    showToast('Switched to Dark Theme');
  });
  
  themeToggleLight.addEventListener('click', () => {
    setTheme('light');
    showToast('Switched to Light Theme');
  });

  // --- 2. Toast System ---
  function showToast(message) {
    toastNotification.innerText = message;
    toastNotification.style.display = 'block';
    setTimeout(() => {
      toastNotification.style.display = 'none';
    }, 2500);
  }

  // --- 3. View Switcher ---
  function setActiveNav(activeBtn) {
    [navHome, navSessions, navFavorites, navSettings].forEach(nav => nav && nav.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');
  }

  function showHomeView() {
    viewHome.style.display = 'block';
    viewLoading.classList.remove('active');
    viewAnalysis.classList.remove('active');
    app.classList.remove('has-chat-panel');
    chatPanel.style.display = 'none';
    setActiveNav(navHome);
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
  }

  function showLoadingView(onComplete) {
    viewHome.style.display = 'none';
    viewLoading.classList.add('active');
    viewAnalysis.classList.remove('active');
    app.classList.remove('has-chat-panel');
    chatPanel.style.display = 'none';

    const steps = document.querySelectorAll('.loading-step-item');
    steps.forEach(step => step.classList.remove('done', 'active'));

    if (steps[0]) steps[0].classList.add('active');
    setTimeout(() => { if (steps[0]) steps[0].classList.replace('active', 'done'); if (steps[1]) steps[1].classList.add('active'); }, 500);
    setTimeout(() => { if (steps[1]) steps[1].classList.replace('active', 'done'); if (steps[2]) steps[2].classList.add('active'); }, 1000);
    setTimeout(() => { if (steps[2]) steps[2].classList.replace('active', 'done'); if (steps[3]) steps[3].classList.add('active'); }, 1500);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 2000);
  }

  function renderSessionData(sessionId) {
    activeSessionId = sessionId;
    const data = SESSIONS_DATA[sessionId] || SESSIONS_DATA['session-1'];

    sessionHeaderTitle.innerText = data.title;
    sessionHeaderDesc.innerText = data.overview;
    sessionHeaderImage.src = data.image;
    sessionHeaderBadge.className = `source-badge ${data.badgeClass}`;
    sessionHeaderBadge.innerText = data.badgeText;
    sessionHeaderDate.innerText = data.date;
    analysisOverview.innerText = data.overview;

    // Key points
    analysisKeyPoints.innerHTML = data.keyPoints.map(kp => `
      <li class="key-point-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${kp}</span>
      </li>
    `).join('');

    // Timeline
    analysisTimeline.innerHTML = data.timeline.map(t => `
      <div class="timeline-item" data-time="${t.time}" data-topic="${escapeHTML(t.title)}">
        <span class="timestamp-tag">${t.time}</span>
        <div class="timeline-content">
          <h5>${t.title}</h5>
          <p>${t.desc}</p>
        </div>
      </div>
    `).join('');

    // Re-bind timeline clicks
    document.querySelectorAll('.timeline-item').forEach(item => {
      item.addEventListener('click', () => {
        const time = item.dataset.time;
        const topic = item.dataset.topic;
        appendUserMessage(`Explain the segment at ${time} regarding "${topic}".`);
        setTimeout(() => {
          appendAIMessage(`At ${time}, the content covers "${topic}". The analysis shows high confidence key insights.`);
        }, 600);
      });
    });

    // Speech & Visual
    analysisSpeech.innerText = data.speech;
    analysisVisual.innerText = data.visual;

    // Entities
    analysisEntities.innerHTML = data.entities.map(e => `<span class="tag-pill">${e}</span>`).join('');
    document.querySelectorAll('.tag-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        appendUserMessage(`Tell me more about ${pill.innerText}.`);
        setTimeout(() => {
          appendAIMessage(`"${pill.innerText}" is a key topic identified in this session's knowledge memory.`);
        }, 600);
      });
    });

    // Chat Mini Badge
    chatMiniTitle.innerText = data.title;
    chatMiniThumb.src = data.image;
    chatMiniMeta.innerText = `${data.badgeText} • ${data.date}`;

    // Highlight sidebar history item
    document.querySelectorAll('.history-item').forEach(h => {
      h.classList.toggle('active', h.dataset.id === sessionId);
    });
  }

  function showAnalysisView(sessionId = 'session-1') {
    renderSessionData(sessionId);
    viewHome.style.display = 'none';
    viewLoading.classList.remove('active');
    viewAnalysis.classList.add('active');
    app.classList.add('has-chat-panel');
    chatPanel.style.display = 'flex';
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
  }

  // Navigation Click Handlers
  navNewAnalysisBtn.addEventListener('click', () => {
    urlInputField.value = '';
    showHomeView();
    showToast('Started new analysis session');
  });

  navHome.addEventListener('click', showHomeView);
  
  navSessions.addEventListener('click', () => {
    showHomeView();
    document.getElementById('recentSessionsGrid').scrollIntoView({ behavior: 'smooth' });
    setActiveNav(navSessions);
  });

  navFavorites.addEventListener('click', () => {
    showHomeView();
    setActiveNav(navFavorites);
    showToast('Showing favorited sessions');
  });

  navSettings.addEventListener('click', () => {
    openModal('Settings & Workspace');
    setActiveNav(navSettings);
  });

  if (viewAllLink) {
    viewAllLink.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('recentSessionsGrid').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // --- 4. Mobile Drawer ---
  mobileMenuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // --- 5. Source Tabs & Drag & Drop ---
  sourceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      sourceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.target;

      if (activeTab === 'image') {
        inputActionCard.style.display = 'none';
        imageDropzone.classList.add('active-tab');
      } else {
        inputActionCard.style.display = 'flex';
        imageDropzone.classList.remove('active-tab');

        if (activeTab === 'youtube') {
          urlInputField.placeholder = 'Paste YouTube URL (e.g. https://youtube.com/watch?v=...)';
        } else if (activeTab === 'facebook') {
          urlInputField.placeholder = 'Paste Facebook public video URL...';
        } else {
          urlInputField.placeholder = 'Paste any supported content URL here...';
        }
      }
    });
  });

  // Image Dropzone file picker
  imageDropzone.addEventListener('click', () => {
    imageFileInput.click();
  });

  imageFileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      dropzoneText.innerHTML = `<h4>Selected: ${escapeHTML(file.name)}</h4><p>${(file.size / 1024).toFixed(1)} KB — Click Analyze to process image</p>`;
      showToast(`Selected image file: ${file.name}`);
    }
  });

  // Analyze Submit Handler
  function handleAnalyzeSubmit() {
    if (activeTab === 'image') {
      if (!imageFileInput.files || !imageFileInput.files[0]) {
        showToast('⚠️ Please select an image file first!');
        imageDropzone.style.borderColor = '#EF4444';
        setTimeout(() => imageDropzone.style.borderColor = '', 2000);
        return;
      }
      showLoadingView(() => showAnalysisView('session-3'));
      return;
    }

    const val = urlInputField.value.trim();
    if (!val) {
      showToast('⚠️ Please enter a YouTube or Facebook URL first!');
      inputActionCard.style.borderColor = '#EF4444';
      setTimeout(() => inputActionCard.style.borderColor = '', 2000);
      return;
    }

    showToast('Processing media URL with Gemini AI...');
    showLoadingView(() => showAnalysisView('session-1'));
  }

  analyzeBtn.addEventListener('click', handleAnalyzeSubmit);
  urlInputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAnalyzeSubmit();
  });

  // Sidebar History & Recent Session Cards Click Handlers
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const sessionId = item.dataset.id;
      showAnalysisView(sessionId);
      showToast(`Loaded ${item.innerText.trim()}`);
    });
  });

  document.querySelectorAll('.session-card').forEach(card => {
    card.addEventListener('click', () => {
      const sessionId = card.dataset.id;
      showAnalysisView(sessionId);
      showToast(`Opened session`);
    });
  });

  // --- 6. Interactive Chat Pane ---
  function appendUserMessage(text) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `<p>${escapeHTML(text)}</p><div class="bubble-time">${now} ✓</div>`;
    chatMessagesStream.appendChild(bubble);
    chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
  }

  function appendAIMessage(htmlText) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble assistant';
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `<p>${htmlText}</p><div class="bubble-time">${now}</div>`;
    chatMessagesStream.appendChild(bubble);
    chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
  }

  function handleSendChat() {
    const msg = chatInput.value.trim();
    if (!msg) return;

    appendUserMessage(msg);
    chatInput.value = '';

    setTimeout(() => {
      let reply = "I analyzed this part of the content session. The data confirms high visual and spoken accuracy.";
      const lower = msg.toLowerCase();
      if (lower.includes('main idea') || lower.includes('summary')) {
        reply = "The main idea of this session is to provide a structured breakdown of the core subjects, key events, and factual timeline.";
      } else if (lower.includes('who') || lower.includes('abdallah')) {
        reply = "Hello Abdallah! I am ready to answer any detailed questions about this content session.";
      } else if (lower.includes('timeline') || lower.includes('timestamp')) {
        reply = "The interactive timeline divides the key video segments into chronological topics. Click any timeline row to jump directly to it!";
      }
      appendAIMessage(reply);
    }, 600);
  }

  chatSendBtn.addEventListener('click', handleSendChat);
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendChat();
  });

  chatExpandBtn.addEventListener('click', () => {
    chatPanel.classList.toggle('expanded');
    showToast(chatPanel.classList.contains('expanded') ? 'Expanded chat view' : 'Standard chat view');
  });

  chatAttachBtn.addEventListener('click', () => {
    showToast('📎 Attachment feature ready for Phase 3 asset uploads');
  });

  // --- 7. Modal System ---
  function openModal(titleText) {
    modalTitle.innerText = titleText;
    modalBackdrop.style.display = 'flex';
  }

  function closeModal() {
    modalBackdrop.style.display = 'none';
  }

  userProfileBtn.addEventListener('click', () => {
    openModal('Abdallah — Workspace Profile');
  });

  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  settingOwnerInput.addEventListener('change', (e) => {
    const newName = e.target.value.trim() || 'Abdallah';
    document.querySelectorAll('.user-name').forEach(el => el.innerText = newName);
    showToast(`Updated profile owner to ${newName}`);
  });

  clearHistoryBtn.addEventListener('click', () => {
    showToast('Cleared local session state');
    closeModal();
    showHomeView();
  });

  // Helper
  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
});
