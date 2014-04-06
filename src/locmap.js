var LocationMap = function() {
    if (!(this instanceof LocationMap)) {
        return new LocationMap(); // protect against calls without new
    }
    // List of interval 3-tuples (src, len, dest), ordered by src.
    // Invariant: (intervals[ii][SRC] + intervals[ii][LEN]) < intervals[ii+1][SRC]
    this.intervals = [];
}

// Record that input position src maps to output position dest
LocationMap.prototype.add = function(src, dest) {
    return this.addRange(src, 1, dest);
}

// Record a linear range of input positions that map 1:1 to output
// [src, src+len) -> [dest, dest+len)
LocationMap.prototype.addRange = function(src, len, dest) {
    if ((this.intervals.length == 0) || (src > this._intervalSrcEnd(-1))) {
        // Definitely a gap, so start a new interval
        this.intervals.push([src, len, dest]);
    } else {
        // Iterate backwards over intervals to find one to adjoin.
        var ii;
        for (ii = (this.intervals.length - 1); ii >= 0; ii--) {
            if (src == this._intervalSrcEnd(ii)) {
                // New source value exactly adjoins this interval.
                if (dest == this._intervalDestEnd(ii)) {
                    // New dest is consistent, so can extend this interval.
                    this.intervals[ii][this.LEN] += len;
                    this._adjustSubsequent(ii);
                } else {
                    // New dest is not consistent, so insert a new interval.
                    this.intervals.splice(ii + 1, 0, [src, len, dest]);
                    this._adjustSubsequent(ii + 1);
                }
                return;
            } else if ((src >= this.intervals[ii][this.SRC]) &&
                       (src < this._intervalSrcEnd(ii))) {
                // New source value falls in this interval
                var existing = this.intervals[ii];
                var offset = src - existing[this.SRC];
                if (dest == (existing[this.DEST] + offset)) {
                    // New source/dest are consistent with existing; so can extend this interval.
                    var endpoint = src + len;
                    if (endpoint > this._intervalSrcEnd(ii)) {
                        existing[this.LEN] = (endpoint - existing[this.SRC]);
                        this._adjustSubsequent(ii);
                    }
                } else {
                    // Need to split the existing interval into before and after chunks (both of which may be empty).
                    // Before is [ii_src, src-1) -> [ii_dest, ii_dest+(src-1-ii_src))
                    var before = [existing[this.SRC], (src - 1 - existing[this.SRC]), existing[this.DEST]];
                    // Middle is [src, src+len) -> [dest, dest+len)
                    var middle = [src, len, dest];
                    // After is  [src+len, src+ii_len) -> [ii_dest + (src+len-ii_src), ii_dest + +ii_len + (src-ii_src))
                    var after = [src + len, (existing[this.LEN] - len), existing[this.DEST] + src + len - existing[this.SRC]];
                    // Remove the existing interval.
                    this.intervals.splice(ii, 1);
                    // Insert the three new intervals (skipping any that are empty).
                    var inserted = 0;
                    if (after[this.LEN] > 0) {
                        this.intervals.splice(ii, 0, after);
                        inserted++;
                    }
                    this.intervals.splice(ii, 0, middle);
                    inserted++;
                    if (before[this.LEN] > 0) {
                        this.intervals.splice(ii, 0, before);
                        inserted++;
                    }
                    // If there was no after interval, need to adjust subsequent intervals.
                    if (after[this.LEN] <= 0) {
                        this._adjustSubsequent(ii + inserted - 1);
                    }
                }
                return;
            } else if (src > this._intervalSrcEnd(ii)) {
                // New source is strictly after this interval.  Add a new interval and adjust.
                this.intervals.splice(ii + 1, 0, [src, len, dest]);
                this._adjustSubsequent(ii + 1);
                return;
            }
        }
        // No interval found to append to, so insert at the start.
        this.intervals.splice(0, 0, [src, len, dest]);
        this._adjustSubsequent(0);
    }
}

