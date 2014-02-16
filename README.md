jsebook Library
===============

**Current Status: very incomplete, under development**

This project is a JavaScript library that reads MOBI (.mobi) format eBooks and converts
them to HTML.

Note that Amazon Kindle files (.azw, .azw3) are in an encrypted MOBI format, so do not work
with this library as-is.


Basic Library Use
-----------------

Feed binary string data with the contents of the .mobi file to the `MobiBook` constructor, and extract the corresponding
HTML with the `.html` property:

```js
var book = new MobiBook(data);
var htmlData = book.html;
```

Other Properties
----------------

**TODO**: when other useful public properties are added to the `MobiBook` object describe them here.

