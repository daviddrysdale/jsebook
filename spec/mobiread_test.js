
var loadFileUrl = function (url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);  // synchronous
    // retrieve data unprocessed as a binary string
    xhr.overrideMimeType("text\/plain; charset=x-user-defined");
    xhr.send(null);

    if (xhr.status === 200) {
        var bytes = [];
        for (var ii=0; ii<xhr.response.length; ii++) {
            bytes.push(xhr.responseText.charCodeAt(ii) & 0xFF);
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
            data = loadFileUrl("data/testbook.mobi");
        }
        expect(loadIt).not.toThrow();
        var book = new MobiBook(data);
        expect(book.creationDate()).toEqual(new Date("Sat Sep 22 2012 21:40:59 GMT+0100 (BST)"));
        expect(book.title).toEqual("Lady Susan");
    });
    it("should cope with accidental construction without new", function() {
    });
    it("should complain of wrong file type", function() {
    });

});

describe("MobiRead utilities", function() {
    it("should decode forward-encoded variable width integers", function() {
        var bytes = [];
        bytes[0] = 0x04;
        bytes[1] = 0x22;
        bytes[2] = 0x91;
        expect(MobiBook.readInteger(bytes, 0)).toEqual(0x11111);
    });
    it("should decode backward-encoded variable width integers", function() {
        var bytes = [];
        bytes[0] = 0x84;
        bytes[1] = 0x22;
        bytes[2] = 0x11;
        expect(MobiBook.readBackwardInteger(bytes, 3)).toEqual(0x11111);
    });
});
