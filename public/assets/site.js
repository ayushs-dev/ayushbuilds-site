(function () {
  var doc = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  doc.classList.add('js');

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- Hero terminal: typed commands ---------- */
  var term = document.getElementById('term');
  var script = [
    { cmd: 'whoami', out: ['<span class="hl">ayush</span> <span class="dim">· software engineer, DevOps in progress</span>'] },
    { cmd: 'docker compose up -d', out: [
      '<span class="ok">✔</span> db        <span class="dim">postgres:16</span>   <span class="ok">healthy</span>',
      '<span class="ok">✔</span> api       <span class="dim">fastapi</span>        <span class="ok">running</span>',
      '<span class="ok">✔</span> web       <span class="dim">react + vite</span>   <span class="ok">running</span>'
    ] },
    { cmd: 'git push origin main', out: [
      '<span class="ok">✔</span> html-validate <span class="dim">passed</span>',
      '<span class="ok">✔</span> deployed <span class="dim">→</span> <span class="hl">ayushbuilds.dev</span>'
    ] },
    { cmd: 'cat stack.txt', out: [
      '<span class="dim">docker · fastapi · postgres · ros2 · python · linux</span>'
    ] }
  ];

  function line(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    term.appendChild(d);
    return d;
  }

  function trim() {
    while (term.children.length > 9) term.removeChild(term.firstChild);
  }

  async function playTerminal() {
    var caret = '<span class="caret"></span>';
    while (true) {
      for (var i = 0; i < script.length; i++) {
        var step = script[i];
        var row = line('<span class="ps">$</span> ' + caret);
        for (var c = 1; c <= step.cmd.length; c++) {
          row.innerHTML = '<span class="ps">$</span> ' + step.cmd.slice(0, c) + caret;
          await sleep(38 + Math.random() * 45);
        }
        await sleep(350);
        row.innerHTML = '<span class="ps">$</span> ' + step.cmd;
        for (var o = 0; o < step.out.length; o++) {
          line(step.out[o]);
          await sleep(260);
        }
        trim();
        await sleep(1100);
      }
      await sleep(1500);
      term.textContent = '';
    }
  }

  if (term && reduce) {
    script.forEach(function (s) {
      line('<span class="ps">$</span> ' + s.cmd);
      s.out.forEach(line);
    });
  } else if (term) {
    playTerminal();
  }

  /* ---------- Scroll reveal ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.15 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Cursor spotlight on project cards ---------- */
  document.querySelectorAll('.project').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- Scroll progress bar ---------- */
  var bar = document.getElementById('progress');
  function onScroll() {
    var max = doc.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Status bar: real TTFB and session timer ---------- */
  var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  if (nav && nav.responseStart && document.getElementById('ttfb')) {
    document.getElementById('ttfb').textContent = 'ttfb: ' + Math.round(nav.responseStart - nav.requestStart) + 'ms';
  }
  var t0 = Date.now();
  var up = document.getElementById('uptime');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  if (up) setInterval(function () {
    var s = Math.floor((Date.now() - t0) / 1000);
    up.textContent = 'session: ' + pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }, 1000);

  /* ---------- Background: scrolling code, lit up near the cursor ---------- */
  var canvas = document.getElementById('net');
  var ctx = canvas.getContext('2d');
  var W, H, cols = [];
  var mouse = { x: -9999, y: -9999 };
  var FS = 13, LH = 19, CW = 7.8, GLOW = 220;

  var SNIPPETS = [
    ['FROM python:3.12-slim', 'WORKDIR /app', 'COPY requirements.txt .', 'RUN pip install --no-cache-dir -r requirements.txt', 'COPY . .', 'EXPOSE 8000', 'CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]'],
    ['services:', '  db:', '    image: postgres:16', '    healthcheck:', '      test: ["CMD", "pg_isready"]', '  api:', '    build: ./backend', '    depends_on:', '      db:', '        condition: service_healthy'],
    ['#!/usr/bin/env bash', 'set -euo pipefail', '# build, test, ship', 'docker compose build', 'docker compose up -d', 'curl -fsS localhost:8000/health', 'docker compose logs -f api'],
    ['@app.get("/repo/{owner}/{name}")', 'async def repo(owner: str, name: str):', '    cached = await cache.get(owner, name)', '    if cached:', '        return cached', '    data = await github.fetch(owner, name)', '    await cache.set(owner, name, data)', '    return data'],
    ['def navigate(waypoints):', '    for wp in waypoints:', '        nav.go_to_pose(wp)', '        while not nav.is_task_complete():', '            rclpy.spin_once(node)', '        sample = sensor.read()', '        post(sample)'],
    ['on:', '  pull_request:', 'jobs:', '  lint:', '    runs-on: ubuntu-latest', '    steps:', '      - uses: actions/checkout@v4', '      - run: npx html-validate "public/*.html"'],
    ['$ ssh pi@rover.local', '$ systemctl status sensor-node', '$ journalctl -u sensor-node -n 20', '$ ros2 topic echo /aqi', '$ git log --oneline -5', '$ docker ps --format "{{.Names}}"'],
    ['SELECT language, SUM(bytes)', 'FROM repo_languages', 'WHERE fetched_at > now() - interval \'1 hour\'', 'GROUP BY language', 'ORDER BY 2 DESC;']
  ];

  function tone(t) {
    var x = t.trim();
    if (!x) return [34, 211, 238];
    if (x[0] === '#' && x[1] !== '!' || x.indexOf('//') === 0) return [107, 107, 118];
    if (x[0] === '$' || x.indexOf('#!') === 0) return [74, 222, 128];
    if (/^(FROM|RUN|CMD|COPY|WORKDIR|EXPOSE|def|async|return|if|while|for|SELECT|FROM|WHERE|GROUP|ORDER|on:|jobs:|services:)/.test(x)) return [167, 139, 250];
    if (/["']/.test(x)) return [74, 222, 128];
    return [34, 211, 238];
  }

  function buildColumn(x) {
    var lines = [];
    var n = 3 + Math.floor(Math.random() * 3);
    for (var k = 0; k < n; k++) {
      var sn = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)];
      for (var l = 0; l < sn.length; l++) lines.push({ t: sn[l], c: tone(sn[l]) });
      lines.push({ t: '', c: [34, 211, 238] });
    }
    return {
      x: x,
      lines: lines,
      off: Math.random() * lines.length * LH,
      speed: 0.12 + Math.random() * 0.35,
      dir: Math.random() < 0.25 ? -1 : 1,
      alpha: 0.045 + Math.random() * 0.05
    };
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = FS + 'px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    cols = [];
    var colW = W < 700 ? 300 : 330;
    for (var x = 12; x < W; x += colW) cols.push(buildColumn(x));
  }

  window.addEventListener('pointermove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; });
  window.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; });
  window.addEventListener('resize', function () {
    resize();
    if (reduce) frame();
  });

  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < cols.length; i++) {
      var col = cols[i];
      var total = col.lines.length * LH;
      if (!reduce) col.off = (col.off + col.speed * col.dir + total) % total;
      var first = Math.floor(col.off / LH);
      var y0 = -(col.off % LH);
      for (var r = 0; y0 + r * LH < H; r++) {
        var ln = col.lines[(first + r) % col.lines.length];
        if (!ln.t) continue;
        var y = y0 + r * LH;
        var near = Math.hypot(col.x + ln.t.length * CW / 2 - mouse.x, y - mouse.y);
        var boost = near < GLOW ? 1 - near / GLOW : 0;
        var a = col.alpha + boost * 0.55;
        ctx.fillStyle = 'rgba(' + ln.c[0] + ',' + ln.c[1] + ',' + ln.c[2] + ',' + a + ')';
        ctx.fillText(ln.t, col.x, y);
      }
    }
    if (!reduce) requestAnimationFrame(frame);
  }

  resize();
  frame();
})();
