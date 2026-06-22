/* ============================================
   CHARACTER REFERENCE WIKI
   Dynamic Theme Colors & Character Select
   ============================================ */

// Global State
const state = {
    characters: [],
    currentCharacter: null,
    currentMediaIndex: 0,
    mediaItems: [],
    lightboxIndex: 0
};

// Prefix a media src with the generated assets/ directory.
// build.py writes every processed image/video into assets/<src>.
function assetUrl(src) {
    return 'assets/' + src;
}

// Thumbnail URL for carousel use. build.py generates 200x150 thumbnails
// in assets/thumb/<src> (NEAREST for pixel art, LANCZOS otherwise).
function thumbUrl(src) {
    return 'assets/thumb/' + src;
}

// DOM Elements
const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    selectPage: document.getElementById('select-page'),
    characterPage: document.getElementById('character-page'),
    characterGrid: document.getElementById('character-grid'),
    backBtn: document.getElementById('back-btn'),
    headerBg: document.getElementById('header-bg'),
    titlePre: document.getElementById('title-pre'),
    titleEn: document.getElementById('title-en'),
    titleJp: document.getElementById('title-jp'),
    characterTagline: document.getElementById('character-tagline'),
    mainImageWrapper: document.getElementById('main-image-wrapper'),
    mediaTypeBadge: document.getElementById('media-type-badge'),
    imageLabel: document.getElementById('image-label'),
    carouselTrack: document.getElementById('carousel-track'),
    carouselPrev: document.getElementById('carousel-prev'),
    carouselNext: document.getElementById('carousel-next'),
    radarChart: document.getElementById('radar-chart'),
    statsList: document.getElementById('stats-list'),
    bioAge: document.getElementById('bio-age'),
    bioHeight: document.getElementById('bio-height'),
    appearanceContent: document.getElementById('appearance-content'),
    personalityContent: document.getElementById('personality-content'),
    abilitiesContent: document.getElementById('abilities-content'),
    loreContent: document.getElementById('lore-content'),
    paletteContent: document.getElementById('palette-content'),
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightbox-image'),
    lightboxVideo: document.getElementById('lightbox-video'),
    lightboxLabel: document.getElementById('lightbox-label'),
    lightboxPrev: document.getElementById('lightbox-prev'),
    lightboxNext: document.getElementById('lightbox-next'),
    downloadBtn: document.getElementById('download-btn'),
    lightboxClose: document.getElementById('lightbox-close')
};

/* ============================================
   THEME COLORS
   ============================================ */

