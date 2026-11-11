/* ==================================================================
   Carousel3D: a curved, draggable WebGL video carousel.

   Needs THREE (UMD build, r150+) and gsap loaded first.

     const c = Carousel3D.mount(sectionEl, {
       projects: [...],   // see work/projects.js
       tabs: [...],       // filter tabs; first one shows everything
       lang: 'en',        // 'en' | 'ar'
       aspect: 16 / 9,    // card shape
       scrollTo: fn       // optional (el, done) => scroll el into view, then call done()
       onOpen / onClose   // optional hooks (pause page scroll, hide nav)
     });
     c.setLang('ar');
     c.destroy();         // removes listeners, loop, textures, geometry

   Picking is analytic (mouse ray against the cylinder), because the
   curve and the speed bend happen in the vertex shader where a normal
   THREE.Raycaster cannot see them.
================================================================== */
(function () {
  'use strict';

  const VERT = /* glsl */`
    uniform float uX, uY, uR, uVel, uScale, uOpen, uW, uH;
    uniform vec2 uFull;
    varying vec2 vUv;
    varying float vShade;
    void main() {
      vUv = uv;
      vec2 p = position.xy * vec2(uW, uH) * uScale;
      // speed distortion: the middle of the card lags behind its edges and the card stretches
      float bow = sin(uv.y * 3.14159265);
      p.x += uVel * bow * uW * 0.10;
      p.x *= 1.0 + abs(uVel) * 0.05;
      p.y *= 1.0 - abs(uVel) * 0.035;
      // inside of a cylinder: x along the strip becomes an angle, sides come toward the camera
      float th = (uX + p.x) / uR;
      vec3 curved = vec3(uR * sin(th), p.y + uY, uR * (1.0 - cos(th)));
      // open state: a flat rectangle that exactly fills the view at z = 0
      vec3 flatP = vec3((uv.x - 0.5) * uFull.x, (uv.y - 0.5) * uFull.y, 0.0);
      vShade = mix(cos(th), 1.0, uOpen);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(mix(curved, flatP, uOpen), 1.0);
    }`;

  const FRAG = /* glsl */`
    uniform sampler2D uPoster;
    uniform sampler2D uVideo;
    uniform float uPosterOn, uReady, uAlpha, uPosterAspect, uVideoAspect;
    uniform float uCardAspect, uFullAspect, uOpen, uTime, uSeed;
    varying vec2 vUv;
    varying float vShade;
    vec2 cover(vec2 uv, float pa, float ta) {
      vec2 s = pa > ta ? vec2(1.0, ta / pa) : vec2(pa / ta, 1.0);
      return (uv - 0.5) * s + 0.5;
    }
    float sdBox(vec2 p, vec2 b, float r) {
      vec2 q = abs(p) - b + r;
      return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
    }
    vec3 placeholder(vec2 uv, float pa) {
      float t = uTime * 0.25 + uSeed * 6.0;
      vec3 deep = vec3(0.07, 0.05, 0.05), rec = vec3(1.0, 0.24, 0.18), sun = vec3(0.96, 0.94, 0.92);
      float w = 0.5 + 0.5 * sin(uv.x * 3.2 + t + sin(uv.y * 3.0 - t * 0.7) * 1.4);
      vec3 c = mix(deep, mix(rec, sun, uv.y), w * 0.45);
      float s = step(0.5, fract((uv.x * pa - uv.y) * 9.0 - t * 0.6));
      return c * (0.9 + 0.1 * s);
    }
    void main() {
      float pa = mix(uCardAspect, uFullAspect, uOpen);
      vec3 base = uPosterOn > 0.5 ? texture2D(uPoster, cover(vUv, pa, uPosterAspect)).rgb : placeholder(vUv, pa);
      vec3 vid = texture2D(uVideo, cover(vUv, pa, uVideoAspect)).rgb;
      vec3 col = mix(base, vid, uReady);
      col *= 0.28 + 0.72 * pow(clamp(vShade, 0.0, 1.0), 4.0);
      vec2 p = (vUv - 0.5) * vec2(pa, 1.0);
      float d = sdBox(p, vec2(pa * 0.5, 0.5), mix(0.04, 0.0, uOpen));
      float aa = fwidth(d) * 1.2;
      gl_FragColor = vec4(col, (1.0 - smoothstep(-aa, aa, d)) * uAlpha);
    }`;

  const STR = {
    en: { label: 'Showreel', eyebrow: 'Showreel · drag to explore', hint: 'Drag', tabs: 'Filter projects',
          close: 'Close project', soundOn: 'Sound on', soundOff: 'Sound off', watch: 'Watch the full piece',
          stage: 'Project carousel. Use the left and right arrow keys to move, Enter to open.', nogl: 'Projects' },
    ar: { label: 'شوريل', eyebrow: 'شوريل · اسحب للاستكشاف', hint: 'اسحب', tabs: 'تصفية الأعمال',
          close: 'إغلاق المشروع', soundOn: 'تشغيل الصوت', soundOff: 'كتم الصوت', watch: 'شاهد العمل كاملاً',
          stage: 'شريط الأعمال. استخدم الأسهم يميناً ويساراً للتنقل، وEnter للفتح.', nogl: 'الأعمال' }
  };

  const CSS = `
  .rc{position:relative;height:100vh;height:100svh;min-height:540px;overflow:hidden;overflow:clip;isolation:isolate;color:#f4eee4;
    background:radial-gradient(120% 85% at 50% 42%,#2a0f0c 0%,#120c0b 45%,#050505 100%)}
  .rc-stage{position:absolute;inset:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;cursor:grab;outline:none}
  .rc-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .rc-stage:focus-visible{box-shadow:inset 0 0 0 2px #ffffff}
  .rc-head{position:absolute;z-index:2;inset-inline:0;top:calc(clamp(92px,13vh,128px) + env(safe-area-inset-top,0px));display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 28px;
    padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));pointer-events:none}
  @media (min-width:900px){.rc-head{padding-left:max(40px,env(safe-area-inset-left,0px));padding-right:max(40px,env(safe-area-inset-right,0px))}}
  .rc-head>*{pointer-events:auto}
  .rc-eyebrow{margin:0;font:500 12px/1 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,238,228,.5)}
  .rc-tabs{display:flex;flex-wrap:wrap;gap:2px 24px}
  .rc-tab{all:unset;cursor:pointer;position:relative;padding-block:10px;font:500 12px/1 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:rgba(244,238,228,.5);transition:color .3s}
  .rc-tab sup{font-size:9px;margin-inline-start:3px;opacity:.7}
  .rc-tab::after{content:"";position:absolute;inset-inline:0;bottom:3px;height:1px;background:currentColor;transform:scaleX(0);transform-origin:left;transition:transform .5s cubic-bezier(.2,.75,.15,1)}
  .rc-tab:hover,.rc-tab[aria-selected=true]{color:#f4eee4}
  .rc-tab[aria-selected=true]::after{transform:scaleX(1)}
  .rc-tab:focus-visible{outline:2px solid #ffffff;outline-offset:4px;border-radius:2px}
  .rc-cap{position:absolute;z-index:2;inset-inline:0;bottom:calc(clamp(40px,9vh,96px) + env(safe-area-inset-bottom,0px));height:104px;pointer-events:none;text-align:center;
    padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
  .rc-cap-l{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:10px}
  .rc-count{font:500 11px/1 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.18em;color:rgba(244,238,228,.42)}
  .rc-title{margin:0;font:600 17px/1.15 "Manrope","Helvetica Neue",Arial,sans-serif;font-variant-caps:all-small-caps;letter-spacing:.2em}
  .rc-client{margin:0;font:italic 400 clamp(24px,2.6vw,38px)/1.05 "Instrument Serif",Georgia,serif;color:rgba(244,238,228,.82)}
  html[lang=ar] .rc-title{font-family:"Tajawal",Tahoma,sans-serif;letter-spacing:0;font-size:16px}
  html[lang=ar] .rc-eyebrow,html[lang=ar] .rc-tab{font-family:"Tajawal",Tahoma,sans-serif;letter-spacing:0;font-size:14px}
  .rc-hint{position:absolute;z-index:2;inset-inline-start:max(16px,env(safe-area-inset-left,0px));bottom:calc(22px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:10px;
    font:500 11px/1 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,238,228,.45);pointer-events:none;transition:opacity .6s}
  .rc-hint i{display:block;width:34px;height:1px;background:currentColor;position:relative}
  .rc-hint i::before,.rc-hint i::after{content:"";position:absolute;top:-3px;width:7px;height:7px;border:solid currentColor;border-width:1px 1px 0 0}
  .rc-hint i::before{left:0;transform:rotate(-135deg)}.rc-hint i::after{right:0;transform:rotate(45deg)}
  .rc.is-used .rc-hint{opacity:0}
  .rc-head,.rc-cap{transition:opacity .4s}
  .rc.is-open .rc-head,.rc.is-open .rc-cap,.rc.is-open .rc-hint{opacity:0;pointer-events:none}
  .rc.is-open .rc-head>*{pointer-events:none}
  .rc-project{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;justify-content:flex-end;
    padding:0 max(16px,env(safe-area-inset-right,0px)) calc(clamp(28px,6vh,64px) + env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));
    background:linear-gradient(180deg,rgba(5,5,5,.55) 0%,transparent 22%,transparent 48%,rgba(5,5,5,.9) 100%);opacity:0}
  @media (min-width:900px){.rc-project{padding-inline:max(40px,env(safe-area-inset-left,0px)) max(40px,env(safe-area-inset-right,0px))}}
  .rc-pmeta{margin:0 0 12px;font:500 11px/1 "JetBrains Mono",ui-monospace,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:rgba(244,238,228,.6)}
  .rc-ptitle{margin:0;max-width:16ch;font:800 clamp(44px,8vw,128px)/.9 "Bricolage Grotesque","Arial Narrow",Impact,sans-serif;font-stretch:75%;text-transform:uppercase;letter-spacing:-.01em;text-wrap:balance}
  html[lang=ar] .rc-ptitle{font-family:"Lalezar","Tajawal",Tahoma,sans-serif;font-weight:400;line-height:1.1;text-transform:none}
  .rc-pclient{margin:12px 0 0;font:italic 400 clamp(22px,2.4vw,34px)/1.1 "Instrument Serif",Georgia,serif;color:rgba(244,238,228,.82)}
  .rc-pact{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}
  .rc-btn{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:0 20px;border-radius:999px;
    font:600 15px/1 "Manrope","Helvetica Neue",Arial,sans-serif;background:rgba(244,238,228,.1);box-shadow:inset 0 0 0 1px rgba(244,238,228,.22);
    -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:background .25s,transform .2s}
  .rc-btn:hover{background:rgba(244,238,228,.18)}.rc-btn:active{transform:scale(.97)}
  .rc-btn.solid{background:#ff3d2e;box-shadow:none;color:#fff}.rc-btn.solid:hover{background:#ff5a4c}
  .rc-btn:focus-visible,.rc-close:focus-visible{outline:2px solid #ffffff;outline-offset:3px}
  html[lang=ar] .rc-btn{font-family:"Tajawal",Tahoma,sans-serif}
  .rc-close{all:unset;box-sizing:border-box;cursor:pointer;position:absolute;top:calc(18px + env(safe-area-inset-top,0px));inset-inline-end:max(16px,env(safe-area-inset-right,0px));
    width:52px;height:52px;border-radius:50%;display:grid;place-items:center;background:rgba(244,238,228,.12);box-shadow:inset 0 0 0 1px rgba(244,238,228,.25);
    -webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);transition:background .25s,transform .3s}
  .rc-close:hover{background:rgba(244,238,228,.22);transform:rotate(90deg)}
  .rc-close svg{width:18px;height:18px}
  .rc-vids{position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none}
  .rc-nogl{position:absolute;inset:auto 0 18vh;display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px))}
  .rc-nogl a{flex:0 0 min(78vw,520px);scroll-snap-align:center;aspect-ratio:16/9;max-width:100%;border-radius:14px;overflow:hidden;background:#141414}
  .rc-nogl img{width:100%;height:100%;object-fit:cover;display:block}
  html.rc-is-open nav{opacity:0;pointer-events:none}`;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mod = (a, b) => ((a % b) + b) % b;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tx = (v, lang) => (v && typeof v === 'object') ? (v[lang] || v.en || '') : (v || '');

  function mount(root, options) {
    const THREE = window.THREE, gsap = window.gsap;
    const o = Object.assign({ projects: [], tabs: [{ id: 'all', en: 'All', ar: 'الكل' }], lang: 'en', aspect: 16 / 9, strings: STR }, options);
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ac = new AbortController();
    const on = (el, ev, fn, opt) => el.addEventListener(ev, fn, Object.assign({ signal: ac.signal }, opt));
    let lang = o.lang;
    const S_ = () => o.strings[lang] || o.strings.en;

    if (!document.getElementById('rc-css')) {
      const st = document.createElement('style'); st.id = 'rc-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    root.classList.add('rc');
    root.innerHTML = `
      <div class="rc-stage" tabindex="0" role="group" aria-roledescription="carousel"></div>
      <div class="rc-head"><p class="rc-eyebrow"></p><div class="rc-tabs" role="tablist"></div></div>
      <div class="rc-cap" aria-live="polite"><div class="rc-cap-l"></div><div class="rc-cap-l" style="opacity:0"></div></div>
      <div class="rc-hint" aria-hidden="true"><i></i><span></span></div>
      <div class="rc-project" role="dialog" aria-modal="true" hidden>
        <button class="rc-close" type="button"><svg viewBox="0 0 18 18" aria-hidden="true"><path d="M2 2l14 14M16 2L2 16" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg></button>
        <p class="rc-pmeta"></p><h3 class="rc-ptitle"></h3><p class="rc-pclient"></p>
        <div class="rc-pact"><button class="rc-btn rc-sound" type="button"></button><a class="rc-btn solid rc-link" target="_blank" rel="noopener"></a></div>
      </div>
      <div class="rc-vids" aria-hidden="true"></div>`;
    const $ = (s) => root.querySelector(s);
    const stage = $('.rc-stage'), tabsEl = $('.rc-tabs'), capLayers = [...root.querySelectorAll('.rc-cap-l')];
    const panel = $('.rc-project'), closeBtn = $('.rc-close'), soundBtn = $('.rc-sound'), linkBtn = $('.rc-link'), vids = $('.rc-vids');

    /* ---------- renderer ---------- */
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      if (!renderer.getContext()) throw new Error('no gl');
    } catch (err) {
      return fallback();
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const FOV = 30, CAMZ = 10;
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    camera.position.set(0, 0, CAMZ);
    const geometry = new THREE.PlaneGeometry(1, 1, 32, 12);   // shared by every card
    const blank = new THREE.DataTexture(new Uint8Array([10, 6, 16, 255]), 1, 1); blank.needsUpdate = true;
    const loader = new THREE.TextureLoader();

    /* ---------- layout ---------- */
    let W = 1, H = 1, visW = 1, visH = 1, pxW = 0.01, cardW = 1, cardH = 1, S = 1, R = 6, Y = 0, L = 1;
    const shared = { uR: { value: 6 }, uW: { value: 1 }, uH: { value: 1 }, uY: { value: 0 }, uFull: { value: new THREE.Vector2(1, 1) },
                     uCardAspect: { value: o.aspect }, uFullAspect: { value: 1 }, uTime: { value: 0 }, uVel: { value: 0 } };
    function layout() {
      W = Math.max(1, stage.clientWidth); H = Math.max(1, stage.clientHeight);
      renderer.setSize(W, H, false);
      camera.aspect = W / H; camera.updateProjectionMatrix();
      visH = 2 * CAMZ * Math.tan(FOV * Math.PI / 360); visW = visH * camera.aspect; pxW = visW / W;
      const portrait = camera.aspect < 0.9;
      cardW = portrait ? visW * 0.8 : Math.min(visW * 0.42, visH * 0.46 * o.aspect);
      cardH = cardW / o.aspect;
      S = cardW * 1.08;
      R = Math.max(visW * 0.8, cardW * 2.2);
      Y = portrait ? visH * 0.02 : 0;
      shared.uR.value = R; shared.uW.value = cardW; shared.uH.value = cardH; shared.uY.value = Y;
      shared.uFull.value.set(visW * 1.002, visH * 1.002); shared.uFullAspect.value = visW / visH;
    }

    /* ---------- items (one per project, shared by every card that shows it) ---------- */
    const items = o.projects.map((p, i) => ({
      p, i, video: null, vtex: null, ptex: null, playing: false, want: false,
      u: { uPoster: { value: blank }, uVideo: { value: blank }, uPosterOn: { value: 0 }, uReady: { value: 0 },
           uPosterAspect: { value: o.aspect }, uVideoAspect: { value: o.aspect }, uSeed: { value: (i * 0.137) % 1 } }
    }));
    function loadPoster(it) {
      if (it.ptex || !it.p.poster) return;
      it.ptex = loader.load(it.p.poster, (t) => {
        it.u.uPosterAspect.value = t.image.width / t.image.height; it.u.uPosterOn.value = 1;
      });
      it.ptex.minFilter = THREE.LinearFilter; it.ptex.generateMipmaps = false;
      it.u.uPoster.value = it.ptex;
    }
    function play(it) {
      if (!it.p.video) return;
      if (!it.video) {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto';
        v.src = it.p.video; vids.appendChild(v); it.video = v;
        it.vtex = new THREE.VideoTexture(v); it.vtex.minFilter = THREE.LinearFilter; it.vtex.generateMipmaps = false;
        on(v, 'playing', () => {
          if (v.videoWidth) it.u.uVideoAspect.value = v.videoWidth / v.videoHeight;
          it.u.uVideo.value = it.vtex;
          gsap.to(it.u.uReady, { value: 1, duration: RM ? 0 : 0.6, ease: 'power2.out', overwrite: true });
        });
      }
      it.playing = true;
      const pr = it.video.play(); if (pr) pr.catch(() => { it.playing = false; });
    }
    function pause(it) { if (it.video && it.playing) { it.video.pause(); it.playing = false; } }

    /* ---------- slots (meshes on the cylinder, repeated so the row never ends) ---------- */
    let slots = [], set = [], filter = (o.tabs[0] && o.tabs[0].id) || 'all';
    function makeMat(it) {
      const u = Object.assign({}, shared, it.u, { uX: { value: 0 }, uScale: { value: 1 }, uOpen: { value: 0 }, uAlpha: { value: 1 } });
      return new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, depthWrite: false });
    }
    function clearSlots() {
      slots.forEach((s) => { gsap.killTweensOf([s.mat.uniforms.uAlpha, s.mat.uniforms.uScale, s.mat.uniforms.uOpen]); scene.remove(s.mesh); s.mat.dispose(); });
      slots = [];
    }
    function buildSet() {
      clearSlots();
      const first = o.tabs[0] && o.tabs[0].id;
      set = items.filter((it) => filter === first || it.p.cat === filter);
      if (!set.length) set = items.slice();
      const n = set.length; if (!n) return;
      const need = 2 * 1.6 * R + 2 * S;                    // enough cards to cover the visible arc both ways
      const m = n * Math.max(1, Math.ceil(need / (n * S)));
      L = m * S;
      for (let i = 0; i < m; i++) {
        const it = set[i % n]; loadPoster(it);
        const mat = makeMat(it), mesh = new THREE.Mesh(geometry, mat);
        mesh.frustumCulled = false; scene.add(mesh);
        slots.push({ i, it, k: i % n, mat, mesh, x: 0, th: 0 });
      }
    }

    /* ---------- motion state ---------- */
    let current = 0, target = 0, prev = 0, momentum = 0, dist = 0, needSnap = false;
    let active = -1, opened = null, busy = false, raf = 0, inView = true, last = performance.now();
    const snap = () => { target = Math.round(target / S) * S; needSnap = false; };

    function updateSlots() {
      let best = null;
      for (const s of slots) {
        s.x = mod(s.i * S - current + L / 2, L) - L / 2;
        s.th = s.x / R;
        s.mesh.visible = Math.abs(s.th) < 1.5 || s === opened;
        s.mat.uniforms.uX.value = s.x;
        if (!best || Math.abs(s.x) < Math.abs(best.x)) best = s;
      }
      if (best && best.k !== active) { active = best.k; caption(); }
    }

    let frameNo = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; frameNo++;
      const f = dt * 60;
      if (!dragging && !opened) {
        if (momentum) {
          target += momentum * f; momentum *= Math.pow(0.92, f);
          if (Math.abs(momentum) < 0.0006) { momentum = 0; }
        }
        if (!momentum && needSnap && !wheelTimer) snap();
      }
      current += (target - current) * (RM ? 1 : 1 - Math.pow(1 - 0.08, f));
      if (Math.abs(target - current) < 1e-5) current = target;
      const vel = (current - prev) / Math.max(f, 0.001); prev = current;
      const want = RM ? 0 : clamp(vel * 2.2, -1, 1);
      dist += (want - dist) * (1 - Math.pow(1 - 0.12, f));
      shared.uVel.value = dist;
      shared.uTime.value = now / 1000;
      updateSlots();
      if (frameNo % 6 === 0) manageVideos();
      renderer.render(scene, camera);
    }
    function manageVideos() {
      items.forEach((it) => { it.want = false; });
      if (opened) opened.it.want = true;
      else for (const s of slots) if (s.mesh.visible && Math.abs(s.th) < 1.2 && s.mat.uniforms.uAlpha.value > 0.02) s.it.want = true;
      items.forEach((it) => { if (it.want && !it.playing) play(it); else if (!it.want && it.playing) pause(it); });
    }
    function start() { if (!raf && inView && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; items.forEach(pause); }

    /* ---------- picking: mouse ray against the cylinder ---------- */
    function pick(e) {
      if (!slots.length) return null;
      const r = stage.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      const tn = Math.tan(FOV * Math.PI / 360), dx = nx * tn * camera.aspect, dy = ny * tn;
      // circle in xz: centre (0, R), radius R; ray from (0, CAMZ) along (dx, -1)
      const k = CAMZ - R, a = dx * dx + 1, b = -2 * k, c = k * k - R * R, disc = b * b - 4 * a * c;
      if (disc < 0) return null;
      const t = (-b + Math.sqrt(disc)) / (2 * a);
      const x = t * dx, z = CAMZ - t, y = t * dy;
      const arc = Math.atan2(x, R - z) * R;
      if (Math.abs(y - Y) > cardH / 2) return null;
      for (const s of slots) {
        if (s.mesh.visible && s.mat.uniforms.uAlpha.value > 0.5 && Math.abs(arc - s.x) < cardW / 2) return s;
      }
      return null;
    }

    /* ---------- pointer: hover, drag, momentum, click ---------- */
    let down = null, dragging = false, dragVel = 0, lastX = 0, lastT = 0, wheelTimer = 0;
    const cursor = (c) => { stage.style.cursor = c; };
    const used = () => root.classList.add('is-used');
    on(stage, 'pointerdown', (e) => {
      if (opened || busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, start: target };
      dragging = false; momentum = 0; dragVel = 0; lastX = e.clientX; lastT = down.t;
    });
    on(stage, 'pointermove', (e) => {
      if (down) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!dragging && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) {
          dragging = true; used();
          try { stage.setPointerCapture(down.id); } catch (_) { }
          cursor('grabbing');
          down.x = e.clientX; down.start = target;          // no jump when the drag kicks in
        }
        if (dragging) {
          const now = performance.now(), ddt = Math.max(1, now - lastT);
          target = down.start - (e.clientX - down.x) * pxW * 1.1;
          const v = -(e.clientX - lastX) * pxW * 1.1 * (16.67 / ddt);      // world units per frame
          dragVel = dragVel * 0.5 + v * 0.5; lastX = e.clientX; lastT = now;
        }
        return;
      }
      if (!opened && !busy && e.pointerType === 'mouse') cursor(pick(e) ? 'pointer' : 'grab');
    });
    const release = (e, cancelled) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), held = performance.now() - down.t;
      if (dragging) {
        momentum = (RM || performance.now() - lastT > 90) ? 0 : clamp(dragVel, -S * 0.5, S * 0.5);
        needSnap = true;
        try { stage.releasePointerCapture(down.id); } catch (_) { }
      } else if (!cancelled && moved < 6 && held < 400) {
        const s = pick(e); if (s) openSlot(s);
      }
      down = null; dragging = false;
      if (e.pointerType === 'mouse') cursor(pick(e) ? 'pointer' : 'grab');
    };
    on(stage, 'pointerup', (e) => release(e, false));
    on(stage, 'pointercancel', (e) => { if (dragging) needSnap = true; release(e, true); });
    on(stage, 'pointerleave', () => { if (!down) cursor('grab'); });
    on(stage, 'wheel', (e) => {
      if (opened || busy) return;
      let d = e.deltaX;
      if (e.shiftKey && !d) d = e.deltaY;
      if (!d || (!e.shiftKey && Math.abs(e.deltaX) <= Math.abs(e.deltaY))) return;   // vertical wheel keeps scrolling the page
      e.preventDefault(); e.stopPropagation(); used();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? W : 1;
      target += d * unit * pxW; momentum = 0; needSnap = true;
      clearTimeout(wheelTimer); wheelTimer = setTimeout(() => { wheelTimer = 0; }, 160);
    }, { passive: false });
    on(stage, 'keydown', (e) => {
      if (opened || busy) return;
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (step) { e.preventDefault(); used(); momentum = 0; target = Math.round(target / S) * S + step * S; }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const s = slots.reduce((b, s) => (!b || Math.abs(s.x) < Math.abs(b.x) ? s : b), null);
        if (s) openSlot(s);
      }
    });
    on(stage, 'contextmenu', (e) => { if (dragging) e.preventDefault(); });

    /* ---------- caption under the carousel (crossfades) ---------- */
    let capIdx = 0;
    function caption(force) {
      const it = set[active]; if (!it) return;
      const html = `<span class="rc-count">${String(active + 1).padStart(2, '0')} / ${String(set.length).padStart(2, '0')}</span>
        <p class="rc-title">${esc(tx(it.p.title, lang))}</p><p class="rc-client">${esc(it.p.client)}${it.p.role ? ' — ' + esc(tx(it.p.role, lang)) : ''}</p>`;
      const cur = capLayers[capIdx], nxt = capLayers[capIdx ^ 1];
      if (force && RM) { cur.innerHTML = html; return; }
      nxt.innerHTML = html; capIdx ^= 1;
      gsap.to(cur, { autoAlpha: 0, y: -6, duration: RM ? 0 : 0.3, ease: 'power2.in', overwrite: true });
      gsap.fromTo(nxt, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: RM ? 0 : 0.45, delay: RM ? 0 : 0.12, ease: 'power2.out', overwrite: true });
    }

    /* ---------- filter tabs ---------- */
    function drawTabs() {
      tabsEl.setAttribute('aria-label', S_().tabs);
      const first = o.tabs[0] && o.tabs[0].id;
      tabsEl.innerHTML = o.tabs.map((t) => {
        const n = t.id === first ? items.length : items.filter((it) => it.p.cat === t.id).length;
        return `<button class="rc-tab" type="button" role="tab" data-id="${esc(t.id)}" aria-selected="${t.id === filter}">${esc(tx(t, lang))}<sup>${n}</sup></button>`;
      }).join('');
    }
    on(tabsEl, 'click', (e) => {
      const b = e.target.closest('.rc-tab'); if (!b) return;
      setFilter(b.dataset.id);
    });
    function setFilter(id) {
      if (id === filter || busy || opened) return;
      busy = true; filter = id;
      tabsEl.querySelectorAll('.rc-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
      const swap = () => {
        buildSet(); current = target = prev = 0; momentum = 0; needSnap = false; active = -1;
        slots.forEach((s) => { s.mat.uniforms.uAlpha.value = 0; s.mat.uniforms.uScale.value = 0.92; });
        updateSlots(); manageVideos();
        const order = slots.slice().sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
        gsap.to(order.map((s) => s.mat.uniforms.uAlpha), { value: 1, duration: RM ? 0 : 0.6, ease: 'power2.out', stagger: RM ? 0 : 0.05 });
        gsap.to(order.map((s) => s.mat.uniforms.uScale), { value: 1, duration: RM ? 0 : 0.8, ease: 'power3.out', stagger: RM ? 0 : 0.05, onComplete: () => { busy = false; } });
      };
      if (RM) return swap();
      gsap.to(slots.map((s) => s.mat.uniforms.uAlpha), { value: 0, duration: 0.35, ease: 'power2.in', onComplete: swap });
      gsap.to(slots.map((s) => s.mat.uniforms.uScale), { value: 0.94, duration: 0.35, ease: 'power2.in' });
    }

    /* ---------- open / close project ---------- */
    let lastFocus = null;
    function openSlot(s) {
      if (opened || busy) return;
      busy = true; used(); momentum = 0; target = current; needSnap = false;
      play(s.it);
      const go = () => {
        opened = s; s.mesh.renderOrder = 10;
        document.documentElement.classList.add('rc-is-open'); root.classList.add('is-open');
        o.onOpen && o.onOpen();
        cursor('default');
        slots.forEach((x) => { if (x !== s) gsap.to(x.mat.uniforms.uAlpha, { value: 0, duration: RM ? 0 : 0.4, ease: 'power2.out', overwrite: true }); });
        gsap.to(s.mat.uniforms.uOpen, { value: 1, duration: RM ? 0 : 0.8, ease: 'power3.inOut', onComplete: () => { busy = false; showPanel(s); } });
      };
      const squeeze = () => gsap.to(s.mat.uniforms.uScale, { value: 0.96, duration: RM ? 0 : 0.1, yoyo: true, repeat: 1, ease: 'power2.out',
        onComplete: () => {
          let done = false; const once = () => { if (!done) { done = true; go(); } };
          if (!o.scrollTo || Math.abs(root.getBoundingClientRect().top) < 2) return once();
          o.scrollTo(root, once); setTimeout(once, 900);           // never wait on a scroll that does not report back
        } });
      squeeze();
    }
    function showPanel(s) {
      lastFocus = document.activeElement;
      fillPanel(s);
      panel.hidden = false;
      gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: RM ? 0 : 0.4, ease: 'power2.out' });
      gsap.fromTo(panel.querySelectorAll('.rc-pmeta,.rc-ptitle,.rc-pclient,.rc-pact'), { y: RM ? 0 : 24, opacity: 0 },
        { y: 0, opacity: 1, duration: RM ? 0 : 0.6, stagger: RM ? 0 : 0.06, ease: 'power3.out' });
      closeBtn.focus({ preventScroll: true });
    }
    function fillPanel(s) {
      const p = s.it.p, cat = o.tabs.find((t) => t.id === p.cat);
      panel.setAttribute('aria-label', tx(p.title, lang));
      closeBtn.setAttribute('aria-label', S_().close);
      $('.rc-pmeta').textContent = `${String(s.k + 1).padStart(2, '0')} / ${String(set.length).padStart(2, '0')}${cat ? ' · ' + tx(cat, lang) : ''}`;
      $('.rc-ptitle').textContent = tx(p.title, lang);
      $('.rc-pclient').textContent = p.client + (p.role ? ' — ' + tx(p.role, lang) : '');
      soundBtn.hidden = !p.video;
      soundBtn.textContent = s.it.video && !s.it.video.muted ? S_().soundOff : S_().soundOn;
      linkBtn.hidden = !p.link; if (p.link) linkBtn.href = p.link;
      linkBtn.textContent = S_().watch + ' ↗';
    }
    function closeSlot() {
      if (!opened || busy) return;
      busy = true; const s = opened; root.classList.remove('is-open');
      if (s.it.video) s.it.video.muted = true;
      gsap.to(panel, { opacity: 0, duration: RM ? 0 : 0.25, ease: 'power2.in', onComplete: () => { panel.hidden = true; } });
      gsap.to(s.mat.uniforms.uOpen, { value: 0, duration: RM ? 0 : 0.8, ease: 'power3.inOut', delay: RM ? 0 : 0.1, onComplete: () => {
        s.mesh.renderOrder = 0; opened = null; busy = false;
        document.documentElement.classList.remove('rc-is-open');
        o.onClose && o.onClose();
        (lastFocus && lastFocus.focus ? lastFocus : stage).focus({ preventScroll: true });
        cursor('grab');
      } });
      slots.forEach((x) => { if (x !== s) gsap.to(x.mat.uniforms.uAlpha, { value: 1, duration: RM ? 0 : 0.5, delay: RM ? 0 : 0.45, ease: 'power2.out', overwrite: true }); });
    }
    on(closeBtn, 'click', closeSlot);
    on(soundBtn, 'click', () => {
      const v = opened && opened.it.video; if (!v) return;
      v.muted = !v.muted; if (!v.muted) { const p = v.play(); if (p) p.catch(() => { }); }
      soundBtn.textContent = v.muted ? S_().soundOn : S_().soundOff;
    });
    on(panel, 'keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSlot(); return; }
      if (e.key !== 'Tab') return;
      const f = [closeBtn, soundBtn, linkBtn].filter((x) => !x.hidden);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
    on(document, 'keydown', (e) => { if (e.key === 'Escape' && opened) closeSlot(); });

    /* ---------- language ---------- */
    function setLang(l) {
      lang = l;
      root.setAttribute('aria-label', S_().label);
      stage.setAttribute('aria-label', S_().stage);
      $('.rc-eyebrow').textContent = S_().eyebrow;
      $('.rc-hint span').textContent = S_().hint;
      drawTabs();
      if (active >= 0) caption(true);
      if (opened) fillPanel(opened);
    }

    /* ---------- lifecycle: resize, visibility, offscreen ---------- */
    const ro = new ResizeObserver(() => {
      const k = Math.round(target / S);
      layout();
      if (!opened) { buildSet(); current = target = prev = k * S; active = -1; updateSlots(); }
    });
    ro.observe(stage);
    const io = new IntersectionObserver(([en]) => { inView = en.isIntersecting; inView ? start() : stop(); }, { rootMargin: '100px' });
    io.observe(root);
    on(document, 'visibilitychange', () => (document.hidden ? stop() : start()));

    layout(); buildSet(); setLang(lang); updateSlots(); start();

    function destroy() {
      stop(); ac.abort(); ro.disconnect(); io.disconnect(); clearTimeout(wheelTimer);
      gsap.killTweensOf([panel, ...capLayers]);
      clearSlots();
      items.forEach((it) => {
        gsap.killTweensOf(it.u.uReady);
        if (it.video) { it.video.pause(); it.video.removeAttribute('src'); it.video.load(); it.video.remove(); }
        it.vtex && it.vtex.dispose(); it.ptex && it.ptex.dispose();
      });
      geometry.dispose(); blank.dispose();
      renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss();
      document.documentElement.classList.remove('rc-is-open');
      root.innerHTML = ''; root.classList.remove('rc', 'is-used', 'is-open');
    }

    /* no WebGL: a plain scroll-snap row of posters */
    function fallback() {
      stage.remove(); $('.rc-hint').remove(); $('.rc-cap').remove();
      const row = document.createElement('div'); row.className = 'rc-nogl';
      row.innerHTML = o.projects.filter((p) => p.poster).map((p) =>
        `<a href="${esc(p.link || '#')}" target="_blank" rel="noopener"><img src="${esc(p.poster)}" alt="${esc(tx(p.title, lang))}" loading="lazy"></a>`).join('');
      root.appendChild(row);
      $('.rc-eyebrow').textContent = (o.strings[lang] || o.strings.en).nogl;
      return { setLang() { }, destroy() { ac.abort(); root.innerHTML = ''; } };
    }

    return { setLang, destroy, setFilter };
  }

  window.Carousel3D = { mount };
})();
