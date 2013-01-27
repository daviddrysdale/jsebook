
// Require BufferPack
var MobiBook = function(data) {
    this.data = data;
    //  @@ throw if no BufferPack?
    // First thing should be a Palm Database Format header
    var offset = 0;
    this.pdfHdr = BufferPack.unpack("32s(name)H(attribs)H(version)I(created)I(modified)I(backedup)I(modification)I(appInfoOff)I(sortInfoOff)4s(type)4s(creator)I(uniqueId)I(nextRecord)H(numRecords)", data, offset);
    offset += 78;
    this.pdfHdr.recordInfo = [];
    for (var ii = 0; ii < this.pdfHdr.numRecords; ii++) {
        this.pdfHdr.recordInfo.push(BufferPack.unpack("I(offset)B(attribs)B(idHigh)H(idLow)", data, offset));
        offset += 8;
    }

    this.pdfHdr.record = [];
    // Record zero

    for (var ii = 0; ii <  this.pdfHdr.recordInfo.length; ii++) {
        var info = this.pdfHdr.recordInfo[ii];
    }
};

MobiBook.dateConvert = function(timestamp) {
    // Timestamp is relative to an epoch of either 1904-01-01 (as uint32) or 1970-01-01.
    if (timestamp & 0x80000000) {
        return timestamp;  // @@@@
    } else {
        return new Date(timestamp * 1000);
    }
};

MobiBook.prototype.creationDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.created);
};

MobiBook.prototype.modificationDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.modified);
};

MobiBook.prototype.backupDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.backedup);
};
