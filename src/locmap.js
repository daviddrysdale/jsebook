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
// Record a linear range of input positions that map 1:1 to output
// src -> dest, src+1 -> dest+1, ...., src+len-1 -> dest+len-1
LocationMap.prototype.addRange = function(src, len, dest) {
    var ii;
    for (ii = 0; ii < len; ii++) {
        this.map[(src + ii)] = (dest + ii);
    }
    if (len > 0) {
        ii = src + len - 1;
        if (ii > this.max_key) {
            this.max_key = ii;
        }
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