
// Require BufferPack
// Require LocationMap
var MobiBook = function(data) {
    if (!(this instanceof MobiBook)) {
        return new MobiBook(data); // protect against calls without new
    }
    this.data = data;
    this.images = [];
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
        if (this.exthHdr.ident != "EXTH") {
            MobiBook.warn("Unexpected identifier " + this.exthHdr.ident + " in EXTH header");
        } else {
            this.exthHdr.record = [];
            offset = this.pdfHdr.recordInfo[0].offset + 260;
            for (var ii = 0; ii < this.exthHdr.numRecords; ii++) {
                var record = BufferPack.unpack("I(type)I(len)", data, offset);
                record.data = BufferPack.unpack((record.len - 8) + "s", data, offset + 8)[0];
                this.exthHdr.record.push(record);
                offset += record.len;
            }
        }
    }

    // Record0: Then some other stuff

    // INDX???
    // TAGX???

    // Record1..RecordN
    this.barehtml = "";
    var locmap = new LocationMap();
    var in_offset = 0;
    for (var ii = 1; ii <  this.pdfHdr.recordInfo.length; ii++) {
        var info = this.pdfHdr.recordInfo[ii];
        var len = info.recordLen;

        if (ii < (this.pdfHdr.recordInfo.length - 1)) {
            var len_to_next = (this.pdfHdr.recordInfo[ii+1].offset - info.offset);
            if (len_to_next != len) {
                MobiBook.err("Record " + ii + " claims len=" + len + " but next record is " + len_to_next + " away!");
                len = len_to_next;
            }
        }

        if ((ii >= this.mobiHdr.firstContentRecord) &&
            (ii < this.mobiHdr.firstNonBookRecord)) {
            // There is potentially trailing <data><size> at the end of each record, one for each bit in
            // the flags (after the LSB).
            var trailing_data_flags = (this.mobiHdr.extraRecordDataFlags & this.RECORD_TRAILING_DATA_FLAGS) >> 1;
            while (trailing_data_flags != 0) {
                if (trailing_data_flags & 0x0001) {
                    var extraDataLen = MobiBook.readBackwardInteger(data, info.offset, len);
                    if (extraDataLen > 0) {
                        len -= extraDataLen;
                    } else {
                        var debug_data = data.slice(info.offset + len - 6, info.offset + len);
                        MobiBook.err("Unexpected trailing length " + extraDataLen + " in record " + ii);
                    }
                }
                trailing_data_flags = (trailing_data_flags >> 1);
            }

            if (this.mobiHdr.extraRecordDataFlags & this.MULTIBYTE_CHAR_OVERLAP_FLAG) {
                // When this bit is set, the text in the record is followed by a trailing entry containing any extra bytes
                // necessary to complete a multibyte character which crosses the record boundary. The trailing entry ends
                // with a byte containing a count of the overlapping bytes plus additional flags
                var num_mb_bytes = data[info.offset + len - 1] & 0x03;
                len -= (1 + num_mb_bytes);
            }

            if (this.palmDocHdr.compression == this.COMPRESSION.none) {
                locmap.addRange(in_offset, len, this.barehtml.length);
                in_offset += len;
                this.barehtml += String.fromCharCode.apply(data.slice(info.offset, info.offset + len));
            } else if (this.palmDocHdr.compression == this.COMPRESSION.palmDoc) {
                var compmap = new LocationMap();
                var result = MobiBook.palmDocUncompress(data, info.offset, info.offset + len, compmap);

                var in_len = compmap.max() + 1;
                // The LocationMap returned from uncompress describes the mapping from [0, in_len)
                // to [0, out_len).  Add this into our master LocationMap at the relevant offsets.
                locmap.mergeLocationMap(compmap, in_offset, this.barehtml.length);
                in_offset += in_len;
                this.barehtml += result;
            } else if (this.palmDocHdr.compression == this.COMPRESSION.huffCdic) {
                locmap.addRange(in_offset, len, this.barehtml.length);
                in_offset += len;
                // @@@ update locmap
                this.barehtml += MobiBook.huffCdicUncompress(data, info.offset, info.offset + len);
            } else {
                throw Error("Unknown compression " + this.palmDocHdr.compression);
            }
            if (this.mobiHdr.extraRecordDataFlags & this.MULTIBYTE_CHAR_OVERLAP_FLAG) {
                // completion of multibyte characters included in this record's trailing [<data><size>], and is also
                // included at the start of the next record
            }
        } else if ((ii >= this.mobiHdr.firstImageRecord) &&
                   (ii < this.mobiHdr.lastContentRecord)) {
            var image = new Uint8Array(len);
            var jj;
            for (jj = 0; jj < len; jj++) {
                image[jj] = data[info.offset + jj];
            }
            this.images.push(image);
        }
    }
    this.html = this.barehtml;

    // Find all '<a filepos=\d+>' links
    var re_link = /<a +filepos="?(\d+)"? *>/ig;
    var dests = [];
    var found;
    while (found = re_link.exec(this.barehtml)) {
        dests.push(parseInt(found[1], 10));
    }
    // Sort descending so later insertions don't move earlier insertion points.
    dests.sort(function(a, b) { return b-a; });
    var prevpos = -1;
    for (ii = 0; ii< dests.length; ii++) {
        // Insert '<a name="offsetNNNN"/>' at offset NNNN=dests[ii]
        var pos = dests[ii];
        if (pos == prevpos) {  // Only insert once per offset
            continue;
        }
        prevpos = pos;
        // Translate the offset to be relative to the barehtml.
        var xpos = locmap.findNext(pos);

        var insert = '<a name="offset' + pos + '"/>';
        // Don't want to insert inside a tag.  Hunt backwards for < or >
        var at = xpos - 1;
        while (at >= 0) {
            var c = this.html[at];
            if (c == '<' || c == '>') {
                break;
            }
            at--;
        }
        if (this.html[at] == '<') {
            xpos = at;
        }
        var before = this.html.slice(0, xpos);
        var after = this.html.slice(xpos);
        this.html = [before, insert, after].join('');
    }
    // Replace <a filepos=NNN> links with <a href="#offsetNNN> links
    for (ii = 0; ii< dests.length; ii++) {
        var pos = dests[ii];
        var re_ref = new RegExp('<a +filepos="?0*' + pos + '"?', "ig");
        this.html = this.html.replace(re_ref, '<a href="#offset' + pos + '"');
    }

    // Insert images, replacing 'recindex="00001" with numbering starting at 1.
    for (ii = 0; ii < this.images.length; ii++) {
        var re_img = new RegExp('recindex="0*' + (ii+1) + '"', "i");
        this.html = this.html.replace(re_img, "src='data:image/png;base64," + MobiBook.base64Encode(this.images[ii]) + "'");
    }
};

