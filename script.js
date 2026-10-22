/* ---------- 2. ORBIT ANIMATION ----------
   Idea: each circle has a "progress" number p between 0 and 1.
     p = 0    -> start of the arc (bottom)
     p = 0.5  -> middle of the arc (left side)
     p = 1    -> end of the arc (top)
   As time passes, p grows. When it reaches 1 it wraps back to 0,
   so the circle disappears at the top and reappears at the bottom.
   From p we work out where the circle is, how big it is, and how visible it is.

   The code is wrapped in (() => { ... })(); so its variables stay
   private and do not clash with other code. */

(() => {
  // --- Find the things we need on the page ---

  // The invisible square holding the arc
  const orbit = document.querySelector(".orbit");

  // If it is not on the page, stop here
  if (!orbit) return;

  // All the circles (each has the class "badge"), turned into a normal list
  const badges = Array.from(orbit.querySelectorAll(".badge"));

  // Did the person ask their device to reduce motion? (true or false)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // --- Settings you can change ---

  // Time for one circle to travel the whole arc, in milliseconds
  // (24000 = 24 seconds; bigger number = slower)
  const LAP = 24000;

  // Size of the arc as a fraction of the orbit size
  // (bigger number = bigger curve)
  const RADIUS = 0.38;

  // How much of the arc is used to fade in and out
  // (0.12 = the first and last 12%)
  const FADE = 0.12;

  // Current width of the orbit, filled in by measure()
  // (let, because this value changes)
  let size = 0;

  // Reads the orbit's current width in pixels
  const measure = () => {
    size = orbit.clientWidth;
  };

  // Makes a number between 0 and 1 change gently (slow at the ends, faster in
  // the middle) instead of in a straight line. This makes the fade look smooth.
  const smooth = (x) => x * x * (3 - 2 * x);

  // Puts every circle in the right place for the time "t" (in milliseconds)
  const place = (t) => {
    // The centre of the orbit (same for x and y)
    const c = size / 2;

    // The radius of the arc in pixels
    const r = size * RADIUS;

    // i = 0, 1, 2 for the three circles
    badges.forEach((b, i) => {
      // 1) PROGRESS: how far along the arc this circle is (0 to 1).
      //    "% 1" wraps the number back to 0 after it reaches 1.
      //    "i / badges.length" spaces the circles evenly apart.
      //    With reduced motion we use fixed positions so nothing moves.
      const p = reduce ? [0.2, 0.5, 0.8][i] : (t / LAP + i / badges.length) % 1;

      // 2) ANGLE: turns progress into an angle on a circle.
      //    Starts at the bottom (90 degrees) and moves half a turn
      //    (180 degrees) up to the top.
      //    Angles here are in radians (Math.PI = 180 degrees).
      const a = Math.PI / 2 + Math.PI * p;

      // 3) VISIBILITY (opacity): 0 at the very start and end of the arc,
      //    1 everywhere else. This is the fade in and fade out.
      const vis = reduce
        ? 1
        : smooth(Math.max(0, Math.min(1, p / FADE, (1 - p) / FADE)));

      // 4) POSITION: cos and sin turn the angle into x and y on the circle.
      //    We subtract half the circle's width so its CENTRE sits on the arc,
      //    not its top-left corner.
      const w = b.offsetWidth;

      // Tiny up-and-down floating
      const bob = reduce ? 0 : Math.sin(t / 1400 + i * 2) * size * 0.01;

      const x = c + r * Math.cos(a) - w / 2;
      const y = c + r * Math.sin(a) - w / 2 + bob;

      // 5) SIZE: Math.sin(PI * p) is 0 at the ends and 1 in the middle.
      //    So the circle is small when it appears, biggest in the middle,
      //    and small again when it disappears.
      const m = reduce ? 1 : Math.sin(Math.PI * p);

      // Scale from 35% (smallest) up to 100% (biggest)
      const sc = 0.35 + 0.65 * m;

      // 6) APPLY everything to the circle on the page
      b.style.opacity = vis;
      b.style.transform = `translate(${x}px,${y}px) scale(${sc})`;
    });
  };

  // Runs again and again (about 60 times a second) to keep things moving.
  // "now" is the time in milliseconds given by the browser.
  const frame = (now) => {
    place(now);

    // Ask the browser to call frame() again for the next screen refresh
    requestAnimationFrame(frame);
  };

  // --- Start everything ---

  // Read the size once at the start
  measure();

  // ...and again if the window size changes
  window.addEventListener("resize", () => {
    measure();
    place(performance.now());
  });

  // Draw the first position straight away
  place(performance.now());

  // Start the animation (unless motion is reduced)
  if (!reduce) requestAnimationFrame(frame);
})();