LocationMap.prototype._adjustSubsequent = function(idx) {
    // Interval [idx] is now definitive; subsequent intervals need adjustment
    // to be consistent with it.
    var jj = idx + 1;
    var endpoint = this._intervalSrcEnd(idx);
    while (jj < this.intervals.length) {
        if (this.intervals[jj][this.SRC] > endpoint) {
            // This subsequent interval is non-overlapping; as all subsequent
            // intervals have higher source, we're done.
            return;
        } else if (endpoint >= this._intervalSrcEnd(jj)) {
            // This subsequent interval is completely consumed, remove it.
            this.intervals.splice(jj, 1);
        } else {
            // This subsequent interval is partly consumed, adjust it
            var offset = (endpoint - this.intervals[jj][this.SRC]);
            this.intervals[jj][this.SRC] = endpoint;
            this.intervals[jj][this.LEN] -= offset;
            this.intervals[jj][this.DEST] += offset;
            return;
        }
    }
}

// Add the contents of another location map to this, allowing for both
// src and dest offsets
LocationMap.prototype.mergeLocationMap = function(other, src_offset, dst_offset) {
    var ii;
    for (ii = 0; ii < other.intervals.length; ii++) {
        this.addRange(other.intervals[ii][this.SRC] + src_offset,
                      other.intervals[ii][this.LEN],
                      other.intervals[ii][this.DEST] + dst_offset);
    }
}

// Compose with another location map
LocationMap.prototype.compose = function(other) {
    var orig_intervals = this.intervals;
    this.intervals = [];
    // Inefficient version.
    var ii;
    for (ii = 0;  ii < orig_intervals.length; ii++) {
        var interval = orig_intervals[ii]
        var jj;
        for (jj = 0; jj < interval[this.LEN]; jj++) {
            var src = interval[this.SRC] + jj;
            var middle = interval[this.DEST] + jj;
            var dest = other.find(middle);
            if (dest != -1) {
                this.add(src, dest);
            }
        }
    }
}

// Find the output position that src maps to.
LocationMap.prototype.find = function(src) {
    var ii;
    for (ii = 0; ii < this.intervals.length; ii++) {
        if ((src >= this.intervals[ii][this.SRC]) &&
            (src < this._intervalSrcEnd(ii))) {
            // src is in this interval
            var offset = src - this.intervals[ii][this.SRC];
            return this.intervals[ii][this.DEST] + offset;
        }
    }
    return -1;
}

LocationMap.prototype.findNext = function(src) {
    if (src >= this._intervalSrcEnd(-1)) {
        return -1;
    }
    var dest = -1;
    var ii;
    for (ii = 0; ii < this.intervals.length; ii++) {
        if ((src >= this.intervals[ii][this.SRC]) &&
            (src < this._intervalSrcEnd(ii))) {
            // src is in this interval
            var offset = src - this.intervals[ii][this.SRC];
            return this.intervals[ii][this.DEST] + offset;
        } else if ((dest == -1) && (src < this.intervals[ii][this.SRC])) {
            // src is before this interval, so it's a candidate for next value.
            dest = this.intervals[ii][this.DEST];
        }
    }
    return dest;
}

// Indexes into intervals.
LocationMap.prototype.SRC = 0;
LocationMap.prototype.LEN = 1;
LocationMap.prototype.DEST = 2;

// For interval [idx] mapping [src, src+len) -> [dest, dest+len)
// return src+len.  Allow for negative idx values.
LocationMap.prototype._intervalSrcEnd = function(idx) {
    var interval;
    if (idx < 0) {
        interval = this.intervals[this.intervals.length + idx];
    } else {
        interval = this.intervals[idx];
    }
    return interval[this.SRC] + interval[this.LEN];
}

// For interval [idx] mapping [src, src+len) -> [dest, dest+len)
// return dest+len.  Allow for negative idx values.
LocationMap.prototype._intervalDestEnd = function(idx) {
    var interval;
    if (idx < 0) {
        interval = this.intervals[this.intervals.length + idx];
    } else {
        interval = this.intervals[idx];
    }
    return interval[this.DEST] + interval[this.LEN];
}

