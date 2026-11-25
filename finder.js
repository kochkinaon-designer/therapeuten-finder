// Therapeuten-Finder
// Main JavaScript


/* ==========================================================================
   00. SHARED GEO UTILITIES
   Coordinate validation, practitioner coordinates and distance in kilometers.
   Independent of Mapbox, Finsweet and the Finder UI.
   ========================================================================== */
(() => {
  "use strict";

  function parseCoordinates(latValue, lngValue) {
    if (
      latValue == null ||
      lngValue == null ||
      String(latValue).trim() === "" ||
      String(lngValue).trim() === ""
    ) {
      return null;
    }

    const lat = Number(latValue);
    const lng = Number(lngValue);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      return null;
    }

    return { lat, lng };
  }

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

  function getPractitionerCoordinates(item) {
    const root = item?.element;
    if (!root) return null;

    const element = root.matches(
      '[data-practitioner="true"]'
    )
      ? root
      : root.querySelector(
          '[data-practitioner="true"]'
        );

    if (!element) return null;

    return parseCoordinates(
      element.getAttribute("data-lat"),
      element.getAttribute("data-lng")
    );
  }

  window.finderUtils = Object.freeze({
    parseCoordinates,
    distanceKm,
    getPractitionerCoordinates
  });
})();

/* ============================================================
   01 — TOPICS SWIPER in topics-selection.js
   Category slider initialization and active slide behavior
   ============================================================ */

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


/* ==========================================================================
   03. MAPBOX LOCATION AUTOCOMPLETE
   Moved to search.js
   ========================================================================== */