/* ---------- 3. SCROLL ANIMATIONS ----------
   - Anything with class "reveal" gets the class "in" when it
     scrolls into view (style.css then animates it).
   We use IntersectionObserver (the browser tells us when something appears)
   instead of listening to every scroll event, which is smoother and lighter. */

(() => {
  // Tells the CSS that JavaScript works, so hidden-until-scrolled styles apply.
  document.documentElement.classList.add("js-on");

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targets = document.querySelectorAll(".reveal");

  if (reduce || !("IntersectionObserver" in window)) {
    // No motion wanted: show everything straight away
    targets.forEach((el) => el.classList.add("in"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          observer.unobserve(entry.target);   // animate only once
        });
      },
      { threshold: 0.25 }
    );
    targets.forEach((el) => observer.observe(el));
  }

})();


/* ---------- 4. WORDS LOOP ----------
   PHENOMENAL / YOUTH / HUB: every round (5 seconds) the words arrive, stay
   together, slide up and away, then start again.
     - PHENOMENAL: its letters slide in from the left, one by one
     - YOUTH: slides in from the right
     - HUB: slides in from the bottom
   In the HTML each word just has data-from="letters", "right" or "bottom".
   This uses the Web Animations API: element.animate(keyframes, options),
   which does the same job as CSS @keyframes but is controlled from JavaScript. */

(() => {
  const section = document.querySelector(".words");
  const words = document.querySelectorAll(".loop-text .mask > span");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!section || !words.length || reduce) return;   // no motion wanted: the words just stay put
  section.classList.add("motion-ready");

  // --- Settings you can change ---
  const ROUND = 5000;       // length of one full round, in milliseconds (bigger = slower)
  const WORD_GAP = 100;     // delay between the words, in milliseconds
  const LETTER_GAP = 60;    // delay between the letters of PHENOMENAL, in milliseconds

  // Where each kind of word waits before it slides in (x y, in the word's own size)
  const START = {
    left: "translate(-100%, 0)",
    right: "translate(100%, 0)",
    bottom: "translate(0, 110%)",
    letters: "translate(-0.5em, 0)",   // each single letter starts a little to the left
  };

  const SMOOTH = "cubic-bezier(.65, 0, .35, 1)";   // gentle start and stop

  // Plays the loop on one element, starting after "delay" milliseconds
  const play = (el, from, delay, fade) => {
    const hidden = fade ? { opacity: 0 } : {};
    const shown = fade ? { opacity: 1 } : {};
    el.animate(
      [
        { ...hidden, transform: START[from], offset: 0, easing: SMOOTH },            // waiting
        { ...shown, transform: "translate(0, 0)", offset: 0.2, easing: "linear" },   // arrived
        { ...shown, transform: "translate(0, 0)", offset: 0.72, easing: SMOOTH },    // staying
        { ...shown, transform: "translate(0, -110%)", offset: 0.86 },                // slid up and away
        { ...shown, transform: "translate(0, -110%)", offset: 1 },
      ],
      { duration: ROUND, delay, iterations: Infinity, fill: "backwards" }
    );
  };

  const startWordLoop = () => words.forEach((word, i) => {
    const from = word.dataset.from;

    if (from === "letters") {
      // Wrap every letter in its own <span> so each one can move on its own.
      // The whole word gets a label so screen readers still read it as one word.
      const text = word.textContent.trim();
      word.setAttribute("aria-label", text);
      word.textContent = "";
      [...text].forEach((letter, n) => {
        const span = document.createElement("span");
        span.className = "ch";
        span.setAttribute("aria-hidden", "true");
        span.textContent = letter;
        word.appendChild(span);
        play(span, "letters", i * WORD_GAP + n * LETTER_GAP, true);
      });
    } else {
      play(word, from, i * WORD_GAP, false);
    }
  });

  // First slide the full title into view when the section is reached. Start
  // the existing word-by-word loop only after that entrance has finished.
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    section.classList.add("scroll-enter");
    observer.disconnect();
    window.setTimeout(startWordLoop, 1000);
  }, { threshold: 0.25 });
  observer.observe(section);
})();


