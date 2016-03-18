var session = {
	pages: document.getElementById("pages"),
	reader: document.getElementById("reader"),
	input: document.getElementById("ebookfile"),
	menu: document.getElementById("menu"),

	currentBook: {},
};

function restorePage(identifier) {
	var pageDataJSON = localStorage.getItem("pageData");
	if(pageDataJSON) {
		pageData = JSON.parse(pageDataJSON);
		var page = pageData[identifier];
		if(page) {
			gotoPage(page);
		} else {
			gotoPage(0);
		}
	} else {
		gotoPage(0);
	}
}

function gotoPage(page) {
	session.pages.children[session.currentBook.currentPage].hidden = true;
	session.currentBook.currentPage = page;
	session.pages.children[session.currentBook.currentPage].hidden = false;
}

function nextPage() {
	gotoPage(session.currentBook.currentPage + 1);
}

function previousPage() {
	gotoPage(session.currentBook.currentPage - 1);
}

function iframeSetVisibility(iframe, visible) {
	if(visible) {
		iframe.style.display = "block";
	} else {
		iframe.style.display = "none";
	}
}

function addStyleSheets(epub, content) {
	var links = [].slice.call(session.pages.getElementsByTagName("link"));
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

function storePage(identifier) {
	var pageDataJSON = localStorage.getItem("pageData");
	var pageData = {};

	if(pageDataJSON) {
		pageData = JSON.parse(pageDataJSON);
		pageData[identifier] = session.currentBook.currentPage;
	}
	localStorage.setItem("pageData", JSON.stringify(pageData));
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
				storePage(session.currentBook.identifier);
			};

			addPages(epub, content, session.pages);
			session.reader.hidden = false;

			addStyleSheets(epub, content);
			restorePage(content.identifier);
		};
		fileReader.readAsBinaryString(file);

		return content;
	} else {
		alert("Please select a file first!");
	}
}

function addPages(epub, content, node) {
	session.pages.hidden = false;
	for(var i = 0; i < content.order.length; ++i) {
		var id = content.order[i];
		var item = content.items[id];

		var div = document.createElement("div");
		div.setAttribute("id", "page" + i);
		div.hidden = true;

		var iframe = document.createElement("iframe");
		iframe.setAttribute("class", "item");
		iframe.setAttribute("src", item.url);

		div.appendChild(iframe);
		node.appendChild(div);
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
