var session = {
	reader: document.getElementById("reader"),
	input: document.getElementById("ebookfile"),
	menu: document.getElementById("menu"),
	bookStyle: document.getElementById("bookstyle"),

	currentBook: {}
};

function restoreScrollPosition(identifier) {
	var scrollDataJSON = localStorage.getItem("scrollData");
	if(scrollDataJSON) {
		scrollData = JSON.parse(scrollDataJSON);
		document.body.scrollTo(0, scrollData[identifier]);
	}
}

function addStyleSheets(epub, content) {
	var links = [].slice.call(session.reader.getElementsByTagName("link"));
	var styleSheets = links.filter( function(link) {
		return link.getAttribute("rel") === "stylesheet" && link.getAttribute("type") === "text/css";
	});

	var uniqueStyleSheets = {};
	for(var i = 0; i < styleSheets.length; ++i) {
		var href = styleSheets[i].getAttribute("href");
		var path = content.path + "/" + href;
		uniqueStyleSheets[href] = path;
	}

	for(var i = 0; i < styleSheets.length; ++i) {
		var file = epub.file(uniqueStyleSheets[styleSheets[i].getAttribute("href")]);
		var data = file.asArrayBuffer();
		var blob = new Blob([data]);
		styleSheets[i].setAttribute("href", URL.createObjectURL(blob));
	}
}

function storeScrollPosition(identifier) {
	var scrollDataJSON = localStorage.getItem("scrollData");
	var scrollData = {};

	if(scrollDataJSON) {
		scrollData = JSON.parse(scrollDataJSON);
		scrollData[identifier] = document.body.scrollTop;
	}
	localStorage.setItem("scrollData", JSON.stringify(scrollData));
}

function runReader() {
	session.menu.style.display = "none";

	var file = session.input.files[0];
	if(file) {
		var fileReader = new FileReader();
		fileReader.onload = function(e) {
			var content = e.target.result;
			var epub = new JSZip(content);
			var contentPath = getContentPath(epub);
			var content = parseContent(epub, contentPath);

			session.currentBook = content;
			window.onbeforeunload = function(e) {
				storeScrollPosition(session.currentBook.identifier);
			};

			addPages(epub, content, session.reader);
			addStyleSheets(epub, content);
			restoreScrollPosition(content.identifier);
			console.log(content);
		};
		fileReader.readAsBinaryString(file);

		return content;
	} else {
		alert("Please select a file first!");
	}
}

function addPages(epub, content, node) {
	session.reader.setAttribute("class", "");
	for(var i = 0; i < content.order.length; ++i) {
		var id = content.order[i];
		var item = content.items[id];

		var html = document.createElement("iframe");
		if(i != content.currentPage) html.setAttribute("class", "item hidden");
		else html.setAttribute("class", "item");
		html.setAttribute("src", item.url);
		node.appendChild(html);
	}
}

function getContentPath(epub) {
	var containerFile = epub.file("META-INF/container.xml");
	var containerXML = new DOMParser().parseFromString(containerFile.asText(), "text/xml");
	var contentPath = containerXML.getElementsByTagName("rootfile")[0].getAttribute("full-path");

	return contentPath;
}

function parseContent(epub, path) {
	var contentPath = path.substr(0, path.lastIndexOf('/'));
	var file = epub.file(path);
	var fileContent = file.asText();
	var xml = new DOMParser().parseFromString(fileContent, "text/xml");

	var itemTags = xml.getElementsByTagName("item");
	var items = {};
	for(var i = 0; i < itemTags.length; ++i) {
		var id = itemTags[i].getAttribute("id");
		var href = itemTags[i].getAttribute("href");

		var blob = new Blob([epub.folder(contentPath).file(href).asArrayBuffer()]);
		items[id] = {
			href: href,
			url: URL.createObjectURL(blob)
		};
	}

	var itemRefTags = xml.getElementsByTagName("itemref");
	var order = [];
	for(var i = 0; i < itemRefTags.length; ++i) {
		order.push(itemRefTags[i].getAttribute("idref"));
	}

	return {
		author: xml.getElementsByTagName("dc:creator")[0].innerHTML,
		title: xml.getElementsByTagName("dc:title")[0].innerHTML,
		date: xml.getElementsByTagName("dc:date")[0].innerHTML,
		identifier: xml.getElementsByTagName("dc:identifier")[0].innerHTML,
		path: contentPath,

		items: items,
		order: order,
		currentPage: 0
	};
}

function nextPage() {
}