/* ============================================================
   04 — TOPICS POPUP in topics-selection.js
   Topic selection and navigation to Finder with URL filters
   ============================================================ */

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
  const { distanceKm } = window.finderUtils;

  // Additional geographic filter for Finsweet
  function geoFilter(items) {

    // Share candidates before applying the radius
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
      const coordinates =
        window.finderUtils.getPractitionerCoordinates(item);

      if (!coordinates) return false;

      const { lat, lng } = coordinates;

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

    document.dispatchEvent(
      new CustomEvent("finder:geo-applied")
    );

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
   07. UNIVERSAL AUTOCOMPLETE — STAGED MAIN SEARCH
   Moved to search.js
   ========================================================================== */


/* ==========================================================================
   08. CLEAR ALL — MAIN FINDER
   Reset every filter; Drawer Clear (block 13) remains independent.
   ========================================================================== */
(() => {
  "use strict";
  const clearAll = document.getElementById("btn-clear-all");
  const form = document.querySelector('form[fs-list-element="filters"]');
  if (!clearAll || !form) return;
  clearAll.addEventListener("click", event => {
    event.preventDefault();
    window.finderMainSearch?.clear();
    window.finderAdvanced?.clear();
    window.finderLocation?.clear();
    window.finderRadius?.clear();
    window.finderGeo?.clear();
    form.requestSubmit();
    console.log("Finder: all filters cleared");
  });
})();



/* ==========================================================================
   09. ACTIVE FILTER TAGS
   Main field is staged; tags reflect only applied filters.
   ========================================================================== */
(() => {
  "use strict";
  const container = document.querySelector(".active-filters__tags");
  const activeBar = document.querySelector(".filter-bar__active");
  const form = document.querySelector('form[fs-list-element="filters"]');
  const drawer = document.querySelector(".filter-drawer");
  if (!container || !form) return;

  // URL synchronization (block 20) uses this API.
  window.finderThema = {
    getApplied() {
      const search = window.finderMainSearch?.getApplied();
      return search?.type === "spezialisierung" ? "" : (search?.name || "");
    }
  };
  const labels = {
    consultation: { online: "Online", onsite: "Vor Ort" },
    insurance: { public: "Gesetzlich", private: "Privat", selfpay: "Selbstzahler" },
    ages: { adults: "Erwachsene", teenagers: "Jugendliche", children: "Kinder" }
  };
  function tag(label, onRemove) {
    const element = document.createElement("div");
    element.className = "card__tag";
    const text = document.createElement("span");
    text.textContent = label;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "active-filter__remove";
    remove.setAttribute("aria-label", `Filter ${label} entfernen`);
    remove.textContent = "×";
    remove.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation(); onRemove();
    });
    element.append(text, remove);
    return element;
  }
  function languageLabel(slug) {
    const el = [...(drawer?.querySelectorAll("[data-language]") || [])]
      .find(node => node.dataset.language === slug);
    return el?.textContent.trim() || slug;
  }
  function specializationLabel(slug) {
    const input = [...(drawer?.querySelectorAll('input[name="filter-specializations"]') || [])]
      .find(node => node.value === slug);
    return input?.closest(".filter-checkbox")?.querySelector(".filter-checkbox__label")?.textContent.trim() || slug;
  }
  function removeMainText() {
    window.finderMainSearch?.clear();
    // Clear through form so the existing Finsweet submit flow remains intact.
    form.requestSubmit();
  }
  function removeLocation() {
    window.finderLocation?.clear();
    window.finderGeo?.clear();
    form.requestSubmit();
  }
  function removeRadius() {
    window.finderRadius?.set("all");
    window.finderGeo?.apply();
    render();
  }
  function render() {
    container.replaceChildren();
    const text = window.finderThema.getApplied();
    if (text) container.appendChild(tag(text, removeMainText));
    const geo = window.finderGeo?.getApplied();
    if (geo?.location) {
      container.appendChild(tag(geo.location.label || "Standort", removeLocation));
      if (geo.radius !== Infinity && Number.isFinite(geo.radius)) {
        container.appendChild(tag(`${geo.radius} km`, removeRadius));
      }
    }
    const advanced = window.finderAdvanced?.getApplied();
    if (advanced) Object.entries(advanced).forEach(([group, values]) => {
      [...new Set(values)].forEach(value => {
        const label = group === "languages" ? languageLabel(value)
          : group === "specializations" ? specializationLabel(value)
          : (labels[group]?.[value] || value);
        container.appendChild(tag(label, () => window.finderAdvanced?.remove(group, value)));
      });
    });
    if (activeBar) activeBar.style.display = container.childElementCount ? "" : "none";
  }
  ["finder:main-search-applied", "finder:advanced-filters-changed",
   "finder:beratungsform-changed", "finder:versicherung-changed",
   "finder:geo-applied", "finder:geo-cleared", "finder:location-changed",
   "finder:radius-changed"].forEach(name => document.addEventListener(name, render));
  form.addEventListener("submit", () => queueMicrotask(render));
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
   Shared state for Drawer, Quick Filters and Autocomplete.
   OR within groups, AND between groups.
   ========================================================================== */
(() => {
  "use strict";

  const DRAWER = ".filter-drawer";

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
    console.warn("Finder Advanced: drawer missing");
    return;
  }

  // -----------------------------------------
  // HELPERS
  // -----------------------------------------

  function unique(values) {
    return [...new Set(
      values.map(value => String(value || "").trim())
        .filter(Boolean)
    )];
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
    return Object.entries(DRAWER_GROUPS[group])
      .filter(([, name]) => getDrawerInput(name)?.checked)
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
        ?.dataset.language;
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

  // Synchronize Beratungsform component
  if (
    group === "consultation" &&
    window.finderBeratungsform
  ) {
    window.finderBeratungsform.set(values);
    return;
  }

  // Synchronize Versicherung component
  if (
    group === "insurance" &&
    window.finderVersicherung
  ) {
    window.finderVersicherung.set(values);
    return;
  }

  // Fallback if component API is unavailable
  const config = QUICK_GROUPS[group];

  if (!config) return;

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

  function setSpecializationCheckboxes(values) {
    const selected = new Set(values);

    drawer.querySelectorAll(
      'input[name="filter-specializations"]'
    ).forEach(input => {
      setCheckbox(input, selected.has(input.value));
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

  function getApplied() {
    return {
      consultation: [...applied.consultation],
      insurance: [...applied.insurance],
      ages: [...applied.ages],
      languages: [...applied.languages],
      specializations: [...applied.specializations]
    };
  }

  function notifyAdvanced() {
    document.dispatchEvent(
      new CustomEvent("finder:advanced-filters-changed", {
        detail: { filters: getApplied() }
      })
    );
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

    applied.languages = getLanguages();

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
  }

  // -----------------------------------------
  // QUICK FILTERS
  // -----------------------------------------

  function bindQuickFilters() {
    Object.entries(QUICK_GROUPS)
      .forEach(([group, config]) => {
        const dropdown =
          document.querySelector(config.selector);

        if (!dropdown) return;

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
  // RESTORE FROM URL
  // -----------------------------------------

  function restoreFromURL() {
    const params = new URLSearchParams(
      window.location.search
    );

    function read(group) {
      return unique(
        (params.get(group) || "")
          .split(",")
      );
    }

    Object.keys(DRAWER_GROUPS).forEach(group => {
      if (params.has(group)) {
        setDrawerValues(group, read(group));
      }
    });

    if (params.has("specializations")) {
      setSpecializationCheckboxes(
        read("specializations")
      );
    }

    if (params.has("languages")) {
      const selected = new Set(
        read("languages")
      );

      drawer.querySelectorAll(
        'input[type="checkbox"]'
      ).forEach(input => {
        const wrapper =
          input.closest(".w-checkbox") ||
          input.closest("label") ||
          input.parentElement;

        const slug = wrapper
          ?.querySelector("[data-language]")
          ?.dataset.language
          ?.trim();

        if (slug) {
          setCheckbox(input, selected.has(slug));
        }
      });
    }

    applyDrawer();
  }

  // -----------------------------------------
  // SPECIALIZATIONS API
  // -----------------------------------------

  // Replace all selected specializations.
  // Retained for Topics Popup and external scripts.
  function setSpecializations(values = []) {
    if (!Array.isArray(values)) return;

    const selected = unique(values);

    setSpecializationCheckboxes(selected);

    applied.specializations =
      getSpecializations();

    notifyAdvanced();
    refresh();
  }

  // Add one specialization without replacing others.
  function addSpecialization(slug) {
    slug = String(slug || "").trim();

    if (!slug) return false;

    const input = [
      ...drawer.querySelectorAll(
        'input[name="filter-specializations"]'
      )
    ].find(checkbox => checkbox.value === slug);

    if (!input) {
      console.warn(
        "Finder Advanced: specialization not found",
        slug
      );
      return false;
    }

    // Already selected: do not create duplicates.
    if (applied.specializations.includes(slug)) {
      setCheckbox(input, true);
      return true;
    }

    const next = unique([
      ...applied.specializations,
      slug
    ]);

    setSpecializationCheckboxes(next);
    applied.specializations = next;

    notifyAdvanced();
    refresh();

    return true;
  }

  // -----------------------------------------
  // REMOVE FILTER
  // -----------------------------------------

  function remove(group, value) {
    if (!Object.hasOwn(applied, group)) return;

    applied[group] = applied[group]
      .filter(item => item !== value);

    if (
      group === "consultation" ||
      group === "insurance"
    ) {
      setQuickValues(group, applied[group]);
      setDrawerValues(group, applied[group]);
      notify(group);
    }

    if (group === "ages") {
      setDrawerValues(group, applied[group]);
    }

    if (group === "specializations") {
      setSpecializationCheckboxes(
        applied.specializations
      );
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
          ?.dataset.language
          ?.trim();

        if (slug === value) {
          setCheckbox(input, false);
        }
      });
    }

    notifyAdvanced();
    refresh();
  }

  // -----------------------------------------
  // CLEAR ADVANCED FILTERS ONLY
  // -----------------------------------------

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

    setSpecializationCheckboxes([]);

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

  // -----------------------------------------
  // PUBLIC API
  // -----------------------------------------

  window.finderAdvanced = {
    getApplied,
    apply: applyDrawer,
    setSpecializations,
    addSpecialization,
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

    restoreFromURL();
    bindQuickFilters();

    // Changes in Drawer apply immediately.
    drawer.addEventListener("change", event => {
      if (!event.target.matches(
        'input[type="checkbox"]'
      )) return;

      applyDrawer();
    });

    (window.FinsweetAttributes ||= []).push([
      "list",
      ([list]) => {
        if (!list) return;

        listInstance = list;
        list.addHook("filter", advancedFilter);

        notifyAdvanced();
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
   14. FINDER SORTING — FINSWEET V2
   Name A-Z, Name Z-A and distance sorting.
   Integrates with Sort Dropdown Embed.
   ========================================================================== */

(() => {
  "use strict";

  let listInstance = null;

  const collator = new Intl.Collator("de", {
    sensitivity: "base",
    numeric: true
  });

  // -----------------------------------------
  // SHARED GEO UTILITIES
  // -----------------------------------------

  const {
    distanceKm,
    parseCoordinates,
    getPractitionerCoordinates
  } = window.finderUtils;

  // -----------------------------------------
  // APPLIED LOCATION
  // -----------------------------------------

  function getLocation() {

    const location =
      window.finderGeo?.getApplied()?.location;

    if (!location) return null;

    return parseCoordinates(
      location.lat,
      location.lng
    );
  }

  // -----------------------------------------
  // PRACTITIONER DATA
  // -----------------------------------------

  function getPractitionerElement(item) {

    const element = item.element;

    if (!element) return null;

    if (
      element.matches(
        '[data-practitioner="true"]'
      )
    ) {
      return element;
    }

    return element.querySelector(
      '[data-practitioner="true"]'
    );
  }

  // -----------------------------------------
  // PRACTITIONER NAME
  // -----------------------------------------

  function getItemName(item) {

    const element = item.element;

    if (!element) return "";

    const nameElement =
      element.matches(".practitioner-name")
        ? element
        : element.querySelector(
            ".practitioner-name"
          );

    const practitioner =
      getPractitionerElement(item);

    return (
      nameElement?.textContent?.trim() ||
      practitioner?.getAttribute("data-name")?.trim() ||
      ""
    );
  }

  // -----------------------------------------
  // PRACTITIONER DISTANCE
  // -----------------------------------------

  function getItemDistance(item, location) {

    const coordinates =
      getPractitionerCoordinates(item);

    if (!coordinates) return Infinity;

    return distanceKm(
      location.lat,
      location.lng,
      coordinates.lat,
      coordinates.lng
    );
  }

  // -----------------------------------------
  // COMPARE NAMES
  // -----------------------------------------

  function compareNames(a, b, descending = false) {

    const nameA = getItemName(a);
    const nameB = getItemName(b);

    // Profiles without names are placed last.
    if (!nameA && !nameB) return 0;
    if (!nameA) return 1;
    if (!nameB) return -1;

    const comparison = collator.compare(
      nameA,
      nameB
    );

    return descending
      ? -comparison
      : comparison;
  }

  // -----------------------------------------
  // SORT BY NAME
  // -----------------------------------------

  function sortByName(items, descending = false) {

    return [...items].sort((a, b) => {
      return compareNames(a, b, descending);
    });
  }

  // -----------------------------------------
  // SORT BY DISTANCE
  // -----------------------------------------

  function sortByDistance(items, location) {

    // Calculate each distance only once.
    const prepared = items.map(item => ({
      item,
      distance: getItemDistance(item, location)
    }));

    prepared.sort((a, b) => {

      // Equal distances: sort alphabetically.
      if (a.distance === b.distance) {
        return compareNames(a.item, b.item);
      }

      // Profiles without coordinates go last.
      if (!Number.isFinite(a.distance)) {
        return 1;
      }

      if (!Number.isFinite(b.distance)) {
        return -1;
      }

      return a.distance - b.distance;
    });

    return prepared.map(entry => entry.item);
  }

  // -----------------------------------------
  // CUSTOM SORT HOOK
  // -----------------------------------------

  function sortPractitioners(items) {

    const mode =
      window.finderSort?.get() || "name";

    if (mode === "name-desc") {
      return sortByName(items, true);
    }

    if (mode === "distance") {

      const location = getLocation();

      if (!location) {
        return sortByName(items);
      }

      return sortByDistance(
        items,
        location
      );
    }

    return sortByName(items);
  }

  // -----------------------------------------
  // REFRESH SORT
  // -----------------------------------------

  function refreshSort() {

    if (!listInstance) return;

    // Return to the first page.
    listInstance.currentPage.value = 1;

    // Run Finsweet sorting and rendering.
    listInstance.triggerHook("sort");
  }

  // -----------------------------------------
  // DROPDOWN EVENTS
  // -----------------------------------------

  document.addEventListener(
    "finder:sort-changed",
    event => {

      const mode = event.detail?.sort;

      if (
        mode !== "name" &&
        mode !== "name-desc" &&
        mode !== "distance"
      ) {
        return;
      }

      if (
        mode === "distance" &&
        !getLocation()
      ) {
        window.finderSort?.set("name");
        return;
      }

      refreshSort();

      console.log(
        "Finder Sorting: applied",
        mode
      );

    }
  );

  // -----------------------------------------
  // LOCATION EVENTS
  // -----------------------------------------

  document.addEventListener(
    "finder:geo-applied",
    () => {

      window.finderSort
        ?.updateAvailability?.();

      if (
        window.finderSort?.get() === "distance"
      ) {
        refreshSort();
      }

    }
  );

  document.addEventListener(
    "finder:geo-cleared",
    () => {

      window.finderSort
        ?.updateAvailability?.();

      if (
        window.finderSort?.get() === "distance"
      ) {
        window.finderSort.set("name");
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
          "Finder Sorting: Finsweet list not found"
        );

        return;
      }

      listInstance = list;

      // Runs after filtering and before pagination.
      list.addHook(
        "sort",
        sortPractitioners
      );

      window.finderSort
        ?.updateAvailability?.();

      // Wait until other synchronous hooks
      // have been registered.
      queueMicrotask(refreshSort);

      console.log(
        "Finder Sorting: ready"
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
   17. FINDER MAP — PRACTITIONER MARKERS & POPUPS
   Finsweet v2: after filtering, before pagination
   Hover popup on desktop, click popup on touch devices
   ========================================================================== */
(() => {
  "use strict";

  const MARKER_COLOR = "#737969";

  let map = null;
  let markers = [];
  let latestItems = null;
  let updateTimer = null;
  let closeTimer = null;
  let lastSignature = null;
  let activePopup = null;
  let activeMarker = null;

  const supportsHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  );

  const { getPractitionerCoordinates } =
    window.finderUtils;

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

    const coordinates = getPractitionerCoordinates(item);
    if (!coordinates) return null;

    const { lat, lng } = coordinates;

    // Name
    const name = root.querySelector(
      ".doctor-card__name"
    )?.textContent.trim() ||
      element.getAttribute("data-name") ||
      "";

    // Professions / Fachrichtungen
    const professions = [
      ...root.querySelectorAll(
        ".doctor-hero__profecion"
      )
    ]
      .map(node => node.textContent.trim())
      .filter(Boolean);

    // City — dedicated Webflow class
    const city = root.querySelector(
      ".practitioner-city"
    )?.textContent.trim() || "";

    // Profile image
    const imageElement = root.querySelector(
      ".doc-card__photo img"
    );

    const image = imageElement?.currentSrc ||
      imageElement?.getAttribute("src") ||
      "";

    // CMS practitioner profile URL
    const profileLink = [
      ...root.querySelectorAll("a[href]")
    ].find(link => {
      const href = link.getAttribute("href") || "";
      return href.startsWith("/practitioners/");
    });

    const profileUrl =
      profileLink?.getAttribute("href") || "";

    return {
      id: item.id || "",
      name,
      profession: [...new Set(professions)].join(", "),
      city,
      image,
      profileUrl,
      lat,
      lng
    };
  }

  // -----------------------------------------
  // CREATE POPUP CONTENT
  // -----------------------------------------

  function createPopupContent(practitioner) {
    const card = document.createElement("div");
    card.className = "practitioner-popup";

    // Image
    const imageWrap = document.createElement("div");
    imageWrap.className = "practitioner-popup__image";

    if (practitioner.image) {
      const img = document.createElement("img");

      img.src = practitioner.image;
      img.alt = practitioner.name;
      img.loading = "lazy";

      imageWrap.appendChild(img);
    }

    // Content
    const content = document.createElement("div");
    content.className = "practitioner-popup__content";

    const info = document.createElement("div");
    info.className = "practitioner-popup__info";

    // Name
    const name = document.createElement("h3");
    name.className = "practitioner-popup__name";
    name.textContent = practitioner.name;

    info.appendChild(name);

    // Profession
    if (practitioner.profession) {
      const profession = document.createElement("p");

      profession.className =
        "practitioner-popup__profession";

      profession.textContent =
        practitioner.profession;

      info.appendChild(profession);
    }

    // City
    if (practitioner.city) {
      const city = document.createElement("p");

      city.className =
        "practitioner-popup__location";

      city.textContent = practitioner.city;

      info.appendChild(city);
    }

    content.appendChild(info);

    // Profile link
    if (practitioner.profileUrl) {
      const link = document.createElement("a");

      link.className =
        "practitioner-popup__link";

      link.href = practitioner.profileUrl;

      const linkText = document.createElement("span");
      linkText.textContent = "Profil ansehen";

      const arrow = document.createElement("span");
      arrow.className = "practitioner-popup__arrow";
      arrow.textContent = "→";
      arrow.setAttribute("aria-hidden", "true");

      link.append(linkText, arrow);
      content.appendChild(link);
    }

    card.append(imageWrap, content);

    return card;
  }

  // -----------------------------------------
  // POPUP MANAGEMENT
  // -----------------------------------------

  function cancelClose() {
    clearTimeout(closeTimer);
    closeTimer = null;
  }

  function closePopup() {
    cancelClose();

    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }

    activeMarker = null;
  }

  function scheduleClose() {
    cancelClose();

    closeTimer = setTimeout(() => {
      closePopup();
    }, 180);
  }

  function openPopup(practitioner, marker) {
    cancelClose();

    if (
      activeMarker === marker &&
      activePopup
    ) {
      return;
    }

    closePopup();

    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      closeOnMove: false,
      focusAfterOpen: false,
      offset: 25,
      maxWidth: "none",
      className: "practitioner-map-popup",
      anchor: "bottom"
    })
      .setLngLat([
        practitioner.lng,
        practitioner.lat
      ])
      .setDOMContent(
        createPopupContent(practitioner)
      )
      .addTo(map);

    activePopup = popup;
    activeMarker = marker;

    const popupElement = popup.getElement();

    // Keep popup open when cursor enters it
    popupElement.addEventListener(
      "pointerenter",
      cancelClose
    );

    // Close after leaving popup
    popupElement.addEventListener(
      "pointerleave",
      () => {
        if (supportsHover.matches) {
          scheduleClose();
        }
      }
    );

    popup.on("close", () => {
      if (activePopup === popup) {
        activePopup = null;
        activeMarker = null;
      }
    });
  }

  // -----------------------------------------
  // CLEAR MARKERS
  // -----------------------------------------

  function clearMarkers() {
    closePopup();

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

    // Ignore sorting-only changes
    const signature = practitioners
      .map(p => [
        p.id,
        p.name,
        p.lat,
        p.lng,
        p.profession,
        p.city,
        p.image,
        p.profileUrl
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

      const markerElement = marker.getElement();

      markerElement.style.cursor = "pointer";

      // Desktop hover
      markerElement.addEventListener(
        "pointerenter",
        () => {
          if (supportsHover.matches) {
            openPopup(practitioner, marker);
          }
        }
      );

      markerElement.addEventListener(
        "pointerleave",
        () => {
          if (supportsHover.matches) {
            scheduleClose();
          }
        }
      );

      // Click / touch
      markerElement.addEventListener(
        "click",
        event => {
          event.stopPropagation();

          if (
            activeMarker === marker &&
            activePopup
          ) {
            if (!supportsHover.matches) {
              closePopup();
            }
          } else {
            openPopup(practitioner, marker);
          }
        }
      );

      markers.push(marker);

      bounds.extend([
        practitioner.lng,
        practitioner.lat
      ]);
    });

    // Fit map to filtered practitioners
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
  // MAP INTERACTIONS
  // -----------------------------------------

  function setupMapInteractions() {
    map.on("click", event => {
      if (
        event.originalEvent?.target?.closest(
          ".mapboxgl-marker, .practitioner-map-popup"
        )
      ) {
        return;
      }

      closePopup();
    });
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
      console.warn(
        "Finder Map: Mapbox instance not found"
      );
      return;
    }

    setupMapInteractions();

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
        console.warn(
          "Finder Map: Finsweet list not found"
        );
        return;
      }

      initMap();

      list.addHook("sort", items => {
        scheduleUpdate(items);
        return items;
      });

      list.triggerHook("filter");

      console.log(
        "Finder Map: Finsweet sync ready"
      );
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
  // SHARED GEO UTILITIES
  // -----------------------------------------

  const {
    distanceKm,
    getPractitionerCoordinates: getCoordinates
  } = window.finderUtils;

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




/* ==========================================================================
   19. URL SEARCH INITIALIZATION
   Restore homepage search parameters on Finder
   Apply Thema, location and radius after Finsweet initialization
   ========================================================================== */
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);

  const hasSearchParams = [
    "thema",
    "location",
    "lat",
    "lng",
    "radius"
  ].some(key => params.has(key));

  if (!hasSearchParams) return;

  const form = document.querySelector(
    'form[fs-list-element="filters"]'
  );

  if (!form) {
    console.warn("Finder URL: filters form not found");
    return;
  }

  const themaInput = document.getElementById("thema-input");

  let initialized = false;

  function restoreSearch() {
    if (initialized) return;

    if (
  !window.finderGeo ||
  !window.finderLocation ||
  !window.finderRadius ||
  !window.finderMainSearch ||
  !window.finderAdvanced
) {
      console.warn("Finder URL: search APIs not ready");
      return;
    }

    initialized = true;

    // -----------------------------------------
    // 01. RESTORE THEMA
    // -----------------------------------------

    const thema = params.get("thema");

    if (thema && themaInput) {
      themaInput.value = thema;

      themaInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    // -----------------------------------------
    // 02. RESTORE LOCATION
    // -----------------------------------------

    const locationLabel = params.get("location");
    const latValue = params.get("lat");
    const lngValue = params.get("lng");

    const lat = Number(latValue);
    const lng = Number(lngValue);

    const hasValidLocation =
      locationLabel &&
      latValue !== null &&
      lngValue !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    if (hasValidLocation) {
      window.finderLocation.set({
        name: locationLabel,
        label: locationLabel,
        lat,
        lng
      });
    }

    // -----------------------------------------
    // 03. RESTORE RADIUS
    // -----------------------------------------

    const radius = params.get("radius");

    if (radius !== null) {
      if (radius === "all") {
        window.finderRadius.set("all");
      } else {
        const radiusNumber = Number(radius);

        if (
          Number.isFinite(radiusNumber) &&
          radiusNumber > 0
        ) {
          window.finderRadius.set(radiusNumber);
        }
      }
    }

    // -----------------------------------------
    // 04. APPLY FILTERS
    // -----------------------------------------

    // Use the existing form submit flow.
    // Block 06 reads location and radius on submit.
    // Finsweet processes the form-based filters.

    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      form.dispatchEvent(
        new Event("submit", {
          bubbles: true,
          cancelable: true
        })
      );
    }

    console.log("Finder URL: search restored", {
      thema: thema || null,
      location: hasValidLocation
        ? locationLabel
        : null,
      radius: window.finderRadius.get()
    });
  }

  // -----------------------------------------
  // 05. WAIT FOR FINSWEET
  // -----------------------------------------

  (window.FinsweetAttributes ||= []).push([
    "list",
    ([list]) => {
      if (!list) {
        console.warn("Finder URL: Finsweet list not found");
        return;
      }

      // Allow other Finder list callbacks to finish.
      setTimeout(restoreSearch, 0);
    }
  ]);

})();



/* ==========================================================================
   20. URL FILTER SYNCHRONIZATION
   Synchronize applied Finder filters with URL.
   Preserve unrelated query parameters.
   Update URL without page reload.
   ========================================================================== */
(() => {
  "use strict";

  const form = document.querySelector(
    'form[fs-list-element="filters"]'
  );

  if (!form) return;

  const FILTER_KEYS = [
    "thema",
    "location",
    "lat",
    "lng",
    "radius",
    "consultation",
    "insurance",
    "ages",
    "languages",
    "specializations"
  ];

  let ready = false;
  let scheduled = false;

  // -----------------------------------------
  // BUILD URL FROM APPLIED FILTERS
  // -----------------------------------------

  function syncURL() {
    if (!ready) return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Remove previous Finder parameters.
    FILTER_KEYS.forEach(key => {
      params.delete(key);
    });

    // 01. Thema
    const thema =
      window.finderThema?.getApplied();

    if (thema) {
      params.set("thema", thema);
    }

    // 02. Geographic filters
    const geo =
      window.finderGeo?.getApplied();

    if (geo?.location) {
      const location = geo.location;

      params.set("location", location.label);
      params.set("lat", String(location.lat));
      params.set("lng", String(location.lng));

      if (geo.radius === Infinity) {
        params.set("radius", "all");
      } else if (Number.isFinite(geo.radius)) {
        params.set("radius", String(geo.radius));
      }
    }

    // 03. Advanced filters
    const advanced =
      window.finderAdvanced?.getApplied();

    if (advanced) {
      Object.entries(advanced).forEach(
        ([group, values]) => {
          if (values.length > 0) {
            params.set(
              group,
              values.join(",")
            );
          }
        }
      );
    }

    // 04. Update browser URL
    if (url.href !== window.location.href) {
      window.history.replaceState(
        window.history.state,
        "",
        url.href
      );
    }
  }

  // -----------------------------------------
  // BATCH SYNCHRONIZATION
  // -----------------------------------------

  function scheduleSync() {
    if (!ready || scheduled) return;

    scheduled = true;

    queueMicrotask(() => {
      scheduled = false;
      syncURL();
    });
  }

  // -----------------------------------------
  // LISTEN TO APPLIED FILTER CHANGES
  // -----------------------------------------

  
  [
    "finder:advanced-filters-changed",
    "finder:geo-applied",
    "finder:geo-cleared",
    "finder:main-search-applied"
  ].forEach(eventName => {
    document.addEventListener(
      eventName,
      scheduleSync
    );
  });


  // -----------------------------------------
  // WAIT FOR INITIAL URL RESTORATION
  // -----------------------------------------

  (window.FinsweetAttributes ||= []).push([
    "list",
    ([list]) => {
      if (!list) return;

      // Block 19 restores the initial search
      // before URL synchronization is enabled.
      setTimeout(() => {
        ready = true;
        syncURL();

        console.log(
          "Finder URL Synchronization: ready"
        );
      }, 0);
    }
  ]);
})();