// If strict is set to true, recoverable decoding errors will generate exceptions.
MobiBook.strict = false;
MobiBook.debug = true;

MobiBook.err = function(msg) {
    if (MobiBook.strict) {
        throw Error(msg);
    } else {
        console.log("Error: " + msg);
    }
}
MobiBook.warn = function(msg) {
    if (MobiBook.debug) {
        console.log("Warning: " + msg);
    }
}

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

// Read a variable width backward-encoded integer ending at data[offset + len -1]
MobiBook.readBackwardInteger = function(data, offset, len) {
    // @@@ need to return consumed count or new offset value as well as the value
    var value = 0;
    var where = offset + len - 1;
    var ii = 0;
    while (where >= offset) {
        value = ((data[where] & 0x7F) << (7*ii)) | value;
        if ((data[where] & 0x80) !== 0) {
            return value;
        }
        where--;
        ii++;
    }
    MobiBook.warn("readBackwardInteger from [offset=" + offset + ", +len= " + len + ") returns 0 due to overrun");
    return 0;
}


MobiBook.base64Encode = function(bytestr) {
    var BASE64_KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var c1, c2, c3, e1, e2, e3, e4;
    var ii = 0;
    while (ii < bytestr.length) {
        if ((ii + 2) < bytestr.length) {
            c1 = bytestr[ii];
            c2 = bytestr[ii+1];
            c3 = bytestr[ii+2];
            ii += 3;

            e1 = c1 >> 2;
            e2 = ((c1 & 3) << 4) | (c2 >> 4);
            e3 = ((c2 & 15) << 2) | (c3 >> 6);
            e4 = c3 & 63;
        } else if ((ii + 1) < bytestr.length) {
            c1 = bytestr[ii];
            c2 = bytestr[ii+1];
            c3 = 0;
            ii += 2;

            e1 = c1 >> 2;
            e2 = ((c1 & 3) << 4) | (c2 >> 4);
            e3 = ((c2 & 15) << 2) | (c3 >> 6);
            e4 = 64;
        } else {
            c1 = bytestr[ii];
            c2 = 0;
            c3 = 0;
            ii += 1;

            e1 = c1 >> 2;
            e2 = ((c1 & 3) << 4) | (c2 >> 4);
            e3 = 64;
            e4 = 64;
        }

        output += (BASE64_KEY.charAt(e1) + BASE64_KEY.charAt(e2) +
                   BASE64_KEY.charAt(e3) + BASE64_KEY.charAt(e4));
    }
    return output;
}

