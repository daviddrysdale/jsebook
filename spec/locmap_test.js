describe("LocationMap", function() {
    it("should map identity", function() {
        var lm = new LocationMap();
        var len = 10;
        var ii;
        for (ii = 0; ii < len; ii++) {
            lm.add(ii, ii);
        }
        for (ii = 0; ii < len; ii++) {
            expect(lm.find(ii)).toEqual(ii);
        }
        expect(lm.find(-1)).toEqual(-1);
        expect(lm.find(len)).toEqual(-1);
    });
    it("should map offset", function() {
        var lm = new LocationMap();
        var len = 10;
        var offset = 3;
        var ii;
        for (ii = 0; ii < len; ii++) {
            lm.add(ii, ii + offset);
        }
        for (ii = 0; ii < len; ii++) {
            expect(lm.find(ii)).toEqual(ii + offset);
        }
    });
    it("should map ranges", function () {
        var lm = new LocationMap();
        lm.add(0, 10);
        lm.add(1, 11);
        lm.add(2, 12);
        lm.add(3, 13);
        lm.add(4, 20);
        lm.add(5, 21);
        lm.add(6, 22);
        lm.add(7, 23);
        lm.add(8, 30);
        lm.add(9, 31);
        expect(lm.find(2)).toEqual(12);
        expect(lm.find(6)).toEqual(22);
    });
    it("should map sparse ranges", function () {
        var lm = new LocationMap();
        lm.add(0, 10);
        lm.add(1, 11);
        lm.add(2, 12);
        lm.add(3, 13);
        lm.add(14, 20);
        lm.add(15, 21);
        lm.add(16, 22);
        lm.add(17, 23);
        lm.add(38, 30);
        lm.add(39, 31);
        expect(lm.find(-2)).toEqual(-1);
        expect(lm.find(2)).toEqual(12);
        expect(lm.find(6)).toEqual(-1);
        expect(lm.findNext(6)).toEqual(20);
        expect(lm.findNext(20)).toEqual(30);
        expect(lm.findNext(39)).toEqual(31);
        expect(lm.findNext(40)).toEqual(-1);
        expect(lm.findNext(-2)).toEqual(10);
    });
    it("should add ranges", function () {
        var lm = new LocationMap();
        lm.addRange(10, 5, 100);
        lm.addRange(50, 50, 200);
        lm.add(122, 333);
        expect(lm.findNext(123)).toEqual(-1);
        expect(lm.findNext(13)).toEqual(103);
        expect(lm.find(75)).toEqual(225);
    });
    it("should merge maps with dest offset", function () {
        var lm = new LocationMap();
        lm.addRange(0, 5, 1);
        lm.addRange(50, 50, 100);

        var lm2 = new LocationMap();
        lm2.addRange(100, 12, 0);
        lm2.addRange(120, 5, 20);

        lm.mergeLocationMap(lm2, 0, 200);
        expect(lm.findNext(8)).toEqual(100);
        expect(lm.find(101)).toEqual(201);
        expect(lm.find(123)).toEqual(223);
    });
    it("should merge maps with src offset", function () {
        var lm = new LocationMap();
        lm.addRange(0, 5, 1);
        lm.addRange(50, 50, 100);

        var lm2 = new LocationMap();
        lm2.addRange(100, 12, 200);
        lm2.addRange(120, 5, 220);

        lm.mergeLocationMap(lm2, 1000, 0);
        expect(lm.findNext(8)).toEqual(100);
        expect(lm.find(1101)).toEqual(201);
        expect(lm.find(1123)).toEqual(223);
    });
    it("should compose with another map", function () {
        var lm = new LocationMap();
        lm.addRange(0, 5, 100);
        lm.addRange(10, 10, 120);

        var lm2 = new LocationMap();
        lm2.addRange(102, 2, 200);
        lm2.addRange(110, 10, 300);
        lm2.addRange(125, 5, 400);

        lm.compose(lm2);
        expect(lm.find(0)).toEqual(-1);
        expect(lm.find(2)).toEqual(200);
        expect(lm.find(3)).toEqual(201);
        expect(lm.find(4)).toEqual(-1);
        expect(lm.find(10)).toEqual(-1);
        expect(lm.find(15)).toEqual(400);
        expect(lm.find(19)).toEqual(404);
        expect(lm.find(110)).toEqual(-1);
    });
});
