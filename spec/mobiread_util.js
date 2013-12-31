var loadFileUrl = function (url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);  // synchronous
    // retrieve data unprocessed as a binary string
    xhr.overrideMimeType("text\/plain; charset=x-user-defined");
    xhr.send(null);

    if (xhr.status === 200) {
        var bytes = [];
        for (var ii=0; ii<xhr.response.length; ii++) {
            bytes.push(xhr.responseText.charCodeAt(ii) & 0xFF);
        }
        return bytes;
    } else {
        throw new Error("File not found");
    }
}

var addResult = function(htmlData) {
    var container = document.getElementById('htmlresults');
    if (container === null) {
        container = document.createElement('div');
        container.setAttribute('id', 'htmlresults');
        document.body.appendChild(container);
    }
    var result = document.createElement('div');
    result.setAttribute('class', 'htmlresult');
    result.innerHTML = htmlData;
    container.appendChild(document.createElement('hr'));
    container.appendChild(result);
}

var addRawResult = function(htmlData) {
    var container = document.getElementById('rawresults');
    if (container === null) {
        container = document.createElement('div');
        container.setAttribute('id', 'rawresults');
        document.body.appendChild(container);
    }
    var result = document.createElement('div');
    result.setAttribute('class', 'rawresult');
    result.textContent = htmlData;
    container.appendChild(document.createElement('hr'));
    container.appendChild(result);
}