function applyThemeColor(color) {
    const root = document.documentElement;
    const hsl = hexToHSL(color);
    
    root.style.setProperty('--accent-hue', hsl.h);
    root.style.setProperty('--accent-primary', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
    root.style.setProperty('--accent-secondary', `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 100)}%, ${Math.max(hsl.l - 10, 30)}%)`);
    root.style.setProperty('--accent-tertiary', `hsl(${(hsl.h + 20) % 360}, ${hsl.s}%, ${hsl.l}%)`);
}

function resetThemeColor() {
    const root = document.documentElement;
    root.style.setProperty('--accent-hue', '245');
    root.style.setProperty('--accent-primary', '#6366f1');
    root.style.setProperty('--accent-secondary', '#8b5cf6');
    root.style.setProperty('--accent-tertiary', '#a855f7');
}

function hexToHSL(hex) {
    hex = hex.replace('#', '');
    
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0;
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

/* ============================================
   INITIALIZATION
   ============================================ */

async function init() {
    try {
        const response = await fetch('characters.json');
        state.characters = await response.json();
        
        buildCharacterGrid();
        setupEventListeners();
        
        // Check if URL has a character hash
        const characterId = getCharacterFromURL();
        if (characterId && state.characters.find(c => c.id === characterId)) {
            // Load character directly from URL
            setTimeout(() => {
                elements.loadingScreen.classList.add('fade-out');
                loadCharacter(characterId);
            }, 800);
        } else {
            // Show select page
            setTimeout(() => {
                elements.loadingScreen.classList.add('fade-out');
            }, 800);
        }
        
    } catch (error) {
        console.error('Failed to initialize:', error);
        elements.loadingScreen.innerHTML = `
            <div class="loader">
                <p style="color: #ef4444; font-family: 'Bebas Neue'; letter-spacing: 0.2em;">ERROR LOADING DATA</p>
                <p style="color: #64748b; font-size: 0.75rem; margin-top: 0.5rem;">データの読み込みに失敗しました</p>
            </div>
        `;
    }
}

/* ============================================
   CHARACTER SELECT GRID
   ============================================ */

function buildCharacterGrid() {
    elements.characterGrid.innerHTML = state.characters.map((char, index) => `
        <div class="character-card" data-id="${char.id}" style="--card-accent: ${char.themeColor || '#6366f1'}">
            <div class="card-content">
                <span class="card-index">${String(index + 1).padStart(2, '0')}</span>
                <h3 class="card-name-en">${char.name.en}</h3>
                <p class="card-name-jp">${char.name.jp}</p>
                ${char.tagline ? `<p class="card-tagline">${char.tagline.en}</p>` : ''}
            </div>
        </div>
    `).join('');
    
    // Animate cards in with stagger
    setTimeout(() => {
        document.querySelectorAll('.character-card').forEach((card, i) => {
            setTimeout(() => {
                card.classList.add('visible');
            }, i * 120);
        });
    }, 600);
}

/* ============================================
   PAGE NAVIGATION & URL ROUTING
   ============================================ */

function showSelectPage() {
    resetThemeColor();
    
    // Clear URL hash
    history.pushState(null, '', window.location.pathname);
    
    elements.characterPage.classList.remove('visible');
    
    setTimeout(() => {
        elements.characterPage.classList.add('hidden');
        elements.selectPage.classList.remove('hidden');
        elements.selectPage.style.animation = 'none';
        elements.selectPage.offsetHeight;
        elements.selectPage.style.animation = '';
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 300);
}

function showCharacterPage() {
    elements.selectPage.classList.add('hidden');
    elements.characterPage.classList.remove('hidden');
    
    setTimeout(() => {
        elements.characterPage.classList.add('visible');
    }, 50);
}

function updateURLHash(characterId) {
    history.pushState(null, '', `#${characterId}`);
}

function getCharacterFromURL() {
    const hash = window.location.hash.slice(1); // Remove the '#'
    return hash || null;
}

function handleURLNavigation() {
    const characterId = getCharacterFromURL();
    if (characterId && state.characters.find(c => c.id === characterId)) {
        loadCharacter(characterId);
    } else if (characterId) {
        // Invalid character ID, clear hash and show select
        history.replaceState(null, '', window.location.pathname);
        showSelectPage();
    }
}

/* ============================================
   CHARACTER LOADING
   ============================================ */

async function loadCharacter(characterId) {
    const charInfo = state.characters.find(c => c.id === characterId);
    if (!charInfo) return;
    
    try {
        const response = await fetch(`characters/${characterId}/${characterId}.json`);
        const charData = await response.json();
        state.currentCharacter = charData;
        state.currentMediaIndex = 0;
        
        // Update URL hash for shareable links
        updateURLHash(characterId);
        
        // Apply theme color
        if (charData.themeColor) {
            applyThemeColor(charData.themeColor);
        }
        
        // Build combined media array
        buildMediaArray(charData);
        
        // Show character page
        showCharacterPage();
        
        // Reset animations
        resetAnimations();
        
        // Update all sections
        updateHeader(charData);
        updateMainDisplay(0);
        updateCarousel();
        updateStats(charData);
        updatePanels(charData);
        updateColorPalette(charData);
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('Failed to load character:', error);
    }
}

function buildMediaArray(charData) {
    state.mediaItems = [];
    
    // Add all images
    if (charData.images && charData.images.length > 0) {
        charData.images.forEach(img => {
            state.mediaItems.push({
                type: 'image',
                src: img.src,
                label: img.label,
                pixelArt: img.pixelArt === true
            });
        });
    }
    
    // Add all videos (now supports multiple)
    if (charData.videos && charData.videos.length > 0) {
        charData.videos.forEach(vid => {
            state.mediaItems.push({
                type: 'video',
                src: vid.src,
                label: vid.label,
                pixelArt: false
            });
        });
    }
    
    // Legacy support: single video field
    if (charData.video && !charData.videos) {
        state.mediaItems.push({
            type: 'video',
            src: charData.video,
            label: { en: 'Motion Reference', jp: 'モーションリファレンス' },
            pixelArt: false
        });
    }
}

function resetAnimations() {
    // Reset header animations
    const animatedElements = [
        elements.titlePre,
        elements.titleEn,
        elements.titleJp,
        document.querySelector('.title-underline'),
        elements.characterTagline
    ];
    
    animatedElements.forEach(el => {
        if (el) {
            el.style.animation = 'none';
            el.offsetHeight;
            el.style.animation = '';
        }
    });
    
    // Reset center stage
    const centerStage = document.querySelector('.center-stage');
    if (centerStage) {
        centerStage.style.animation = 'none';
        centerStage.offsetHeight;
        centerStage.style.animation = '';
    }
    
    // Reset panel animations
    document.querySelectorAll('.panel-card').forEach(card => {
        card.style.animation = 'none';
        card.offsetHeight;
        card.style.animation = '';
    });
}

/* ============================================
   HEADER UPDATE
   ============================================ */

function updateHeader(charData) {
    // Update background
    if (state.mediaItems.length > 0 && state.mediaItems[0].type === 'image') {
        elements.headerBg.style.backgroundImage = `url('${assetUrl(state.mediaItems[0].src)}')`;
    }
    
    // Update title
    elements.titlePre.textContent = 'CHARACTER FILE';
    elements.titleEn.textContent = charData.name.en;
    elements.titleJp.textContent = charData.name.jp;
    
    // Update tagline
    if (charData.tagline) {
        elements.characterTagline.innerHTML = `
            <span class="en">${charData.tagline.en}</span>
            <span class="jp">${charData.tagline.jp}</span>
        `;
    } else {
        elements.characterTagline.innerHTML = '';
    }
}

/* ============================================
   MAIN DISPLAY
   ============================================ */

function updateMainDisplay(index) {
    if (index < 0 || index >= state.mediaItems.length) return;
    
    state.currentMediaIndex = index;
    const item = state.mediaItems[index];
    
    elements.mainImageWrapper.innerHTML = '';
    
    if (item.type === 'image') {
        const img = document.createElement('img');
        img.src = assetUrl(item.src);
        img.alt = item.label.en || 'Character Reference';
        if (item.pixelArt) img.classList.add('pixel-art');
        img.decoding = 'async';
        img.onload = () => setTimeout(() => img.classList.add('loaded'), 50);
        elements.mainImageWrapper.appendChild(img);
        
        elements.mediaTypeBadge.classList.remove('video');
        elements.mediaTypeBadge.querySelector('.badge-text').textContent = 'IMAGE';
    } else {
        const video = document.createElement('video');
        video.src = assetUrl(item.src);
        video.loop = true;
        video.muted = true;
        video.autoplay = true;
        video.playsInline = true;
        video.preload = 'auto';
        elements.mainImageWrapper.appendChild(video);
        
        elements.mediaTypeBadge.classList.add('video');
        elements.mediaTypeBadge.querySelector('.badge-text').textContent = 'VIDEO';
    }
    
    elements.imageLabel.textContent = item.label.en || 'Reference';
    
    // Update carousel active state
    document.querySelectorAll('.carousel-item').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
}

/* ============================================
   CAROUSEL
   ============================================ */

function updateCarousel() {
    elements.carouselTrack.innerHTML = state.mediaItems.map((item, index) => {
        const isVideo = item.type === 'video';
        const activeClass = index === 0 ? 'active' : '';
        const videoClass = isVideo ? 'video-item' : '';
        const pixelArtClass = !isVideo && item.pixelArt ? 'pixel-art' : '';
        const label = item.label.en || 'Reference';
        
        return `
            <div class="carousel-item ${activeClass} ${videoClass}" data-index="${index}">
                ${isVideo ? 
                    `<video src="${assetUrl(item.src)}#t=0.1" muted preload="metadata" playsinline></video>` : 
                    `<img src="${thumbUrl(item.src)}" alt="${label}" class="${pixelArtClass}" loading="lazy" decoding="async">`
                }
                <div class="item-badge">
                    ${isVideo ? 
                        `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>` :
                        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

function scrollCarousel(direction) {
    const container = document.querySelector('.carousel-track-container');
    const scrollAmount = 150;
    container.scrollBy({
        left: direction * scrollAmount,
        behavior: 'smooth'
    });
}

/* ============================================
   STATS
   ============================================ */

function updateStats(charData) {
    const stats = charData.stats || {};
    
    // Draw radar chart
    setTimeout(() => drawRadarChart(stats), 100);
    
    // Build stats list
    elements.statsList.innerHTML = Object.entries(stats).map(([name, value]) => `
        <div class="stat-item">
            <span class="stat-name">${name}</span>
            <span class="stat-val">${value}</span>
        </div>
    `).join('');
}

function drawRadarChart(stats) {
    const canvas = elements.radarChart;
    const ctx = canvas.getContext('2d');
    
    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight, 200);
    
    canvas.width = size * 2;
    canvas.height = size * 2;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(2, 2);
    
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.38;
    const statNames = Object.keys(stats);
    const statValues = Object.values(stats);
    const numStats = statNames.length;
    const angleStep = (Math.PI * 2) / numStats;
    
    // Get current theme color from CSS
    const computedStyle = getComputedStyle(document.documentElement);
    const accentHue = computedStyle.getPropertyValue('--accent-hue').trim() || '245';
    
    ctx.clearRect(0, 0, size, size);
    
    // Draw background rings
    for (let i = 1; i <= 5; i++) {
        const ringRadius = (radius / 5) * i;
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${accentHue}, 70%, 60%, ${0.08 + (i * 0.02)})`;
        ctx.lineWidth = 1;
        
        for (let j = 0; j <= numStats; j++) {
            const angle = (j * angleStep) - Math.PI / 2;
            const x = centerX + Math.cos(angle) * ringRadius;
            const y = centerY + Math.sin(angle) * ringRadius;
            if (j === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
    }
    
    // Draw axis lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < numStats; i++) {
        const angle = (i * angleStep) - Math.PI / 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(angle) * radius,
            centerY + Math.sin(angle) * radius
        );
        ctx.stroke();
    }
    
    // Draw data polygon with gradient
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, `hsla(${accentHue}, 70%, 60%, 0.5)`);
    gradient.addColorStop(0.6, `hsla(${accentHue}, 60%, 50%, 0.25)`);
    gradient.addColorStop(1, `hsla(${accentHue}, 50%, 45%, 0.1)`);
    
    ctx.beginPath();
    for (let i = 0; i < numStats; i++) {
        const angle = (i * angleStep) - Math.PI / 2;
        const value = statValues[i] / 10;
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Draw outline with glow
    ctx.shadowColor = `hsla(${accentHue}, 70%, 60%, 0.6)`;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = `hsla(${accentHue}, 70%, 60%, 0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Draw data points
    for (let i = 0; i < numStats; i++) {
        const angle = (i * angleStep) - Math.PI / 2;
        const value = statValues[i] / 10;
        const x = centerX + Math.cos(angle) * radius * value;
        const y = centerY + Math.sin(angle) * radius * value;
        
        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${accentHue}, 70%, 60%, 0.4)`;
        ctx.fill();
        
        // Point
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        const pointGradient = ctx.createRadialGradient(x, y, 0, x, y, 4);
        pointGradient.addColorStop(0, `hsl(${(parseInt(accentHue) + 30) % 360}, 70%, 60%)`);
        pointGradient.addColorStop(1, `hsl(${accentHue}, 70%, 55%)`);
        ctx.fillStyle = pointGradient;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    
    // Draw labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < numStats; i++) {
        const angle = (i * angleStep) - Math.PI / 2;
        const labelRadius = radius + 16;
        const x = centerX + Math.cos(angle) * labelRadius;
        const y = centerY + Math.sin(angle) * labelRadius;
        
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 8px "Bebas Neue", sans-serif';
        ctx.fillText(statNames[i], x, y);
    }
}

/* ============================================
   PANELS
   ============================================ */

function updatePanels(charData) {
    // Bio
    elements.bioAge.textContent = charData.age || '--';
    elements.bioHeight.textContent = charData.height || '--';
    
    // Appearance
    if (charData.appearance) {
        elements.appearanceContent.innerHTML = `
            <p class="text-en">${parseLinks(charData.appearance.en)}</p>
            <p class="text-jp">${parseLinks(charData.appearance.jp)}</p>
        `;
    }
    
    // Personality
    if (charData.personality) {
        elements.personalityContent.innerHTML = `
            <p class="text-en">${parseLinks(charData.personality.en)}</p>
            <p class="text-jp">${parseLinks(charData.personality.jp)}</p>
        `;
    }
    
    // Abilities
    if (charData.abilities) {
        elements.abilitiesContent.innerHTML = `
            <p class="text-en">${parseLinks(charData.abilities.en)}</p>
            <p class="text-jp">${parseLinks(charData.abilities.jp)}</p>
        `;
    }
    
    // Lore
    if (charData.lore) {
        elements.loreContent.innerHTML = `
            <p class="text-en">${parseLinks(charData.lore.en)}</p>
            <p class="text-jp">${parseLinks(charData.lore.jp)}</p>
        `;
    }
}

function parseLinks(text) {
    // Convert [[CHARACTER_ID|Display Text]] to clickable links
    return text.replace(/\[\[(\w+)\|([^\]]+)\]\]/g, (match, id, displayText) => {
        return `<span class="character-link" data-character="${id}">${displayText}</span>`;
    });
}

/* ============================================
   COLOR PALETTE
   ============================================ */

function updateColorPalette(charData) {
    const palette = charData.colorPalette || {};
    const primary = palette.primary || [];
    const secondary = palette.secondary || [];
    
    let html = '';
    
    // Primary colors (larger swatches)
    if (primary.length > 0) {
        html += '<div class="palette-row primary">';
        primary.forEach(color => {
            html += createSwatchHTML(color, true);
        });
        html += '</div>';
    }
    
    // Secondary colors
    if (secondary.length > 0) {
        html += '<div class="palette-row secondary">';
        secondary.forEach(color => {
            html += createSwatchHTML(color, false);
        });
        html += '</div>';
    }
    
    elements.paletteContent.innerHTML = html;
    
    // Add click-to-copy functionality
    elements.paletteContent.querySelectorAll('.swatch-color').forEach(swatch => {
        swatch.addEventListener('click', () => {
            const hex = swatch.dataset.hex;
            navigator.clipboard.writeText(hex).then(() => {
                swatch.classList.add('copied');
                setTimeout(() => swatch.classList.remove('copied'), 1000);
            });
        });
    });
}

function createSwatchHTML(color, isPrimary) {
    return `
        <div class="color-swatch">
            <div class="swatch-color" style="background-color: ${color.hex}" data-hex="${color.hex}"></div>
            <div class="swatch-info">
                <span class="swatch-label">${color.name}</span>
                <span class="swatch-hex">${color.hex}</span>
            </div>
        </div>
    `;
}

/* ============================================
   LIGHTBOX
   ============================================ */

function openLightbox(index) {
    if (index < 0 || index >= state.mediaItems.length) return;
    
    state.lightboxIndex = index;
    const item = state.mediaItems[index];
    
    // Reset display
    elements.lightboxImage.classList.remove('active');
    elements.lightboxVideo.classList.remove('active');
    elements.lightboxVideo.pause();
    
    if (item.type === 'image') {
        elements.lightboxImage.src = assetUrl(item.src);
        if (item.pixelArt) elements.lightboxImage.classList.add('pixel-art');
        else elements.lightboxImage.classList.remove('pixel-art');
        elements.lightboxImage.classList.add('active');
        elements.downloadBtn.href = assetUrl(item.src);
        elements.downloadBtn.download = `${state.currentCharacter.id}_${item.label.en || 'reference'}.png`;
        elements.downloadBtn.style.display = 'flex';
    } else {
        elements.lightboxVideo.src = assetUrl(item.src);
        elements.lightboxVideo.classList.add('active');
        elements.lightboxVideo.play();
        elements.downloadBtn.href = assetUrl(item.src);
        elements.downloadBtn.download = `${state.currentCharacter.id}_motion_reference.mp4`;
        elements.downloadBtn.style.display = 'flex';
    }
    
    elements.lightboxLabel.textContent = item.label.en || 'Reference';
    updateLightboxCounter();
    elements.lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function updateLightboxCounter() {
    const counter = document.getElementById('lightbox-counter');
    if (counter) {
        counter.textContent = `${state.lightboxIndex + 1} / ${state.mediaItems.length}`;
    }
}

function closeLightbox() {
    elements.lightbox.classList.remove('active');
    elements.lightboxVideo.pause();
    document.body.style.overflow = '';
}

function navigateLightbox(direction) {
    const total = state.mediaItems.length;
    state.lightboxIndex = (state.lightboxIndex + direction + total) % total;
    
    const item = state.mediaItems[state.lightboxIndex];
    
    // Animate transition
    const content = elements.lightbox.querySelector('.lightbox-content');
    content.style.opacity = '0';
    content.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
        // Reset display
        elements.lightboxImage.classList.remove('active');
        elements.lightboxVideo.classList.remove('active');
        elements.lightboxVideo.pause();
        
        if (item.type === 'image') {
            elements.lightboxImage.src = assetUrl(item.src);
            if (item.pixelArt) elements.lightboxImage.classList.add('pixel-art');
            else elements.lightboxImage.classList.remove('pixel-art');
            elements.lightboxImage.classList.add('active');
            elements.downloadBtn.href = assetUrl(item.src);
            elements.downloadBtn.download = `${state.currentCharacter.id}_${item.label.en || 'reference'}.png`;
        } else {
            elements.lightboxVideo.src = assetUrl(item.src);
            elements.lightboxVideo.classList.add('active');
            elements.lightboxVideo.play();
            elements.downloadBtn.href = assetUrl(item.src);
            elements.downloadBtn.download = `${state.currentCharacter.id}_motion_reference.mp4`;
        }
        
        elements.lightboxLabel.textContent = item.label.en || 'Reference';
        updateLightboxCounter();
        
        content.style.opacity = '1';
        content.style.transform = 'scale(1)';
    }, 150);
}

/* ============================================
   EVENT LISTENERS
   ============================================ */

function setupEventListeners() {
    // Back button
    elements.backBtn.addEventListener('click', showSelectPage);
    
    // Character grid selection
    elements.characterGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.character-card');
        if (card) {
            loadCharacter(card.dataset.id);
        }
    });
    
    // Carousel item selection
    elements.carouselTrack.addEventListener('click', (e) => {
        const item = e.target.closest('.carousel-item');
        if (item) {
            const index = parseInt(item.dataset.index);
            updateMainDisplay(index);
        }
    });
    
    // Carousel navigation
    elements.carouselPrev.addEventListener('click', () => scrollCarousel(-1));
    elements.carouselNext.addEventListener('click', () => scrollCarousel(1));
    
    // Main display click (open lightbox)
    elements.mainImageWrapper.addEventListener('click', () => {
        if (state.currentCharacter) {
            openLightbox(state.currentMediaIndex);
        }
    });
    
    // Lightbox controls
    elements.lightboxClose.addEventListener('click', closeLightbox);
    elements.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
    elements.lightboxNext.addEventListener('click', () => navigateLightbox(1));
    
    // Close lightbox on backdrop click
    elements.lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (elements.lightbox.classList.contains('active')) {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') navigateLightbox(-1);
            if (e.key === 'ArrowRight') navigateLightbox(1);
        } else if (!elements.characterPage.classList.contains('hidden')) {
            if (e.key === 'Escape') showSelectPage();
        }
    });
    
    // Character links in profile text
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('character-link')) {
            const characterId = e.target.dataset.character;
            if (characterId) {
                loadCharacter(characterId);
            }
        }
    });
    
    // Window resize - redraw chart
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.currentCharacter) {
                drawRadarChart(state.currentCharacter.stats);
            }
        }, 250);
    });
    
    // Handle browser back/forward navigation
    window.addEventListener('popstate', () => {
        const characterId = getCharacterFromURL();
        if (characterId && state.characters.find(c => c.id === characterId)) {
            loadCharacter(characterId);
        } else {
            // No character in URL, show select page
            resetThemeColor();
            elements.characterPage.classList.remove('visible');
            setTimeout(() => {
                elements.characterPage.classList.add('hidden');
                elements.selectPage.classList.remove('hidden');
                elements.selectPage.style.animation = 'none';
                elements.selectPage.offsetHeight;
                elements.selectPage.style.animation = '';
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 300);
        }
    });
}

/* ============================================
   START APPLICATION
   ============================================ */

document.addEventListener('DOMContentLoaded', init);
