
var loadFileUrl = function (url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);  // synchronous
    // retrieve data unprocessed as a binary string
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    xhr.send();
    if (xhr.status === 200) {
        return xhr.response; // Note: not xhr.responseText
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
    });
    it("should complain of wrong file type", function() {
    });

});
