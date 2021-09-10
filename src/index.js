// JS Goes here - ES6 supported


/* Tabbed Content */
document.querySelectorAll('a[data-toggle="tab"]').forEach(item => {
  item.addEventListener('click', event => {
    event.preventDefault();
    const panel = item.closest('.tab_panel');
    panel.querySelectorAll('.active').forEach(item => {
      item.classList.remove('active');
    });
    document.getElementById(item.getAttribute("href").substring(1)).classList.add('active');
    item.classList.add('active');
  })
});


import "./css/main.scss";

// Say hello
console.log("🦊 Hello! Edit me in src/index.js");
