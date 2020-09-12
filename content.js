console.log("content script started...");

const ipcRenderer = require('electron').ipcRenderer;
const process = require('process');

var currentUser = undefined;
var currentBlocoId = -1;
var blocosDict = [];

var currentTags = undefined;
var pageScript = undefined;
var currentAulaXML = undefined;

function getLegs(localLegenda) {

	//console.log(localLegenda)

	return $.ajax({
		type: "GET",
		dataType: "text",
		url: localLegenda,
		success: function (resposta) {
			populateCurrentAulaXML(resposta);
			populateBlocosDict();
		},
		fail: function (resposta) {
			console.log(resposta);
		}
	});
}

function populateCurrentAulaXML(xml) {
	if (currentAulaXML !== undefined) {
		console.log("ERROR: currentAulaXML is already populated!")
		return;
	}

	/// remove comentarios que causam conflitos
	xml = xml.replace("<!--");
	xml.split('\n').filter(function (s) { return (s.match('<!-')) ? "" : s });

	/// paseia a string para xml
	currentAulaXML = $.parseXML(xml);
}

function populateBlocosDict() {
	if (currentAulaXML === undefined) {
		console.log("ERROR: currentAulaXML is NOT populated!");
		return;
	}

	/// passa pelo arquivo xml e cria um dicionario com os nomes de aquivos/ids
	$(currentAulaXML).find("bloco").each(function (index) {
		blocosDict[$(this).attr("filme")] = $(this).attr("id");

		isFinalBloco($(this), $(this).attr("id"));
	});
}

function isFinalBloco(xmlTag, id) {
	/// para cada conteudo no bloco testa se eh final
	$(xmlTag).find("conteudo").each(function (index) {
		if ($(this).text() === ".") {
			finalBlocoId = id;
			//console.log("finalBlocoId = " + finalBlocoId);
		}
	});
}

function addBlocoIdListener() {
	console.log("Setting up bloco id listener");
	// renderer process
	ipcRenderer.on('bloco-id-update', (event, store) => {
		console.log('bloco-id-update');
		console.log(store);

		/// pega id do bloco a partir do nome
		let fileId = blocosDict[store];

		/// se id do bloco for maior que id atual
		if (fileId > currentBlocoId) {
			/// seta o id atual para id do arquivo
			currentBlocoId = fileId;

			/// atualiza nos logs
			if (currentUser !== undefined) {
				currentUser.b = String(currentBlocoId);

				ipcRenderer.send('set-current-user', currentUser);
			}
		}

	});
}

function changeLogo() {
	/// url to logo image
	let logoUrl = chrome.extension.getURL("/resources/images/technos_logo.png");

	/// get page image elements to be replaces
	loginImgElems = document.getElementsByClassName("logo-login");
	logoNavImgElems = document.getElementsByClassName("logo-nav");

	/// replace them if found

	if (loginImgElems.length) {
		loginImgElems[0].src = logoUrl;
	}

	if (logoNavImgElems.length) {
		logoNavImgElems[0].src = logoUrl;
	}
}

function runAulaScript() {

	/// chama info do usuario atual (async)
	getUserInfo();


	// wait for currentUser to be defined
	// waitUserData();
}

function getUserInfo() {
	ipcRenderer.send('get-current-user-iframe');

	if (currentUser === undefined) {
		console.log("ERROR: currentUser is undefined!");
	}

	//console.log(currentUser);
}

function getScriptFromPage() {
	currentTags = childrenToArray(document);

	// console.log("currentTags");
	// console.log(currentTags);

	while (currentTags && currentTags.length > 0) {
		// console.log(currentTags)

		currentTags = currentTags.concat(childrenToArray(currentTags[0]));

		let firstTag = currentTags.shift(); // removes and stores first element

		if (firstTag.tagName.toLowerCase() === "script"
			&& firstTag.innerText.indexOf("dadosAulaJS") !== -1) {
			pageScript = firstTag;
		}
	}

	// console.log("pageScript");
	// console.log(pageScript);
}

function childrenToArray(tagElem) {
	let tagArr = [];

	if (!tagElem) return tagArr;

	Array.from(tagElem.children).forEach(function (element) {
		tagArr.push(element);
	});

	return tagArr;
}

