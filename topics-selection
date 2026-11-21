/* ==========================================================================
   TOPICS SELECTION
   Shared category slider and specialization popup.
   Used on Homepage and Finder page.
   ========================================================================== */

(() => {
  "use strict";

  const FINDER_PATH = "/find-a-practitioner";

  function init() {
    const swiperEl = document.querySelector(
      ".swiper.is--topics"
    );

    if (!swiperEl) return;

    // Prevent duplicate initialization.
    if (swiperEl.dataset.topicsInitialized === "true") {
      return;
    }

    swiperEl.dataset.topicsInitialized = "true";

    const isFinderPage =
      window.location.pathname.replace(/\/+$/, "") ===
      FINDER_PATH;

    /* ============================================================
       01 — TOPICS SWIPER
       Category slider initialization and active slide behavior
       ============================================================ */

    if (typeof Swiper !== "undefined") {

      const topicsSwiper = swiperEl.swiper || new Swiper(
        swiperEl,
        {
          direction: "horizontal",
          loop: false,
          slidesPerView: 1.3,
          spaceBetween: 16,

          breakpoints: {
            480: {
              slidesPerView: 2,
              spaceBetween: 16
            },
            768: {
              slidesPerView: 3,
              spaceBetween: 16
            },
            992: {
              slidesPerView: 4,
              spaceBetween: 24
            }
          },

          navigation: {
            nextEl: ".swiper-btn.is--next",
            prevEl: ".swiper-btn.is--prev",
            disabledClass: "is--disabled"
          },

          scrollbar: {
            el: ".swiper-scrollbar.is--topics",
            draggable: true
          }
        }
      );

      const slides = Array.from(topicsSwiper.slides);

      function setActive(index) {
        slides.forEach(function (slide, i) {
          const card = slide.querySelector(
            ".category-card"
          );

          const isActive = i === index;

          slide.classList.toggle(
            "is--active-slide",
            isActive
          );

          if (card) {
            card.classList.toggle(
              "is--active",
              isActive
            );
          }
        });
      }

      setActive(topicsSwiper.activeIndex || 0);

      topicsSwiper.on("slideChange", function () {
        setActive(topicsSwiper.activeIndex);
      });

      slides.forEach(function (slide, i) {
        slide.addEventListener(
          "mouseenter",
          function () {
            setActive(i);
          }
        );
      });

      swiperEl.addEventListener(
        "mouseleave",
        function () {
          setActive(topicsSwiper.activeIndex);
        }
      );

    } else {
      console.warn(
        "Topics Selection: Swiper is not available"
      );
    }

    /* ============================================================
       02 — TOPICS POPUP
       Category selection and specialization management
       ============================================================ */

    const popup = document.querySelector(
      ".topics-popup"
    );

    const overlay = document.querySelector(
      ".popup-overlay"
    );

    const popupTitle = document.querySelector(
      ".popup-title"
    );

    const chipsContainer = document.querySelector(
      ".popup-chips"
    );

    const countEl = document.querySelector(
      ".popup-count"
    );

    const resetBtn = document.querySelector(
      ".popup-reset"
    );

    const closeBtn = document.querySelector(
      ".popup-close"
    );

    const confirmBtn = document.getElementById(
      "popup-confirm"
    );

    if (!popup || !chipsContainer) {
      console.warn(
        "Topics Selection: popup elements missing"
      );
      return;
    }

    let activeCategory = null;

    // Selection before opening the popup.
    let initialSelection = new Set();

    // Temporary selection inside the popup.
    let draftSelection = new Set();

    /* ============================================================
       03 — SELECTION HELPERS
       ============================================================ */

    function getAppliedSpecializations() {
      if (!isFinderPage) return [];

      const applied =
        window.finderAdvanced?.getApplied();

      if (Array.isArray(applied?.specializations)) {
        return applied.specializations;
      }

      // Fallback while Finder is initializing.
      const params = new URLSearchParams(
        window.location.search
      );

      return (params.get("specializations") || "")
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
    }

    function getAllChips() {
      return Array.from(
        chipsContainer.querySelectorAll(
          ".popup-chip"
        )
      );
    }

    function getCategoryChips() {
      return getAllChips().filter(function (chip) {
        return chip.dataset.category === activeCategory;
      });
    }

    function syncChips() {
      getAllChips().forEach(function (chip) {
        const slug = chip.dataset.slug;

        const belongsToCategory =
          chip.dataset.category === activeCategory;

        chip.style.display =
          belongsToCategory ? "" : "none";

        chip.classList.toggle(
          "is--selected",
          Boolean(slug && draftSelection.has(slug))
        );
      });
    }

    function updateCount() {
      const count = new Set(
        getCategoryChips()
          .map(chip => chip.dataset.slug)
          .filter(slug => draftSelection.has(slug))
      ).size;

      if (countEl) {
        countEl.textContent =
          count === 1
            ? "1 Thema gewählt"
            : count > 1
              ? count + " Themen gewählt"
              : "";
      }

      if (resetBtn) {
        resetBtn.style.visibility =
          count > 0 ? "visible" : "hidden";
      }
    }

    /* ============================================================
       04 — OPEN AND CLOSE POPUP
       ============================================================ */

    function openPopup(categoryId, categoryTitle) {
      activeCategory = categoryId;

      initialSelection = new Set(
        getAppliedSpecializations()
      );

      draftSelection = new Set(
        initialSelection
      );

      if (popupTitle) {
        popupTitle.textContent = categoryTitle || "";
      }

      syncChips();
      updateCount();

      popup.classList.add("is--open");
    }

    function closePopup() {
      popup.classList.remove("is--open");

      // Discard unconfirmed changes.
      draftSelection = new Set(
        initialSelection
      );

      activeCategory = null;
    }

    swiperEl.addEventListener(
      "click",
      function (event) {
        if (swiperEl.swiper?.allowClick === false) {
          return;
        }

        const slide = event.target.closest(
          ".swiper-slide"
        );

        if (!slide || !swiperEl.contains(slide)) {
          return;
        }

        const categoryId =
          slide.dataset.categoryId;

        const categoryTitle =
          slide.dataset.categoryTitle;

        if (!categoryId) return;

        openPopup(
          categoryId,
          categoryTitle
        );
      }
    );

    /* ============================================================
       05 — CHIP SELECTION
       ============================================================ */

    chipsContainer.addEventListener(
      "click",
      function (event) {
        const chip = event.target.closest(
          ".popup-chip"
        );

        if (
          !chip ||
          !chipsContainer.contains(chip) ||
          chip.dataset.category !== activeCategory
        ) {
          return;
        }

        const slug = chip.dataset.slug;

        if (!slug) return;

        event.preventDefault();

        if (draftSelection.has(slug)) {
          draftSelection.delete(slug);
        } else {
          draftSelection.add(slug);
        }

        syncChips();
        updateCount();
      }
    );

    /* ============================================================
       06 — RESET CURRENT CATEGORY
       Preserve selections from other categories.
       ============================================================ */

    if (resetBtn) {
      resetBtn.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          getCategoryChips().forEach(
            function (chip) {
              draftSelection.delete(
                chip.dataset.slug
              );
            }
          );

          syncChips();
          updateCount();
        }
      );
    }

    /* ============================================================
       07 — CONFIRM SELECTION
       Homepage: redirect to Finder.
       Finder: apply filters without page reload.
       ============================================================ */

    if (confirmBtn) {
      confirmBtn.addEventListener(
        "click",
        function (event) {
          event.preventDefault();

          if (!activeCategory) return;

          const selected = Array.from(
            draftSelection
          ).filter(Boolean);

          // -----------------------------------------
          // FINDER PAGE
          // -----------------------------------------

          if (isFinderPage) {

            if (
              typeof window.finderAdvanced
                ?.setSpecializations !== "function"
            ) {
              console.warn(
                "Topics Selection: Finder API not ready"
              );
              return;
            }

            // Preserve the latest applied filters
            // outside the currently opened category.
            const mergedSelection = new Set(
              getAppliedSpecializations()
            );

            getCategoryChips().forEach(
              function (chip) {
                const slug = chip.dataset.slug;

                if (!slug) return;

                if (draftSelection.has(slug)) {
                  mergedSelection.add(slug);
                } else {
                  mergedSelection.delete(slug);
                }
              }
            );

            window.finderAdvanced.setSpecializations(
              Array.from(mergedSelection)
            );

            initialSelection = new Set(
              getAppliedSpecializations()
            );

            closePopup();

            return;
          }

          // -----------------------------------------
          // HOMEPAGE
          // -----------------------------------------

          const params = new URLSearchParams();

          if (selected.length > 0) {
            params.set(
              "specializations",
              selected.join(",")
            );
          }

          closePopup();

          window.location.href =
            FINDER_PATH +
            (
              params.toString()
                ? "?" + params.toString()
                : ""
            );
        }
      );
    }

    /* ============================================================
       08 — CLOSE EVENTS
       ============================================================ */

    if (closeBtn) {
      closeBtn.addEventListener(
        "click",
        function (event) {
          event.preventDefault();
          closePopup();
        }
      );
    }

    if (overlay) {
      overlay.addEventListener(
        "click",
        function (event) {
          if (event.target === overlay) {
            closePopup();
          }
        }
      );
    }

    document.addEventListener(
      "keydown",
      function (event) {
        if (
          event.key === "Escape" &&
          popup.classList.contains("is--open")
        ) {
          closePopup();
        }
      }
    );

    console.log(
      "Topics Selection: ready",
      isFinderPage ? "Finder" : "Homepage"
    );
  }

  /* ============================================================
     INITIALIZATION
     ============================================================ */

  window.Webflow = window.Webflow || [];

  window.Webflow.push(init);

})();

