
// Require BufferPack
var MobiBook = function(data) {
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
        this.mobiHdr = BufferPack.unpack("4s(ident)I(hdrLen)I(type)I(encoding)I(uniqueId)I(fileVersion)I(orthoIndex)I(infectionIndex)I(indexNames)I(indexKeys)I(extraIndex0)I(extraIndex1)I(extraIndex2)I(extraIndex3)I(extraIndex4)I(extraIndex5)I(firstNonBookIndex)I(fullNameOffset)I(fullNameLen)I(locale)I(inputLang)I(outputLang)I(minVersion)I(firstImageIndex)I(huffmanRecordOffset)I(huffmanRecordCount)I(huffmanTableOffset)I(huffmanTableLength)I(exthFlags)",
                                         data, this.pdfHdr.recordInfo[0].offset + 16);
    }
    // There may be more MOBI header
    if (this.pdfHdr.recordInfo[0].recordLen > 132) {
        var moreMobiHdr = BufferPack.unpack("32s(unknownA)I(unknownB)I(drmOffset)I(drmCount)I(drmSize)I(drmFlags)8s(unknownC)H(firstContentRecord)H(lastContentRecord)I(unknownD)I(fcisRecordNumber)I(fcisRecordCount)I(flisRecordNumber)I(flisRecordCount)8s(unknownE)I(unknownF)I(firstCompilationDataSectionCount)I(numCompilationDataSections)I(unknownG)I(extraRecordDataFlags)I(indxRecordOffset)",
                                            data, this.pdfHdr.recordInfo[0].offset + 132);
        for (var k in moreMobiHdr) {
            this.mobiHdr[k] = moreMobiHdr[k];
        }
    }

    // Record0: Next is a possible EXTH header
    if ((this.mobiHdr.exthFlags & 0x40) &&
        (this.pdfHdr.recordInfo[0].recordLen > 248)) {
        this.exthHdr = BufferPack.unpack("4s(ident)I(hdrLen)I(numRecords)",
                                         data, this.pdfHdr.recordInfo[0].offset + 248);
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

    for (var ii = 1; ii <  this.pdfHdr.recordInfo.length; ii++) {
        var info = this.pdfHdr.recordInfo[ii];
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

MobiBook.prototype.creationDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.created);
};

MobiBook.prototype.modificationDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.modified);
};

MobiBook.prototype.backupDate = function() {
    return MobiBook.dateConvert(this.pdfHdr.backedup);
};
