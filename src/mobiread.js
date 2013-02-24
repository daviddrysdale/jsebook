
// Require BufferPack
var MobiBook = function(data) {
    if (!(this instanceof MobiBook)) {
        return new MobiBook(data); // protect against calls without new
    }
    this.data = data;
    //  @@ throw if no BufferPack?

    // First thing should be a Palm Database Format header
    var offset = 0;
    this.pdfHdr = BufferPack.unpack("32s(name)H(attribs)H(version)I(created)I(modified)I(backedup)I(modification)I(appInfoOff)I(sortInfoOff)4s(type)4s(creator)I(uniqueId)I(nextRecord)H(numRecords)",
                                    data, offset);
    offset += 78;
    this.pdfHdr.recordInfo = [];
    for (var ii = 0; ii < this.pdfHdr.numRecords; ii++) {
        this.pdfHdr.recordInfo.push(BufferPack.unpack("I(offset)B(attribs)B(idHigh)H(idLow)", data, offset));
        offset += 8;
        if (ii > 0) {
            // Assume records are in order
            this.pdfHdr.recordInfo[ii-1].recordLen = (this.pdfHdr.recordInfo[ii].offset - this.pdfHdr.recordInfo[ii-1].offset);
        }
    }
    // Assume last record goes to end of file
    this.pdfHdr.recordInfo[this.pdfHdr.numRecords - 1].recordLen = (data.length - this.pdfHdr.recordInfo[this.pdfHdr.numRecords - 1].offset)

    // Next, app info area if present (unlikely for ebooks)
    // Next, sort info area if present (unlikely for ebooks)
    // N x records
    this.pdfHdr.record = [];

    // Record zero
    // Record0: First is a PalmDoc header
    this.palmDocHdr = BufferPack.unpack("H(compression)H(reserved)I(uncompressedTextLength)H(recordCount)H(maxRecordSize)H(encryption)H(unknown)",
                                        data, this.pdfHdr.recordInfo[0].offset);
    // Record0: Next is a MOBI header
    if (this.pdfHdr.recordInfo[0].recordLen > 16) {
        this.mobiHdr = BufferPack.unpack("4s(ident)I(hdrLen)I(type)I(encoding)I(uniqueId)I(fileVersion)I(orthoIndex)I(infectionIndex)I(indexNames)I(indexKeys)I(extraIndex0)I(extraIndex1)I(extraIndex2)I(extraIndex3)I(extraIndex4)I(extraIndex5)I(firstNonBookRecord)I(fullNameOffset)I(fullNameLen)I(locale)I(inputLang)I(outputLang)I(minVersion)I(firstImageRecord)I(huffmanRecordOffset)I(huffmanRecordCount)I(huffmanTableOffset)I(huffmanTableLength)I(exthFlags)",
                                         data, this.pdfHdr.recordInfo[0].offset + 16);
        if (this.mobiHdr.ident != "MOBI") {
            throw Error("Unexpected identifier " + this.mobiHdr.ident + " in MOBI header");
        }
    }
    // There may be more MOBI header contents
    if (this.pdfHdr.recordInfo[0].recordLen > 132) {
        var moreMobiHdr = BufferPack.unpack("32s(unknownA)I(unknownB)I(drmOffset)I(drmCount)I(drmSize)I(drmFlags)8s(unknownC)H(firstContentRecord)H(lastContentRecord)I(unknownD)I(fcisRecordNumber)I(fcisRecordCount)I(flisRecordNumber)I(flisRecordCount)8s(unknownE)I(unknownF)I(firstCompilationDataSectionCount)I(numCompilationDataSections)I(unknownG)I(extraRecordDataFlags)I(indxRecordOffset)",
                                            data, this.pdfHdr.recordInfo[0].offset + 132);
        for (var k in moreMobiHdr) {
            this.mobiHdr[k] = moreMobiHdr[k];
        }
    }
    var titleOffset = (this.pdfHdr.recordInfo[0].offset + this.mobiHdr.fullNameOffset);
    if ((titleOffset + this.mobiHdr.fullNameLen) <= data.length) {
        this.title = String.fromCharCode.apply(String, data.slice(titleOffset,
                                                                  titleOffset + this.mobiHdr.fullNameLen));
    }

    // Record0: Next is a possible EXTH header
    if ((this.mobiHdr.exthFlags & this.EXTH_PRESENT_FLAG) &&
        (this.pdfHdr.recordInfo[0].recordLen > 248)) {
        this.exthHdr = BufferPack.unpack("4s(ident)I(hdrLen)I(numRecords)",
                                         data, this.pdfHdr.recordInfo[0].offset + 248);
        if (this.exthHdr.ident != "EXTH") throw Error("Unexpected identifier " + this.exthHdr.ident + " in EXTH header");
        this.exthHdr.record = [];
        offset = this.pdfHdr.recordInfo[0].offset + 260;

        for (var ii = 0; ii < this.exthHdr.numRecords; ii++) {
            var record = BufferPack.unpack("I(type)I(len)", data, offset);
            record.data = BufferPack.unpack((record.len - 8) + "s", data, offset + 8)[0];
            this.exthHdr.record.push(record);
            offset += record.len;
        }
    }

    // Record0: Then some other stuff

    // INDX???
    // TAGX???

    // Record1..RecordN
    this.html = "";
    for (var ii = 1; ii <  this.pdfHdr.recordInfo.length; ii++) {
        var info = this.pdfHdr.recordInfo[ii];
        var len = info.recordLen;
        if (this.mobiHdr.extraRecordDataFlags & this.RECORD_TRAILING_DATA_FLAGS) {
            // There is trailing <data><size> at the end of each record
            var extraDataLen = MobiBook.readBackwardInteger(data, info.offset + info.recordLen);
            len -= extraDataLen;
        }
        if ((ii >= this.mobiHdr.firstContentRecord) &&
            (ii < this.mobiHdr.firstNonBookRecord)) {
            if (this.palmDocHdr.compression == this.COMPRESSION.none) {
                this.html += String.fromCharCode.apply(data.slice(info.offset, info.offset + len));
            } else if (this.palmDocHdr.compression == this.COMPRESSION.palmDoc) {
                this.html += MobiBook.palmDocUncompress(data, info.offset, info.offset + len);
            } else if (this.palmDocHdr.compression == this.COMPRESSION.huffCdic) {
                this.html += MobiBook.huffCdicUncompress(data, info.offset, info.offset + len);
            } else {
                throw Error("Unknown compression " + this.palmDocHdr.compression);
            }
            if (this.mobiHdr.extraRecordDataFlags & this.MULTIBYTE_CHAR_OVERLAP_FLAG) {
                // completion of multibyte characters included in this record's trailing [<data><size>], and is also
                // included at the start of the next record
            }
        } else if ((ii >= this.mobiHdr.firstImageRecord) &&
                   (ii < this.mobiHdr.lastContentRecord)) {
            // ????image modiHdr.firstImageRecord mobiHdr.firstContentRecord mobiHdr.lastContentRecord
            console.log("@@@ image in record " + ii);
        }
    }
};

