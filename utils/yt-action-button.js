(function (global) {
  const YOUTUBE_ACTION_BUTTON_CLASSES = {
    host: "userscript-yt-action-button",
    tooltip: "userscript-yt-action-button__tooltip",
    tooltipPopover: "userscript-yt-action-button__tooltip-popover",
  };

  const YOUTUBE_ACTION_BUTTON_STYLE_ID = "userscript-yt-action-button-styles";
  const YOUTUBE_ACTION_BUTTON_TAGS = { wrapper: "yt-button-view-model" };
  const YOUTUBE_ACTION_BUTTON_CLASS_LIST =
    "yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m yt-spec-button-shape-next--enable-backdrop-filter-experiment"
      .split(" ")
      .filter(Boolean);

  function ensureStyles() {
    if (document.getElementById(YOUTUBE_ACTION_BUTTON_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = YOUTUBE_ACTION_BUTTON_STYLE_ID;
    style.textContent = `
.${YOUTUBE_ACTION_BUTTON_CLASSES.host} {
  position: relative;
  --userscript-yt-action-button-tooltip-background: rgb(91, 91, 91);
  --userscript-yt-action-button-tooltip-offset: 8px;
}

.${YOUTUBE_ACTION_BUTTON_CLASSES.host} button.yt-spec-button-shape-next[disabled] {
  opacity: 0.5;
  cursor: default !important;
}

.${YOUTUBE_ACTION_BUTTON_CLASSES.host} button.yt-spec-button-shape-next:not([disabled]) {
  cursor: pointer;
}

.${YOUTUBE_ACTION_BUTTON_CLASSES.host} .${YOUTUBE_ACTION_BUTTON_CLASSES.tooltip} {
  pointer-events: none;
}

.${YOUTUBE_ACTION_BUTTON_CLASSES.host} .${YOUTUBE_ACTION_BUTTON_CLASSES.tooltipPopover} {
  position: absolute;
  left: 50%;
  top: calc(100% + var(--userscript-yt-action-button-tooltip-offset));
  transform: translateX(-50%);
  margin: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--userscript-yt-action-button-tooltip-background);
  color: #fff;
  font-family: "YouTube Sans", "Roboto", sans-serif;
  font-size: 1.2rem;
  line-height: 1.6rem;
  white-space: nowrap;
  z-index: 2202;
}
`;
    document.head.appendChild(style);
  }

  function createTouchFeedback() {
    const touchFeedback = document.createElement("yt-touch-feedback-shape");
    touchFeedback.style.borderRadius = "inherit";

    const feedbackContainer = document.createElement("div");
    feedbackContainer.className =
      "yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response";

    const stroke = document.createElement("div");
    stroke.className = "yt-spec-touch-feedback-shape__stroke";

    const fill = document.createElement("div");
    fill.className = "yt-spec-touch-feedback-shape__fill";

    feedbackContainer.appendChild(stroke);
    feedbackContainer.appendChild(fill);
    touchFeedback.appendChild(feedbackContainer);

    return touchFeedback;
  }

  function createTooltip(initialText) {
    const tooltip = document.createElement("div");
    tooltip.className = YOUTUBE_ACTION_BUTTON_CLASSES.tooltip;
    tooltip.setAttribute("aria-hidden", "true");

    const tooltipPopover = document.createElement("div");
    tooltipPopover.className = YOUTUBE_ACTION_BUTTON_CLASSES.tooltipPopover;
    tooltipPopover.textContent = initialText;
    tooltipPopover.hidden = true;

    tooltip.appendChild(tooltipPopover);

    return { tooltip, tooltipPopover };
  }

  function syncTooltipState(button, tooltipPopover, getTooltipText) {
    const tooltipText = getTooltipText(button);
    if (button.getAttribute("aria-label") !== tooltipText) {
      button.setAttribute("aria-label", tooltipText);
    }
    if (tooltipPopover.textContent !== tooltipText) {
      tooltipPopover.textContent = tooltipText;
    }
  }

  function attachTooltipBehavior(outerContainer, button, tooltip, tooltipPopover) {
    const showTooltip = () => {
      tooltip.setAttribute("aria-hidden", "false");
      tooltipPopover.hidden = false;
    };
    const hideTooltip = () => {
      tooltip.setAttribute("aria-hidden", "true");
      tooltipPopover.hidden = true;
    };

    outerContainer.addEventListener("mouseenter", showTooltip);
    outerContainer.addEventListener("mouseleave", hideTooltip);
    button.addEventListener("focus", showTooltip);
    button.addEventListener("blur", hideTooltip);
  }

  function create({
    id,
    buildButtonContent,
    getTooltipText,
    onClick,
    initialDisabled = false,
    tooltipBackground = "rgb(91, 91, 91)",
    tooltipOffset = 8,
  }) {
    ensureStyles();

    const outerContainer = document.createElement("div");
    outerContainer.id = id;
    outerContainer.classList.add(
      YOUTUBE_ACTION_BUTTON_CLASSES.host,
      "style-scope",
      "ytd-video-owner-renderer",
      "copy-panel"
    );
    outerContainer.style.setProperty(
      "--userscript-yt-action-button-tooltip-background",
      tooltipBackground
    );
    outerContainer.style.setProperty(
      "--userscript-yt-action-button-tooltip-offset",
      `${tooltipOffset}px`
    );

    const container = document.createElement("div");
    container.className = "copy-button-container";

    const button = document.createElement("button");
    button.classList.add(...YOUTUBE_ACTION_BUTTON_CLASS_LIST);
    button.toggleAttribute("disabled", initialDisabled);

    const { tooltip, tooltipPopover } = createTooltip(getTooltipText(button));
    syncTooltipState(button, tooltipPopover, getTooltipText);
    attachTooltipBehavior(outerContainer, button, tooltip, tooltipPopover);

    const contentRefs =
      typeof buildButtonContent === "function"
        ? buildButtonContent(button, { createTouchFeedback })
        : undefined;

    button.addEventListener("click", onClick);

    container.appendChild(button);
    outerContainer.appendChild(container);
    outerContainer.appendChild(tooltip);

    const wrapper = document.createElement(YOUTUBE_ACTION_BUTTON_TAGS.wrapper);
    wrapper.classList.add("ytd-menu-renderer");
    wrapper.appendChild(outerContainer);

    return {
      wrapper,
      outerContainer,
      button,
      tooltip,
      tooltipPopover,
      contentRefs,
      setDisabled(disabled) {
        button.toggleAttribute("disabled", Boolean(disabled));
        syncTooltipState(button, tooltipPopover, getTooltipText);
      },
      syncTooltipText() {
        syncTooltipState(button, tooltipPopover, getTooltipText);
      },
    };
  }

  global.ytActionButton = {
    create,
  };
})(typeof window !== "undefined" ? window : globalThis);
