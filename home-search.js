/* ==========================================================================
   THERAPEUTEN-FINDER — HOME SEARCH
   Dr. Anne Karl Academy

   Search interface for the homepage
   Universal autocomplete, Mapbox location search,
   radius selection and redirect to /find-a-practitioner
   ========================================================================== */

/* ==========================================================================
   01. MAPBOX LOCATION AUTOCOMPLETE
   Location suggestions, coordinate retrieval and public API
   ========================================================================== */
(() => {
  "use strict";

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
      console.error("Home Search: Mapbox retrieve error", error);
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
        console.error("Home Search: Mapbox suggest error", error);
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
      clearTimeout(debounceTimer);
      controller?.abort();

      input.value = "";
      clearLocation();
      clearSuggestions();
    }
  };

  console.log("Home Search: Mapbox ready");
})();


/* ==========================================================================
   02. UNIVERSAL AUTOCOMPLETE
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

    input.dispatchEvent(
      new Event("input", { bubbles: true })
    );

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

    input.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    input.focus();
  });

  document.addEventListener("pointerdown", event => {
    if (!root.contains(event.target)) {
      closeSuggestions();
    }
  });

  input.closest("form")?.addEventListener(
    "submit",
    closeSuggestions
  );

  updateClearButton();

  console.log(
    "Home Search: Universal Autocomplete ready",
    entries.length,
    "CMS entries"
  );
})();



/* ==========================================================================
   03. HOME SEARCH SUBMIT
   Transfer selected filters to Finder via URL
   Prevent Webflow form submission and success message
   ========================================================================== */
(() => {
  "use strict";

  const form = document.querySelector(".search-form");

  if (!form) {
    console.warn("Home Search: form not found");
    return;
  }

  const wrapper = form.closest(".w-form");

  const successMessage = wrapper?.querySelector(
    ".w-form-done"
  );

  const errorMessage = wrapper?.querySelector(
    ".w-form-fail"
  );

  // ----------------------------------------------------------
  // RESET WEBFLOW FORM DISPLAY
  // ----------------------------------------------------------

  function resetFormDisplay() {
    form.style.display = "";

    if (successMessage) {
      successMessage.style.display = "none";
    }

    if (errorMessage) {
      errorMessage.style.display = "none";
    }
  }

  // ----------------------------------------------------------
  // HANDLE SEARCH SUBMIT
  // ----------------------------------------------------------

  function handleSubmit(event) {
    // Prevent standard Webflow form submission
    event.preventDefault();

    // Prevent Webflow's submit handlers from running
    event.stopImmediatePropagation();

    const url = new URL(
      "/find-a-practitioner",
      window.location.origin
    );

    // -----------------------------------------
    // 01. THEMA
    // -----------------------------------------

    const thema = document
      .getElementById("thema-input")
      ?.value.trim();

    if (thema) {
      url.searchParams.set("thema", thema);
    }

    // -----------------------------------------
    // 02. LOCATION
    // -----------------------------------------

    const location = window.finderLocation?.get();

    if (location) {
      url.searchParams.set(
        "location",
        location.label
      );

      url.searchParams.set(
        "lat",
        String(location.lat)
      );

      url.searchParams.set(
        "lng",
        String(location.lng)
      );
    }

    // -----------------------------------------
    // 03. RADIUS
    // -----------------------------------------

    const radius = window.finderRadius?.get();

    if (
      radius !== null &&
      radius !== undefined
    ) {
      url.searchParams.set(
        "radius",
        String(radius)
      );
    }

    console.log(
      "Home Search: redirecting to",
      url.toString()
    );

    // Navigate to Finder
    window.location.assign(url.toString());
  }

  // Capture phase:
  // Intercept submit before Webflow's form handlers
  form.addEventListener(
    "submit",
    handleSubmit,
    true
  );

  // ----------------------------------------------------------
  // RESTORE FORM AFTER BROWSER BACK NAVIGATION
  // ----------------------------------------------------------

  window.addEventListener("pageshow", () => {
    resetFormDisplay();
  });

  // Ensure correct initial state
  resetFormDisplay();

  console.log("Home Search: submit ready");

})();



/* ==========================================================================
   04. WEBFLOW FORM STATE RESET
   Prevent success message after browser back navigation
   ========================================================================== */
(() => {
  "use strict";

  const form = document.querySelector(".search-form");

  if (!form) return;

  const wrapper = form.closest(".w-form");

  if (!wrapper) return;

  const successMessage = wrapper.querySelector(
    ".w-form-done"
  );

  const errorMessage = wrapper.querySelector(
    ".w-form-fail"
  );

  window.addEventListener("pageshow", () => {
    form.style.display = "";

    if (successMessage) {
      successMessage.style.display = "none";
    }

    if (errorMessage) {
      errorMessage.style.display = "none";
    }
  });
})();
