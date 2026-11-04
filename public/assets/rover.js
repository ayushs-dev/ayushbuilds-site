import {
  WebGLRenderer, Scene, Fog, PerspectiveCamera, HemisphereLight, DirectionalLight,
  GridHelper, Mesh, Group, Vector3, Vector2, Raycaster,
  CylinderGeometry, RingGeometry, TorusGeometry, OctahedronGeometry, SphereGeometry,
  BoxGeometry, CircleGeometry, BufferGeometry, BufferAttribute,
  Line, LineDashedMaterial, MeshStandardMaterial, MeshBasicMaterial,
  Points, PointsMaterial, AdditiveBlending, DoubleSide
} from './vendor/three-lite.min.js';

/* A Roomba-style rover that drives between project waypoints and pauses at each one
   for 5 seconds, like the AAQR robot does. Click a pad to send it there. */

var stage = document.getElementById('stage');
var canvas = document.getElementById('rover-canvas');
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

var CYAN = 0x22d3ee, GREEN = 0x4ade80, PURPLE = 0xa78bfa;
var SAMPLE_S = 5;
var NODES = [
  { color: CYAN, pos: new Vector3(-3.4, 0, -1.2) },
  { color: GREEN, pos: new Vector3(3.2, 0, -2.0) },
  { color: PURPLE, pos: new Vector3(0.3, 0, 2.9) }
];
var labels = Array.prototype.slice.call(stage.querySelectorAll('.node-label'));
var subs = labels.map(function (l) { return l.querySelector('.sub'); });
var defaultSub = subs.map(function (s) { return s.textContent; });

