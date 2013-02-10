
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
    var COMPRESSION = {
        1 : "No compression",
        2 : "PalmDOC compression"
    };
    // Record0: Next is a MOBI header
    if (this.pdfHdr.recordInfo[0].recordLen > 16) {
        this.mobiHdr = BufferPack.unpack("4s(ident)I(hdrLen)I(type)I(encoding)I(uniqueId)I(fileVersion)I(orthoIndex)I(infectionIndex)I(indexNames)I(indexKeys)I(extraIndex0)I(extraIndex1)I(extraIndex2)I(extraIndex3)I(extraIndex4)I(extraIndex5)I(firstNonBookIndex)I(fullNameOffset)I(fullNameLen)I(locale)I(inputLang)I(outputLang)I(minVersion)I(firstImageIndex)I(huffmanRecordOffset)I(huffmanRecordCount)I(huffmanTableOffset)I(huffmanTableLength)I(exthFlags)",
                                         data, this.pdfHdr.recordInfo[0].offset + 16);
        if (this.mobiHdr.ident != "MOBI") throw Error("Unexpected identifier " + this.mobiHdr.ident + " in MOBI header");
        var MOBITYPE = {
            2 : "Mobipocket Book",
            3 : "PalmDoc Book",
            4 : "Audio",
            232 : "Mobipocket generated by kindlegen1.2",
            248 : "KF8: generated by kindlegen2",
            257 : "News",
            258 : "News_Feed",
            259 : "News_Magazine",
            513 : "PICS",
            514 : "WORD",
            515 : "XLS",
            516 : "PPT",
            517 : "TEXT",
            518 : "HTML"
        };
        var ENCODING = {
            1252: "CP1252",
            65001: "UTF-8"
        };
        var LOCALE_LANG = {
            9 : "English"
        }
        var LOCALE_DIALECT = {
            8 : "British",
            4 : "American"
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
    var EXTH_PRESENT_FLAG = 0x40
    if ((this.mobiHdr.exthFlags & EXTH_PRESENT_FLAG) &&
        (this.pdfHdr.recordInfo[0].recordLen > 248)) {
        this.exthHdr = BufferPack.unpack("4s(ident)I(hdrLen)I(numRecords)",
                                         data, this.pdfHdr.recordInfo[0].offset + 248);
        if (this.exthHdr.ident != "EXTH") throw Error("Unexpected identifier " + this.exthHdr.ident + " in EXTH header");
        this.exthHdr.record = [];
        offset = this.pdfHdr.recordInfo[0].offset + 260;
        var EXTH_RECORD_TYPE = {
            1: "drm_server_id",
            2: "drm_commerce_id",
            3: "drm_ebookbase_book_id",
            100: "author",
            101: "publisher",
            102: "imprint",
            103: "description",
            104: "isbn",
            105: "subject",
            106: "publishingdate",
            107: "review",
            108: "contributor",
            109: "rights",
            110: "subjectcode",
            111: "type",
            112: "source",
            113: "asin",
            114: "versionnumber",
            115: "sample",
            116: "startreading",
            117: "adult",
            118: "retail price",
            119: "retail price currency",
            200: "Dictionary short name",
            201: "coveroffset",
            202: "thumboffset",
            203: "hasfakecover",
            204: "Creator Software",
            205: "Creator Major Version",
            206: "Creator Minor Version",
            207: "Creator Build Number",
            208: "watermark",
            209: "tamper proof keys",
            300: "fontsignature",
            401: "clippinglimit",
            402: "publisherlimit",
            403: "Unknown",
            404: "ttsflag",
            405: "Unknown",
            406: "Unknown",
            407: "Unknown",
            450: "Unknown",
            451: "Unknown",
            452: "Unknown",
            453: "Unknown",
            501: "cdetype",
            502: "lastupdatetime",
            503: "updatedtitle",
            504: "asin",
            524: "language"
        };

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
    for (var ii = 1; ii <  this.pdfHdr.recordInfo.length; ii++) {
        var info = this.pdfHdr.recordInfo[ii];
        if (ii >= 1) {
            var text = MobiBook.palmDocUncompress(data, info.offset, info.offset + info.recordLen);
            console.log(text);
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

MobiBook.readInteger = function(data, offset, forward) {
    forward = typeof forward === "undefined" ? true : !!forward;
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
                console.log("*************************** dist_len=" + toHex(dist_len) + " : dist=" + dist + " len=" + len + " currentlength=" + result.length);
                // @@@ throw Error("Compression offset before start of data");
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

// @@@ temporary for debugging:
function toHex(number) {
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
