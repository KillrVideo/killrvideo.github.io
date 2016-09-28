import $ from 'cash-dom';
import throttle from 'lodash.throttle';

/**
 * Helper function to determine whether or not the current page is being viewed in a mobile 
 * width (consistent with the breakpoints in our SASS).
 */
function getMobile() {
  let viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
  return viewportWidth <= 768;
}

/**
 * Helper function to get the current scroll position of the page.
 */
function getPosition() {
  return window.pageYOffset || document.documentElement.scrollTop;
}

/**
 * Helper function that determines whether given a scroll threshold, we should be putting
 * sticky elements into fixed positioning.
 */
function shouldBeFixedPosition(thresholdPx) {
  let isMobile = getMobile();
  if (isMobile) return false;

  let position = getPosition();
  if (position < thresholdPx) return false;

  return true;
}

/**
 * Simulate CSS sticky positioning on an element by reacting to window scroll and resize events,
 * then adding a class to the specified element(s).
 */
export function sticky(selector, thresholdPx, topPx) {
  let $el = $(selector);

  // Insert a hidden div after the element we're going to make sticky
  let $newDiv = $(document.createElement('div')).css('height', '0px').insertAfter($el);

  // Variable that contains state about whether or not we're in fixed position
  let isFixed = false;

  // Function that will update the width of the element to be the same as the hidden div
  function updateWidth() {
    if (isFixed === false) return;
    $el.css('width', `${$newDiv.width()}px`);
  }

  // Update width function, only throttled
  let updateWidthOnResize = throttle(updateWidth, 100);

  // The function we'll run as the UI is scrolled/resized to update our state
  function updateFixed() {
    // Check if we should be fixed position
    let shouldBeFixed = shouldBeFixedPosition(thresholdPx);

    // If already in the correct state, just bail
    if (shouldBeFixed === isFixed) return;

    // Update our state
    isFixed = shouldBeFixed;

    // Update the UI
    if (isFixed === true) {
      // Set to fixed position, update the element width, and update width on resizes
      $el.css({ position: 'fixed', top: `${topPx}px` });
      updateWidth();
      $(window).on('resize', updateWidthOnResize);
    } else {
      // Remove all style attributes and listeners
      $el.removeAttr('style');
      $(window).off('resize', updateWidthOnResize);
    }
  }

  // Update state on resize or scroll
  $(window)
    .on('resize', throttle(updateFixed, 100))
    .on('scroll', throttle(updateFixed, 100));
};