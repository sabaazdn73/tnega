// Runs in <head>: marks the page for the album view before it is drawn, so the long list never flashes.
if (typeof HTMLDialogElement === 'function' && 'showModal' in HTMLDialogElement.prototype && 'animate' in Element.prototype) document.documentElement.classList.add('js-book');