async function updateDadosAula() {

	// separating function and eval on it

	/// seoara a funcao e executa ela
	dadosAulaFuncStr = pageScript.innerText.substr(pageScript.innerText.indexOf("function dadosAulaJS"));
	dadosAulaFuncStr = dadosAulaFuncStr.substr(0, dadosAulaFuncStr.indexOf("}") + 1);

	// console.log("dadosAulaFuncStr: ");
	// console.log(dadosAulaFuncStr);

	eval(dadosAulaFuncStr);

	// Getting XML on it

	/// get xml output from function
	dadosAulaXML = $.parseXML(dadosAulaJS());

	/// url da legenda
	var legs = $(dadosAulaXML).find("localLegenda")

	// getting legendas from resource
	await getLegs(location.href.substring(0, location.href.lastIndexOf('/')) + '/' + legs.text())

	console.log("AulaXML: ")
	console.log(currentAulaXML);

	/// se o bloco atual eh o ultimo bloco
	if (finalBlocoId === currentBlocoId) {
		/// coloca bloco atual como inicio2
		currentBlocoId = 0;
		currentUser.b = String(currentBlocoId);
		/// atualiza nos logs
		chrome.runtime.sendMessage({ messageType: "update_userlogs", currentUser: currentUser },
			(r) => { console.log("update_userlogs"); }
		);
	}

	/// passa pelos blocos liberando
	$(dadosAulaXML).find("bloco").each(function (index) {
		//console.log($(this).find("id").text());

		/// se o bloco atual tiver id menor que o bloco do usuario
		if (Number($(this).find("id").text()) < currentBlocoId) {
			/// libera bloco
			$(this).find("data").text("1");
			$(this).find("hora").text("1");
			$(this).find("nota").text("10");
			$(this).find("status").text("1");
		}
	})

	//console.log(dadosAulaXML);

	var newDadosAulaXML = (new XMLSerializer()).serializeToString(dadosAulaXML);

	//console.log(newDadosAulaXML);

	let newDadosAulaFunc = "function dadosAulaJS() { console.log(\"dadosAulaJS has been injected successfully\"); return \"<new_xml>\"; }";

	newDadosAulaFunc = newDadosAulaFunc.replace("<new_xml>", newDadosAulaXML);

	//console.log(newDadosAulaFunc);

	/// append modified configs script into source
	var scriptTag = document.createElement('script');
	var code = document.createTextNode(newDadosAulaFunc);
	scriptTag.appendChild(code);
	(document.body || document.head).appendChild(scriptTag);
}

function updateFechaModal() {
	let modalBodies = document.getElementsByClassName("modal-fecha-body");

	for (var i = modalBodies.length - 1; i >= 0; i--) {
		modalBodies[i].innerText = "Deseja mesmo sair?\nSeu progresso será salvo, mantenha a extensão ativa.";
	}
}

function runUserLoginScript() {
	/// coloca uma funcao no botao de executar atividade
	$(document).on("click", ".atividade-link, .btn-atividade-link", function () {
		/// pega as inforamoes da aula
		var link = $(this).attr("data-link");

		if (link.length === 0) {
			console.log("ERROR: link string is empty!");
		}

		/// cria objeto com as informacoes do usuario atual
		currentUser = {
			t: localStorage.getItem("id-trilha-atual"),
			c: localStorage.getItem("id-curso-atual"),
			d: localStorage.getItem("id-disciplina-atual"),
			u: link.match(/(?:IdUnidade=)(\d+)/)[1],
			a: link.match(/(?:IdAtividade=)(\d+)/)[1],
			b: "5"
		}

		/// avisa background script do usuario
		// chrome.runtime.sendMessage({ messageType: "user_login", currentUser: currentUser },
		//     (r) => { console.log("user_login"); });
		ipcRenderer.send('set-current-user', currentUser);
	});

	updateFechaModal();
}

function setupListenersMain() {
	ipcRenderer.on('set-current-user', (event, user) => {
		console.log('set-current-user');
		currentUser = user;
		currentBlocoId = Number(user.b);
		console.log(currentUser);
	});
}

function setupListenersFrame(){
	ipcRenderer.on('set-current-user-iframe', (event, user) => {
		console.log('set-current-user-iframe');
		currentUser = user;
		currentBlocoId = Number(user.b);
		console.log(currentUser);

		console.log("getScriptFromPage in Iframe");
		/// pega a função o código da página atual
		getScriptFromPage();

		updateDadosAula();
	});
}

function main() {
	console.log("url of document");
	console.log(location.href);

	console.log("isMainFrame");
	console.log(process.isMainFrame);

	setupListenersMain();

	if (!process.isMainFrame && location.href.indexOf("aulainterativa") !== -1) {
		ipcRenderer.send('set-iframe-id', require('electron').webFrame.routingId);
		addBlocoIdListener();
		setupListenersFrame();
		return;
	}
}
main();

function onPageLoad() {

	if (location.href.indexOf("evoluaeducacao.com.br") !== -1) {
		// changeLogo();
	}

	if (!process.isMainFrame && location.href.indexOf("aulainterativa") !== -1) {
		runAulaScript();
		return;
	}

	if (location.href.indexOf("evoluaeducacao.com.br/Cursos/") !== -1) {
		runUserLoginScript();
		return;
	}
}

window.onload = onPageLoad;