MobiBook.huffCdicUncompress = function(data, offset, boundary) {
    MobiBook.err("huffCdic unsupported");
};

MobiBook.palmDocUncompress = function(data, offset, boundary, locmap) {
    var ii;
    var start_offset = offset;
    var result = [];
    var ASCII_SPACE = 0x20;
    while (offset < boundary) {
        if (data[offset] === 0) {
            // 1 literal
            result.push(0);
            offset++;
        } else if (data[offset] >= 0x01 && data[offset] <= 0x08) {
            // literals: copy 1-8 following bytes to output
            var len = data[offset];
            offset++;
            for (ii = 0; ii < len; ii++) {
                result.push(data[offset + ii]);
            }
            offset += len;
        } else if (data[offset] >= 0x09 && data[offset] < 0x20) {
            // 1 literal (control character)
            result.push(data[offset]);
            offset++;
        } else if (data[offset] >= 0x20 && data[offset] < 0x7f) {
            // 1 literal (printable ASCII character)
            result.push(data[offset]);
            offset++;
        } else if (data[offset] == 0x7f) {
            // 1 literal (DEL control character)
            result.push(data[offset]);
            offset++;
        } else if (data[offset] >= 0x80 && data[offset] < 0xc0) {
            if (offset + 1 >= boundary) {
                MobiBook.err("Unexpected trailing length " + extraDataLen + " in record " + ii);
                offset++;
                continue;
            }
            // length, distance pair: copy 3-10 bytes from earlier location
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
            // byte pair: this byte becomes (space, byte XOR 0x80)
            result.push(ASCII_SPACE);
            if ((data[offset] ^ 0x80) < 0x20 || (data[offset] ^ 0x80) >= 0x7f) {
                // non-ascii value
                MobiBook.err("Non-ASCII value at " + offset);
            }
            result.push(data[offset] ^ 0x80);
            offset++;
        }
    }
    // The result array still potentially contains UTF-8 encodings.  Decode first.
    // Use a LocationMap to track the changes in offset -- all of the offset values
    // are relative to the data before UTF-8 decoding.
    result = MobiBook.utf8Decode(result, 0, result.length, locmap);
    return String.fromCharCode.apply(String, result);
}

