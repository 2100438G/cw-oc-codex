///@ts-nocheck
/* ============================================
	THE CARD WARS CODEX
	Script — Language · Cut-In · Grid Gallery
	============================================ */

gsap.registerPlugin(ScrollTrigger);

const state = {
	characters: [],
	currentCharacter: null,
	mediaItems: [],
	lightboxIndex: 0,
	scrollTriggers: [],
	heroTimeline: null,
	currentLang: 'jp',
	translations: {}
};

function assetUrl(src) { return 'assets/' + src; }
function thumbUrl(src) { return 'assets/thumb/' + src; }

/* ============================================
	LANGUAGE SYSTEM
	============================================ */

function t(key) {
	const entry = state.translations[key];
	if (!entry) return key;
	return entry[state.currentLang] || entry.en || key;
}

function getLangFromURL() {
	const params = new URLSearchParams(window.location.search);
	return params.get('lang') || 'jp';
}

function syncLangURL() {
	const url = new URL(window.location);
	if (state.currentLang === 'jp') url.searchParams.delete('lang');
	else url.searchParams.set('lang', state.currentLang);
	history.replaceState(null, '', url.toString());
}

function getText(obj) {
	if (!obj) return '';
	if (typeof obj === 'string') return obj;
	return obj[state.currentLang] || obj.en || '';
}

function toggleLanguage() {
	state.currentLang = state.currentLang === 'jp' ? 'en' : 'jp';
	syncLangURL();
	updateLangToggleUI();
	updateAllLangElements();
	if (state.currentCharacter) refreshCharacterDisplay();
}

function updateLangToggleUI() {
	document.querySelectorAll('.lang-option').forEach(opt => {
		opt.classList.toggle('active', opt.dataset.lang === state.currentLang);
	});
	document.documentElement.lang = state.currentLang === 'jp' ? 'ja' : 'en';
}

function updateAllLangElements() {
	document.querySelectorAll('[data-lang-key]').forEach(el => {
		const key = el.dataset.langKey;
		el.textContent = t(key);
	});
	document.querySelectorAll('.gallery-zone-title-jp[data-lang-key]').forEach(el => {
		el.textContent = t(el.dataset.langKey);
	});
}

/* ============================================
	DOM ELEMENTS
	============================================ */

const els = {
	loadingScreen: document.getElementById('loading-screen'),
	selectPage: document.getElementById('select-page'),
	characterPage: document.getElementById('character-page'),
	characterGrid: document.getElementById('character-grid'),
	backBtn: document.getElementById('back-btn'),
	langToggle: document.getElementById('lang-toggle'),

	heroImage: document.getElementById('hero-image'),
	heroTitlePrimary: document.getElementById('hero-title-primary'),
	heroTitleSecondary: document.getElementById('hero-title-secondary'),
	heroTagline: document.getElementById('hero-tagline'),
	heroBadges: document.getElementById('hero-badges'),

	galleryGridOfficial: document.getElementById('gallery-grid-official'),
	galleryGridCommissioned: document.getElementById('gallery-grid-commissioned'),

	profileArtImg: document.getElementById('profile-art-img'),
	profileStats: document.getElementById('profile-stats'),
	detailAppearance: document.getElementById('detail-appearance'),
	detailPersonality: document.getElementById('detail-personality'),
	detailAbilities: document.getElementById('detail-abilities'),
	detailLore: document.getElementById('detail-lore'),

	radarChart: document.getElementById('radar-chart'),
	statsList: document.getElementById('stats-list'),
	paletteContent: document.getElementById('palette-content'),

	lightbox: document.getElementById('lightbox'),
	lightboxImage: document.getElementById('lightbox-image'),
	lightboxVideo: document.getElementById('lightbox-video'),
	lightboxLabel: document.getElementById('lightbox-label'),
	lightboxCounter: document.getElementById('lightbox-counter'),
	lightboxPrev: document.getElementById('lightbox-prev'),
	lightboxNext: document.getElementById('lightbox-next'),
	downloadBtn: document.getElementById('download-btn'),
	lightboxClose: document.getElementById('lightbox-close')
};

/* ============================================
	THEME COLORS
	============================================ */

