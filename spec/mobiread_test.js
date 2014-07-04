describe("MobiRead", function() {
    it("should complain of missing file", function() {
        var loadMissing = function() {
            data = loadFileUrl("nosuchfile");
        }
        expect(loadMissing).toThrow();
    });
    it("should load and parse a valid file", function() {
        var data;
        expect(function() {data = loadFileUrl("data/testbook.mobi");}).not.toThrow();
        var book = new MobiBook(data);
        expect(book.creationDate()).toEqual(new Date("Sat Sep 22 2012 21:40:59 GMT+0100 (BST)"));
        expect(book.title).toEqual("Lady Susan");
        addResult(book.html);
    });
    it("should cope with accidental construction without new", function() {
        var book = MobiBook(loadFileUrl("data/testbook.mobi"));
        expect(book.title).toEqual("Lady Susan");
    });
    it("should complain of wrong file type", function() {
        var data = loadFileUrl("src/mobiread.js");
        var book;
        expect(function() {book = new MobiBook(data);}).toThrow();
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
        expect(MobiBook.readBackwardInteger(bytes, 0, 3)).toEqual(0x11111);
    });
});
