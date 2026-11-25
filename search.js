/* ==========================================================================
   THERAPEUTEN-FINDER — SHARED SEARCH
   Dr. Anne Karl Academy
   Load before finder.js, at the end of the page body.
   ========================================================================== */


/* ==========================================================================
   01. MAPBOX LOCATION AUTOCOMPLETE
   Location suggestions, coordinate retrieval and public API.
   Supports restoring location from homepage URL.
   ========================================================================== */

(() => {
  "use strict";

  const TOKEN = "pk.eyJ1IjoiZHJrYXJsYWNhZGVteSIsImEiOiJjbXc0c2VlcXcwMHFjMnpxdnU5djd1Mnp2In0.WAfodmJtJlMVoSn7AerCQg";

  const input = document.getElementById("input-ort");
  const suggestions = document.getElementById("ort-suggestions");

  if (!input || !suggestions) return;
  if (input.dataset.locationReady === "true") return;

  input.dataset.locationReady = "true";

  let sessionToken = crypto.randomUUID();
  let debounceTimer;
  let controller;
  let retrieveController;
  let revision = 0;
  let selectedLocation = null;

  function cancelRequests() {
    revision++;
    clearTimeout(debounceTimer);
    controller?.abort();
    retrieveController?.abort();
  }

  const newSession = () => {
    sessionToken = crypto.randomUUID();
  };

  // ----------------------------------------------------------
  // CLEAR SUGGESTIONS
  // ----------------------------------------------------------

  function clearSuggestions() {
    suggestions.replaceChildren();
    suggestions.hidden = true;
  }

  // ----------------------------------------------------------
  // CLEAR LOCATION STATE
  // ----------------------------------------------------------

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

  // ----------------------------------------------------------
  // FETCH MAPBOX DATA
  // ----------------------------------------------------------

  async function fetchJSON(url, signal) {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Mapbox HTTP ${response.status}`);
    }

    return response.json();
  }

  // ----------------------------------------------------------
  // SELECT MAPBOX SUGGESTION
  // ----------------------------------------------------------

  async function selectSuggestion(item) {
    cancelRequests();

    const requestRevision = revision;

    retrieveController = new AbortController();

    clearSuggestions();

    const url = new URL(
      "https://api.mapbox.com/search/searchbox/v1/retrieve/" +
      encodeURIComponent(item.mapbox_id)
    );

    url.searchParams.set("session_token", sessionToken);
    url.searchParams.set("access_token", TOKEN);

    try {
      const data = await fetchJSON(
        url,
        retrieveController.signal
      );

      if (requestRevision !== revision) return;

      const feature = data.features?.[0];

      if (!feature) return;

      const [lng, lat] =
        feature.geometry?.coordinates || [];

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        Math.abs(lat) > 90 ||
        Math.abs(lng) > 180
      ) return;

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
      if (error.name !== "AbortError") {
        console.error(
          "Mapbox retrieve error:",
          error
        );
      }
    }
  }

  // ----------------------------------------------------------
  // RENDER LOCATION SUGGESTIONS
  // ----------------------------------------------------------

  function renderSuggestions(items) {
    clearSuggestions();

    items.forEach(item => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "location-autocomplete__option";

      const title = document.createElement("strong");
      title.textContent = item.name;

      const subtitle = document.createElement("small");

      subtitle.className =
        "location-autocomplete__subtitle";

      subtitle.textContent =
        item.place_formatted || "";

      button.append(title, subtitle);

      button.addEventListener("click", () => {
        selectSuggestion(item);
      });

      suggestions.appendChild(button);
    });

    suggestions.hidden = items.length === 0;
  }

  // ----------------------------------------------------------
  // SEARCH MAPBOX LOCATIONS
  // ----------------------------------------------------------

  async function searchLocation(query) {
    controller?.abort();

    controller = new AbortController();

    const requestRevision = revision;

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

      if (
        requestRevision !== revision ||
        input.value.trim() !== query
      ) return;

      renderSuggestions(data.suggestions || []);

    } catch (error) {
      if (error.name !== "AbortError") {
        console.error(
          "Mapbox suggest error:",
          error
        );
      }
    }
  }

  // ----------------------------------------------------------
  // INPUT EVENTS
  // ----------------------------------------------------------

  input.addEventListener("input", () => {
    cancelRequests();

    clearLocation();
    clearSuggestions();

    const query = input.value.trim();

    if (query.length < 2) return;

    debounceTimer = setTimeout(() => {
      searchLocation(query);
    }, 300);
  });

  // ----------------------------------------------------------
  // KEYBOARD ACCESSIBILITY
  // ----------------------------------------------------------

  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      clearSuggestions();
    }
  });

  // ----------------------------------------------------------
  // CLICK OUTSIDE
  // ----------------------------------------------------------

  document.addEventListener("pointerdown", event => {
    if (
      !input.contains(event.target) &&
      !suggestions.contains(event.target)
    ) {
      clearSuggestions();
    }
  });

  // ----------------------------------------------------------
  // PUBLIC API
  // ----------------------------------------------------------

  window.finderLocation = {

    // Return currently selected location
    get() {
      return selectedLocation;
    },

    // Restore location programmatically
    // Used by URL Search Initialization
    set(location) {
      if (!location) {
        console.warn(
          "Finder Location: missing location"
        );
        return;
      }

      if (
        location.lat == null ||
        location.lng == null ||
        String(location.lat).trim() === "" ||
        String(location.lng).trim() === ""
      ) return;

      const lat = Number(location.lat);
      const lng = Number(location.lng);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        console.warn(
          "Finder Location: invalid coordinates",
          location
        );
        return;
      }

      cancelRequests();

      selectedLocation = {
        name: location.name || location.label || "",
        label: location.label || location.name || "",
        lat,
        lng,
        mapboxId: location.mapboxId || null
      };

      input.value = selectedLocation.label;

      input.dataset.lat = String(lat);
      input.dataset.lng = String(lng);

      clearSuggestions();

      document.dispatchEvent(
        new CustomEvent("finder:location-changed", {
          detail: { location: selectedLocation }
        })
      );

      console.log(
        "Finder Location: restored",
        selectedLocation
      );
    },

    // Clear location and coordinates
    clear() {
      cancelRequests();

      input.value = "";

      clearLocation();
      clearSuggestions();
    }
  };

  console.log("Finder Location: ready");

})();




/* ==========================================================================
   02. UNIVERSAL AUTOCOMPLETE — SHARED SEARCH
   Homepage redirect and Finder staged search.
   ========================================================================== */

(() => {
  "use strict";

  const root = document.getElementById("thema-combobox");
  const input = document.getElementById("thema-input");
  const suggestions = document.getElementById("thema-suggestions");
  const clearButton = document.getElementById("thema-clear");

  const form = document.querySelector(
    'form[fs-list-element="filters"]'
  );

  const isFinder =
  window.location.pathname.replace(/\/+$/, "") ===
  "/find-a-practitioner" ||
  Boolean(document.getElementById("finder-city-config"));

  if (
    !root ||
    !input ||
    !suggestions ||
    !clearButton
  ) return;

  if (root.dataset.autocompleteReady === "true") return;

  root.dataset.autocompleteReady = "true";

  // ----------------------------------------------------------
  // FINSWEET PROXY INPUT — FINDER ONLY
  // ----------------------------------------------------------

  // Keep the visible field separate from Finsweet's live
  // keyword filter. The proxy must be a real text input.

  let proxy = null;

  if (isFinder) {
    proxy = document.createElement("input");

    proxy.type = "text";

    proxy.setAttribute("fs-list-field", "keywords");
    proxy.setAttribute("aria-hidden", "true");

    proxy.tabIndex = -1;
    proxy.autocomplete = "off";

    proxy.style.cssText = `
      position:absolute!important;
      left:-9999px!important;
      width:1px!important;
      height:1px!important;
      opacity:0!important;
      pointer-events:none!important;
    `;

    input.removeAttribute("fs-list-field");

    form.appendChild(proxy);
  }

  // ----------------------------------------------------------
  // NORMALIZE SEARCH TEXT
  // ----------------------------------------------------------

  const normalize = value =>
    String(value || "")
      .toLocaleLowerCase("de")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  // ----------------------------------------------------------
  // COLLECT CMS AUTOCOMPLETE ENTRIES
  // ----------------------------------------------------------

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
    ].includes(type) || !name) return;

    const key = `${type}:${normalize(name)}`;

    if (seen.has(key)) return;

    seen.add(key);

    entries.push({ type, name });
  });

  // ----------------------------------------------------------
  // SEARCH STATE
  // ----------------------------------------------------------

  let pending = null;

  let applied = {
    type: "text",
    name: "",
    slug: null
  };

  let activeIndex = -1;
  let optionButtons = [];

  // ----------------------------------------------------------
  // RESOLVE SPECIALIZATION SLUG
  // ----------------------------------------------------------

  function slugFor(name) {
    const normalized = normalize(name);

    for (const checkbox of document.querySelectorAll(
      '.filter-drawer input[name="filter-specializations"]'
    )) {
      const label = checkbox
        .closest(".filter-checkbox")
        ?.querySelector(".filter-checkbox__label")
        ?.textContent;

      if (normalize(label) === normalized) {
        return checkbox.value;
      }
    }

    for (const source of document.querySelectorAll(
      ".specialization-source[data-spec-slug]"
    )) {
      if (
        normalize(source.dataset.specName) === normalized
      ) {
        return source.dataset.specSlug?.trim() || null;
      }
    }

    return null;
  }

  // ----------------------------------------------------------
  // NOTIFY APPLIED SEARCH CHANGE
  // ----------------------------------------------------------

  function notify() {
    document.dispatchEvent(
      new CustomEvent("finder:main-search-applied", {
        detail: { ...applied }
      })
    );
  }

  // ----------------------------------------------------------
  // CLEAR BUTTON & SUGGESTIONS
  // ----------------------------------------------------------

  function updateClear() {
    clearButton.hidden = !input.value.length;
  }

  function close() {
    suggestions.hidden = true;
    suggestions.replaceChildren();

    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");

    activeIndex = -1;
    optionButtons = [];
  }

  // ----------------------------------------------------------
  // UPDATE FINSWEET PROXY
  // ----------------------------------------------------------

  function writeProxy(value) {
    if (!proxy || proxy.value === value) return;

    proxy.value = value;

    proxy.dispatchEvent(
      new Event("input", { bubbles: true })
    );
  }

  // ----------------------------------------------------------
  // UPDATE VISIBLE SEARCH FIELD
  // ----------------------------------------------------------

  function setVisible(value, selection = null) {
    input.value = value;
    pending = selection;

    updateClear();
    close();
  }

  // ----------------------------------------------------------
  // RESOLVE PENDING SEARCH
  // ----------------------------------------------------------

  function resolvePending() {
    const name = input.value.trim();

    if (!name) {
      return {
        type: "text",
        name: "",
        slug: null
      };
    }

    if (
      pending &&
      normalize(pending.name) === normalize(name)
    ) {
      return pending;
    }

    // Recognize values restored from homepage or URL
    // without requiring another autocomplete selection.

    const match = entries.find(
      entry => normalize(entry.name) === normalize(name)
    );

    if (match?.type === "spezialisierung") {
      const slug = slugFor(match.name);

      if (slug) {
        return { ...match, slug };
      }
    }

    return match || {
      type: "text",
      name,
      slug: null
    };
  }

  // ----------------------------------------------------------
  // COMMIT MAIN SEARCH — FINDER ONLY
  // ----------------------------------------------------------

  function commit() {
    const next = resolvePending();
    const old = applied;

    // Replacing or clearing a main-field specialization
    // removes only that specialization.

    if (
      old.type === "spezialisierung" &&
      old.slug &&
      (
        next.type !== "spezialisierung" ||
        next.slug !== old.slug
      )
    ) {
      window.finderAdvanced?.remove(
        "specializations",
        old.slug
      );
    }

    if (next.type === "spezialisierung") {
      const slug = next.slug || slugFor(next.name);

      if (slug && window.finderAdvanced?.addSpecialization(slug)) {

        applied = {
          type: "spezialisierung",
          name: next.name,
          slug
        };

        // Avoid a second keyword condition.
        writeProxy("");

      } else {
        console.warn(
          "Finder: specialization slug not found",
          next.name
        );

        applied = {
          type: "text",
          name: next.name,
          slug: null
        };

        writeProxy(next.name);
      }

    } else {
      applied = {
        type: next.type,
        name: next.name,
        slug: null
      };

      writeProxy(next.name);
    }

    pending = applied.name
      ? { ...applied }
      : null;

    notify();
    close();
  }

  // ----------------------------------------------------------
  // SELECT AUTOCOMPLETE ENTRY
  // ----------------------------------------------------------

  function select(entry) {
    const slug =
      isFinder && entry.type === "spezialisierung"
        ? slugFor(entry.name)
        : null;

    input.focus();

    setVisible(entry.name, {
      ...entry,
      slug
    });
  }

  // ----------------------------------------------------------
  // CREATE AUTOCOMPLETE OPTION
  // ----------------------------------------------------------

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
      select(entry);
    });

    return button;
  }

  // ----------------------------------------------------------
  // KEYBOARD ACTIVE OPTION
  // ----------------------------------------------------------

  function setActive(index) {
    if (!optionButtons.length) return;

    activeIndex =
      (index + optionButtons.length) %
      optionButtons.length;

    optionButtons.forEach((button, i) => {
      button.classList.toggle(
        "is-active",
        i === activeIndex
      );

      button.setAttribute(
        "aria-selected",
        String(i === activeIndex)
      );
    });

    const button = optionButtons[activeIndex];

    input.setAttribute(
      "aria-activedescendant",
      button.id
    );

    button.scrollIntoView({
      block: "nearest"
    });
  }

  // ----------------------------------------------------------
  // AUTOCOMPLETE GROUP HEADING
  // ----------------------------------------------------------

  function heading(label) {
    const element = document.createElement("div");

    element.className =
      "thema-combobox__group-label";

    element.textContent = label;

    element.setAttribute("role", "presentation");

    if (isFinder) {
      element.classList.add("is--finder");
    }

    return element;
  }

  // ----------------------------------------------------------
  // RENDER AUTOCOMPLETE SUGGESTIONS
  // ----------------------------------------------------------

  function renderSuggestions() {
    const query = normalize(input.value);

    updateClear();

    if (query.length < 2) {
      close();
      return;
    }

    const matches = entries.filter(entry =>
      normalize(entry.name).includes(query)
    );

    const terms = matches
      .filter(entry => entry.type !== "practitioner")
      .sort((a, b) => {
        const aStarts =
          normalize(a.name).startsWith(query);

        const bStarts =
          normalize(b.name).startsWith(query);

        if (aStarts !== bStarts) {
          return aStarts ? -1 : 1;
        }

        return a.name.localeCompare(b.name, "de");
      })
      .slice(0, 8);

    const practitioners = matches
      .filter(entry => entry.type === "practitioner")
      .slice(0, 4);

    suggestions.replaceChildren();

    optionButtons = [];
    activeIndex = -1;

    if (!terms.length && !practitioners.length) {
      const empty = document.createElement("div");

      empty.className = "thema-combobox__empty";
      empty.textContent = "Keine Vorschläge gefunden";

      suggestions.appendChild(empty);

    } else {

      terms.forEach(entry => {
        const button = createOption(
          entry,
          optionButtons.length
        );

        optionButtons.push(button);
        suggestions.appendChild(button);
      });

      if (practitioners.length) {
        suggestions.appendChild(
          heading("Therapeut:innen")
        );

        practitioners.forEach(entry => {
          const button = createOption(
            entry,
            optionButtons.length
          );

          optionButtons.push(button);
          suggestions.appendChild(button);
        });
      }
    }

    suggestions.hidden = false;

    input.setAttribute("aria-expanded", "true");
  }

  // ----------------------------------------------------------
  // INPUT & FOCUS EVENTS
  // ----------------------------------------------------------

  input.addEventListener("input", () => {
    pending = null;

    // No Finsweet event until submit.
    renderSuggestions();
  });

  input.addEventListener("focus", () => {
    if (input.value.trim().length >= 2) {
      renderSuggestions();
    }
  });

  // ----------------------------------------------------------
  // KEYBOARD NAVIGATION
  // ----------------------------------------------------------

  input.addEventListener("keydown", event => {
    if (suggestions.hidden) return;

    if (
      event.key === "ArrowDown" &&
      optionButtons.length
    ) {
      event.preventDefault();

      setActive(activeIndex + 1);

    } else if (
      event.key === "ArrowUp" &&
      optionButtons.length
    ) {
      event.preventDefault();

      setActive(
        activeIndex < 0
          ? optionButtons.length - 1
          : activeIndex - 1
      );

    } else if (
      event.key === "Enter" &&
      activeIndex >= 0
    ) {
      event.preventDefault();

      optionButtons[activeIndex]?.click();

    } else if (event.key === "Escape") {
      event.preventDefault();

      close();
    }
  });

  // ----------------------------------------------------------
  // CLEAR SEARCH FIELD
  // ----------------------------------------------------------

  clearButton.addEventListener("click", () => {
    input.focus();

    // Pending clear; applied filters remain unchanged.
    setVisible("");
  });

  // ----------------------------------------------------------
  // CLICK OUTSIDE
  // ----------------------------------------------------------

  document.addEventListener("pointerdown", event => {
    if (!root.contains(event.target)) {
      close();
    }
  });

  // ----------------------------------------------------------
  // FINDER MODE
  // ----------------------------------------------------------

  if (isFinder) {

    // Capture phase: commit before Geo and Finsweet
    // handle form submission.

    form.addEventListener("submit", commit, true);

    // Drawer/chip removal is an immediate
    // applied-filter action.

    document.addEventListener(
      "finder:advanced-filters-changed",
      () => {
        if (
          applied.type !== "spezialisierung" ||
          !applied.slug
        ) return;

        const values =
          window.finderAdvanced
            ?.getApplied()
            ?.specializations || [];

        if (values.includes(applied.slug)) return;

        const old = applied;

        applied = {
          type: "text",
          name: "",
          slug: null
        };

        if (
          normalize(input.value) === normalize(old.name)
        ) {
          setVisible("");
        }

        notify();
      }
    );

    // --------------------------------------------------------
    // FINDER MAIN SEARCH PUBLIC API
    // --------------------------------------------------------

    window.finderMainSearch = {

      getApplied() {
        return { ...applied };
      },

      clear() {
        applied = {
          type: "text",
          name: "",
          slug: null
        };

        setVisible("");
        writeProxy("");
        notify();
      }
    };

    root.querySelector(
      ".thema-combobox__chevron"
    )?.remove();

  // ----------------------------------------------------------
  // HOMEPAGE MODE
  // ----------------------------------------------------------

  } else {

    input.closest("form")?.addEventListener(
      "submit",
      close
    );
  }

  updateClear();

  console.log(
    "Shared Autocomplete: ready",
    entries.length
  );

})();




/* ==========================================================================
   03. HOME SEARCH SUBMIT
   Transfer selected filters to Finder via URL.
   Prevent Webflow form submission and success message.
   ========================================================================== */

(() => {
  "use strict";

  const form = document.querySelector(".search-form");

  // Homepage only.
  // Finder and future City Pages use Finsweet filters.

  const isFinder =
  window.location.pathname.replace(/\/+$/, "") ===
  "/find-a-practitioner" ||
  Boolean(document.getElementById("finder-city-config"));

  if (!form || isFinder) return;

  if (form.dataset.homeSearchReady === "true") return;

  form.dataset.homeSearchReady = "true";

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

    // Prevent standard Webflow form submission.
    event.preventDefault();

    // Prevent Webflow's submit handlers from running.
    event.stopImmediatePropagation();

    const url = new URL(
      "/find-a-practitioner",
      window.location.origin
    );

    // --------------------------------------------------------
    // 01. THEMA
    // --------------------------------------------------------

    const thema = document
      .getElementById("thema-input")
      ?.value.trim();

    if (thema) {
      url.searchParams.set("thema", thema);
    }

    // --------------------------------------------------------
    // 02. LOCATION
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // 03. RADIUS
    // --------------------------------------------------------

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

    // Navigate to Finder.
    window.location.assign(url.toString());
  }

  // ----------------------------------------------------------
  // REGISTER FORM SUBMIT
  // ----------------------------------------------------------

  // Capture phase: intercept submit before
  // Webflow's form handlers.

  form.addEventListener(
    "submit",
    handleSubmit,
    true
  );

  // ----------------------------------------------------------
  // RESTORE FORM AFTER BROWSER BACK NAVIGATION
  // ----------------------------------------------------------

  window.addEventListener(
    "pageshow",
    resetFormDisplay
  );

  // Ensure correct initial state.
  resetFormDisplay();

  console.log("Home Search: submit ready");

})();
