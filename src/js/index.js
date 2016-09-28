import $ from 'cash-dom';
import { sticky } from './sticky';

// Include Google Analytics when in production
if (process.env.NODE_ENV === 'production') {
  const ga = require('./google-analytics');
}

// Add listeners for click on mobile menu
let $mainNavMenu = $('header > nav.nav div.nav-menu');
$('header > nav.nav span.nav-toggle').on('click', function toggleMenuActive(e) {
  $mainNavMenu.toggleClass('is-active');
});

export {
  sticky
};