MobiBook.dateConvert = function(timestamp) {
    // Timestamp is relative to an epoch of either 1904-01-01 (as uint32) or 1970-01-01.
    if (timestamp & 0x80000000) {
        return new Date((timestamp-2082844800) * 1000);
    } else {
        return new Date(timestamp * 1000);
    }
};

// Read a variable width forward-encoded integer starting at data[offset]
MobiBook.readInteger = function(data, offset) {
    var value = 0;
    while (true) {
        value = ((value << 7) | (data[offset] & 0x7F));
        if ((data[offset] & 0x80) !== 0) {
            return value;
        }
        offset++;
    }
    // @@@ need to return consumed count or new offset value
}

// Read a variable width backward-encoded integer ending at data[offset-1]
MobiBook.readBackwardInteger = function(data, offset) {
    var value = 0;
    offset--;
    var ii = 0;
    while (true) {
        value = ((data[offset] & 0x7F) << (7*ii)) | value;
        if ((data[offset] & 0x80) !== 0) {
            return value;
        }
        offset--;
        ii++;
    }
    // @@@ need to return consumed count or new offset value
}


MobiBook.huffCdicUncompress = function(data, offset, boundary) {
};

MobiBook.palmDocUncompress = function(data, offset, boundary) {
    var ii;
    var result = [];
    var ASCII_SPACE = 0x20;
    while (offset < boundary) {
        if (data[offset] === 0) {
            result.push(0);
            offset++;
        } else if (data[offset] >= 0x01 && data[offset] <= 0x08) {
            var len = data[offset];
            offset++;
            for (ii = 0; ii < len; ii++) {
                result.push(data[offset + ii]);
            }
            offset += len;
        } else if (data[offset] >= 0x09 && data[offset] <= 0x7f) {
            result.push(data[offset]);
            offset++;
        } else if (data[offset] >= 0x80 && data[offset] <= 0xbf) {
            var dist_len = (((data[offset] & 0x3F) << 8) | data[offset+1]);  // 14 bit distance+length
            var dist = (dist_len >> 3);  // 11 bit offset backwards
            var len = 3 + (dist_len & 0x07);  // 3 bit length
            var dest_offset = result.length - dist;
            if (dest_offset < 0) {
                var details = "dist_len=" + MobiBook.toHex(dist_len) + " : dist=" + dist + " len=" + len + " currentlength=" + result.length;
                throw Error("Compression offset before start of data: " + details);
            } else {
                for (ii = 0; ii < len; ii++) {
                    result.push(result[dest_offset + ii]);
                }
            }
            offset += 2;
        } else {  // data[offset] >= 0xc0
            result.push(ASCII_SPACE);
            result.push(data[offset] ^ 0x80);
            offset++;
        }
    }
    return String.fromCharCode.apply(String, result);
}

