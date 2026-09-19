/* ==========================================================================
   AI CONTENT ANALYZER - COMPLETE INTERACTIVE FRONTEND LOGIC
   Phase 4 — Frontend ↔ Backend Integration (YouTube Real Analysis)
   ========================================================================== */

// ---------------------------------------------------------------------------
// API CONFIG — single source of truth, no credentials here
// ---------------------------------------------------------------------------
const API_BASE_URL = "https://ai-content-analyzer-4i6u.onrender.com";
const ANALYZE_URL  = `${API_BASE_URL}/api/analyze/url`;
const SESSIONS_URL = `${API_BASE_URL}/api/sessions`;
const WORKSPACE_ID = "main-workspace";

document.addEventListener('DOMContentLoaded', () => {

  // -------------------------------------------------------------------------
  // Runtime State
  // -------------------------------------------------------------------------
  let currentTheme    = 'dark';
  let activeTab       = 'youtube';
  let currentSessionId = null;      // real Supabase session currently open
  let currentWorkspaceId = WORKSPACE_ID;
  let isAnalyzing     = false;      // duplicate-request guard

  // -------------------------------------------------------------------------
  // Mock Dataset — kept for sidebar demo history; NEVER shown after real API
  // -------------------------------------------------------------------------
  const SESSIONS_DATA = {
    'session-1': {
      title: 'How Black Holes Work',
      badgeClass: 'youtube',
      badgeText: '🔴 YouTube',
      date: 'May 12, 2024 • 18:42',
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
      overview: 'The video explains what black holes are, how massive stellar collapse forms them, and the physics governing the event horizon.',
      keyPoints: [
        '<strong>Stellar Core Collapse:</strong> Supermassive stars collapse under intense gravity when nuclear fusion ceases.',
        '<strong>Event Horizon:</strong> The boundary where escape velocity exceeds light speed.',
        '<strong>Accretion Disk Dynamics:</strong> Superheated gas and dust orbiting the black hole glow in X-ray spectrums.'
      ],
      timeline: [
        { time: '00:00 — 02:15', title: 'Introduction to Gravitational Collapse', desc: 'Overview of massive stars before stellar death.' },
        { time: '02:15 — 06:40', title: 'Event Horizon Geometry & Schwarzschild Radius', desc: 'Detailed explanation of space curvature and light-bending.' },
        { time: '06:40 — 12:10', title: 'Accretion Disks and Relativistic Jets', desc: 'How superheated matter emits high-energy X-rays.' }
      ],
      speech: 'Narration is paced clearly with precise astrophysics terminology. Analogies like "trampoline bowling balls" are used.',
      visual: 'Combines 3D ray-tracing simulations with infrared telescope captures.',
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

  // -------------------------------------------------------------------------
  // DOM Handles
  // -------------------------------------------------------------------------
  const app              = document.getElementById('app');
  const sidebar          = document.getElementById('sidebar');
  const mobileMenuBtn    = document.getElementById('mobileMenuBtn');
  const themeToggleLight = document.getElementById('themeToggleLight');
  const themeToggleDark  = document.getElementById('themeToggleDark');
  const userProfileBtn   = document.getElementById('userProfileBtn');

  const navNewAnalysisBtn = document.getElementById('navNewAnalysisBtn');
  const navHome           = document.getElementById('navHome');
  const navSessions       = document.getElementById('navSessions');
  const navFavorites      = document.getElementById('navFavorites');
  const navSettings       = document.getElementById('navSettings');
  const viewAllLink       = document.getElementById('viewAllLink');

  const viewHome     = document.getElementById('viewHome');
  const viewLoading  = document.getElementById('viewLoading');
  const viewAnalysis = document.getElementById('viewAnalysis');
  const chatPanel    = document.getElementById('chatPanel');

  const sourceTabs     = document.querySelectorAll('.tab-btn');
  const inputActionCard  = document.getElementById('inputActionCard');
  const urlInputField  = document.getElementById('urlInputField');
  const analyzeBtn     = document.getElementById('analyzeBtn');
  const imageDropzone  = document.getElementById('imageDropzone');
  const imageFileInput = document.getElementById('imageFileInput');
  const dropzoneText   = document.getElementById('dropzoneText');

  const sessionHeaderTitle = document.getElementById('sessionHeaderTitle');
  const sessionHeaderDesc  = document.getElementById('sessionHeaderDesc');
  const sessionHeaderImage = document.getElementById('sessionHeaderImage');
  const sessionHeaderBadge = document.getElementById('sessionHeaderBadge');
  const sessionHeaderDate  = document.getElementById('sessionHeaderDate');
  const analysisOverview   = document.getElementById('analysisOverview');
  const analysisKeyPoints  = document.getElementById('analysisKeyPoints');
  const analysisTimeline   = document.getElementById('analysisTimeline');
  const analysisSpeech     = document.getElementById('analysisSpeech');
  const analysisVisual     = document.getElementById('analysisVisual');
  const analysisEntities   = document.getElementById('analysisEntities');

  // New optional sections
  const blockStructure      = document.getElementById('blockStructure');
  const analysisStructure   = document.getElementById('analysisStructure');
  const blockEvidence       = document.getElementById('blockEvidence');
  const analysisEvidence    = document.getElementById('analysisEvidence');
  const blockUncertainties  = document.getElementById('blockUncertainties');
  const analysisUncertainties = document.getElementById('analysisUncertainties');

  const chatMiniTitle      = document.getElementById('chatMiniTitle');
  const chatMiniThumb      = document.getElementById('chatMiniThumb');
  const chatMiniMeta       = document.getElementById('chatMiniMeta');
  const chatMessagesStream = document.getElementById('chatMessagesStream');
  const chatInput          = document.getElementById('chatInput');
  const chatSendBtn        = document.getElementById('chatSendBtn');
  const chatExpandBtn      = document.getElementById('chatExpandBtn');
  const chatAttachBtn      = document.getElementById('chatAttachBtn');

  const modalBackdrop    = document.getElementById('modalBackdrop');
  const modalCloseBtn    = document.getElementById('modalCloseBtn');
  const modalTitle       = document.getElementById('modalTitle');
  const settingOwnerInput = document.getElementById('settingOwnerInput');
  const clearHistoryBtn  = document.getElementById('clearHistoryBtn');
  const toastNotification = document.getElementById('toastNotification');
  const sidebarHistoryList = document.getElementById('sidebarHistoryList');
  const recentSessionsGrid = document.getElementById('recentSessionsGrid');
  const sessionBadgeCount = document.getElementById('sessionBadgeCount');
  const sessionsTitle = document.getElementById('sessionsTitle');

  // -------------------------------------------------------------------------
  // 1. Theme Management
  // -------------------------------------------------------------------------
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

  themeToggleDark.addEventListener('click', () => { setTheme('dark'); showToast('Switched to Dark Theme'); });
  themeToggleLight.addEventListener('click', () => { setTheme('light'); showToast('Switched to Light Theme'); });

  // -------------------------------------------------------------------------
  // 2. Toast System
  // -------------------------------------------------------------------------
  let toastTimer = null;
  function showToast(message, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);
    toastNotification.innerText = message;
    toastNotification.style.display = 'block';
    toastNotification.style.background = isError
      ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
      : '';
    toastTimer = setTimeout(() => {
      toastNotification.style.display = 'none';
    }, isError ? 4000 : 2500);
  }

  // -------------------------------------------------------------------------
  // 3. View Switcher
  // -------------------------------------------------------------------------
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

  function showLoadingView() {
    viewHome.style.display = 'none';
    viewLoading.classList.add('active');
    viewAnalysis.classList.remove('active');
    app.classList.remove('has-chat-panel');
    chatPanel.style.display = 'none';

    // Animate loading steps as visual progress (backend/Gemini does the real work)
    const steps = document.querySelectorAll('.loading-step-item');
    steps.forEach(s => s.classList.remove('done', 'active'));
    if (steps[0]) steps[0].classList.add('active');
    setTimeout(() => { if (steps[0]) { steps[0].classList.replace('active','done'); } if (steps[1]) steps[1].classList.add('active'); }, 800);
    setTimeout(() => { if (steps[1]) { steps[1].classList.replace('active','done'); } if (steps[2]) steps[2].classList.add('active'); }, 1800);
    setTimeout(() => { if (steps[2]) { steps[2].classList.replace('active','done'); } if (steps[3]) steps[3].classList.add('active'); }, 3000);
  }

  function showAnalysisView() {
    viewHome.style.display = 'none';
    viewLoading.classList.remove('active');
    viewAnalysis.classList.add('active');
    app.classList.add('has-chat-panel');
    chatPanel.style.display = 'flex';
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
  }

  // -------------------------------------------------------------------------
  // 4. Render MOCK session (sidebar demo history items only)
  // -------------------------------------------------------------------------
  function renderMockSessionData(sessionId) {
    const data = SESSIONS_DATA[sessionId] || SESSIONS_DATA['session-1'];

    sessionHeaderTitle.innerText = data.title;
    sessionHeaderDesc.innerText  = data.overview;
    sessionHeaderImage.src       = data.image;
    sessionHeaderBadge.className = `source-badge ${data.badgeClass}`;
    sessionHeaderBadge.innerText = data.badgeText;
    sessionHeaderDate.innerText  = data.date;
    analysisOverview.innerText   = data.overview;

    analysisKeyPoints.innerHTML = data.keyPoints.map(kp => `
      <li class="key-point-item">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>${kp}</span>
      </li>
    `).join('');

    analysisTimeline.innerHTML = data.timeline.map(t => `
      <div class="timeline-item" data-time="${t.time}" data-topic="${escapeHTML(t.title)}">
        <span class="timestamp-tag">${t.time}</span>
        <div class="timeline-content">
          <h5>${t.title}</h5>
          <p>${t.desc}</p>
        </div>
      </div>
    `).join('');
    bindTimelineClicks();

    analysisSpeech.innerText = data.speech;
    analysisVisual.innerText  = data.visual;

    analysisEntities.innerHTML = data.entities.map(e => `<span class="tag-pill">${e}</span>`).join('');
    bindEntityClicks();

    // Hide real-only sections
    blockStructure.style.display     = 'none';
    blockEvidence.style.display      = 'none';
    blockUncertainties.style.display = 'none';

    // Chat mini badge
    chatMiniTitle.innerText = data.title;
    chatMiniThumb.src       = data.image;
    chatMiniMeta.innerText  = `${data.badgeText} • ${data.date}`;

    // Restore placeholder chat input (mock context)
    setChatPlaceholder('Ask anything about this content...');

    document.querySelectorAll('.history-item').forEach(h => {
      h.classList.toggle('active', h.dataset.id === sessionId);
    });

    currentSessionId = null; // demo sessions never use persistent chat
  }

  // -------------------------------------------------------------------------
  // 5. Render REAL API Analysis
  // -------------------------------------------------------------------------
  function renderRealAnalysis(session, analysis) {
    // — Session Header —
    const title       = analysis.title || session.title || 'YouTube Video Analysis';
    const sourceUrl   = session.source_url || '';
    const createdRaw  = session.created_at  || new Date().toISOString();
    const dateLabel   = formatDate(createdRaw);
    const thumbUrl    = getYouTubeThumbnail(sourceUrl);

    sessionHeaderTitle.innerText  = title;
    sessionHeaderDesc.innerText   = analysis.overview || '';
    sessionHeaderImage.src        = thumbUrl;
    sessionHeaderBadge.className  = 'source-badge youtube';
    sessionHeaderBadge.innerText  = '🔴 YouTube';
    sessionHeaderDate.innerText   = dateLabel;

    // — Overview —
    analysisOverview.innerText = analysis.overview || 'No overview returned.';

    // — Key Points —
    const kps = Array.isArray(analysis.key_points) ? analysis.key_points : [];
    if (kps.length > 0) {
      analysisKeyPoints.innerHTML = kps.map(kp => `
        <li class="key-point-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${escapeHTML(typeof kp === 'string' ? kp : JSON.stringify(kp))}</span>
        </li>
      `).join('');
    } else {
      analysisKeyPoints.innerHTML = '<li class="key-point-item" style="opacity:0.6;"><span>No key points returned by Gemini.</span></li>';
    }

    // — Timeline —
    const tl = Array.isArray(analysis.timeline) ? analysis.timeline : [];
    if (tl.length > 0) {
      analysisTimeline.innerHTML = tl.map(t => {
        const timeLabel = t.start && t.end ? `${t.start} — ${t.end}` : (t.time || '');
        const topicStr  = escapeHTML(t.topic || '');
        const summStr   = escapeHTML(t.summary || t.desc || '');
        return `
          <div class="timeline-item" data-time="${escapeHTML(timeLabel)}" data-topic="${topicStr}">
            <span class="timestamp-tag">${escapeHTML(timeLabel)}</span>
            <div class="timeline-content">
              <h5>${topicStr}</h5>
              <p>${summStr}</p>
            </div>
          </div>
        `;
      }).join('');
    } else {
      analysisTimeline.innerHTML = `
        <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px;">
          No timeline segments returned for this video.
        </div>`;
    }
    bindTimelineClicks();

    // — Speech Analysis —
    const speech = analysis.speech_analysis;
    analysisSpeech.innerText = typeof speech === 'object' && speech !== null
      ? (speech.summary || speech.tone || JSON.stringify(speech))
      : (speech || 'No speech analysis returned.');

    // — Visual Analysis —
    const visual = analysis.visual_analysis;
    analysisVisual.innerText = typeof visual === 'object' && visual !== null
      ? (visual.summary || visual.description || JSON.stringify(visual))
      : (visual || 'No visual analysis returned.');

    // — Entities —
    let entities = [];
    if (Array.isArray(analysis.entities)) {
      entities = analysis.entities.map(e => typeof e === 'string' ? e : (e.name || JSON.stringify(e)));
    }
    if (entities.length > 0) {
      analysisEntities.innerHTML = entities.map(e => `<span class="tag-pill">${escapeHTML(e)}</span>`).join('');
    } else {
      analysisEntities.innerHTML = '<span style="color:var(--text-muted);font-size:13px;">No entities identified.</span>';
    }
    bindEntityClicks();

    // — Content Structure (optional) —
    const structure = analysis.structure;
    if (structure) {
      analysisStructure.innerText = typeof structure === 'object'
        ? JSON.stringify(structure, null, 2)
        : structure;
      blockStructure.style.display = 'block';
    } else {
      blockStructure.style.display = 'none';
    }

    // — Evidence Notes (optional) —
    const evidence = Array.isArray(analysis.evidence_notes) ? analysis.evidence_notes : [];
    if (evidence.length > 0) {
      analysisEvidence.innerHTML = evidence.map(e => `
        <li class="key-point-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>${escapeHTML(typeof e === 'string' ? e : JSON.stringify(e))}</span>
        </li>
      `).join('');
      blockEvidence.style.display = 'block';
    } else {
      blockEvidence.style.display = 'none';
    }

    // — Uncertainties (optional) —
    const uncertainties = Array.isArray(analysis.uncertainties) ? analysis.uncertainties : [];
    if (uncertainties.length > 0) {
      analysisUncertainties.innerHTML = uncertainties.map(u => `
        <li class="key-point-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <span>${escapeHTML(typeof u === 'string' ? u : JSON.stringify(u))}</span>
        </li>
      `).join('');
      blockUncertainties.style.display = 'block';
    } else {
      blockUncertainties.style.display = 'none';
    }

    // — Chat Mini Badge —
    chatMiniTitle.innerText = title;
    chatMiniThumb.src       = thumbUrl;
    chatMiniMeta.innerText  = `🔴 YouTube • ${dateLabel}`;

    setChatAvailable(Boolean(session.id));
    clearChatMessages();

    // Clear sidebar active state (this is a new real session, not a demo item)
    document.querySelectorAll('.history-item').forEach(h => h.classList.remove('active'));

    currentSessionId = session.id || null;
    currentWorkspaceId = session.workspace_id || WORKSPACE_ID;
  }

  // -------------------------------------------------------------------------
  // 6. Helpers
  // -------------------------------------------------------------------------
  function getYouTubeThumbnail(url) {
    try {
      const parsed = new URL(url);
      let videoId  = parsed.searchParams.get('v');
      if (!videoId && parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1);
      }
      if (videoId) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } catch {}
    return 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80';
  }

  function formatDate(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  }

  function setChatPlaceholder(text) {
    if (chatInput) chatInput.placeholder = text;
  }

  function bindTimelineClicks() {
    document.querySelectorAll('.timeline-item').forEach(item => {
      item.addEventListener('click', () => handleSendChat('Explain the segment at ' + item.dataset.time + ' regarding "' + item.dataset.topic + '".'));
    });
  }

  function bindEntityClicks() {
    document.querySelectorAll('.tag-pill').forEach(pill => {
      pill.addEventListener('click', () => handleSendChat('Tell me more about ' + pill.innerText + '.'));
    });
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"/]/g,
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '/': '&#47;' }[tag] || tag)
    );
  }

  // -------------------------------------------------------------------------
  // 7. Input Validation
  // -------------------------------------------------------------------------
  function isValidUrl(str) {
    try { new URL(str); return true; } catch { return false; }
  }

  function isYouTubeUrl(str) {
    try {
      const host = new URL(str).hostname.toLowerCase();
      return host.includes('youtube.com') || host.includes('youtu.be');
    } catch { return false; }
  }

  // -------------------------------------------------------------------------
  // 8. API Call — POST /api/analyze/url
  // -------------------------------------------------------------------------
  async function callAnalyzeAPI(youtubeUrl) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 120000); // 2 min timeout

    try {
      const response = await fetch(ANALYZE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: youtubeUrl, workspace_id: WORKSPACE_ID }),
        signal:  controller.signal
      });

      clearTimeout(timeoutId);

      // Parse JSON regardless of status to read error messages
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Server returned an invalid response. Please try again.');
      }

      if (!response.ok) {
        // Map backend error codes to user-friendly messages
        const code = data.code || '';
        if (code === 'INVALID_URL')          throw new Error('Invalid URL. Please enter a valid YouTube link.');
        if (code === 'UNSUPPORTED_SOURCE')   throw new Error('Only public YouTube URLs are supported. Facebook & Image analysis coming soon.');
        if (response.status === 503)         throw new Error('The analysis server is starting up (Render cold start). Please wait 30 seconds and try again.');
        throw new Error(data.message || `Server error (${response.status}). Please try again.`);
      }

      if (data.status !== 'ok' || !data.analysis) {
        throw new Error('Received an unexpected response from the server. Please try again.');
      }

      return data; // { status, session, analysis }

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Gemini analysis can take up to 2 minutes. Please try again.');
      }
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Cannot reach the analysis server. Check your internet connection or try again in a moment.');
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // 9. Analyze Submit Handler (REAL API)
  // -------------------------------------------------------------------------
  async function handleAnalyzeSubmit() {
    // — Image tab —
    if (activeTab === 'image') {
      showToast('Image analysis will be available soon.', false);
      return;
    }

    // — Facebook tab —
    if (activeTab === 'facebook') {
      showToast('Facebook analysis is coming in a later phase.', false);
      return;
    }

    const val = urlInputField.value.trim();

    // Test 1: Empty URL
    if (!val) {
      showToast('⚠️ Please enter a YouTube URL first!', true);
      inputActionCard.style.borderColor = '#EF4444';
      setTimeout(() => inputActionCard.style.borderColor = '', 2000);
      return;
    }

    // Test 2: Invalid URL format
    if (!isValidUrl(val)) {
      showToast('⚠️ This does not look like a valid URL. Please check and try again.', true);
      return;
    }

    // Test 3: Non-YouTube URL
    if (!isYouTubeUrl(val)) {
      showToast('⚠️ Only YouTube URLs are supported right now. Facebook & Image analysis coming soon.', true);
      return;
    }

    // Test 8: Duplicate request guard
    if (isAnalyzing) {
      showToast('Analysis already in progress, please wait…');
      return;
    }

    // — Start request —
    isAnalyzing = true;
    setAnalyzeButtonState(true);
    showLoadingView();

    try {
      const result = await callAnalyzeAPI(val);

      // Tests 5 & 6: Render real Gemini response
      renderRealAnalysis(result.session, result.analysis);
      await loadSessionMessages(result.session.id);
      await loadRealSessions();
      showAnalysisView();
      showToast('✅ Analysis complete!');

    } catch (err) {
      // Test 7: Error handling
      showHomeView();
      showToast(`❌ ${err.message}`, true);
    } finally {
      isAnalyzing = false;
      setAnalyzeButtonState(false);
    }
  }

  function setAnalyzeButtonState(loading) {
    if (loading) {
      analyzeBtn.disabled   = true;
      analyzeBtn.innerHTML  = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-dasharray="60" stroke-dashoffset="20"></circle>
        </svg>
        Analyzing…`;
    } else {
      analyzeBtn.disabled   = false;
      analyzeBtn.innerHTML  = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/>
        </svg>
        Analyze`;
    }
  }

  analyzeBtn.addEventListener('click', handleAnalyzeSubmit);
  urlInputField.addEventListener('keydown', e => { if (e.key === 'Enter') handleAnalyzeSubmit(); });

  // -------------------------------------------------------------------------
  // 10. Navigation Click Handlers
  // -------------------------------------------------------------------------
  navNewAnalysisBtn.addEventListener('click', () => {
    urlInputField.value = '';
    currentSessionId = null;
    clearChatMessages();
    setChatAvailable(false);
    showHomeView();
    showToast('Started new analysis session');
  });

  navHome.addEventListener('click', showHomeView);

  navSessions.addEventListener('click', async () => {
    showHomeView();
    try { await loadRealSessions(); } catch (error) { showToast('Error: ' + error.message, true); }
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
    viewAllLink.addEventListener('click', e => {
      e.preventDefault();
      document.getElementById('recentSessionsGrid').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // -------------------------------------------------------------------------
  // 11. Mobile Drawer
  // -------------------------------------------------------------------------
  mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

  // -------------------------------------------------------------------------
  // 12. Source Tabs
  // -------------------------------------------------------------------------
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
          urlInputField.placeholder = 'Facebook analysis is coming in a later phase…';
        } else {
          urlInputField.placeholder = 'Paste any supported content URL here…';
        }
      }
    });
  });

  // Image Dropzone
  imageDropzone.addEventListener('click', () => imageFileInput.click());
  imageFileInput.addEventListener('change', e => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      dropzoneText.innerHTML = `<h4>Selected: ${escapeHTML(file.name)}</h4><p>${(file.size / 1024).toFixed(1)} KB — Image analysis will be available soon.</p>`;
      showToast('Image analysis will be available soon.');
    }
  });

  // -------------------------------------------------------------------------
  // 13. Real Session History
  // -------------------------------------------------------------------------
  function sourceBadge(sourceType) {
    return sourceType === 'youtube' ? 'YouTube' : (sourceType || 'Content');
  }

  function renderRealSessions(sessions) {
    sessionBadgeCount.innerText = String(sessions.length);
    sessionsTitle.innerText = 'Real Sessions';
    if (!sessions.length) {
      sidebarHistoryList.innerHTML = '<div class="history-item">No real sessions yet</div>';
      recentSessionsGrid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No real sessions yet. Analyze a public YouTube video to create one.</p>';
      return;
    }
    sidebarHistoryList.innerHTML = sessions.map(session => `<button class="history-item ${session.id === currentSessionId ? 'active' : ''}" data-real-session-id="${escapeHTML(session.id)}" type="button">${escapeHTML(session.title || 'Untitled content')}</button>`).join('');
    recentSessionsGrid.innerHTML = sessions.map(session => `<button class="session-card" data-real-session-id="${escapeHTML(session.id)}" type="button"><div class="session-info"><h4>${escapeHTML(session.title || 'Untitled content')}</h4><div class="session-meta"><span class="source-badge youtube">${escapeHTML(sourceBadge(session.source_type))}</span><span>${escapeHTML(formatDate(session.created_at || session.updated_at || ''))}</span></div><div class="session-meta"><span>${escapeHTML(session.status || 'completed')}</span></div></div></button>`).join('');
    document.querySelectorAll('[data-real-session-id]').forEach(item => item.addEventListener('click', () => openRealSession(item.dataset.realSessionId)));
  }

  async function loadRealSessions() {
    const data = await callSessionAPI(`?workspace_id=${encodeURIComponent(WORKSPACE_ID)}`);
    renderRealSessions(data.sessions);
  }

  async function openRealSession(sessionId) {
    try {
      const data = await callSessionAPI(`/${encodeURIComponent(sessionId)}`);
      renderRealAnalysis(data.session, data.analysis);
      await loadSessionMessages(sessionId);
      await loadRealSessions();
      showAnalysisView();
    } catch (error) {
      showToast(`Error: ${error.message}`, true);
    }
  }

  // -------------------------------------------------------------------------
  // 14. Persistent Session Chat
  // -------------------------------------------------------------------------
  function clearChatMessages() {
    chatMessagesStream.innerHTML = '';
  }

  function formatChatTime(isoString) {
    const date = new Date(isoString);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(role, text, createdAt = new Date().toISOString()) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'user' ? 'user' : 'assistant'}`;
    bubble.innerHTML = `<p>${escapeHTML(text)}</p><div class="bubble-time">${formatChatTime(createdAt)}${role === 'user' ? ' sent' : ''}</div>`;
    chatMessagesStream.appendChild(bubble);
    chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
  }

  function appendUserMessage(text, createdAt) { appendMessage('user', text, createdAt); }
  function appendAIMessage(text, createdAt) { appendMessage('assistant', text, createdAt); }

  function showTypingState() {
    const typing = document.createElement('div');
    typing.className = 'chat-bubble assistant';
    typing.id = 'chatTypingState';
    typing.innerHTML = '<p>Gemini is thinking...</p>';
    chatMessagesStream.appendChild(typing);
    chatMessagesStream.scrollTop = chatMessagesStream.scrollHeight;
  }

  function removeTypingState() { document.getElementById('chatTypingState')?.remove(); }

  function setChatAvailable(available) {
    chatInput.disabled = !available;
    chatSendBtn.disabled = !available;
    setChatPlaceholder(available ? 'Ask anything about this content...' : 'Analyze or open a real session to chat.');
  }

  async function callSessionAPI(path, options = {}) {
    const response = await fetch(`${SESSIONS_URL}${path}`, options);
    let data;
    try { data = await response.json(); } catch { throw new Error('Server returned an invalid response.'); }
    if (!response.ok || data.status !== 'ok') {
      const messages = {
        INVALID_SESSION_ID: 'This session link is invalid.',
        SESSION_NOT_FOUND: 'This session no longer exists.',
        INVALID_MESSAGE: 'Please enter a message before sending.',
        DATABASE_ERROR: 'Session storage is temporarily unavailable.',
        CHAT_FAILED: 'Gemini could not answer right now. Please try again.'
      };
      throw new Error(messages[data.code] || data.message || 'Unable to complete the session request.');
    }
    return data;
  }

  async function loadSessionMessages(sessionId) {
    if (!sessionId) return;
    const data = await callSessionAPI(`/${encodeURIComponent(sessionId)}/messages`);
    clearChatMessages();
    data.messages.forEach(message => appendMessage(message.role, message.content, message.created_at));
  }

  async function handleSendChat(messageOverride = null) {
    const message = (messageOverride || chatInput.value).trim();
    if (!currentSessionId) return showToast('Open a real session before starting a chat.', true);
    if (!message) return showToast('Please enter a message.', true);

    appendUserMessage(message);
    chatInput.value = '';
    chatInput.disabled = true;
    chatSendBtn.disabled = true;
    showTypingState();
    try {
      const data = await callSessionAPI(`/${encodeURIComponent(currentSessionId)}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      removeTypingState();
      appendAIMessage(data.message.content, data.message.created_at);
    } catch (error) {
      removeTypingState();
      showToast(`Error: ${error.message}`, true);
    } finally {
      setChatAvailable(Boolean(currentSessionId));
      chatInput.focus();
    }
  }

  chatSendBtn.addEventListener('click', () => handleSendChat());
  chatInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); handleSendChat(); } });

  // -------------------------------------------------------------------------
  // 15. Modal System
  // -------------------------------------------------------------------------
  function openModal(titleText) {
    modalTitle.innerText = titleText;
    modalBackdrop.style.display = 'flex';
  }
  function closeModal() {
    modalBackdrop.style.display = 'none';
  }

  userProfileBtn.addEventListener('click', () => openModal('Abdallah — Workspace Profile'));
  modalCloseBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });

  settingOwnerInput.addEventListener('change', e => {
    const newName = e.target.value.trim() || 'Abdallah';
    document.querySelectorAll('.user-name').forEach(el => el.innerText = newName);
    showToast(`Updated profile owner to ${newName}`);
  });

  clearHistoryBtn.addEventListener('click', () => {
    showToast('Cleared local session state');
    closeModal();
    showHomeView();
  });

  loadRealSessions().catch(() => { /* Rendered demo content stays visible only while the API is unavailable. */ });
  setChatAvailable(false);

  // -------------------------------------------------------------------------
  // 16. Spinner CSS (injected so no stylesheet change needed)
  // -------------------------------------------------------------------------
  const spinStyle = document.createElement('style');
  spinStyle.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(spinStyle);

});
