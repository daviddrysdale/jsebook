(function(document) {
    // Onload, take the DOM of the page, get the markdown formatted text out and
    // apply the converter.
    var book = new MobiBook(document.body.innerText);
    document.body.innerHTML = book.html;

    // Inject a reference to our stylesheet.
    var ss = document.createElement('link');
    ss.rel = 'stylesheet';
    ss.href = chrome.extension.getURL('mobiread.css');
    document.head.appendChild(ss);
}(document));
