console.log("content script started...");

function initShortcutListener() {
	console.log("setting up shortcutListener");

	/// Adiciona shortcut para pular bloco
	let shortcutListener = `
	var forceNextPressCount = 0;
document.onkeyup = function (e) {
	e = e || window.event;
	if(e.key === '|') {
		// console.log("pressed");
		forceNextPressCount++;
	}
}

document.onkeypress = function (e) {
	e = e || window.event;
	if(e.key === ' ') {
		try {
			let nextbtn_1 = document.querySelector('.btn-avanca-momento');
			let nextbtn_2 = document.querySelector('.actions_btn_next');
			if(nextbtn_1 && !nextbtn_1.classList.contains('disabledbutton')) {
				try {proximoMomento()} catch(e) {}
				console.log('(1) next slide!')
			}
			if(nextbtn_2 && !nextbtn_2.hasAttribute('disabled')) {
				try {nextSlide()} catch(e) {}
				console.log('(2) next slide!')
			}
		} catch (error) {
			console.log(error);
		}
	}
	if(e.key === '|' && forceNextPressCount >= 9) {
		forceNextPressCount = 0;

		try {
			document.querySelectorAll(".btn-controle .btn-avanca-momento").forEach(function (elem) {elem.classList.remove('disabledbutton')});
			document.querySelectorAll(".actions_btn_next").forEach(function (elem) {elem.removeAttribute('disabled')});
		} catch (error) {
			console.log(error);
		}
	}
}
	`

	var scriptTag = document.createElement('script');
	var code = document.createTextNode(shortcutListener);
	scriptTag.appendChild(code);
	document.body.appendChild(scriptTag);
}


if (!process.isMainFrame) {
	window.onload = function() {initShortcutListener()};
}
