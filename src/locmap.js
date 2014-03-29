var LocationMap = function() {
    if (!(this instanceof LocationMap)) {
        return new LocationMap(); // protect against calls without new
    }
    this.map = {};
    this.max_key = -1;
}

// Record that input position src maps to output position dest
LocationMap.prototype.add = function(src, dest) {
    this.map[src] = dest;
    if (src > this.max_key) {
        this.max_key = src;
    }
}

// Find the output position that src maps to.
LocationMap.prototype.find = function(src) {
    if (src in this.map) {
        return this.map[src];
    } else {
        return -1;
    }
}

LocationMap.prototype.findNext = function(src) {
    if (src > this.max_key) {
        return -1;
    }
    var ii;
    for (ii = 0; ii <= (this.max_key - src); ii++) {
        if ((src+ii) in this.map) {
            return this.map[(src+ii)];
        }
    }
    return -1;
}
