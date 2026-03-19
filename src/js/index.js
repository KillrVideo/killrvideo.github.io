document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('header > nav.nav span.nav-toggle')
    .addEventListener('click', function() {
      document.querySelector('header > nav.nav div.nav-menu')
        .classList.toggle('is-active');
    });
});