function init() {
  var renderer;
  try {
    renderer = new WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (err) {
    stage.classList.add('nogl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  var scene = new Scene();
  scene.fog = new Fog(0x0a0a0b, 12, 26);
  var camera = new PerspectiveCamera(38, 1, 0.1, 60);

  scene.add(new HemisphereLight(0x88aacc, 0x080810, 0.9));
  var key = new DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 8, 5);
  scene.add(key);
  var rim = new DirectionalLight(CYAN, 1.0);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  var grid = new GridHelper(30, 60, 0x155e75, 0x0e2a35);
  [].concat(grid.material).forEach(function (m) { m.transparent = true; m.opacity = 0.55; });
  scene.add(grid);

  function glowMat(color, opacity) {
    return new MeshBasicMaterial({
      color: color, transparent: true, opacity: opacity, side: DoubleSide,
      blending: AdditiveBlending, depthWrite: false
    });
  }

  /* ---------- waypoint pads ---------- */
  var hitMeshes = [];
  var pads = NODES.map(function (n, i) {
    var g = new Group();
    g.position.copy(n.pos);

    var base = new Mesh(
      new CylinderGeometry(0.95, 1.05, 0.14, 6),
      new MeshStandardMaterial({ color: 0x14161a, metalness: 0.5, roughness: 0.5 })
    );
    base.position.y = 0.07;

    var ring = new Mesh(new RingGeometry(0.62, 0.72, 48), glowMat(n.color, 0.8));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;

    var pulse = new Mesh(new RingGeometry(0.7, 0.74, 48), glowMat(n.color, 0));
    pulse.rotation.x = -Math.PI / 2;
    pulse.position.y = 0.16;

    var beam = new Mesh(new CylinderGeometry(0.02, 0.02, 2.4, 8), glowMat(n.color, 0.45));
    beam.position.y = 1.35;

    var gem = new Mesh(
      new OctahedronGeometry(0.2),
      new MeshStandardMaterial({ color: n.color, emissive: n.color, emissiveIntensity: 0.9, roughness: 0.3 })
    );
    gem.position.y = 2.7;

    // Invisible, generous click target
    var hit = new Mesh(
      new CylinderGeometry(1.3, 1.3, 2.8, 12),
      new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    hit.position.y = 1.3;
    hit.userData.index = i;
    hitMeshes.push(hit);

    g.add(base, ring, pulse, beam, gem, hit);
    scene.add(g);
    return { ring: ring, pulse: pulse, gem: gem, beam: beam, glow: 0, color: n.color };
  });

  /* ---------- dashed route + data packets ---------- */
  var loop = NODES.map(function (n) { return new Vector3(n.pos.x, 0.03, n.pos.z); });
  loop.push(loop[0].clone());
  var route = new Line(
    new BufferGeometry().setFromPoints(loop),
    new LineDashedMaterial({ color: CYAN, dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.5 })
  );
  route.computeLineDistances();
  scene.add(route);

  var packets = [0, 0.75, 1.5, 2.25].map(function (u, i) {
    var m = new Mesh(new SphereGeometry(0.07, 10, 10), glowMat(i % 2 ? PURPLE : GREEN, 0.95));
    m.position.y = 0.12;
    scene.add(m);
    return { mesh: m, u: u };
  });

  /* ---------- the rover ---------- */
  var rover = new Group();
  var body = new Mesh(
    new CylinderGeometry(0.55, 0.58, 0.2, 32),
    new MeshStandardMaterial({ color: 0x1b1c20, metalness: 0.6, roughness: 0.4 })
  );
  body.position.y = 0.16;
  var topRing = new Mesh(new TorusGeometry(0.42, 0.025, 8, 48), glowMat(CYAN, 0.95));
  topRing.rotation.x = Math.PI / 2;
  topRing.position.y = 0.27;
  var bumper = new Mesh(
    new TorusGeometry(0.58, 0.04, 8, 24, Math.PI),
    new MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.4, roughness: 0.5 })
  );
  bumper.rotation.x = Math.PI / 2;
  bumper.rotation.z = Math.PI;   // arc faces +Z, the rover's front
  bumper.position.y = 0.16;
  var puck = new Mesh(
    new CylinderGeometry(0.12, 0.12, 0.1, 20),
    new MeshStandardMaterial({ color: 0x2a2c33, metalness: 0.5, roughness: 0.4 })
  );
  puck.position.set(0, 0.32, -0.12);
  var lidar = new Mesh(new BoxGeometry(0.22, 0.03, 0.06), glowMat(CYAN, 0.95));
  lidar.position.set(0, 0.39, -0.12);
  var mast = new Mesh(
    new CylinderGeometry(0.015, 0.015, 0.4, 8),
    new MeshStandardMaterial({ color: 0x2a2c33 })
  );
  mast.position.set(0, 0.46, 0.3);
  var led = new Mesh(new SphereGeometry(0.04, 10, 10), glowMat(GREEN, 1));
  led.position.set(0, 0.68, 0.3);
  var under = new Mesh(new RingGeometry(0.5, 0.75, 40), glowMat(CYAN, 0.3));
  under.rotation.x = -Math.PI / 2;
  under.position.y = 0.04;
  var shadow = new Mesh(new CircleGeometry(0.75, 28), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  rover.add(body, topRing, bumper, puck, lidar, mast, led, under, shadow);
  rover.scale.setScalar(1.5);
  scene.add(rover);

  /* ---------- air samples rising while the rover is sampling ---------- */
  var N = 70;
  var pPos = new Float32Array(N * 3);
  var pCol = new Float32Array(N * 3);
  var pLife = new Float32Array(N);
  var pVel = new Float32Array(N * 3);
  var pGeo = new BufferGeometry();
  pGeo.setAttribute('position', new BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new BufferAttribute(pCol, 3));
  var dust = new Points(pGeo, new PointsMaterial({
    size: 0.07, vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false
  }));
  dust.frustumCulled = false;
  scene.add(dust);
  var spawnAcc = 0;

  function emit(x, z) {
    for (var i = 0; i < N; i++) {
      if (pLife[i] > 0) continue;
      pLife[i] = 1;
      pPos[i * 3] = x + (Math.random() - 0.5) * 0.9;
      pPos[i * 3 + 1] = 0.2;
      pPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.9;
      pVel[i * 3] = (Math.random() - 0.5) * 0.12;
      pVel[i * 3 + 1] = 0.35 + Math.random() * 0.4;
      pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      return;
    }
  }

  /* ---------- rover state machine ---------- */
  var st = {
    pos: new Vector3(0.4, 0, 0.8), heading: 0, target: 0, state: 'drive', timer: 0
  };
  var hovered = -1;
  var pointer = new Vector2(0, 0);
  var look = new Vector3(0, 0.4, 0);
  var tmp = new Vector3();

  function wrap(a) {
    return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  }

  function sendRover(i) {
    if (st.target === i && (st.state === 'drive' || st.state === 'sample')) return;
    st.target = i;
    st.state = 'drive';
  }

  function step(dt, t) {
    var target = NODES[st.target].pos;
    if (st.state === 'drive') {
      tmp.set(target.x - st.pos.x, 0, target.z - st.pos.z);
      var dist = tmp.length();
      var diff = wrap(Math.atan2(tmp.x, tmp.z) - st.heading);
      st.heading += diff * Math.min(1, dt * 6);
      var turn = Math.max(0.15, 1 - Math.abs(diff) / 1.2);
      var v = Math.min(2.2, 0.5 + dist * 1.4) * turn;
      var d = Math.min(v * dt, dist);
      if (dist > 0.0001) st.pos.addScaledVector(tmp.normalize(), d);
      if (dist < 0.12) { st.state = 'sample'; st.timer = 0; }
    } else {
      st.timer += dt;
      spawnAcc += dt * 14;
      while (spawnAcc > 1) { emit(st.pos.x, st.pos.z); spawnAcc -= 1; }
      if (st.timer >= SAMPLE_S) {
        st.target = (st.target + 1) % NODES.length;
        st.state = 'drive';
      }
    }

    rover.position.copy(st.pos);
    rover.rotation.y = st.heading;
    lidar.rotation.y = t * 7;
    led.material.opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 5));
    under.material.opacity = 0.22 + 0.12 * Math.sin(t * 3);

    // pads
    pads.forEach(function (p, i) {
      var active = st.target === i;
      var goal = (hovered === i ? 1 : 0) + (active ? 0.6 : 0);
      p.glow += (goal - p.glow) * Math.min(1, dt * 6);
      p.ring.material.opacity = 0.55 + 0.4 * Math.min(1, p.glow);
      p.beam.material.opacity = 0.3 + 0.3 * Math.min(1, p.glow);
      p.gem.material.emissiveIntensity = 0.6 + p.glow;
      p.gem.position.y = 2.7 + Math.sin(t * 1.6 + i) * 0.08;
      p.gem.rotation.y = t * 0.9 + i;
      var sampling = active && st.state === 'sample';
      p.pulse.material.opacity = sampling ? 0.8 * (1 - ((st.timer * 0.9) % 1)) : 0;
      var s = 1 + (sampling ? (st.timer * 0.9) % 1 : 0) * 0.9;
      p.pulse.scale.set(s, s, 1);
    });

    // packets
    packets.forEach(function (pk) {
      pk.u = (pk.u + dt * 0.22) % NODES.length;
      var e = Math.floor(pk.u), f = pk.u - e;
      var a = loop[e], b = loop[e + 1];
      pk.mesh.position.set(a.x + (b.x - a.x) * f, 0.12, a.z + (b.z - a.z) * f);
    });

    // air samples
    for (var i = 0; i < N; i++) {
      if (pLife[i] <= 0) { pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; continue; }
      pLife[i] -= dt * 0.55;
      pPos[i * 3] += pVel[i * 3] * dt;
      pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt;
      pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt;
      var l = Math.max(0, pLife[i]);
      pCol[i * 3] = 0.29 * l; pCol[i * 3 + 1] = 0.87 * l; pCol[i * 3 + 2] = 0.5 * l;
    }
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }

  /* ---------- camera ---------- */
  var size = { w: 1, h: 1 };
  function frameCamera(dt, instant) {
    var asp = size.w / size.h;
    var k = asp < 0.8 ? 1.7 : asp < 1.3 ? 1.5 : 1;
    var wantX = 6.4 * k + pointer.x * 1.4;
    var wantY = 6.2 * k - pointer.y * 0.8;
    var wantZ = 8.4 * k;
    var a = instant ? 1 : Math.min(1, dt * 2);
    camera.position.x += (wantX - camera.position.x) * a;
    camera.position.y += (wantY - camera.position.y) * a;
    camera.position.z += (wantZ - camera.position.z) * a;
    look.x += (st.pos.x * 0.35 - look.x) * a;
    look.z += (st.pos.z * 0.35 - look.z) * a;
    camera.lookAt(look);
  }

  /* ---------- labels follow their pads ---------- */
  var lastText = [];
  function placeLabels() {
    labels.forEach(function (el, i) {
      tmp.copy(NODES[i].pos);
      tmp.y = 3.2;
      tmp.project(camera);
      var half = el.offsetWidth / 2 + 6;
      var x = Math.min(size.w - half, Math.max(half, (tmp.x * 0.5 + 0.5) * size.w));
      var y = (-tmp.y * 0.5 + 0.5) * size.h;
      el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-100%)';
      el.style.opacity = tmp.z < 1 ? '1' : '0';

      var text = defaultSub[i];
      if (st.target === i) {
        text = st.state === 'sample'
          ? 'sampling air… ' + Math.max(0, Math.ceil(SAMPLE_S - st.timer)) + 's'
          : 'rover en route';
      }
      if (lastText[i] !== text) { subs[i].textContent = text; lastText[i] = text; }
      el.classList.toggle('active', st.target === i);
    });
  }

  /* ---------- sizing ---------- */
  function resize() {
    var r = stage.getBoundingClientRect();
    size.w = Math.max(1, Math.round(r.width));
    size.h = Math.max(1, Math.round(r.height));
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    frameCamera(0, true);
    if (reduce || !running) draw();
  }

  function draw() {
    placeLabels();
    renderer.render(scene, camera);
  }

  /* ---------- pointer interaction ---------- */
  var ray = new Raycaster();
  function toNdc(e) {
    var r = canvas.getBoundingClientRect();
    return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  function pick(e) {
    ray.setFromCamera(toNdc(e), camera);
    var hit = ray.intersectObjects(hitMeshes, false)[0];
    return hit ? hit.object.userData.index : -1;
  }
  stage.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
    hovered = pick(e);
    canvas.style.cursor = hovered >= 0 ? 'pointer' : 'default';
  });
  stage.addEventListener('pointerleave', function () { hovered = -1; pointer.set(0, 0); });
  canvas.addEventListener('click', function (e) {
    var i = pick(e);
    if (i >= 0) { sendRover(i); if (reduce) draw(); }
  });

  /* ---------- run loop, paused when off-screen or hidden ---------- */
  var running = false, raf = 0, last = 0, clock = 0;
  function tick(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    clock += dt;
    step(dt, clock);
    frameCamera(dt, false);
    draw();
    stage.dataset.state = st.state;
    raf = requestAnimationFrame(tick);
  }
  function setRunning(on) {
    if (on === running || reduce) return;
    running = on;
    if (on) { last = performance.now(); raf = requestAnimationFrame(tick); }
    else cancelAnimationFrame(raf);
  }

  new ResizeObserver(resize).observe(stage);
  resize();

  if (reduce) {
    // Static pose: rover parked on the first pad, no animation loop.
    st.pos.copy(NODES[0].pos);
    st.state = 'sample';
    step(0, 0);
    frameCamera(0, true);
    draw();
  } else if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { setRunning(es[0].isIntersecting); }).observe(stage);
  } else {
    setRunning(true);
  }

  stage.classList.add('ready');
}

init();