/* ---------- 4b. FIRST-VISIT INTRO ----------
   On the first page load in this tab, briefly guide visitors to the title,
   pause so they can read it, then return smoothly to the hero. */
(() => {
  const section = document.querySelector(".words");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const introKey = "pyh-title-intro-seen";
  if (!section || reduce || sessionStorage.getItem(introKey)) return;
  sessionStorage.setItem(introKey, "1");

  // Avoid taking control if the browser restored the page somewhere below top.
  if (window.scrollY > 5) return;

  let cancelled = false;
  const cancelIntro = () => { cancelled = true; };
  ["wheel", "touchstart", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, cancelIntro, { once: true, passive: true });
  });

  window.setTimeout(() => {
    if (cancelled) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });

    // Let the title's entrance and its first word sequence play before going home.
    window.setTimeout(() => {
      if (!cancelled) window.scrollTo({ top: 0, behavior: "smooth" });
    }, 4200);
  }, 650);
})();


/* ---------- 5. MOBILE MENU ----------
   The hamburger button opens and closes the glass dropdown on phones.
   It works by adding or removing the class "menu-open" on the navbar; the
   look of both states is in style.css. The menu also closes when you tap a
   link, tap outside it, press Escape, or make the screen wide again. */

(() => {
  const nav = document.querySelector(".nav");
  const btn = document.querySelector(".menu-btn");
  if (!nav || !btn) return;

  const setOpen = (open) => {
    nav.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };

  btn.addEventListener("click", () => setOpen(!nav.classList.contains("menu-open")));
  nav.querySelectorAll(".links a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });
  document.addEventListener("click", (e) => {
    if (!nav.contains(e.target)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });
  window.matchMedia("(min-width: 901px)").addEventListener("change", () => setOpen(false));
})();


/* ---------- STORY RAIL ----------
   Cards enter first, then the rail drifts left-to-right in a slow seamless
   loop while remaining interactive. */
(() => {
  const heading = document.querySelector(".story-heading");
  const track = document.querySelector("[data-story-track]");
  if (!track) return;
  const originals = Array.from(track.querySelectorAll(".story-card"));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  originals.forEach((card, index) => {
    card.dataset.storyIndex = String(index);
    card.dataset.loopCopy = "0";
  });

  const makeClones = (copyIndex) => originals.map((card) => {
    const clone = card.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    clone.dataset.loopCopy = String(copyIndex);
    clone.querySelectorAll("button").forEach((button) => { button.tabIndex = -1; });
    return clone;
  });
  track.prepend(...makeClones(-1));
  track.append(...makeClones(1));
  const cards = Array.from(track.querySelectorAll(".story-card"));
  let cycleWidth = 0;
  let loopStarted = false;
  let previousFrame = 0;
  let motionTime = 0;
  let mouseCard = null;
  let pressedCard = null;
  const speed = 26; // pixels per second: slow enough to read, visible in motion

  const measureLoop = () => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    cycleWidth = originals.reduce((sum, card) => sum + card.getBoundingClientRect().width, 0) + gap * originals.length;
    if (cycleWidth) track.scrollLeft = cycleWidth;
  };

  if (reduce || !("IntersectionObserver" in window)) {
    heading?.classList.add("is-visible");
    cards.forEach((card) => card.classList.add("is-visible"));
  } else {
    if (heading) {
      const titleObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          titleObserver.unobserve(entry.target);
        });
      }, { threshold: 0.18 });
      titleObserver.observe(heading);
    }
    const cardObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        cardObserver.unobserve(entry.target);
      });
    }, { root: track, threshold: 0.18 });
    cards.forEach((card) => cardObserver.observe(card));
  }

  const move = (direction) => {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    track.scrollBy({ left: direction * (originals[0].getBoundingClientRect().width + gap), behavior: reduce ? "auto" : "smooth" });
  };
  const animate = (now) => {
    if (previousFrame && loopStarted && cycleWidth) {
      const delta = now - previousFrame;
      if (!mouseCard && !pressedCard) {
        motionTime += delta;
        track.scrollLeft -= (delta / 1000) * speed;
        if (track.scrollLeft < 1) track.scrollLeft += cycleWidth;
        if (track.scrollLeft >= cycleWidth * 2) track.scrollLeft -= cycleWidth;

        // One continuous sine wave travels across every repeated card set.
        const entranceEase = Math.min(1, motionTime / 2200);
        cards.forEach((card) => {
          const position = Number(card.dataset.loopCopy) * originals.length + Number(card.dataset.storyIndex);
          const phase = position * (Math.PI * 2 / originals.length);
          const y = Math.sin(motionTime * 0.00072 + phase) * 18 * entranceEase;
          card.style.setProperty("--zigzag-y", `${y.toFixed(2)}px`);
        });
      }
    }
    previousFrame = now;
    requestAnimationFrame(animate);
  };

  track.addEventListener("click", (event) => {
    const imageButton = event.target.closest(".story-image-frame");
    if (!imageButton) return;
    const card = imageButton.closest(".story-card");
    const zoomed = card.classList.toggle("is-zoomed");
    imageButton.setAttribute("aria-pressed", String(zoomed));
    imageButton.setAttribute("aria-label", zoomed ? "Restore image size" : "Zoom image");
  });
  const focusCard = (card) => {
    track.classList.add("is-hovering-picture");
    track.querySelectorAll(".story-card.is-hovered").forEach((item) => item.classList.remove("is-hovered"));
    if (card) card.classList.add("is-hovered");
  };
  const clearFocus = () => {
    track.querySelectorAll(".story-card.is-hovered").forEach((item) => item.classList.remove("is-hovered"));
    if (!mouseCard && !pressedCard) track.classList.remove("is-hovering-picture");
  };
  track.addEventListener("pointerover", (event) => {
    if (event.pointerType !== "mouse") return;
    const card = event.target.closest(".story-card");
    if (!card || card.contains(event.relatedTarget)) return;
    mouseCard = card;
    focusCard(card);
  });
  track.addEventListener("pointerout", (event) => {
    if (event.pointerType !== "mouse") return;
    const card = event.target.closest(".story-card");
    if (!card || card.contains(event.relatedTarget)) return;
    const nextCard = event.relatedTarget?.closest?.(".story-card");
    mouseCard = nextCard && track.contains(nextCard) ? nextCard : null;
    if (mouseCard) focusCard(mouseCard);
    else clearFocus();
  });
  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    const card = event.target.closest(".story-card");
    if (!card) return;
    pressedCard = card;
    focusCard(card);
  });
  const releasePress = (event) => {
    if (!pressedCard || (event?.pointerType && event.pointerType === "mouse")) return;
    pressedCard = null;
    if (mouseCard) focusCard(mouseCard);
    else clearFocus();
  };
  window.addEventListener("pointerup", releasePress);
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerType !== "touch") releasePress(event);
  });
  window.addEventListener("touchend", () => releasePress(), { passive: true });
  window.addEventListener("touchcancel", () => releasePress(), { passive: true });
  track.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
  });
  window.addEventListener("resize", measureLoop);
  measureLoop();
  // Start on page load after the card entrance time, so the loop never waits
  // for a scroll trigger. The visitor's reduced-motion preference still
  // removes the entrance/hover transitions; this requested rail stays moving.
  window.setTimeout(() => { loopStarted = true; }, 1450);
  requestAnimationFrame(animate);
})();
