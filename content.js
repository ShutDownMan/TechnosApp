console.log("content script started...");

(function () {
	/// Adiciona shortcut para pular bloco
	let shortcutListener = `
	document.onkeypress = function (e) {
		e = e || window.event;
		if(e.key === '|') {
			try {
				nextSlide();
			} catch (error) {
				console.log(error);
			}
		}
	}
`
	var scriptTag = document.createElement('script');
	var code = document.createTextNode(shortcutListener);
	scriptTag.appendChild(code);
	(document.body || document.head).appendChild(scriptTag);

}());