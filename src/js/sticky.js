import $ from 'cash-dom';
import throttle from 'lodash.throttle';

/**
 * Simulate CSS sticky positioning on an element by reacting to window scroll and resize events,
 * then adding a class to the specified element(s).
 */
export function sticky(selector, thresholdPx) {
  let el = $(selector);
  let applySticky = throttle(function checkStickyEl(e) {
    let top = window.pageYOffset || document.documentElement.scrollTop;
    if (top >= thresholdPx) {
      el.addClass('sticky');
    } else {
      el.removeClass('sticky');
    }
  }, 250);

  $(window).on('scroll', applySticky);
  $(window).on('resize', applySticky);
};