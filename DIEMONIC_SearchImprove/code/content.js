function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.q = "";

parseUrlParams();

window.q = replaceAll(window.q, "%20", " ");

window.onload = function () {
  parseUrlParams();
}

function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('q') != null && urlParams.get('q') != "null") {
    window.q = urlParams.get('q');
  }
  if (urlParams.get('text') != null && urlParams.get('text') != "null") {
    window.q = urlParams.get('text');
  }

  window.q = replaceAll(window.q, "%20", " ");
}

function openYouTybe() {
  parseUrlParams();
  window.open('https://www.youtube.com/results?search_query=' + window.q);
}

function openchat() {
  parseUrlParams();
  window.open('https://chatgpt.com/?prompt=' + window.q);
}

function opendeep() {
  parseUrlParams();
  window.open('https://chatgpt.com/?prompt=' + window.q);
}

document.body.insertAdjacentHTML('beforebegin', `
  <div 
        id="mBlock"
        style="
            position: fixed;
            left: 0;
            top: 0;
            opacity: 1;
            z-index: 100000000000000000000000000000;
            color: black;
        ">
        <div style="cursor: pointer; height: 10px;" id="move"></div>
        <div style="  
        padding: 4px 9px;
        border-radius: 17px;
        background-color: #222224;
        display: flex;
        align-content: center;
        gap: 5px;
        box-shadow: 7px 7px 8px 0px rgb(0 0 0 / 20%);
        justify-content: space-evenly;">
            <div style="cursor: pointer; display: flex; align-items: center;"><img class="mImgS" id="chat" width="30px" height="30px" src="/chat.png" alt=""></div>
            <div style="width: 3px; height: 30px; background-color: rgb(165, 165, 165); border-radius: 10px;"></div>
            <!--
            <div style="cursor: pointer; display: flex; align-items: center;"><img class="mImgS" id="deep" width="30px" height="30px" src="/deep.png" alt=""></div>
            <div style="width: 3px; height: 30px; background-color: rgb(165, 165, 165); border-radius: 10px;"></div>
            -->
            <div style="cursor: pointer; display: flex; align-items: center;"><img class="mImgS" id="youtybe" width="30px" height="30px" src="/you.png" alt=""></div>
        </div>
    </div>
  `);

document.getElementById('chat').onclick = openchat;
//document.getElementById('deep').onclick = opendeep;
document.getElementById('youtybe').onclick = openYouTybe;

document.getElementById('chat').src = chrome.runtime.getURL("chat.png");
//document.getElementById('deep').src = chrome.runtime.getURL("deep.png");
document.getElementById('youtybe').src = chrome.runtime.getURL("you.png");

let ball = document.getElementById('mBlock');
ball.style.left = localStorage.getItem("SearchImproveX") + 'px';
ball.style.top = localStorage.getItem("SearchImproveY") + 'px';

document.getElementById('move').onmousedown = function (event) {
  let ball = document.getElementById('mBlock');

  moveAt(event.pageX, event.pageY);

  function moveAt(pageX, pageY) {
    ball.style.left = pageX + 'px';
    ball.style.top = pageY + 'px';
  }

  function onMouseMove(event) {
    moveAt(event.pageX, event.pageY);
    window.lastX = event.pageX;
    window.lastY = event.pageY;
  }

  document.addEventListener('mousemove', onMouseMove);

  document.getElementById('move').onmouseup = function () {
    localStorage.setItem("SearchImproveX", window.lastX);
    localStorage.setItem("SearchImproveY", window.lastY);

    document.removeEventListener('mousemove', onMouseMove);
    document.getElementById('move').onmouseup = null;
  };

};