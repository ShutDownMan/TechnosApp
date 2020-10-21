console.log("content script started...");

const ipcRenderer = require('electron').ipcRenderer;
const { ipcMain } = require('electron/main');
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
		blocosDict[$(this).attr("filme").toUpperCase()] = $(this).attr("id");
//		console.log("blocosDict[" + $(this).attr("filme") + "] = " + $(this).attr("id"));

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
		console.log("fileId = ", fileId);

		/// se id do bloco for maior que id atual
		if (fileId !== undefined && Number(fileId) > Number(currentBlocoId)) {
			/// seta o id atual para id do arquivo
			currentBlocoId = Number(fileId);

			/// atualiza nos logs
			if (currentUser !== undefined) {
				currentUser.b = String(currentBlocoId);

				ipcRenderer.send('set-current-user', currentUser);
			}
		}

		console.log("Bloco atual = " + currentBlocoId);
	});
}

function getUserInfo() {
	console.log("Getting user info");
	ipcRenderer.send('startup-get-user');
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

	console.log("pageScript");
	console.log(pageScript);
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
		ipcRenderer.send('set-current-user', currentUser);
	}

	/// passa pelos blocos liberando
	$(dadosAulaXML).find("bloco").each(function (index) {
		//console.log($(this).find("id").text());

		/// se o bloco atual tiver id menor que o bloco do usuario
		if (Number($(this).find("id").text()) < Number(currentBlocoId)) {
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

function fecharApp() {
	ipcRenderer.send('quitApp');
}

function addFecharBtn() {
	let loginBtn = $('.btn.btn-success.btn-login.btn-padrao');
	let divElem = document.createElement('div');
	let fecharBtn = document.createElement('btn');
	var style = document.createElement('style');

	style.setAttribute('type', 'text/css');
	style.innerHTML = '.btn-padrao-fechar {\
		min-width: 150px;\
		padding: 7px 45px;\
		border-radius: 100px;\
		text-transform: uppercase;\
	}\
	.btn-success-fechar {\
		color: #fff;\
		background-color: #f00;\
		border-color: #f00;\
	}';

	(document.body || document.head).appendChild(style);

	divElem.setAttribute('class', 'd-flex justify-content-center');

	fecharBtn.setAttribute('class', 'btn btn-success-fechar btn-login btn-padrao-fechar');
	fecharBtn.innerText  = 'fechar';

	fecharBtn.addEventListener('click', () => {fecharApp();})

	loginBtn.parents()[2].appendChild(divElem);
	divElem.appendChild(fecharBtn);
}

function runUserLoginScript() {

	/// coloca uma funcao no botao de executar atividade
	$(document).on("click", ".atividade-link, .btn-atividade-link", function () {
		console.log("Atividade CLICK.");
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
			b: "0"
		}

		/// avisa background script do usuario
		// chrome.runtime.sendMessage({ messageType: "user_login", currentUser: currentUser },
		//     (r) => { console.log("user_login"); });
		ipcRenderer.send('user-login', currentUser);
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

function setupListenersFrame() {
	console.log("Setting up listener frame");
	ipcRenderer.on('startup-scripts-iframe', (event, data) => {
		console.log('startup-scripts-iframe');
		let user = data.user
		let reloadFix = data.reloadFix;

		if (!reloadFix) {
			location.reload();
		}

		if (user !== undefined) {
			currentUser = user;
			currentBlocoId = Number(user.b);
			console.log(currentUser);

			console.log("getScriptFromPage in Iframe");
			/// pega a função o código da página atual
			getScriptFromPage();

			updateDadosAula();
		}
	});
}

function main() {
	console.log("url of document");
	console.log(location.href);

	console.log("isMainFrame");
	console.log(process.isMainFrame);


	if (!process.isMainFrame && location.href.indexOf("aulainterativa") !== -1) {
		iframeId = require('electron').webFrame.routingId;
		console.log("IframeId = " + iframeId);
		ipcRenderer.send('set-iframe-id');
	}
}
main();

addBlocoIdListener();
setupListenersFrame();

function onPageLoad() {
	setupListenersMain();

	if (location.href.indexOf("evoluaeducacao.com.br/Login") !== -1) {
		addFecharBtn();
	}

	if (location.href.indexOf("evoluaeducacao.com.br/Cursos/") !== -1) {
		runUserLoginScript();
	}

	if (!process.isMainFrame && location.href.indexOf("aulainterativa") !== -1) {

		getUserInfo();
	}
}
window.addEventListener('load', onPageLoad)
// document.onload = onPageLoad;