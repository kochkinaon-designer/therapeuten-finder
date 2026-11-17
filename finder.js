// Therapeuten-Finder
// Main JavaScript


/* ============================================================
   01 — TOPICS SWIPER
   Category slider initialization and active slide behavior
   ============================================================ */

const TopicsSwiper = new Swiper('.swiper.is--topics', {
  direction: 'horizontal',
  loop: false,
  slidesPerView: 1.3,
  spaceBetween: 16,
  breakpoints: {
    480: {
      slidesPerView: 2,
      spaceBetween: 16,
    },
    768: {
      slidesPerView: 3,
      spaceBetween: 16,
    },
    992: {
      slidesPerView: 4,
      spaceBetween: 24,
    },
  },
  navigation: {
    nextEl: '.swiper-btn.is--next',
    prevEl: '.swiper-btn.is--prev',
    disabledClass: 'is--disabled',
  },
  scrollbar: {
    el: '.swiper-scrollbar.is--topics',
    draggable: true,
  },
});

Webflow.push(function () {
  var swiperEl = document.querySelector('.swiper.is--topics');
  if (!swiperEl) return;

  setTimeout(function () {
    var swiperInstance = swiperEl.swiper;
    if (!swiperInstance) return;

    var slides = Array.from(swiperInstance.slides);

    function setActive(index) {
      slides.forEach(function (slide, i) {
        var card = slide.querySelector('.category-card');
        var isActive = i === index;
        slide.classList.toggle('is--active-slide', isActive);
        if (card) card.classList.toggle('is--active', isActive);
      });
    }

    setActive(0);

    swiperInstance.on('slideChange', function () {
      setActive(swiperInstance.activeIndex);
    });

    slides.forEach(function (slide, i) {
      slide.addEventListener('mouseenter', function () {
        setActive(i);
      });
    });

    swiperEl.addEventListener('mouseleave', function () {
      setActive(swiperInstance.activeIndex);
    });

  }, 300);
});


/* ============================================================
   02 — MARQUEE CARDS
   Responsive card heights and infinite marquee duplication
   ============================================================ */

(function () {
  var isMobile = window.innerWidth <= 767;
  var heights = isMobile
    ? ['19.25rem', '16.5rem', '16.5rem', '13.75rem']
    : ['24.5rem', '21rem', '21rem', '17.5rem'];

  document.querySelectorAll('.marquee__track').forEach(function (track) {
    var inner = track.querySelector('.w-dyn-items') || track;
    var items = Array.from(inner.children);

    items.forEach(function (item, i) {
      var card = item.querySelector('.doc-preview-card');
      if (card) card.style.height = heights[i % 4];
    });

    items.forEach(function (item) {
      var clone = item.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      inner.appendChild(clone);
    });
  });
})();


/* ============================================================
   03 — MAPBOX LOCATION AUTOCOMPLETE
   Location suggestions, coordinate retrieval and public API
   ============================================================ */