MobiBook.utf8Decode = function(data, offset, len, locmap) {
    var result = [];
    var ii = 0;
    var value;
    while (ii < len) {
        var c1 = data[offset + ii];
        if (c1 <= 0x7f) {  // 0b0xxxxxxx
            value = c1;
            locmap.add(offset+ii, result.length);
            result.push(value);
            ii++;
        } else if (c1 <= 0xbf) { // 0x10xxxxxx error as first byte
            MobiBook.err("Invalid first UTF-8 byte " + c1 + " at " + (offset+ii));
            ii++;
        } else if (c1 <= 0xdf) { // 0b110xxxxx 0b10xxxxxx
            if ((ii + 1) >= len) {
                MobiBook.err("Invalid first UTF-8 byte " + c1 + " at " + (offset+ii) + " - not enough data");
            } else {
                value = (((c1 & 0x1f) << 6) +
                         (data[offset + ii + 1] & 0x3f));
                locmap.add(offset+ii, result.length);
                result.push(value);
            }
            ii += 2;
        } else if (c1 <= 0xef) { // 0b1110xxxx 0b10xxxxxx 0b10xxxxxx
            if ((ii + 2) >= len) {
                MobiBook.err("Invalid first UTF-8 byte " + c1 + " at " + (offset+ii) + " - not enough data");
            } else {
                value = (((c1 & 0x0f) << 12) +
                         ((data[offset + ii + 1] & 0x3f) << 6) +
                         (data[offset + ii + 2] & 0x3f));
                locmap.add(offset+ii, result.length);
                result.push(value);
            }
            ii += 3;
        } else if (c1 <= 0xf7) { // 0b11110xxx 0b10xxxxxx 0b10xxxxxx 0b10xxxxxx
            if ((ii + 3) >= len) {
                MobiBook.err("Invalid first UTF-8 byte " + c1 + " at " + (offset+ii) + " - not enough data");
            } else {
                value = (((c1 & 0x0f) << 18) +
                         ((data[offset + ii + 1] & 0x3f) << 12) +
                         ((data[offset + ii + 2] & 0x3f) << 6) +
                         (data[offset + ii + 3] & 0x3f));
                locmap.add(offset+ii, result.length);
                result.push(value);
            }
            ii += 4;
        } else if (c1 <= 0xfb) { // 0b111110xx 0b10xxxxxx 0b10xxxxxx 0b10xxxxxx 0b10xxxxxx
            if ((ii + 4) >= len) {
                MobiBook.err("Invalid first UTF-8 byte " + c1 + " at " + (offset+ii) + " - not enough data");
            } else {
                value = (((c1 & 0x0f) << 24) +
                         ((data[offset + ii + 1] & 0x3f) << 18) +
                         ((data[offset + ii + 2] & 0x3f) << 12) +
                         ((data[offset + ii + 3] & 0x3f) << 6) +
                         (data[offset + ii + 4] & 0x3f));
                locmap.add(offset+ii, result.length);
                result.push(value);
            }
            ii += 5;
        } else if (c1 <= 0xfd) { // 0b1111110x 0b10xxxxxx 0b10xxxxxx 0b10xxxxxx 0b10xxxxxx 0b10xxxxxx
            if ((ii + 5) >= len) {
                MobiBook.err("Invalid first UTF-8 byte " + c1 + " at " + (offset+ii) + " - not enough data");
            } else {
                value = (((c1 & 0x0f) << 30) +
                         ((data[offset + ii + 1] & 0x3f) << 24) +
                         ((data[offset + ii + 2] & 0x3f) << 18) +
                         ((data[offset + ii + 3] & 0x3f) << 12) +
                         ((data[offset + ii + 4] & 0x3f) << 6) +
                         (data[offset + ii + 5] & 0x3f));
                locmap.add(offset+ii, result.length);
                result.push(value);
            }
            ii += 6;
        }
    }
    return result;
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
MobiBook.prototype.RECORD_TRAILING_DATA_FLAGS = 0x0007;
MobiBook.prototype.MULTIBYTE_CHAR_OVERLAP_FLAG = 0x0001;
MobiBook.prototype.HUFF_PROLOG = [0x48, 0x55, 0x46, 0x46, 0x00, 0x00, 0x00, 0x18];  // 'HUFF\0\0\0\x18'
MobiBook.prototype.CDIC_PROLOG = [0x43, 0x44, 0x49, 0x43, 0x00, 0x00, 0x00, 0x10];  // 'CDIC\0\0\0\x10'
