/* Animated hero: a Greek trireme sailing a moonless, aurora-lit sea.
   Built with p5.js in instance mode, mounted into #hero-ocean on the home
   page only. The sky and stars are baked to an offscreen buffer; the aurora,
   the layered parallax waves, and the ship (a real cutout sprite that bobs
   and rocks with the water and casts a rippling reflection) redraw each frame.
   The scene is always dark, so it reads as night in both site themes. */
(function () {
  "use strict";
  var mountEl = document.getElementById("hero-ocean");
  if (!mountEl || typeof p5 === "undefined") return;

  new p5(function (p) {
    var ship, bg;
    var W = 0, H = 0, HY = 0; // width, height, horizon y
    var t = 0;

    // fixed night palette (independent of the light/dark toggle)
    var SKY_TOP = [6, 10, 24];
    var SKY_HORIZON = [16, 30, 62];
    var AUR = [
      [138, 99, 255], // violet
      [63, 139, 208], // blue
      [63, 208, 201], // teal
      [224, 137, 76], // warm
    ];
    var stars = [];

    p.preload = function () {
      ship = p.loadImage("/img/ship-sprite.png");
    };

    p.setup = function () {
      var d = size();
      var c = p.createCanvas(d.w, d.h);
      c.parent(mountEl);
      p.frameRate(40);
      p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
      seedStars();
      bakeSky();
    };

    function size() {
      W = mountEl.clientWidth || 960;
      H = mountEl.clientHeight || 460;
      HY = Math.round(H * 0.5);
      return { w: W, h: H };
    }

    p.windowResized = function () {
      var d = size();
      p.resizeCanvas(d.w, d.h);
      seedStars();
      bakeSky();
    };

    function seedStars() {
      stars = [];
      var n = Math.round((W * H) / 9000);
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * HY * 0.96,
          r: Math.random() * 1.3 + 0.3,
          ph: Math.random() * 6.28,
        });
      }
    }

    // bake the vertical sky gradient + static stars once per resize
    function bakeSky() {
      bg = p.createGraphics(W, H);
      bg.noStroke();
      for (var y = 0; y < HY; y++) {
        var f = y / HY;
        var r = lerp(SKY_TOP[0], SKY_HORIZON[0], f);
        var g = lerp(SKY_TOP[1], SKY_HORIZON[1], f);
        var b = lerp(SKY_TOP[2], SKY_HORIZON[2], f);
        bg.stroke(r, g, b);
        bg.line(0, y, W, y);
      }
      bg.noStroke();
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        bg.fill(210, 224, 245, 180 * (s.r / 1.6) + 40);
        bg.circle(s.x, s.y, s.r);
      }
    }

    function lerp(a, b, f) {
      return a + (b - a) * f;
    }

    // aurora: a few flowing curtains high in the sky, additive and soft
    function drawAurora() {
      p.push();
      p.blendMode(p.SCREEN);
      p.noStroke();
      var bands = 4;
      for (var k = 0; k < bands; k++) {
        var col = AUR[k % AUR.length];
        var baseY = HY * (0.2 + 0.15 * k);
        var amp = HY * 0.12;
        var phase = t * (0.12 + 0.05 * k) + k * 1.7;
        for (var layer = 0; layer < 3; layer++) {
          var a = 30 - layer * 7;
          p.fill(col[0], col[1], col[2], a);
          p.beginShape();
          p.vertex(0, 0);
          for (var x = 0; x <= W; x += 24) {
            var n = p.noise(x * 0.0016, k * 0.7, t * 0.06);
            var y =
              baseY +
              Math.sin(x * 0.004 + phase) * amp * 0.5 +
              (n - 0.5) * amp * 1.6 +
              layer * 10;
            p.vertex(x, y);
          }
          p.vertex(W, 0);
          p.endShape(p.CLOSE);
        }
      }
      p.pop();
    }

    function twinkle() {
      p.noStroke();
      for (var i = 0; i < stars.length; i += 2) {
        var s = stars[i];
        var a = 120 + 110 * Math.sin(t * 1.4 + s.ph);
        if (a > 60) {
          p.fill(220, 232, 250, a * 0.5);
          p.circle(s.x, s.y, s.r * 1.4);
        }
      }
    }

    // wave layers: back-to-front parallax. Each returns its own surface fn.
    var LAYERS = 6;
    function layerParams(i) {
      var f = i / (LAYERS - 1);
      return {
        baseY: HY + (H - HY) * (0.06 + f * 0.9),
        amp: 3 + f * 16,
        k1: 0.006 + f * 0.004,
        k2: 0.013 + f * 0.006,
        s1: 0.5 + f * 1.3,
        s2: 0.7 + f * 1.1,
      };
    }
    function surfaceY(lp, x) {
      return (
        lp.baseY +
        Math.sin(x * lp.k1 + t * lp.s1) * lp.amp +
        Math.sin(x * lp.k2 - t * lp.s2 + 1.3) * lp.amp * 0.5
      );
    }

    function drawWaveLayer(i) {
      var lp = layerParams(i);
      var f = i / (LAYERS - 1);
      var r = lerp(20, 5, f), g = lerp(42, 16, f), b = lerp(70, 30, f);
      p.noStroke();
      p.fill(r, g, b);
      p.beginShape();
      p.vertex(0, H);
      p.vertex(0, surfaceY(lp, 0));
      for (var x = 0; x <= W; x += 12) p.vertex(x, surfaceY(lp, x));
      p.vertex(W, H);
      p.endShape(p.CLOSE);

      // aurora-tinted crest highlights on the front layers
      if (i >= LAYERS - 3) {
        var col = AUR[(i + 1) % AUR.length];
        p.push();
        p.blendMode(p.SCREEN);
        p.noFill();
        p.stroke(col[0], col[1], col[2], 40 + 25 * Math.sin(t + i));
        p.strokeWeight(1.2);
        p.beginShape();
        for (var x2 = 0; x2 <= W; x2 += 12) p.vertex(x2, surfaceY(lp, x2) - 1);
        p.endShape();
        p.pop();
      }
    }

    function drawShip() {
      var frontLp = layerParams(LAYERS - 3);
      var shipH = H * 0.38;
      var shipW = (ship.width / ship.height) * shipH;
      // sail straight and level across the screen: x advances continuously and
      // wraps, y is fixed at the mean water line (no bobbing, no rocking).
      var span = W + shipW * 2;
      // phase offset so the ship is already on-screen at load; ~60s to cross
      var sx = ((t * (span / 40) + span * 0.55) % span) - shipW;
      var wl = frontLp.baseY; // constant mean water level
      var cy = wl - shipH * 0.34; // hull base sits just under the water line

      // steady reflection that travels with the ship
      p.push();
      p.translate(sx, wl);
      p.scale(1, -0.55);
      p.tint(255, 38);
      p.imageMode(p.CENTER);
      p.image(ship, 0, -shipH * 0.16, shipW, shipH);
      p.pop();

      // lay the very front wave over the reflection to break it up
      drawWaveLayer(LAYERS - 1);

      // the ship, level
      p.push();
      p.translate(sx, cy);
      p.imageMode(p.CENTER);
      p.noTint();
      p.image(ship, 0, 0, shipW, shipH);
      p.pop();
    }

    p.draw = function () {
      t += 0.016;
      p.image(bg, 0, 0);
      drawAurora();
      twinkle();
      // soft horizon haze so the sea blends into the sky with no hard seam
      p.push();
      p.noStroke();
      for (var hz = 0; hz < 30; hz++) {
        var a = 26 * (1 - hz / 30);
        p.fill(16, 30, 62, a);
        p.rect(0, HY - 8 + hz, W, 2);
      }
      p.pop();
      for (var i = 0; i < LAYERS - 1; i++) drawWaveLayer(i);
      drawShip();
    };
  }, mountEl);
})();
