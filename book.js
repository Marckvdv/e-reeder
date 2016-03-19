"use strict";

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
		var pageData = JSON.parse(pageDataJSON);
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

function getAllElementsWithAttribute(node, attribute) {
	return [].slice.call(node.getElementsByTagName("*")).filter(function(v) {
		return v.getAttribute(attribute) !== null;
	});
}

function findItemURL(href) {
	var items = session.currentBook.items;
	return Object.keys(items)
		.map(function (v) { return items[v]; })
		.find(function (v) { return v.href === href; });
}

function replaceRelativeURLs(page) {
	var hrefs = getAllElementsWithAttribute(page.contentDocument, "href");
	for(var j = 0; j < hrefs.length; ++j) {
		var href = hrefs[j].getAttribute("href");
		var item = findItemURL(href);
		if(item) {
			hrefs[j].setAttribute("href", item.url);
		}
	}

	var srcs = getAllElementsWithAttribute(page.contentDocument, "src");
	for(var j = 0; j < srcs.length; ++j) {
		var src = srcs[j].getAttribute("src");
		var item = findItemURL(src);

		if(item) {
			srcs[j].setAttribute("src", item.url);
		}
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
			var epub = new JSZip(e.target.result);
			var contentPath = getContentPath(epub);
			var book = parseContent(epub, contentPath);
			session.currentBook = book;

			window.onbeforeunload = function(e) {
				storePage(session.currentBook.identifier);
			};

			addPages(book, session.pages);
			restorePage(book.identifier);

			session.reader.hidden = false;
		};
		fileReader.readAsBinaryString(file);
	} else {
		alert("Please select a file first!");
	}
}

function addPages(book, node) {
	session.pages.hidden = false;
	for(var i = 0; i < book.order.length; ++i) {
		var id = book.order[i];
		var item = book.items[id];

		var div = document.createElement("div");
		div.setAttribute("id", "page" + i);
		div.hidden = true;

		var iframe = document.createElement("iframe");
		iframe.setAttribute("class", "item");
		iframe.setAttribute("src", item.url);
		iframe.onload = function() {
			replaceRelativeURLs(this);
		};

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

		var file = epub.folder(contentPath).file(href);
		if(file) {
			var blob = new Blob([file.asArrayBuffer()]);
			items[id] = {
				href: href,
				url: URL.createObjectURL(blob)
			};
		}
	}

	var itemRefTags = xml.getElementsByTagName("itemref");
	var order = [];
	for(var i = 0; i < itemRefTags.length; ++i) {
		var id = itemRefTags[i].getAttribute("idref");
		if(items[id]) {
			order.push(id);
		}
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