function hexToHSL(hex) {
	hex = hex.replace('#', '');
	let r = parseInt(hex.substring(0, 2), 16) / 255;
	let g = parseInt(hex.substring(2, 4), 16) / 255;
	let b = parseInt(hex.substring(4, 6), 16) / 255;
	let max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h, s, l = (max + min) / 2;
	if (max === min) { h = s = 0; }
	else {
		let d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
			case g: h = ((b - r) / d + 2) / 6; break;
			case b: h = ((r - g) / d + 4) / 6; break;
		}
	}
	return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function applyThemeColor(color) {
	const root = document.documentElement;
	const hsl = hexToHSL(color);
	root.style.setProperty('--accent-hue', hsl.h);
	root.style.setProperty('--accent-primary', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`);
	root.style.setProperty('--accent-secondary', `hsl(${hsl.h}, ${Math.min(hsl.s + 10, 100)}%, ${Math.max(hsl.l - 10, 30)}%)`);
	root.style.setProperty('--accent-tertiary', `hsl(${(hsl.h + 20) % 360}, ${hsl.s}%, ${hsl.l}%)`);
	root.style.setProperty('--selection-text', hsl.l > 55 ? '#050508' : '#f0f0f5');
	if (particleSystem) particleSystem.setHue(hsl.h);
}

function resetThemeColor() {
	const root = document.documentElement;
	root.style.setProperty('--accent-hue', '245');
	root.style.setProperty('--accent-primary', '#6366f1');
	root.style.setProperty('--accent-secondary', '#8b5cf6');
	root.style.setProperty('--accent-tertiary', '#a855f7');
	root.style.setProperty('--selection-text', '#050508');
}

/* ============================================
	PARTICLE SYSTEM
	============================================ */

let particleSystem = null;

function createParticleSystem(canvas, hue) {
	const ctx = canvas.getContext('2d');
	let particles = [], h = hue || 245, running = true, animId = null;

	function resize() {
		const rect = canvas.parentElement.getBoundingClientRect();
		canvas.width = rect.width * window.devicePixelRatio;
		canvas.height = rect.height * window.devicePixelRatio;
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
	}

	function spawn() {
		if (particles.length >= 50) return;
		const w = canvas.width / window.devicePixelRatio;
		const ch = canvas.height / window.devicePixelRatio;
		particles.push({
			x: Math.random() * w, y: ch + 10,
			size: Math.random() * 2.2 + 0.6,
			speed: Math.random() * 0.5 + 0.15,
			opacity: Math.random() * 0.45 + 0.12,
			drift: Math.random() * 0.35 - 0.175, life: 1
		});
	}

	function update() {
		if (!running) return;
		const w = canvas.width / window.devicePixelRatio;
		const ch = canvas.height / window.devicePixelRatio;
		ctx.clearRect(0, 0, w, ch);
		spawn();
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.y -= p.speed; p.x += p.drift; p.life -= 0.0025;
			if (p.y < -10 || p.life <= 0) { particles.splice(i, 1); continue; }
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
			ctx.fillStyle = `hsla(${h}, 70%, 65%, ${p.opacity * p.life})`;
			ctx.fill();
		}
		animId = requestAnimationFrame(update);
	}

	resize(); update();
	return {
		setHue(v) { h = v; },
		resize, start() { running = true; update(); },
		stop() { running = false; if (animId) cancelAnimationFrame(animId); }
	};
}

/* ============================================
	INITIALIZATION
	============================================ */

async function init() {
	state.currentLang = getLangFromURL();
	updateLangToggleUI();
	document.documentElement.lang = state.currentLang === 'jp' ? 'ja' : 'en';

	try {
		const langRes = await fetch('lang.json');
		state.translations = await langRes.json();
		updateAllLangElements();

		const response = await fetch('characters.json');
		state.characters = await response.json();
		buildCharacterGrid();
		setupEventListeners();

		const characterId = getCharacterFromURL();
		if (characterId && state.characters.find(c => c.id === characterId)) {
			setTimeout(() => { els.loadingScreen.classList.add('fade-out'); loadCharacter(characterId); }, 800);
		} else {
			setTimeout(() => { els.loadingScreen.classList.add('fade-out'); }, 800);
		}
	} catch (error) {
		console.error('Failed to initialize:', error);
		els.loadingScreen.innerHTML = '<div class="loader"><p style="color:#ef4444;font-family:\'Bebas Neue\';letter-spacing:0.2em;">ERROR LOADING DATA</p><p style="color:#64748b;font-size:0.75rem;margin-top:0.5rem;">データの読み込みに失敗しました</p></div>';
	}
}

/* ============================================
	SELECT GRID
	============================================ */

function buildCharacterGrid() {
	els.characterGrid.innerHTML = state.characters.map((char, index) => `
<div class="character-card" data-id="${char.id}"
style="--card-accent: ${char.themeColor || '#6366f1'};
background-image: url('${assetUrl('characters/' + char.id + '/main.png')}')">
<div class="card-content">
<span class="card-index">${String(index + 1).padStart(2, '0')}</span>
<p class="card-name-jp">${char.name.jp}</p>
<h3 class="card-name-en">${char.name.en}</h3>
${char.tagline ? `<p class="card-tagline">${getText(char.tagline)}</p>` : ''}
</div>
</div>
`).join('');

	setTimeout(() => {
		document.querySelectorAll('.character-card').forEach((card, i) => {
			setTimeout(() => card.classList.add('visible'), i * 120);
		});
		setupCardTilt();
	}, 600);
}

function setupCardTilt() {
	document.querySelectorAll('.character-card').forEach(card => {
		card.addEventListener('mousemove', (e) => {
			const rect = card.getBoundingClientRect();
			const x = (e.clientX - rect.left) / rect.width - 0.5;
			const y = (e.clientY - rect.top) / rect.height - 0.5;
			gsap.to(card, { rotateY: x * 6, rotateX: -y * 6, duration: 0.6, ease: 'power2.out', overwrite: 'auto' });
		});
		card.addEventListener('mouseleave', () => {
			gsap.to(card, { rotateY: 0, rotateX: 0, duration: 0.8, ease: 'power2.out', overwrite: 'auto' });
		});
	});
}

/* ============================================
	PAGE NAVIGATION & URL ROUTING
	============================================ */

function showSelectPage() {
	resetThemeColor();
	const url = new URL(window.location);
	url.hash = '';
	if (state.currentLang !== 'jp') url.searchParams.set('lang', state.currentLang);
	else url.searchParams.delete('lang');
	history.pushState(null, '', url.toString());

	els.characterPage.classList.remove('visible');
	if (particleSystem) { particleSystem.stop(); particleSystem = null; }
	killScrollTriggers();

	setTimeout(() => {
		els.characterPage.classList.add('hidden');
		els.selectPage.classList.remove('hidden');
		els.selectPage.style.animation = 'none';
		els.selectPage.offsetHeight;
		els.selectPage.style.animation = '';
		window.scrollTo({ top: 0, behavior: 'instant' });
		updateAllLangElements();
	}, 300);
}

function showCharacterPage() {
	els.selectPage.classList.add('hidden');
	els.characterPage.classList.remove('hidden');
	setTimeout(() => els.characterPage.classList.add('visible'), 50);
}

function updateURLHash(characterId) {
	const url = new URL(window.location);
	url.hash = characterId;
	if (state.currentLang !== 'jp') url.searchParams.set('lang', state.currentLang);
	else url.searchParams.delete('lang');
	history.pushState(null, '', url.toString());
}

function getCharacterFromURL() {
	const hash = window.location.hash.slice(1);
	return hash.split('?')[0] || null;
}

function killScrollTriggers() {
	state.scrollTriggers.forEach(st => st.kill());
	state.scrollTriggers = [];
	if (state.heroTimeline) { state.heroTimeline.kill(); state.heroTimeline = null; }
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

		updateURLHash(characterId);
		if (charData.themeColor) applyThemeColor(charData.themeColor);

		buildMediaArray(charData);
		showCharacterPage();
		killScrollTriggers();
		resetDisplayElements();

		updateHero(charData);
		updateDetails(charData);
		updateGallery(charData);
		updateStats(charData);
		updateColorPalette(charData);
		updateAllLangElements();

		setTimeout(() => {
			setupScrollTriggers();
		}, 150);
		window.scrollTo({ top: 0, behavior: 'instant' });
		setTimeout(() => {
			if (state.currentCharacter) drawRadarChart(state.currentCharacter.stats);
		}, 400);

	} catch (error) {
		console.error('Failed to load character:', error);
	}
}

function buildMediaArray(charData) {
	state.mediaItems = [];
	if (charData.assets) {
		charData.assets.forEach(item => {
			state.mediaItems.push({
				type: item.type || 'image',
				src: item.src, label: item.label,
				pixelArt: item.pixelArt === true,
				category: item.category || 'other',
				artist: item.artist || null
			});
		});
	}
}

function resetDisplayElements() {
	if (els.heroImage) { els.heroImage.src = ''; els.heroImage.classList.remove('pixel-art'); }
	if (els.heroTitlePrimary) els.heroTitlePrimary.textContent = '';
	if (els.heroTitleSecondary) els.heroTitleSecondary.textContent = '';
	if (els.heroBadges) els.heroBadges.textContent = '';
	if (els.heroTagline) els.heroTagline.textContent = '';
	if (els.profileArtImg) els.profileArtImg.src = '';
	if (els.profileStats) els.profileStats.textContent = '';
	if (els.detailAppearance) els.detailAppearance.innerHTML = '';
	if (els.detailPersonality) els.detailPersonality.innerHTML = '';
	if (els.detailAbilities) els.detailAbilities.innerHTML = '';
	if (els.detailLore) els.detailLore.innerHTML = '';
	if (els.galleryGridOfficial) els.galleryGridOfficial.innerHTML = '';
	if (els.galleryGridCommissioned) els.galleryGridCommissioned.innerHTML = '';
	if (els.statsList) els.statsList.innerHTML = '';
	if (els.paletteContent) els.paletteContent.innerHTML = '';
}

/* ============================================
	IMAGE HELPERS
	============================================ */

function findInAssets(assets, pattern) {
	if (!assets) return null;
	return assets.find(a => a.src && a.src.includes(pattern));
}

function updateTitles(charData) {
	const jpName = charData.name.jp;
	const enName = charData.name.en;
	const isJP = state.currentLang === 'jp';

	els.heroTitlePrimary.textContent = isJP ? jpName : enName;
	els.heroTitleSecondary.textContent = isJP ? enName : jpName;
	els.heroTitlePrimary.style.fontFamily = isJP ? '\'Zen Kaku Gothic New\', sans-serif' : '\'Bebas Neue\', sans-serif';
	els.heroTitleSecondary.style.fontFamily = isJP ? '\'Bebas Neue\', sans-serif' : '\'Zen Kaku Gothic New\', sans-serif';
}

function refreshCharacterDisplay() {
	if (!state.currentCharacter) return;
	const c = state.currentCharacter;

	updateTitles(c);

	els.heroBadges.textContent = c.age && c.height ? `${t('age')} ${c.age}  ·  ${t('height')} ${c.height}` : '';
	els.heroTagline.textContent = getText(c.tagline);
	els.profileStats.textContent = c.age && c.height ? `${t('age')} ${c.age}  ·  ${t('height')} ${c.height}` : '';

	if (c.appearance) els.detailAppearance.innerHTML = `<p>${parseLinks(getText(c.appearance))}</p>`;
	if (c.personality) els.detailPersonality.innerHTML = `<p>${parseLinks(getText(c.personality))}</p>`;
	if (c.abilities) els.detailAbilities.innerHTML = `<p>${parseLinks(getText(c.abilities))}</p>`;
	if (c.lore) els.detailLore.innerHTML = `<p>${parseLinks(getText(c.lore))}</p>`;

	updateGalleryLabels();
	updateAllLangElements();
}

function updateGalleryLabels() {
	document.querySelectorAll('.gallery-item').forEach(item => {
		const idx = parseInt(item.dataset.index);
		if (isNaN(idx) || idx >= state.mediaItems.length) return;
		const media = state.mediaItems[idx];
		const labelEl = item.querySelector('.gallery-item-label');
		const artistEl = item.querySelector('.gallery-item-artist');
		if (labelEl) labelEl.textContent = getText(media.label);
		if (artistEl) artistEl.textContent = media.artist || '';
	});
}

/* ============================================
	HERO SECTION
	============================================ */

function updateHero(charData) {
	const heroArt = findInAssets(charData.assets, 'main.png') || state.mediaItems[0];
	if (heroArt && heroArt.type === 'image') {
		els.heroImage.src = assetUrl(heroArt.src);
		els.heroImage.alt = getText(heroArt.label) || charData.name.en;
		if (heroArt.pixelArt) els.heroImage.classList.add('pixel-art');
		else els.heroImage.classList.remove('pixel-art');
	}

	updateTitles(charData);
	els.heroBadges.textContent = charData.age && charData.height ? `${t('age')} ${charData.age}  ·  ${t('height')} ${charData.height}` : '';
	els.heroTagline.textContent = getText(charData.tagline);

	const hsl = hexToHSL(charData.themeColor || '#6366f1');
	startParticleSystem(hsl.h);
	animateHeroCutin();
}

function startParticleSystem(hue) {
	if (particleSystem) particleSystem.stop();
	particleSystem = createParticleSystem(document.getElementById('particle-canvas'), hue || 245);
}

function animateHeroCutin() {
	const speedlines = document.querySelector('.hero-speedlines');
	const leftB = document.querySelector('.hero-bracket-left');
	const rightB = document.querySelector('.hero-bracket-right');
	const img = els.heroImage;

	gsap.set(img, { opacity: 0, scale: 0.92 });
	gsap.set(speedlines, { x: -30, opacity: 0 });
	gsap.set(leftB, { left: 'calc(50% - 2vw)', top: '42%', opacity: 0 });
	gsap.set(rightB, { right: 'calc(50% - 2vw)', top: '42%', opacity: 0 });
	gsap.set(els.heroTitlePrimary, { opacity: 0, y: 10 });
	gsap.set(els.heroTitleSecondary, { opacity: 0, y: 6 });
	gsap.set(els.heroBadges, { opacity: 0, y: 5 });
	gsap.set('.hero-underline', { opacity: 0, scaleX: 0 });
	gsap.set(els.heroTagline, { opacity: 0, y: 5 });

	const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

	tl.to(speedlines, { opacity: 0.4, x: 0, duration: 0.25 })
		.to(leftB, { left: '2vw', top: '36%', opacity: 0.55, duration: 0.4, ease: 'power4.out' }, '-=0.18')
		.to(rightB, { right: '2vw', top: '48%', opacity: 0.55, duration: 0.4, ease: 'power4.out' }, '-=0.34')

		.to(img, { opacity: 1, scale: 1, duration: 0.25 }, '-=0.25')
		.to(speedlines, { opacity: 0.12, x: 25, duration: 1 }, '-=0.15')

		.to(els.heroBadges, { opacity: 1, y: 0, duration: 0.15 }, '-=0.25')
		.to(els.heroTitlePrimary, { opacity: 1, y: 0, duration: 0.22, ease: 'power4.out' }, '-=0.1')
		.to(els.heroTitleSecondary, { opacity: 1, y: 0, duration: 0.12 }, '-=0.12')
		.to('.hero-underline', { opacity: 1, scaleX: 1, duration: 0.18 }, '-=0.08')
		.to(els.heroTagline, { opacity: 1, y: 0, duration: 0.15 }, '-=0.1');

	state.heroTimeline = tl;

	gsap.to(speedlines, { x: 60, opacity: 0.06, duration: 4, delay: 0.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });
}

/* ============================================
	GALLERY — GRID
	============================================ */

function updateGallery(charData) {
	const official = state.mediaItems.filter(m => m.category === 'official' || m.category === 'reference');
	const commissioned = state.mediaItems.filter(m => m.category === 'skeb');
	const other = state.mediaItems.filter(m => !['official', 'reference', 'skeb'].includes(m.category));
	const allOfficial = [...official, ...other];

	els.galleryGridOfficial.innerHTML = buildGalleryItems(allOfficial);
	els.galleryGridCommissioned.innerHTML = buildGalleryItems(commissioned);

	document.getElementById('gallery-section-commissioned').style.display = commissioned.length === 0 ? 'none' : '';
}

function buildGalleryItems(items) {
	if (items.length === 0) return '<p style="color:var(--text-muted);font-size:0.8rem;letter-spacing:0.08em;padding:1rem;">—</p>';

	return items.map((item) => {
		const mediaIndex = state.mediaItems.indexOf(item);
		const isVideo = item.type === 'video';
		const label = getText(item.label);
		const pixelClass = !isVideo && item.pixelArt ? 'pixel-art' : '';
		const hasArtist = item.artist && item.category === 'skeb';

		if (isVideo) {
			return `<div class="gallery-item" data-index="${mediaIndex}" data-type="video">
<video src="${assetUrl(item.src)}#t=0.1" muted preload="auto" playsinline></video>
<div class="gallery-item-play"></div>
<div class="gallery-item-overlay"><span class="gallery-item-label">${label}</span></div>
</div>`;
		}
		return `<div class="gallery-item" data-index="${mediaIndex}" data-type="image">
<img src="${thumbUrl(item.src)}" alt="${label}" class="${pixelClass}" loading="lazy" decoding="async" />
<div class="gallery-item-overlay">
<span class="gallery-item-label">${label}</span>
${hasArtist ? `<span class="gallery-item-artist">@${item.artist}</span>` : ''}
</div>
</div>`;
	}).join('');
}

/* ============================================
	DETAILS
	============================================ */

function updateDetails(charData) {
	const potrait = findInAssets(charData.assets, 'potrait_main.png') || findInAssets(charData.assets, 'potrait_alt.png');
	if (potrait) {
		els.profileArtImg.src = assetUrl(potrait.src);
		if (potrait.pixelArt) els.profileArtImg.classList.add('pixel-art');
		document.getElementById('profile-art-container').style.display = '';
	} else {
		document.getElementById('profile-art-container').style.display = 'none';
	}

	els.profileStats.textContent = charData.age && charData.height ? `${t('age')} ${charData.age}  ·  ${t('height')} ${charData.height}` : '';
	if (charData.appearance) els.detailAppearance.innerHTML = `<p>${parseLinks(getText(charData.appearance))}</p>`;
	if (charData.personality) els.detailPersonality.innerHTML = `<p>${parseLinks(getText(charData.personality))}</p>`;
	if (charData.abilities) els.detailAbilities.innerHTML = `<p>${parseLinks(getText(charData.abilities))}</p>`;
	if (charData.lore) els.detailLore.innerHTML = `<p>${parseLinks(getText(charData.lore))}</p>`;
}

function parseLinks(text) {
	return text.replace(/\[\[(\w+)\|([^\]]+)\]\]/g, (match, id, displayText) => {
		return `<span class="character-link" data-character="${id}">${displayText}</span>`;
	});
}

/* ============================================
	SCROLL TRIGGERS
	============================================ */

function setupScrollTriggers() {
	const preference = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (preference) return;
	const dur = 0.5;

	['#profile-section', '#abilities-section', '#lore-section'].forEach(id => {
		const st = ScrollTrigger.create({
			trigger: id,
			start: 'top 88%',
			onEnter: () => {
				gsap.fromTo(id, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: dur, ease: 'power3.out' });
			},
			once: true
		});
		state.scrollTriggers.push(st);
	});

	const statsST = ScrollTrigger.create({
		trigger: '#stats-palette-section',
		start: 'top 88%',
		onEnter: () => {
			gsap.fromTo('#stats-palette-section .sp-block',
				{ opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: dur, stagger: 0.12, ease: 'power3.out' });
			animateRadarChart();
		},
		once: true
	});
	state.scrollTriggers.push(statsST);
}

/* ============================================
	STATS
	============================================ */

function updateStats(charData) {
	const stats = charData.stats || {};
	drawRadarChart(stats);
	els.statsList.innerHTML = Object.entries(stats).map(([name, value]) => `
<div class="stat-item"><span class="stat-name">${name}</span><span class="stat-val">${value}</span></div>
`).join('');
}

function drawRadarChart(stats) {
	const canvas = els.radarChart;
	const ctx = canvas.getContext('2d');
	const container = canvas.parentElement;
	const size = Math.min(container.clientWidth, container.clientHeight, 150);
	canvas.width = size * 2; canvas.height = size * 2;
	canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
	ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.scale(2, 2);

	const cx = size / 2, cy = size / 2, radius = size * 0.38;
	const statNames = Object.keys(stats), statValues = Object.values(stats);
	const numStats = statNames.length, angleStep = (Math.PI * 2) / numStats;
	const hue = getComputedStyle(document.documentElement).getPropertyValue('--accent-hue').trim() || '245';

	ctx.clearRect(0, 0, size, size);
	for (let i = 1; i <= 5; i++) {
		const r = (radius / 5) * i;
		ctx.beginPath();
		ctx.strokeStyle = `hsla(${hue},70%,60%,${0.05 + i * 0.02})`; ctx.lineWidth = 1;
		for (let j = 0; j <= numStats; j++) {
			const a = (j * angleStep) - Math.PI / 2;
			const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
			j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
		}
		ctx.closePath(); ctx.stroke();
	}
	ctx.strokeStyle = 'rgba(255,255,255,0.05)';
	for (let i = 0; i < numStats; i++) {
		const a = (i * angleStep) - Math.PI / 2;
		ctx.beginPath(); ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
		ctx.stroke();
	}
	const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
	grad.addColorStop(0, `hsla(${hue},70%,60%,0.5)`);
	grad.addColorStop(0.6, `hsla(${hue},60%,50%,0.25)`);
	grad.addColorStop(1, `hsla(${hue},50%,45%,0.1)`);
	ctx.beginPath();
	for (let i = 0; i < numStats; i++) {
		const a = (i * angleStep) - Math.PI / 2, v = statValues[i] / 10;
		const x = cx + Math.cos(a) * radius * v, y = cy + Math.sin(a) * radius * v;
		i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
	}
	ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
	ctx.shadowColor = `hsla(${hue},70%,60%,0.6)`; ctx.shadowBlur = 8;
	ctx.strokeStyle = `hsla(${hue},70%,60%,0.85)`; ctx.lineWidth = 2; ctx.stroke();
	ctx.shadowBlur = 0;
	for (let i = 0; i < numStats; i++) {
		const a = (i * angleStep) - Math.PI / 2, v = statValues[i] / 10;
		const x = cx + Math.cos(a) * radius * v, y = cy + Math.sin(a) * radius * v;
		ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
		ctx.fillStyle = `hsla(${hue},70%,60%,0.4)`; ctx.fill();
		ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
		const pg = ctx.createRadialGradient(x, y, 0, x, y, 2.5);
		pg.addColorStop(0, `hsl(${(parseInt(hue) + 30) % 360},70%,60%)`);
		pg.addColorStop(1, `hsl(${hue},70%,55%)`);
		ctx.fillStyle = pg; ctx.fill();
		ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
		ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
	}
	ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
	for (let i = 0; i < numStats; i++) {
		const a = (i * angleStep) - Math.PI / 2;
		ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 6px "Bebas Neue", sans-serif';
		ctx.fillText(statNames[i], cx + Math.cos(a) * (radius + 13), cy + Math.sin(a) * (radius + 13));
	}
}

function animateRadarChart() {
	const charData = state.currentCharacter;
	if (!charData) return;
	const stats = charData.stats || {};
	const canvas = els.radarChart;
	const ctx = canvas.getContext('2d');
	const container = canvas.parentElement;
	const size = Math.min(container.clientWidth, container.clientHeight, 150);
	canvas.width = size * 2; canvas.height = size * 2;
	const hue = getComputedStyle(document.documentElement).getPropertyValue('--accent-hue').trim() || '245';
	const statNames = Object.keys(stats), statValues = Object.values(stats);
	const numStats = statNames.length, angleStep = (Math.PI * 2) / numStats;
	const cx = size / 2, cy = size / 2, radius = size * 0.38;

	const drawFrame = () => {
		ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.clearRect(0, 0, size, size);
		for (let i = 1; i <= 5; i++) {
			const r = (radius / 5) * i;
			ctx.beginPath();
			ctx.strokeStyle = `hsla(${hue},70%,60%,${0.05 + i * 0.02})`; ctx.lineWidth = 1;
			for (let j = 0; j <= numStats; j++) {
				const a = (j * angleStep) - Math.PI / 2;
				const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
				j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
			}
			ctx.closePath(); ctx.stroke();
		}
		ctx.strokeStyle = 'rgba(255,255,255,0.05)';
		for (let i = 0; i < numStats; i++) {
			const a = (i * angleStep) - Math.PI / 2;
			ctx.beginPath(); ctx.moveTo(cx, cy);
			ctx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
			ctx.stroke();
		}
	};

	const drawProgress = (progress) => {
		drawFrame();
		const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
		grad.addColorStop(0, `hsla(${hue},70%,60%,0.5)`);
		grad.addColorStop(0.6, `hsla(${hue},60%,50%,0.25)`);
		grad.addColorStop(1, `hsla(${hue},50%,45%,0.1)`);
		ctx.beginPath();
		for (let i = 0; i < numStats; i++) {
			const a = (i * angleStep) - Math.PI / 2, v = (statValues[i] / 10) * progress;
			const x = cx + Math.cos(a) * radius * v, y = cy + Math.sin(a) * radius * v;
			i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
		}
		ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
		ctx.shadowColor = `hsla(${hue},70%,60%,0.6)`; ctx.shadowBlur = 8;
		ctx.strokeStyle = `hsla(${hue},70%,60%,0.85)`; ctx.lineWidth = 2; ctx.stroke();
		ctx.shadowBlur = 0;
		if (progress > 0.5) {
			const pa = progress * 2 - 1;
			for (let i = 0; i < numStats; i++) {
				const a = (i * angleStep) - Math.PI / 2, v = statValues[i] / 10;
				const x = cx + Math.cos(a) * radius * v, y = cy + Math.sin(a) * radius * v;
				ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2);
				ctx.fillStyle = `hsla(${hue},70%,60%,${0.4 * pa})`; ctx.fill();
				ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2);
				ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
			}
		}
		ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
		for (let i = 0; i < numStats; i++) {
			const a = (i * angleStep) - Math.PI / 2;
			ctx.fillStyle = '#cbd5e1'; ctx.font = 'bold 6px "Bebas Neue", sans-serif';
			ctx.fillText(statNames[i], cx + Math.cos(a) * (radius + 13), cy + Math.sin(a) * (radius + 13));
		}
	};

	gsap.to({ progress: 0 }, {
		progress: 1, duration: 1, ease: 'power3.out',
		onUpdate: function () { drawProgress(this.targets()[0].progress); }
	});
}

/* ============================================
	COLOR PALETTE
	============================================ */

function updateColorPalette(charData) {
	const palette = charData.colorPalette || {};
	const primary = palette.primary || [], secondary = palette.secondary || [];
	let html = '';
	if (primary.length > 0) {
		html += '<div class="palette-row primary">';
		primary.forEach(c => { html += createSwatchHTML(c); });
		html += '</div>';
	}
	if (secondary.length > 0) {
		html += '<div class="palette-row secondary">';
		secondary.forEach(c => { html += createSwatchHTML(c); });
		html += '</div>';
	}
	els.paletteContent.innerHTML = html;
	els.paletteContent.querySelectorAll('.swatch-color').forEach(swatch => {
		swatch.addEventListener('click', () => {
			const hex = swatch.dataset.hex;
			navigator.clipboard.writeText(hex).then(() => {
				swatch.classList.add('copied');
				setTimeout(() => swatch.classList.remove('copied'), 1000);
			});
		});
	});
}

function createSwatchHTML(color) {
	return `<div class="color-swatch">
<div class="swatch-color" style="background-color:${color.hex}" data-hex="${color.hex}"></div>
<div class="swatch-info"><span class="swatch-label">${color.name}</span><span class="swatch-hex">${color.hex}</span></div>
</div>`;
}

/* ============================================
	LIGHTBOX — video fixed, no src clearing
	============================================ */

function openLightbox(index) {
	if (index < 0 || index >= state.mediaItems.length) return;
	state.lightboxIndex = index;
	const item = state.mediaItems[index];

	els.lightboxImage.classList.remove('active');
	els.lightboxVideo.classList.remove('active');
	els.lightboxVideo.pause();

	if (item.type === 'image') {
		els.lightboxImage.src = assetUrl(item.src);
		if (item.pixelArt) els.lightboxImage.classList.add('pixel-art');
		else els.lightboxImage.classList.remove('pixel-art');
		els.lightboxImage.classList.add('active');
		els.downloadBtn.href = assetUrl(item.src);
		els.downloadBtn.download = `${state.currentCharacter.id}_${(getText(item.label) || 'ref').replace(/\s+/g, '_')}.png`;
	} else {
		els.lightboxVideo.src = assetUrl(item.src);
		els.lightboxVideo.classList.add('active');
		els.lightboxVideo.play();
		els.downloadBtn.href = assetUrl(item.src);
		els.downloadBtn.download = `${state.currentCharacter.id}_motion.mp4`;
	}

	els.lightboxLabel.textContent = getText(item.label);
	updateLightboxCounter();
	els.lightbox.style.display = 'flex';

	gsap.fromTo(els.lightbox, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: 'power2.out' });
	gsap.fromTo('.lightbox-container',
		{ opacity: 0, scale: 0.93, filter: 'blur(6px)' },
		{ opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.45, ease: 'power3.out' });

	els.lightbox.classList.add('active');
	document.body.style.overflow = 'hidden';
}

function updateLightboxCounter() {
	els.lightboxCounter.textContent = `${state.lightboxIndex + 1} / ${state.mediaItems.length}`;
}

function closeLightbox() {
	els.lightboxVideo.pause();
	gsap.to('.lightbox-container',
		{
			opacity: 0, scale: 0.94, duration: 0.2, ease: 'power2.in',
			onComplete: () => {
				els.lightbox.classList.remove('active');
				els.lightbox.style.display = 'none';
				document.body.style.overflow = '';
			}
		});
}

function navigateLightbox(direction) {
	const total = state.mediaItems.length;
	state.lightboxIndex = (state.lightboxIndex + direction + total) % total;
	const item = state.mediaItems[state.lightboxIndex];

	const content = els.lightbox.querySelector('.lightbox-content');
	gsap.to(content, {
		opacity: 0, scale: 0.95, duration: 0.1, ease: 'power2.in',
		onComplete: () => {
			els.lightboxImage.classList.remove('active');
			els.lightboxVideo.classList.remove('active');
			els.lightboxVideo.pause();

			if (item.type === 'image') {
				els.lightboxImage.src = assetUrl(item.src);
				if (item.pixelArt) els.lightboxImage.classList.add('pixel-art');
				else els.lightboxImage.classList.remove('pixel-art');
				els.lightboxImage.classList.add('active');
				els.downloadBtn.href = assetUrl(item.src);
				els.downloadBtn.download = `${state.currentCharacter.id}_${(getText(item.label) || 'ref').replace(/\s+/g, '_')}.png`;
			} else {
				els.lightboxVideo.src = assetUrl(item.src);
				els.lightboxVideo.classList.add('active');
				els.lightboxVideo.play();
				els.downloadBtn.href = assetUrl(item.src);
				els.downloadBtn.download = `${state.currentCharacter.id}_motion.mp4`;
			}

			els.lightboxLabel.textContent = getText(item.label);
			updateLightboxCounter();
			gsap.to(content, { opacity: 1, scale: 1, duration: 0.25, ease: 'power3.out' });
		}
	});
}

/* ============================================
	EVENT LISTENERS
	============================================ */

function setupEventListeners() {
	els.langToggle.addEventListener('click', toggleLanguage);
	els.backBtn.addEventListener('click', showSelectPage);

	els.characterGrid.addEventListener('click', (e) => {
		const card = e.target.closest('.character-card');
		if (card) loadCharacter(card.dataset.id);
	});

	function setupGalleryClicks(gridId) {
		const grid = document.getElementById(gridId);
		grid.addEventListener('click', (e) => {
			const item = e.target.closest('.gallery-item');
			if (item) openLightbox(parseInt(item.dataset.index));
		});
	}
	setupGalleryClicks('gallery-grid-official');
	setupGalleryClicks('gallery-grid-commissioned');

	els.heroImage.addEventListener('click', () => {
		if (state.currentCharacter && state.mediaItems.length > 0) openLightbox(0);
	});

	els.lightboxClose.addEventListener('click', closeLightbox);
	els.lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
	els.lightboxNext.addEventListener('click', () => navigateLightbox(1));
	els.lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

	document.addEventListener('keydown', (e) => {
		if (els.lightbox.classList.contains('active')) {
			if (e.key === 'Escape') closeLightbox();
			if (e.key === 'ArrowLeft') navigateLightbox(-1);
			if (e.key === 'ArrowRight') navigateLightbox(1);
		} else if (!els.characterPage.classList.contains('hidden')) {
			if (e.key === 'Escape') showSelectPage();
		}
	});

	document.addEventListener('click', (e) => {
		if (e.target.classList.contains('character-link')) {
			const cid = e.target.dataset.character;
			if (cid) loadCharacter(cid);
		}
	});

	let resizeTimeout;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(() => {
			if (particleSystem) particleSystem.resize();
			if (state.currentCharacter) drawRadarChart(state.currentCharacter.stats);
		}, 300);
	});

	window.addEventListener('popstate', () => {
		const newLang = getLangFromURL();
		if (newLang !== state.currentLang) {
			state.currentLang = newLang;
			updateLangToggleUI();
			document.documentElement.lang = state.currentLang === 'jp' ? 'ja' : 'en';
			if (state.currentCharacter) refreshCharacterDisplay();
		}
		const characterId = getCharacterFromURL();
		if (characterId && state.characters.find(c => c.id === characterId)) {
			loadCharacter(characterId);
		} else {
			resetThemeColor();
			if (particleSystem) { particleSystem.stop(); particleSystem = null; }
			killScrollTriggers();
			resetHeroPosition();
			els.characterPage.classList.remove('visible');
			setTimeout(() => {
				els.characterPage.classList.add('hidden');
				els.selectPage.classList.remove('hidden');
				els.selectPage.style.animation = 'none';
				els.selectPage.offsetHeight;
				els.selectPage.style.animation = '';
				updateAllLangElements();
				window.scrollTo({ top: 0, behavior: 'instant' });
			}, 300);
		}
	});
}

document.addEventListener('DOMContentLoaded', init);