(() => {
  const TOKEN = "pk.eyJ1IjoiZHJrYXJsYWNhZGVteSIsImEiOiJjbXc0c2VlcXcwMHFjMnpxdnU5djd1Mnp2In0.WAfodmJtJlMVoSn7AerCQg";

  const input = document.getElementById("input-ort");
  const suggestions = document.getElementById("ort-suggestions");

  if (!input || !suggestions) return;

  let sessionToken = crypto.randomUUID();
  let debounceTimer;
  let controller;
  let selectedLocation = null;

  const newSession = () => {
    sessionToken = crypto.randomUUID();
  };

  function clearSuggestions() {
    suggestions.replaceChildren();
    suggestions.hidden = true;
  }

  function clearLocation() {
    selectedLocation = null;
    delete input.dataset.lat;
    delete input.dataset.lng;

    document.dispatchEvent(
      new CustomEvent("finder:location-changed", {
        detail: { location: null }
      })
    );
  }

  async function fetchJSON(url, signal) {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Mapbox HTTP ${response.status}`);
    }

    return response.json();
  }

  async function selectSuggestion(item) {
    controller?.abort();
    clearSuggestions();

    const url = new URL(
      "https://api.mapbox.com/search/searchbox/v1/retrieve/" +
      encodeURIComponent(item.mapbox_id)
    );

    url.searchParams.set("session_token", sessionToken);
    url.searchParams.set("access_token", TOKEN);

    try {
      const data = await fetchJSON(url);
      const feature = data.features?.[0];

      if (!feature) return;

      const [lng, lat] = feature.geometry.coordinates;

      selectedLocation = {
        name: item.name,
        label: item.place_formatted
          ? `${item.name}, ${item.place_formatted}`
          : item.name,
        lat,
        lng,
        mapboxId: item.mapbox_id
      };

      input.value = selectedLocation.label;
      input.dataset.lat = String(lat);
      input.dataset.lng = String(lng);

      document.dispatchEvent(
        new CustomEvent("finder:location-changed", {
          detail: { location: selectedLocation }
        })
      );

      newSession();

    } catch (error) {
      console.error("Mapbox retrieve error:", error);
    }
  }

  function renderSuggestions(items) {
    clearSuggestions();

    items.forEach(item => {
      const button = document.createElement("button");

      button.type = "button";
      button.style.cssText = `
        display:block;
        width:100%;
        padding:0.75rem;
        border:0;
        background:#fff;
        color:#373A35;
        font:inherit;
        text-align:left;
        cursor:pointer;
      `;

      const title = document.createElement("strong");
      title.textContent = item.name;

      const subtitle = document.createElement("small");
      subtitle.style.cssText = `
        display:block;
        margin-top:0.2rem;
        color:#737969;
      `;
      subtitle.textContent = item.place_formatted || "";

      button.append(title, subtitle);

      button.addEventListener("click", () => {
        selectSuggestion(item);
      });

      suggestions.appendChild(button);
    });

    suggestions.hidden = items.length === 0;
  }

  async function searchLocation(query) {
    controller?.abort();
    controller = new AbortController();

    const url = new URL(
      "https://api.mapbox.com/search/searchbox/v1/suggest"
    );

    url.searchParams.set("q", query);
    url.searchParams.set("access_token", TOKEN);
    url.searchParams.set("session_token", sessionToken);
    url.searchParams.set("country", "DE");
    url.searchParams.set("language", "de");
    url.searchParams.set("types", "place,locality,postcode");
    url.searchParams.set("limit", "6");

    try {
      const data = await fetchJSON(
        url,
        controller.signal
      );

      if (input.value.trim() !== query) return;

      renderSuggestions(data.suggestions || []);

    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Mapbox suggest error:", error);
      }
    }
  }

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    controller?.abort();

    clearLocation();
    clearSuggestions();

    const query = input.value.trim();

    if (query.length < 2) return;

    debounceTimer = setTimeout(() => {
      searchLocation(query);
    }, 300);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      clearSuggestions();
    }
  });

  document.addEventListener("pointerdown", event => {
    if (
      !input.contains(event.target) &&
      !suggestions.contains(event.target)
    ) {
      clearSuggestions();
    }
  });

  window.finderLocation = {
    get() {
      return selectedLocation;
    },
    clear() {
      input.value = "";
      clearLocation();
      clearSuggestions();
    }
  };
})();


/* ============================================================
   04 — TOPICS POPUP
   Topic selection and navigation to Finder with URL filters
   ============================================================ */

(function () {
  var swiperEl = document.querySelector('.swiper.is--topics');
  if (!swiperEl) return;

  var popup = document.querySelector('.topics-popup');
  var overlay = document.querySelector('.popup-overlay');
  var popupTitle = document.querySelector('.popup-title');
  var chipsContainer = document.querySelector('.popup-chips');
  var countEl = document.querySelector('.popup-count');
  var resetBtn = document.querySelector('.popup-reset');
  var closeBtn = document.querySelector('.popup-close');
  var confirmBtn = document.querySelector('.popup-confirm');

  swiperEl.addEventListener('click', function (event) {
    var slide = event.target.closest('.swiper-slide');
    if (!slide) return;

    var categoryId = slide.dataset.categoryId;
    var categoryTitle = slide.dataset.categoryTitle;
    if (!categoryId) return;

    if (popupTitle) popupTitle.textContent = categoryTitle;

    chipsContainer.querySelectorAll('.popup-chip').forEach(function (chip) {
      chip.classList.remove('is--selected');
      chip.style.display = chip.dataset.category === categoryId ? '' : 'none';
    });

    updateCount();
    popup.classList.add('is--open');
  });

  chipsContainer.addEventListener('click', function (e) {
    var chip = e.target.closest('.popup-chip');
    if (!chip || chip.style.display === 'none') return;
    chip.classList.toggle('is--selected');
    updateCount();
  });

  function updateCount() {
    var count = chipsContainer.querySelectorAll('.popup-chip.is--selected').length;
    if (countEl) countEl.textContent = count > 0 ? count + ' Themen gewählt' : '';
    if (resetBtn) resetBtn.style.visibility = count > 0 ? 'visible' : 'hidden';
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      chipsContainer.querySelectorAll('.popup-chip.is--selected').forEach(function (c) {
        c.classList.remove('is--selected');
      });
      updateCount();
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', function () {
      var selected = Array.from(chipsContainer.querySelectorAll('.popup-chip.is--selected'))
        .map(function (c) { return c.dataset.slug; })
        .filter(Boolean);
      window.location.href = '/therapeuten' + (selected.length > 0 ? '?specializations=' + selected.join(',') : '');
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closePopup);
  if (overlay) overlay.addEventListener('click', closePopup);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePopup();
  });

  function closePopup() {
    popup.classList.remove('is--open');
  }

})();



/* ==========================================================================
   05. SPECIALIZATION CHECKBOXES
   Generate drawer checkboxes from CMS and URL parameters
   ========================================================================== */
document.addEventListener("DOMContentLoaded", function () {
  const drawer = document.querySelector(".filter-drawer");
  if (!drawer) return;

  const categoryElements = [
    ...drawer.querySelectorAll(
      ".filter-category[data-category-slug]"
    )
  ];

  const sourceElements = [
    ...drawer.querySelectorAll(
      ".specialization-source[data-spec-slug]"
    )
  ];

  const selectedFromURL = new Set(
    (new URLSearchParams(window.location.search)
      .get("specializations") || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean)
  );

  // Match CMS categories by slug
  const categories = new Map();

  categoryElements.forEach(category => {
    const slug = category.dataset.categorySlug?.trim();
    const trigger = category.querySelector(
      ".filter-category__trigger"
    );
    const content = category.querySelector(
      ".filter-category__content"
    );
    const options = category.querySelector(
      ".filter-category__options"
    );

    if (!slug || !trigger || !content || !options) return;

    categories.set(slug, {
      category,
      trigger,
      content,
      options
    });

    // Initial collapsed state
    content.hidden = true;
    content.style.display = "none";
    trigger.setAttribute("aria-expanded", "false");

    trigger.addEventListener("click", function (event) {
      event.preventDefault();

      const isOpen =
        trigger.getAttribute("aria-expanded") === "true";

      setCategoryOpen(slug, !isOpen);
    });
  });

  function setCategoryOpen(slug, open) {
    const item = categories.get(slug);
    if (!item) return;

    item.content.hidden = !open;
    item.content.style.display = open ? "" : "none";

    item.trigger.setAttribute(
      "aria-expanded",
      String(open)
    );

    item.category.classList.toggle("is-open", open);
  }

  // Generate checkboxes from CMS
  sourceElements.forEach(source => {
    const slug = source.dataset.specSlug?.trim();
    const name = source.dataset.specName?.trim();
    const categorySlug =
      source.dataset.specCategory?.trim();

    if (!slug || !name || !categorySlug) return;

    const target = categories.get(categorySlug);

    if (!target) {
      console.warn(
        "Finder: category not found for specialization",
        { slug, categorySlug }
      );
      return;
    }

    const label = document.createElement("label");
    label.className = "filter-checkbox";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "filter-specializations";
    input.value = slug;
    input.className = "filter-checkbox__input";

    if (selectedFromURL.has(slug)) {
      input.checked = true;
      setCategoryOpen(categorySlug, true);
    }

    const text = document.createElement("span");
    text.className = "filter-checkbox__label";
    text.textContent = name;

    label.appendChild(input);
    label.appendChild(text);

    target.options.appendChild(label);
  });

  // Notify Finder when selections change
  drawer.addEventListener("change", function (event) {
    if (!event.target.matches(
      'input[name="filter-specializations"]'
    )) return;

    drawer.dispatchEvent(new CustomEvent(
      "finder:specializations-changed",
      {
        bubbles: true,
        detail: {
          specializations: [
            ...drawer.querySelectorAll(
              'input[name="filter-specializations"]:checked'
            )
          ].map(input => input.value)
        }
      }
    ));
  });

  console.log(
    "Finder: specialization filters initialized",
    sourceElements.length
  );
});


/* ==========================================================================
   06. GEO FILTER
   Finsweet geo filter hook, applied location and radius
   ========================================================================== */
(() => {
  "use strict";

  let listInstance = null;
  let appliedLocation = null;
  let appliedRadius = 25;

  const form = document.querySelector(
    'form[fs-list-element="filters"]'
  );

  if (!form) {
    console.warn("Finder Geo: filters form not found");
    return;
  }

  // Calculate distance between coordinates (km)
  function distanceKm(lat1, lng1, lat2, lng2) {
    const rad = value => value * Math.PI / 180;

    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLng / 2) ** 2;

    return 6371 * 2 * Math.asin(
      Math.sqrt(Math.min(1, a))
    );
  }

  // Additional geographic filter for Finsweet
  function geoFilter(items) {

     // Share candidates before applying the radius.
    document.dispatchEvent(
    new CustomEvent("finder:geo-candidates", {
      detail: { items: [...items] }
      })
     );

    // No location selected
    if (!appliedLocation) return items;

    // Unlimited radius (Alle)
    if (appliedRadius === Infinity) return items;

    return items.filter(item => {
      const latElement = item.element.querySelector(
        "[data-lat]"
      );

      const lngElement = item.element.querySelector(
        "[data-lng]"
      );

      const latValue = latElement?.getAttribute("data-lat");
      const lngValue = lngElement?.getAttribute("data-lng");

      if (!latValue || !lngValue) return false;

      const lat = Number(latValue);
      const lng = Number(lngValue);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) return false;

      return distanceKm(
        appliedLocation.lat,
        appliedLocation.lng,
        lat,
        lng
      ) <= appliedRadius;
    });
  }

  // Re-run Finsweet filtering
  function refreshResults() {
    if (listInstance) {
      listInstance.triggerHook("filter");
    }
  }

  // Apply geographic search on form submit
  function applyGeoSearch() {

    const selected = window.finderLocation?.get();

    appliedLocation = selected
      ? {
          lat: selected.lat,
          lng: selected.lng,
          label: selected.label || selected.name || ""
        }
      : null;

    const radiusValue = window.finderRadius?.get();

    if (radiusValue === "all") {

      appliedRadius = Infinity;

    } else {

      const radius = Number(radiusValue);

      appliedRadius =
        radiusValue !== null &&
        radiusValue !== undefined &&
        Number.isFinite(radius) &&
        radius > 0
          ? radius
          : 25;
    }

    refreshResults();

    console.log("Finder Geo: search applied", {
      location: appliedLocation?.label || null,
      radius: appliedRadius === Infinity
        ? "Alle"
        : appliedRadius
    });
  }

  // Public API for Active Filters and Clear All
  window.finderGeo = {

    // Get currently applied geographic filters
    getApplied() {
      return {
        location: appliedLocation
          ? { ...appliedLocation }
          : null,
        radius: appliedRadius
      };
    },

    // Clear applied geographic filters
    clear() {
      appliedLocation = null;
      appliedRadius = 25;

      refreshResults();

      console.log("Finder Geo: cleared");

      document.dispatchEvent(
        new CustomEvent("finder:geo-cleared")
      );
    },

    // Reapply geographic filters from current inputs
    apply() {
      applyGeoSearch();
    }
  };

  // Initialize Finsweet List API
  (window.FinsweetAttributes ||= []).push([
    "list",
    ([list]) => {

      if (!list) {
        console.warn("Finder Geo: list not found");
        return;
      }

      listInstance = list;

      // Register geographic filter
      list.addHook("filter", geoFilter);

      console.log("Finder Geo: ready");
    }
  ]);

  // Submit applies location and radius
  form.addEventListener("submit", () => {
    applyGeoSearch();
  }, true);

})();


/* ==========================================================================
   07. UNIVERSAL AUTOCOMPLETE
   Search terms, specializations, professions and practitioners
   ========================================================================== */
(() => {
  "use strict";

  const root = document.getElementById("thema-combobox");
  const input = document.getElementById("thema-input");
  const suggestions = document.getElementById("thema-suggestions");
  const clearButton = document.getElementById("thema-clear");

  if (!root || !input || !suggestions || !clearButton) return;
  if (root.dataset.autocompleteReady === "true") return;

  root.dataset.autocompleteReady = "true";

  const MAX_TERMS = 8;
  const MAX_PRACTITIONERS = 4;

  let activeIndex = -1;
  let optionButtons = [];

  const normalize = value =>
    String(value || "")
      .toLocaleLowerCase("de")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // Read autocomplete entries from CMS
  function getEntries() {
    const entries = [];
    const seen = new Set();

    document.querySelectorAll(
      "[data-autocomplete]"
    ).forEach(element => {
      const type = element.dataset.autocomplete;
      const name = element.textContent.trim();

      if (![
        "thema",
        "fachrichtung",
        "spezialisierung",
        "practitioner"
      ].includes(type)) return;

      if (!name) return;

      const key = `${type}:${normalize(name)}`;

      if (seen.has(key)) return;
      seen.add(key);

      entries.push({ type, name });
    });

    return entries;
  }

  // Keep the autocomplete dictionary independent
  // of Finsweet's changing result list
  const entries = getEntries();

  function closeSuggestions() {
    suggestions.hidden = true;
    suggestions.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");

    activeIndex = -1;
    optionButtons = [];
  }

  function updateClearButton() {
    clearButton.hidden = !input.value.length;
  }

  function selectEntry(entry) {
    input.value = entry.name;
    updateClearButton();
    closeSuggestions();

    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));

    input.focus();
  }

  function createOption(entry, index) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "thema-combobox__option";
    button.id = `thema-option-${index}`;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", "false");
    button.textContent = entry.name;

    button.addEventListener("pointerdown", event => {
      event.preventDefault();
    });

    button.addEventListener("click", () => {
      selectEntry(entry);
    });

    return button;
  }

  function setActive(index) {
    if (!optionButtons.length) return;

    activeIndex =
      (index + optionButtons.length) %
      optionButtons.length;

    optionButtons.forEach((button, i) => {
      const active = i === activeIndex;

      button.classList.toggle("is-active", active);
      button.setAttribute(
        "aria-selected",
        String(active)
      );
    });

    const activeButton = optionButtons[activeIndex];

    input.setAttribute(
      "aria-activedescendant",
      activeButton.id
    );

    activeButton.scrollIntoView({
      block: "nearest"
    });
  }

  function renderSuggestions() {
    const query = normalize(input.value);

    updateClearButton();

    if (query.length < 2) {
      closeSuggestions();
      return;
    }

    const matches = entries.filter(entry =>
      normalize(entry.name).includes(query)
    );

    const terms = matches
      .filter(entry => entry.type !== "practitioner")
      .sort((a, b) => {
        const aStarts = normalize(a.name).startsWith(query);
        const bStarts = normalize(b.name).startsWith(query);

        if (aStarts !== bStarts) {
          return aStarts ? -1 : 1;
        }

        return a.name.localeCompare(b.name, "de");
      })
      .slice(0, MAX_TERMS);

    const practitioners = matches
      .filter(entry => entry.type === "practitioner")
      .slice(0, MAX_PRACTITIONERS);

    suggestions.replaceChildren();
    optionButtons = [];
    activeIndex = -1;

    if (!terms.length && !practitioners.length) {
      const empty = document.createElement("div");
      empty.className = "thema-combobox__empty";
      empty.textContent = "Keine Vorschläge gefunden";

      suggestions.appendChild(empty);
      suggestions.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }

    terms.forEach(entry => {
      const button = createOption(
        entry,
        optionButtons.length
      );

      optionButtons.push(button);
      suggestions.appendChild(button);
    });

    if (practitioners.length) {
      const heading = document.createElement("div");

      heading.className = "thema-combobox__group-label";
      heading.textContent = "Therapeut:innen";

      suggestions.appendChild(heading);

      practitioners.forEach(entry => {
        const button = createOption(
          entry,
          optionButtons.length
        );

        optionButtons.push(button);
        suggestions.appendChild(button);
      });
    }

    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  input.addEventListener("input", renderSuggestions);

  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 2) {
      renderSuggestions();
    }
  });

  input.addEventListener("keydown", event => {
    if (suggestions.hidden) return;

    if (event.key === "ArrowDown") {
      if (!optionButtons.length) return;

      event.preventDefault();
      setActive(activeIndex + 1);
    }

    if (event.key === "ArrowUp") {
      if (!optionButtons.length) return;

      event.preventDefault();
      setActive(
        activeIndex < 0
          ? optionButtons.length - 1
          : activeIndex - 1
      );
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      optionButtons[activeIndex]?.click();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSuggestions();
    }
  });

  clearButton.addEventListener("click", () => {
    input.value = "";
    updateClearButton();
    closeSuggestions();

    input.dispatchEvent(new Event("input", {
      bubbles: true
    }));

    input.focus();
  });

  document.addEventListener("pointerdown", event => {
    if (!root.contains(event.target)) {
      closeSuggestions();
    }
  });

  // Hide suggestions when the search is submitted
  input.closest("form")?.addEventListener(
    "submit",
    closeSuggestions
  );

  updateClearButton();

  console.log(
    "Finder Autocomplete: ready",
    entries.length,
    "CMS entries"
  );
})();



/* ==========================================================================
   08. CLEAR ALL — MAIN FINDER
   Reset search, location, radius and quick filters
   ========================================================================== */
(() => {
  "use strict";

  const clearAll = document.getElementById("btn-clear-all");
  const form = document.querySelector(
    'form[fs-list-element="filters"]'
  );

  if (!clearAll || !form) return;

  clearAll.addEventListener("click", event => {
    event.preventDefault();

    // Clear Thema
    const thema = document.getElementById("thema-input");

    if (thema) {
      thema.value = "";
      thema.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    // Clear Mapbox location
    window.finderLocation?.clear();

    // Clear applied Geo Filter
    window.finderGeo?.clear();

    // Clear Radius Dropdown UI
    window.finderRadius?.clear();

    // Clear quick filter checkboxes
    [
      "#beratungsform-dropdown",
      "#versicherung-dropdown"
    ].forEach(selector => {
      document.querySelectorAll(
        `${selector} input[type="checkbox"]`
      ).forEach(checkbox => {
        checkbox.checked = false;
        checkbox.dispatchEvent(
          new Event("change", { bubbles: true })
        );
      });
    });

    // Reapply form-based Finsweet filters
    if (form.requestSubmit) {
      form.requestSubmit();
    }

    // Remove active tags
    document.querySelector(
      ".active-filters__tags"
    )?.replaceChildren();

    console.log("Finder: all filters cleared");
  });
})();



/* ==========================================================================
   09. ACTIVE FILTER TAGS
   Render and remove active filter chips
   ========================================================================== */
(() => {
  "use strict";

  const container = document.querySelector(
    ".active-filters__tags"
  );

  const activeBar = document.querySelector(
    ".filter-bar__active"
  );

  const form = document.querySelector(
    'form[fs-list-element="filters"]'
  );

  if (!container || !form) return;

  const themaInput = document.getElementById("thema-input");
  const drawer = document.querySelector(".filter-drawer");

  let appliedThema = "";
  let suppressSubmitSync = false;

  const labels = {
    consultation: {
      online: "Online",
      onsite: "Vor Ort"
    },
    insurance: {
      public: "Gesetzlich",
      private: "Privat",
      selfpay: "Selbstzahler"
    },
    ages: {
      adults: "Erwachsene",
      teenagers: "Jugendliche",
      children: "Kinder"
    }
  };

  function refreshSearch() {
    suppressSubmitSync = true;

    try {
      form.requestSubmit();
    } finally {
      suppressSubmitSync = false;
    }

    queueMicrotask(render);
  }

  function createTag(label, onRemove) {
    const tag = document.createElement("div");
    tag.className = "card__tag";

    const text = document.createElement("span");
    text.textContent = label;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "active-filter__remove";
    remove.setAttribute(
      "aria-label",
      `Filter ${label} entfernen`
    );
    remove.textContent = "×";

    remove.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      onRemove();
    });

    tag.append(text, remove);
    return tag;
  }

  function removeThema() {
    appliedThema = "";

    if (themaInput) {
      themaInput.value = "";
      themaInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    refreshSearch();
  }

  function removeLocation() {
    window.finderLocation?.clear();
    window.finderGeo?.clear();
    refreshSearch();
  }

  function removeRadius() {
    window.finderRadius?.set("all");
    window.finderGeo?.apply();
    render();
  }

  function removeAdvanced(group, value) {
    window.finderAdvanced?.remove(group, value);
    render();
  }

  function getLanguageLabel(slug) {
    if (!drawer) return slug;

    const element = [
      ...drawer.querySelectorAll("[data-language]")
    ].find(el => el.dataset.language === slug);

    return element?.textContent.trim() || slug;
  }

  function getSpecializationLabel(slug) {
    if (!drawer) return slug;

    const input = [
      ...drawer.querySelectorAll(
        'input[name="filter-specializations"]'
      )
    ].find(el => el.value === slug);

    return input
      ?.closest(".filter-checkbox")
      ?.querySelector(".filter-checkbox__label")
      ?.textContent.trim() || slug;
  }

  function render() {
    container.replaceChildren();

    // THEMA
    if (appliedThema) {
      container.appendChild(
        createTag(appliedThema, removeThema)
      );
    }

    // GEO
    const geo = window.finderGeo?.getApplied();

    if (geo?.location) {
      container.appendChild(
        createTag(
          geo.location.label || "Standort",
          removeLocation
        )
      );

      if (
        geo.radius !== Infinity &&
        Number.isFinite(geo.radius)
      ) {
        container.appendChild(
          createTag(
            `${geo.radius} km`,
            removeRadius
          )
        );
      }
    }

    // ADVANCED FILTERS
    const advanced =
      window.finderAdvanced?.getApplied();

    if (advanced) {
      Object.entries(advanced).forEach(
        ([group, values]) => {
          values.forEach(value => {
            let label;

            if (group === "languages") {
              label = getLanguageLabel(value);
            } else if (group === "specializations") {
              label = getSpecializationLabel(value);
            } else {
              label = labels[group]?.[value] || value;
            }

            container.appendChild(
              createTag(
                label,
                () => removeAdvanced(group, value)
              )
            );
          });
        }
      );
    }

    // SHOW / HIDE ACTIVE FILTERS BLOCK
    // Sorting remains visible in filter-bar__row-2.
    if (activeBar) {
      activeBar.style.display =
        container.childElementCount > 0
          ? ""
          : "none";
    }
  }

  // MAIN FORM SUBMIT
  form.addEventListener("submit", () => {
    if (!suppressSubmitSync) {
      appliedThema = themaInput?.value.trim() || "";
    }

    queueMicrotask(render);
  });

  // FILTER EVENTS
  [
    "finder:beratungsform-changed",
    "finder:versicherung-changed",
    "finder:advanced-filters-changed",
    "finder:geo-cleared",
    "finder:location-changed",
    "finder:radius-changed"
  ].forEach(eventName => {
    document.addEventListener(eventName, render);
  });

  // MAIN CLEAR ALL
  document.getElementById("btn-clear-all")
    ?.addEventListener("click", () => {
      appliedThema = "";
      window.finderAdvanced?.clear();
      queueMicrotask(render);
    });

  render();

  console.log("Finder Active Filters: ready");
})();



/* ==========================================================================
   10. FINDER DRAWER KEYBOARD ACCESSIBILITY
   Keyboard navigation, focus trapping and Escape handling.
   Works with existing Webflow Interactions.
   ========================================================================== */
(() => {
  "use strict";

  const drawer = document.querySelector(".filter-drawer");
  const panel = drawer?.querySelector(".filter-drawer__panel");
  const opener = document.getElementById("btn-all-filters");
  const closeButton = document.getElementById("drawer-close");
  const overlay = drawer?.querySelector(".filter-drawer__overlay");

  if (!drawer || !panel || !opener || !closeButton) {
    console.warn("Finder Drawer A11y: elements missing");
    return;
  }

  if (drawer.dataset.keyboardReady === "true") return;
  drawer.dataset.keyboardReady = "true";

  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");

  let isOpen = false;
  let previousFocus = null;

  function visible(element) {
    const style = getComputedStyle(element);
    return (
      element.getClientRects().length > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  function getFocusable() {
    return [...panel.querySelectorAll(FOCUSABLE)]
      .filter(element => {
        if (!visible(element)) return false;
        if (element.closest("[hidden]")) return false;
        if (element.closest('[aria-hidden="true"]')) return false;
        return true;
      });
  }

  function focusFirst() {
    const first = visible(closeButton)
      ? closeButton
      : getFocusable()[0];

    (first || panel).focus({ preventScroll: true });
  }

  function activateDrawer() {
    if (isOpen) return;

    isOpen = true;
    previousFocus = document.activeElement;

    requestAnimationFrame(() => {
      if (!isOpen) return;
      focusFirst();
    });
  }

  function deactivateDrawer() {
    if (!isOpen) return;

    isOpen = false;

    const target = previousFocus?.isConnected
      ? previousFocus
      : opener;

    requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
    });
  }

  function drawerVisible() {
    const style = getComputedStyle(drawer);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) > 0.01
    );
  }

  // Watch Webflow Interaction style changes
  const observer = new MutationObserver(() => {
    const currentlyVisible = drawerVisible();

    if (currentlyVisible && !isOpen) {
      activateDrawer();
    } else if (!currentlyVisible && isOpen) {
      deactivateDrawer();
    }
  });

  observer.observe(drawer, {
    attributes: true,
    attributeFilter: ["style", "class"]
  });

  // Handle keyboard navigation
  document.addEventListener("keydown", event => {
    if (!isOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();

      // Trigger existing Webflow close interaction
      closeButton.click();
      return;
    }

    if (event.key !== "Tab") return;

    const focusable = getFocusable();

    if (!focusable.length) {
      event.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  // Return focus after close interaction
  closeButton.addEventListener("click", () => {
    if (isOpen) {
      previousFocus ||= opener;
    }
  });

  overlay?.addEventListener("click", () => {
    if (isOpen) {
      previousFocus ||= opener;
    }
  });

  // Initialize correctly if drawer is already open
  if (drawerVisible()) {
    activateDrawer();
  }

  console.log("Finder Drawer Keyboard: ready");
})();


/* ==========================================================================
   11. FINDER DRAWER ACCORDION
   Expand and collapse filter groups inside the advanced filters drawer.
   Supports mouse and keyboard interaction.
   ========================================================================== */
(() => {
  "use strict";

  const drawer = document.querySelector(".filter-drawer");
  const body = drawer?.querySelector(".filter-drawer__body");
  if (!body) return;

  const groups = [
    ...body.querySelectorAll(":scope > .filter-group")
  ];

  groups.forEach((group, index) => {
    if (group.dataset.accordionReady === "true") return;

    const heading = [...group.children].find(el =>
      el.classList.contains("filter-group__title-wrap")
    );

    if (!heading) return;

    // Everything after the heading belongs to this group
    const contents = [...group.children].filter(
      el => el !== heading
    );

    if (!contents.length) return;

    group.dataset.accordionReady = "true";

    const contentId = `finder-group-${index}`;
    heading.setAttribute("role", "button");
    heading.setAttribute("tabindex", "0");
    heading.setAttribute("aria-controls", contentId);

    // Use the group as a wrapper for multiple content elements
    const content = document.createElement("div");
    content.className = "filter-group__accordion-content";
    content.id = contentId;

    contents.forEach(el => content.appendChild(el));
    group.appendChild(content);

    function setOpen(open) {
      content.hidden = !open;
      content.style.display = open ? "" : "none";

      heading.setAttribute("aria-expanded", String(open));
      group.classList.toggle("is-open", open);
    }

    setOpen(false);

    function toggle() {
      setOpen(
        heading.getAttribute("aria-expanded") !== "true"
      );
    }

    heading.addEventListener("click", event => {
      event.preventDefault();
      toggle();
    });

    heading.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        toggle();
      }
    });
  });

  console.log("Finder Drawer Accordion: ready");
})();


/* ==========================================================================
   12. FINDER ADVANCED FILTERS
   Consultation type, insurance, age groups, languages and specializations.
   Synchronizes Quick Filters with Drawer and applies Finsweet filtering.
   Provides window.finderAdvanced public API.
   ========================================================================== */
(() => {
  "use strict";

  const DRAWER = ".filter-drawer";
  const APPLY_BUTTON = "#btn-apply-filters";

  const QUICK_GROUPS = {
    consultation: {
      selector: "#beratungsform-dropdown",
      event: "finder:beratungsform-changed"
    },
    insurance: {
      selector: "#versicherung-dropdown",
      event: "finder:versicherung-changed"
    }
  };

  const DRAWER_GROUPS = {
    consultation: {
      online: "filter-online",
      onsite: "filter-onsite"
    },
    insurance: {
      public: "filter-insurance-public",
      private: "filter-insurance-private",
      selfpay: "filter-insurance-selfpay"
    },
    ages: {
      adults: "filter-age-adults",
      teenagers: "filter-age-teenagers",
      children: "filter-age-children"
    }
  };

  let listInstance = null;
  let initialized = false;

  const applied = {
    consultation: [],
    insurance: [],
    ages: [],
    languages: [],
    specializations: []
  };

  const drawer = document.querySelector(DRAWER);

  if (!drawer) {
    console.warn("Finder Advanced Filters: drawer missing");
    return;
  }

  // -----------------------------------------
  // HELPERS
  // -----------------------------------------

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function getQuickValues(group) {
    const config = QUICK_GROUPS[group];

    return unique([
      ...document.querySelectorAll(
        `${config.selector} input[type="checkbox"]:checked`
      )
    ].map(input => input.value));
  }

  function getDrawerInput(name) {
    return [...drawer.querySelectorAll(
      'input[type="checkbox"]'
    )].find(input => input.name === name);
  }

  function getDrawerValues(group) {
    const mapping = DRAWER_GROUPS[group];

    return Object.entries(mapping)
      .filter(([, name]) => {
        return getDrawerInput(name)?.checked;
      })
      .map(([value]) => value);
  }

  function getLanguages() {
    return unique([
      ...drawer.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
    ].map(input => {
      const wrapper =
        input.closest(".w-checkbox") ||
        input.closest("label") ||
        input.parentElement;

      return wrapper
        ?.querySelector("[data-language]")
        ?.dataset.language
        ?.trim();
    }));
  }

  function getSpecializations() {
    return unique([
      ...drawer.querySelectorAll(
        'input[name="filter-specializations"]:checked'
      )
    ].map(input => input.value));
  }

  function setCheckbox(input, checked) {
    if (!input) return;

    input.checked = checked;

    // Keep Webflow custom checkbox appearance in sync.
    const wrapper =
      input.closest(".w-checkbox") ||
      input.closest("label");

    const visual = wrapper?.querySelector(
      ".w-checkbox-input"
    );

    if (visual) {
      visual.classList.toggle(
        "w--redirected-checked",
        checked
      );
    }
  }

  function setDrawerValues(group, values) {
    const selected = new Set(values);

    Object.entries(DRAWER_GROUPS[group])
      .forEach(([value, name]) => {
        setCheckbox(
          getDrawerInput(name),
          selected.has(value)
        );
      });
  }

  function setQuickValues(group, values) {
    const config = QUICK_GROUPS[group];
    const selected = new Set(values);

    document.querySelectorAll(
      `${config.selector} input[type="checkbox"]`
    ).forEach(input => {
      setCheckbox(
        input,
        selected.has(input.value)
      );
    });
  }

  function refresh() {
    listInstance?.triggerHook("filter");
  }

  function notify(group) {
    const config = QUICK_GROUPS[group];

    document.dispatchEvent(
      new CustomEvent(config.event, {
        detail: {
          values: [...applied[group]]
        }
      })
    );
  }

  function notifyAdvanced() {
    document.dispatchEvent(
      new CustomEvent("finder:advanced-filters-changed", {
        detail: {
          filters: getApplied()
        }
      })
    );
  }

  function getApplied() {
    return {
      consultation: [...applied.consultation],
      insurance: [...applied.insurance],
      ages: [...applied.ages],
      languages: [...applied.languages],
      specializations: [...applied.specializations]
    };
  }

  // -----------------------------------------
  // FINSWEET FILTER HOOK
  // -----------------------------------------

  function matchesOptions(element, values) {
    return !values.length || values.some(value =>
      [...element.querySelectorAll("[data-option]")]
        .some(node => node.dataset.option === value)
    );
  }

  function matchesLanguages(element, values) {
    return !values.length || values.some(value =>
      [...element.querySelectorAll("[data-language]")]
        .some(node => node.dataset.language === value)
    );
  }

  function matchesSpecializations(element, values) {
    return !values.length || values.some(value =>
      [...element.querySelectorAll(
        "[data-specialization]"
      )].some(node =>
        node.dataset.specialization === value
      )
    );
  }

  function advancedFilter(items) {
    return items.filter(item => {
      const element = item.element;

      return (
        matchesOptions(
          element,
          applied.consultation
        ) &&
        matchesOptions(
          element,
          applied.insurance
        ) &&
        matchesOptions(
          element,
          applied.ages
        ) &&
        matchesLanguages(
          element,
          applied.languages
        ) &&
        matchesSpecializations(
          element,
          applied.specializations
        )
      );
    });
  }

  // -----------------------------------------
  // APPLY DRAWER
  // -----------------------------------------

  function applyDrawer() {
    applied.consultation =
      getDrawerValues("consultation");

    applied.insurance =
      getDrawerValues("insurance");

    applied.ages =
      getDrawerValues("ages");

    applied.languages =
      getLanguages();

    applied.specializations =
      getSpecializations();

    setQuickValues(
      "consultation",
      applied.consultation
    );

    setQuickValues(
      "insurance",
      applied.insurance
    );

    notify("consultation");
    notify("insurance");
    notifyAdvanced();

    refresh();

    console.log(
      "Finder Advanced Filters: applied",
      getApplied()
    );
  }

  // -----------------------------------------
  // QUICK FILTERS
  // -----------------------------------------

  function bindQuickFilters() {
    Object.entries(QUICK_GROUPS)
      .forEach(([group, config]) => {
        const dropdown =
          document.querySelector(config.selector);

        if (!dropdown) {
          console.warn(
            "Finder Advanced Filters: missing",
            config.selector
          );
          return;
        }

        dropdown.addEventListener(
          "change",
          event => {
            if (!event.target.matches(
              'input[type="checkbox"]'
            )) return;

            applied[group] =
              getQuickValues(group);

            setDrawerValues(
              group,
              applied[group]
            );

            notify(group);
            notifyAdvanced();
            refresh();
          }
        );
      });
  }

  // -----------------------------------------
  // PUBLIC API
  // -----------------------------------------

  function remove(group, value) {
    if (!Object.hasOwn(applied, group)) return;

    applied[group] = applied[group]
      .filter(item => item !== value);

    if (group === "consultation" ||
        group === "insurance") {
      setQuickValues(group, applied[group]);
      setDrawerValues(group, applied[group]);
      notify(group);
    }

    if (group === "ages") {
      setDrawerValues(group, applied[group]);
    }

    if (group === "specializations") {
      drawer.querySelectorAll(
        'input[name="filter-specializations"]'
      ).forEach(input => {
        if (input.value === value) {
          setCheckbox(input, false);
        }
      });
    }

    if (group === "languages") {
      drawer.querySelectorAll(
        'input[type="checkbox"]'
      ).forEach(input => {
        const wrapper =
          input.closest(".w-checkbox") ||
          input.closest("label") ||
          input.parentElement;

        const slug = wrapper
          ?.querySelector("[data-language]")
          ?.dataset.language;

        if (slug === value) {
          setCheckbox(input, false);
        }
      });
    }

    notifyAdvanced();
    refresh();
  }

  function clear() {
    Object.keys(applied).forEach(group => {
      applied[group] = [];
    });

    Object.keys(QUICK_GROUPS).forEach(group => {
      setQuickValues(group, []);
      notify(group);
    });

    Object.keys(DRAWER_GROUPS).forEach(group => {
      setDrawerValues(group, []);
    });

    drawer.querySelectorAll(
      'input[name="filter-specializations"]'
    ).forEach(input => {
      setCheckbox(input, false);
    });

    drawer.querySelectorAll(
      'input[type="checkbox"]'
    ).forEach(input => {
      const wrapper =
        input.closest(".w-checkbox") ||
        input.closest("label") ||
        input.parentElement;

      if (wrapper?.querySelector("[data-language]")) {
        setCheckbox(input, false);
      }
    });

    notifyAdvanced();
    refresh();
  }

  window.finderAdvanced = {
    getApplied,
    apply: applyDrawer,
    remove,
    clear
  };

  // -----------------------------------------
  // INITIALIZATION
  // -----------------------------------------

  function init() {
    if (initialized) return;
    initialized = true;

    applied.consultation =
      getQuickValues("consultation");

    applied.insurance =
      getQuickValues("insurance");

    // Preserve specializations preselected from URL.
    applied.specializations =
      getSpecializations();

    setDrawerValues(
      "consultation",
      applied.consultation
    );

    setDrawerValues(
      "insurance",
      applied.insurance
    );

    bindQuickFilters();

    const applyButton =
      document.querySelector(APPLY_BUTTON);

    if (applyButton) {
      applyButton.addEventListener(
        "click",
        applyDrawer
      );
    } else {
      console.warn(
        "Finder Advanced Filters: apply button missing"
      );
    }

    (window.FinsweetAttributes ||= []).push([
      "list",
      ([list]) => {
        if (!list) return;

        listInstance = list;
        list.addHook("filter", advancedFilter);

        refresh();

        console.log(
          "Finder Advanced Filters: ready"
        );
      }
    ]);

    console.log(
      "Finder Advanced Filters: initialized"
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }
})();


/* ==========================================================================
   13. FINDER DRAWER CLEAR FILTERS
   Reset advanced filters from the drawer Clear All button.
   ========================================================================== */
(() => {
  "use strict";

  const button = document.querySelector(
    ".filter-drawer .filter-clear-all"
  );

  if (!button) {
    console.warn(
      "Finder Drawer Clear: button not found"
    );
    return;
  }

  button.addEventListener("click", event => {
    event.preventDefault();

    window.finderAdvanced?.clear();

    console.log(
      "Finder Drawer: filters cleared"
    );
  });

  console.log("Finder Drawer Clear: ready");
})();


/* ==========================================================================
   14. FINDER DISTANCE SORTING — FINSWEET V2
   Sort practitioners by distance from the applied location.
   Integrates with the existing Sort Dropdown Embed.
   ========================================================================== */
(() => {
  "use strict";

  let listInstance = null;

  // -----------------------------------------
  // DISTANCE CALCULATION (KM)
  // -----------------------------------------

  function distanceKm(lat1, lng1, lat2, lng2) {
    const rad = value => value * Math.PI / 180;

    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLng / 2) ** 2;

    return 6371 * 2 * Math.asin(
      Math.sqrt(Math.min(1, a))
    );
  }

  // -----------------------------------------
  // APPLIED LOCATION
  // -----------------------------------------

  function getLocation() {
    const location =
      window.finderGeo?.getApplied()?.location;

    if (!location) return null;

    const lat = Number(location.lat);
    const lng = Number(location.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return { lat, lng };
  }

  // -----------------------------------------
  // PRACTITIONER DISTANCE
  // -----------------------------------------

  function getItemDistance(item, location) {
    const element = item.element.querySelector(
      '[data-practitioner="true"]'
    );

    if (!element) return Infinity;

    const latValue = element.getAttribute("data-lat");
    const lngValue = element.getAttribute("data-lng");

    if (
      latValue === null ||
      lngValue === null ||
      !latValue.trim() ||
      !lngValue.trim()
    ) {
      return Infinity;
    }

    const lat = Number(latValue);
    const lng = Number(lngValue);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return Infinity;
    }

    return distanceKm(
      location.lat,
      location.lng,
      lat,
      lng
    );
  }

  // -----------------------------------------
  // CUSTOM SORT HOOK
  // -----------------------------------------

  function distanceSort(items) {
    if (window.finderSort?.get() !== "distance") {
      return items;
    }

    const location = getLocation();

    if (!location) return items;

    return [...items].sort((a, b) => {
      const distanceA = getItemDistance(a, location);
      const distanceB = getItemDistance(b, location);

      return distanceA - distanceB;
    });
  }

  // -----------------------------------------
  // REFRESH SORT
  // -----------------------------------------

  function refreshSort() {
    if (!listInstance) return;

    // Return to first page after changing sorting.
    listInstance.currentPage.value = 1;

    // Run Finsweet sorting lifecycle.
    listInstance.triggerHook("sort");
  }

  // -----------------------------------------
  // DROPDOWN EVENT
  // -----------------------------------------

  document.addEventListener(
    "finder:sort-changed",
    event => {
      const mode = event.detail?.sort;

      if (mode === "distance") {
        if (!getLocation()) {
          // No applied location: fall back to Name A-Z.
          window.finderSort?.set("name");

          if (listInstance) {
            listInstance.sorting.value.fieldKey = "name";
            listInstance.sorting.value.direction = "asc";
          }

          refreshSort();

          console.info(
            "Finder Distance: no location selected"
          );

          return;
        }

        refreshSort();

        console.log(
          "Finder Distance: sorting applied"
        );
      }

      if (mode === "name") {
        refreshSort();
      }
    }
  );

  // -----------------------------------------
  // FINSWEET INITIALIZATION
  // -----------------------------------------

  (window.FinsweetAttributes ||= []).push([
    "list",
    ([list]) => {
      if (!list) {
        console.warn(
          "Finder Distance: Finsweet list not found"
        );
        return;
      }

      listInstance = list;

      // Sorting runs after filtering,
      // before pagination and rendering.
      list.addHook("sort", distanceSort);

      console.log(
        "Finder Distance Sorting: ready"
      );
    }
  ]);

})();


/* ==========================================================================
   15. FINDER VIEW TOGGLE — GRID / LIST
   ========================================================================== */
(() => {
  "use strict";

  const gridButton = document.querySelector(".view-toggle-grid__btn");
  const listButton = document.querySelector(".view-toggle-list__btn");
  const resultsGrid = document.querySelector(".results-list__grid");

  if (!gridButton || !listButton || !resultsGrid) {
    console.warn("Finder View Toggle: elements not found");
    return;
  }

  if (resultsGrid.dataset.viewToggleReady === "true") return;
  resultsGrid.dataset.viewToggleReady = "true";

  function setView(view) {
    const isList = view === "list";

    resultsGrid.classList.toggle("is--list", isList);
    gridButton.classList.toggle("is--active", !isList);
    listButton.classList.toggle("is--active", isList);

    gridButton.setAttribute("aria-pressed", String(!isList));
    listButton.setAttribute("aria-pressed", String(isList));
  }

  gridButton.addEventListener("click", event => {
    event.preventDefault();
    setView("grid");
  });

  listButton.addEventListener("click", event => {
    event.preventDefault();
    setView("list");
  });

  setView("grid");

  console.log("Finder View Toggle: ready");
})();



/* ==========================================================================
   16. FINDER MAP — INITIALIZATION
   ========================================================================== */
(() => {
  "use strict";

  const container = document.getElementById("finder-map");

  if (!container) {
    console.warn("Finder Map: container not found");
    return;
  }

  if (typeof mapboxgl === "undefined") {
    console.warn("Finder Map: Mapbox GL JS not loaded");
    return;
  }

  // Public Mapbox token
  mapboxgl.accessToken = "pk.eyJ1IjoiZHJrYXJsYWNhZGVteSIsImEiOiJjbXc0c2VlcXcwMHFjMnpxdnU5djd1Mnp2In0.WAfodmJtJlMVoSn7AerCQg";

  const map = new mapboxgl.Map({
    container: "finder-map",
    style: "mapbox://styles/mapbox/streets-v12",
    center: [10.4515, 51.1657],
    zoom: 5.5,
    attributionControl: false
  });

  map.addControl(
    new mapboxgl.AttributionControl({
      compact: true
    }),
    "bottom-right"
  );

  map.addControl(
    new mapboxgl.NavigationControl({
      showCompass: false
    }),
    "top-right"
  );

  map.on("load", () => {
    console.log("Finder Map: ready");
  });

  map.on("error", event => {
    console.error("Finder Map: error", event.error);
  });

  window.finderMap = {
    getMap() {
      return map;
    }
  };
})();



/* ==========================================================================
   17. FINDER MAP — PRACTITIONER MARKERS
   Finsweet v2: after filtering, before pagination
   ========================================================================== */
(() => {
  "use strict";

  const MARKER_COLOR = "#737969";

  let map = null;
  let markers = [];
  let latestItems = null;
  let updateTimer = null;
  let lastSignature = null;

  // -----------------------------------------
  // READ PRACTITIONER DATA
  // -----------------------------------------

  function getPractitioner(item) {
    const root = item?.element;
    if (!root) return null;

    const element = root.matches('[data-practitioner="true"]')
      ? root
      : root.querySelector('[data-practitioner="true"]');

    if (!element) return null;

    const latValue = element.getAttribute("data-lat");
    const lngValue = element.getAttribute("data-lng");

    if (!latValue?.trim() || !lngValue?.trim()) {
      return null;
    }

    const lat = Number(latValue);
    const lng = Number(lngValue);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return {
      id: item.id || "",
      name: element.getAttribute("data-name") || "",
      lat,
      lng
    };
  }

  // -----------------------------------------
  // CLEAR MARKERS
  // -----------------------------------------

  function clearMarkers() {
    markers.forEach(marker => marker.remove());
    markers = [];
  }

  // -----------------------------------------
  // RENDER MARKERS
  // -----------------------------------------

  function renderMarkers(items) {
    if (!map || !Array.isArray(items)) return;

    const practitioners = [];
    const seen = new Set();

    items.forEach(item => {
      const practitioner = getPractitioner(item);
      if (!practitioner) return;

      const key = practitioner.id || [
        practitioner.name,
        practitioner.lat,
        practitioner.lng
      ].join("|");

      if (seen.has(key)) return;

      seen.add(key);
      practitioners.push(practitioner);
    });

    // Ignore sorting-only changes.
    const signature = practitioners
      .map(p => [
        p.id,
        p.name,
        p.lat,
        p.lng
      ].join("|"))
      .sort()
      .join("||");

    if (signature === lastSignature) return;

    lastSignature = signature;

    clearMarkers();

    const bounds = new mapboxgl.LngLatBounds();

    practitioners.forEach(practitioner => {
      const marker = new mapboxgl.Marker({
        color: MARKER_COLOR
      })
        .setLngLat([
          practitioner.lng,
          practitioner.lat
        ])
        .addTo(map);

      markers.push(marker);

      bounds.extend([
        practitioner.lng,
        practitioner.lat
      ]);
    });

    if (practitioners.length > 0) {
      map.fitBounds(bounds, {
        padding: 60,
        maxZoom: 11,
        duration: 500
      });
    }

    console.log(
      "Finder Map: markers updated:",
      practitioners.length
    );
  }

  // -----------------------------------------
  // SCHEDULE UPDATE
  // -----------------------------------------

  function scheduleUpdate(items) {
    latestItems = [...items];

    clearTimeout(updateTimer);

    updateTimer = setTimeout(() => {
      renderMarkers(latestItems);
    }, 80);
  }

  // -----------------------------------------
  // MAP CONNECTION
  // -----------------------------------------

  function initMap() {
    map = window.finderMap?.getMap();

    if (!map) {
      console.warn("Finder Map: Mapbox instance not found");
      return;
    }

    if (map.loaded()) {
      if (latestItems) {
        renderMarkers(latestItems);
      }
    } else {
      map.once("load", () => {
        if (latestItems) {
          renderMarkers(latestItems);
        }
      });
    }
  }

  // -----------------------------------------
  // FINSWEET V2
  // -----------------------------------------

  (window.FinsweetAttributes ||= []).push([
    "list",
    ([list]) => {
      if (!list) {
        console.warn("Finder Map: Finsweet list not found");
        return;
      }

      initMap();

      list.addHook("sort", items => {
        console.log(
          "MAP DEBUG — filtered items:",
          items.length
        );

        scheduleUpdate(items);
        return items;
      });

      list.triggerHook("filter");

      console.log("Finder Map: Finsweet sync ready");
    }
  ]);
})();





/* ==========================================================================
   18. FINDER EMPTY STATE
   Smart radius suggestions for zero results
   Only radii with increasing practitioner counts
   Preserves selected radius during updates
   ========================================================================== */
(() => {
  "use strict";

  const root = document.querySelector(".finder-empty");
  if (!root) return;

  const title = root.querySelector(".finder-empty__title");
  const description = root.querySelector(".finder-empty__description");
  const radiusContainer = root.querySelector(".finder-empty__radius");
  const applyButton = root.querySelector(".finder-empty__apply");
  const resetButton = root.querySelector(".finder-empty__reset");

  if (
    !title ||
    !description ||
    !radiusContainer ||
    !applyButton ||
    !resetButton
  ) {
    console.warn("Finder Empty: missing elements");
    return;
  }

  const RADII = [10, 25, 50, 100, 200, Infinity];

  let candidates = [];
  let selectedRadius = null;
  let updateTimer = null;

  // -----------------------------------------
  // DISTANCE CALCULATION
  // -----------------------------------------

  function distanceKm(lat1, lng1, lat2, lng2) {
    const rad = value => value * Math.PI / 180;

    const dLat = rad(lat2 - lat1);
    const dLng = rad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) *
      Math.cos(rad(lat2)) *
      Math.sin(dLng / 2) ** 2;

    return 6371 * 2 * Math.asin(
      Math.sqrt(Math.min(1, a))
    );
  }

  // -----------------------------------------
  // GET PRACTITIONER COORDINATES
  // -----------------------------------------

  function getCoordinates(item) {
    const rootElement = item?.element;
    if (!rootElement) return null;

    const element = rootElement.matches(
      '[data-practitioner="true"]'
    )
      ? rootElement
      : rootElement.querySelector(
          '[data-practitioner="true"]'
        );

    if (!element) return null;

    const latValue = element.getAttribute("data-lat");
    const lngValue = element.getAttribute("data-lng");

    if (!latValue?.trim() || !lngValue?.trim()) {
      return null;
    }

    const lat = Number(latValue);
    const lng = Number(lngValue);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }

    return { lat, lng };
  }

  // -----------------------------------------
  // ADVANCED FILTER MATCHING
  // -----------------------------------------

  function hasMatch(element, attribute, values) {
    if (!values.length) return true;

    const available = new Set(
      [...element.querySelectorAll(`[${attribute}]`)]
        .map(node => node.getAttribute(attribute))
    );

    return values.some(value => available.has(value));
  }

  function matchesAdvanced(item) {
    const applied = window.finderAdvanced?.getApplied();

    if (!applied) return true;

    const element = item.element;
    if (!element) return false;

    return (
      hasMatch(
        element,
        "data-option",
        applied.consultation || []
      ) &&
      hasMatch(
        element,
        "data-option",
        applied.insurance || []
      ) &&
      hasMatch(
        element,
        "data-option",
        applied.ages || []
      ) &&
      hasMatch(
        element,
        "data-language",
        applied.languages || []
      ) &&
      hasMatch(
        element,
        "data-specialization",
        applied.specializations || []
      )
    );
  }

  // -----------------------------------------
  // VISIBILITY
  // -----------------------------------------

  function show() {
    root.style.display = "flex";
    root.setAttribute("aria-hidden", "false");
  }

  function hide() {
    if (root.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    root.style.display = "none";
    root.setAttribute("aria-hidden", "true");
  }

  function hideRadiusOptions() {
    radiusContainer.style.display = "none";
    applyButton.style.display = "none";
    selectedRadius = null;
  }

  // -----------------------------------------
  // GET AVAILABLE RADII
  // -----------------------------------------

  function getRadiusOptions(items, location, currentRadius) {
    const distances = items
      .map(item => getCoordinates(item))
      .filter(Boolean)
      .map(coords => distanceKm(
        location.lat,
        location.lng,
        coords.lat,
        coords.lng
      ));

    const options = RADII
      .filter(radius => radius > currentRadius)
      .map(radius => ({
        radius,
        count: distances.filter(distance =>
          distance <= radius
        ).length
      }))
      .filter(option => option.count > 0);

    // Keep only radii that add new practitioners.
    let previousCount = 0;

    return options.filter(option => {
      if (option.count <= previousCount) {
        return false;
      }

      previousCount = option.count;
      return true;
    });
  }

  // -----------------------------------------
  // RENDER RADIUS OPTIONS
  // -----------------------------------------

  function renderRadiusOptions(options) {
    // Preserve selection if it is still available.
    const availableRadii = options.map(option => option.radius);

    if (
      selectedRadius === null ||
      !availableRadii.includes(selectedRadius)
    ) {
      selectedRadius = options[0]?.radius ?? null;
    }

    radiusContainer.replaceChildren();

    options.forEach(option => {
      const label = document.createElement("label");
      label.className = "finder-empty__radius-option";

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "finder-empty-radius";

      input.value = option.radius === Infinity
        ? "all"
        : String(option.radius);

      input.checked = option.radius === selectedRadius;

      const text = document.createElement("span");
      text.className = "finder-empty__radius-label";

      const radiusText = option.radius === Infinity
        ? "Überall"
        : `${option.radius} km`;

      const practitionerText = option.count === 1
        ? "Therapeut:in"
        : "Therapeut:innen";

      text.textContent =
        `${radiusText} · ${option.count} ${practitionerText}`;

      label.append(input, text);
      radiusContainer.appendChild(label);

      input.addEventListener("change", () => {
        selectedRadius = option.radius;

        console.log(
          "Finder Empty: selected radius",
          selectedRadius
        );
      });
    });

    radiusContainer.style.display = "flex";
    applyButton.style.display = "";
  }

  // -----------------------------------------
  // UPDATE EMPTY STATE
  // -----------------------------------------

  function update(filteredItems) {
    if (!Array.isArray(filteredItems)) return;

    // Results exist: hide Empty State.
    if (filteredItems.length > 0) {
      hide();
      return;
    }

    show();

    const geo = window.finderGeo?.getApplied();
    const location = geo?.location;
    const currentRadius = geo?.radius ?? Infinity;

    const matchingCandidates = candidates.filter(
      matchesAdvanced
    );

    if (
      location &&
      Number.isFinite(currentRadius) &&
      matchingCandidates.length
    ) {
      const options = getRadiusOptions(
        matchingCandidates,
        location,
        currentRadius
      );

      if (options.length) {
        title.textContent =
          `Keine Therapeut:innen im Umkreis von ${currentRadius} km gefunden.`;

        description.textContent =
          "Wir haben passende Therapeut:innen in einem größeren Umkreis gefunden. Wähle einen Suchradius, um sie zu entdecken.";

        renderRadiusOptions(options);

        resetButton.style.display = "";
        return;
      }
    }

    // No suitable radius found.
    hideRadiusOptions();

    title.textContent =
      "Keine passenden Therapeut:innen gefunden.";

    description.textContent =
      "Versuche, deine Suchkriterien anzupassen oder einzelne Filter zu entfernen.";

    resetButton.style.display = "";
  }

  // -----------------------------------------
  // SCHEDULE UPDATE
  // -----------------------------------------

  function scheduleUpdate(items) {
    clearTimeout(updateTimer);

    const snapshot = [...items];

    updateTimer = setTimeout(() => {
      update(snapshot);
    }, 120);
  }

  // -----------------------------------------
  // APPLY SELECTED RADIUS
  // -----------------------------------------

  applyButton.addEventListener("click", event => {
    event.preventDefault();

    if (selectedRadius === null) return;

    const radiusValue = selectedRadius === Infinity
      ? "all"
      : String(selectedRadius);

    if (typeof window.finderRadius?.set !== "function") {
      console.error(
        "Finder Empty: finderRadius.set unavailable"
      );
      return;
    }

    window.finderRadius.set(radiusValue);
    window.finderGeo?.apply();

    document.dispatchEvent(
      new CustomEvent("finder:radius-changed")
    );

    console.log(
      "Finder Empty: applied radius",
      radiusValue
    );
  });

  // -----------------------------------------
  // RESET FILTERS
  // -----------------------------------------

  resetButton.addEventListener("click", event => {
    event.preventDefault();

    const clearAll = document.getElementById(
      "btn-clear-all"
    );

    if (clearAll) {
      clearAll.click();
    } else {
      console.warn(
        "Finder Empty: Clear All button missing"
      );
    }
  });

  // -----------------------------------------
  // RECEIVE PRE-GEO CANDIDATES
  // -----------------------------------------

  document.addEventListener(
    "finder:geo-candidates",
    event => {
      candidates = event.detail?.items || [];
    }
  );

  // -----------------------------------------
  // FINSWEET V2 INTEGRATION
  // -----------------------------------------

  (window.FinsweetAttributes ||= []).push([
    "list",
    ([list]) => {
      if (!list) {
        console.warn(
          "Finder Empty: Finsweet list not found"
        );
        return;
      }

      list.addHook("sort", items => {
        scheduleUpdate(items);
        return items;
      });

      list.triggerHook("filter");

      console.log("Finder Empty: ready");
    }
  ]);

  hide();
})();