// Local utility function for debugging
MobiBook.toHex = function(number) {
    var hexes = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
    var hex = '';
    var nibble;
    do {
        nibble = number & 0x0f;
        number = number >> 4;
        hex = hexes[nibble] + hex;
    } while (number);
    return '0x'+hex;
}

MobiBook.prototype.creationDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.created);
};

MobiBook.prototype.modificationDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.modified);
};

MobiBook.prototype.backupDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.backedup);
};

// File format constants
MobiBook.prototype.COMPRESSION = {
    "none": 1,
    "palmDoc": 2,
    "huffCdic": 17480
};
MobiBook.prototype.ENCRYPTION = {
    "none": 0,
    "mobiPocketOld": 1,
    "mobiPocket": 2
};
MobiBook.prototype.MOBITYPE = {
    "mobipocketBook": 2,
    "palmDocBook": 3,
    "audio": 4,
    "mobipocketKindlegen1.2": 232,
    "kf8Kindlegen2": 248,
    "news": 257,
    "newsFeed": 258,
    "newsMagazine": 259,
    "pics": 513,
    "word": 514,
    "xls": 515,
    "ppt": 516,
    "text": 517,
    "html": 518
};
MobiBook.prototype.ENCODING = {
    "cp1252": 1252,
    "utf8": 65001
};
MobiBook.prototype.LOCALE_LANG = {
    "en": 9
}
MobiBook.prototype.LOCALE_DIALECT = {
    "GB": 8,
    "US": 4
}
MobiBook.prototype.EXTH_PRESENT_FLAG = 0x40;
MobiBook.prototype.EXTH_RECORD_TYPE = {
    "drmServerId": 1,
    "drmCommerceId": 2,
    "drmEbookbaseBookId": 3,
    "author": 100,
    "publisher": 101,
    "imprint": 102,
    "description": 103,
    "isbn": 104,
    "subject": 105,
    "publishingDate": 106,
    "review": 107,
    "contributor": 108,
    "rights": 109,
    "subjectCode": 110,
    "type": 111,
    "source": 112,
    "asin": 113,
    "versionNumber": 114,
    "sample": 115,
    "startReading": 116,
    "adult": 117,
    "retailPrice": 118,
    "retailPriceCurrency": 119,
    "dictionaryShortName": 200,
    "coverOffset": 201,
    "thumbOffset": 202,
    "hasFakeCover": 203,
    "creatorSoftware": 204,
    "creatorMajorVersion": 205,
    "creatorMinorVersion": 206,
    "creatorBuildNumber": 207,
    "watermark": 208,
    "tamperProofKeys": 209,
    "fontSignature": 300,
    "clippingLimit": 401,
    "publisherLimit": 402,
    "unknown403": 403,
    "ttsflag": 404,
    "unknown405": 405,
    "unknown406": 406,
    "unknown407": 407,
    "unknown450": 450,
    "unknown451": 451,
    "unknown452": 452,
    "unknown453": 453,
    "cdeType": 501,
    "lastUpdateTime": 502,
    "updatedTitle": 503,
    "asin": 504,
    "language": 524
};
MobiBook.prototype.RECORD_TRAILING_DATA_FLAGS = 0x07;
MobiBook.prototype.MULTIBYTE_CHAR_OVERLAP_FLAG = 0x01;
MobiBook.prototype.HUFF_PROLOG = [0x48, 0x55, 0x46, 0x46, 0x00, 0x00, 0x00, 0x18];  // 'HUFF\0\0\0\x18'
MobiBook.prototype.CDIC_PROLOG = [0x43, 0x44, 0x49, 0x43, 0x00, 0x00, 0x00, 0x10];  // 'CDIC\0\0\0\x10'
