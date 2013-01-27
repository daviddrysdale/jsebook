
var loadFileUrl = function (url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);  // synchronous
    // retrieve data unprocessed as a binary string
    xhr.overrideMimeType("application/octet-string");
    xhr.send();
    if (xhr.status === 200) {
        var bytes = [];
        for (var ii=0; ii<xhr.response.length; ii++) {
            bytes.push(xhr.response.charCodeAt(ii) & 0xFF);
        }
        return bytes;
    } else {
        throw new Error("File not found");
    }
}

describe("MobiRead", function() {
    it("should complain of missing file", function() {
        var loadMissing = function() {
            data = loadFileUrl("nosuchfile");
        }
        expect(loadMissing).toThrow();
    });
    it("should load and parse a valid file", function() {
        var data;
        var loadIt = function() {
            data = loadFileUrl("http://localhost/~dmd/jsebook/data/testbook.mobi");
        }
        expect(loadIt).not.toThrow();
        var book = new MobiBook(data);
        expect(book.creationDate()).toEqual(new Date("Sat Sep 22 2012 21:40:59 GMT+0100 (BST)"));
    });
    it("should complain of wrong file type", function() {
    });

});
